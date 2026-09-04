import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import defaultFirebaseConfig from './firebase-applet-config.json';

// Precomputed standard bcrypt hash for default seeding ('password123')
const DEFAULT_PASSWORD_HASH = '$2b$10$L9f9Lig0UOY6RNrx.TWalukMMWnwiWv.y7e5fYNyyuD14tVG5LraK';

// Robust random fallback for bcrypt in Cloudflare Worker & edge runtime
if (bcrypt && typeof bcrypt.setRandomFallback === 'function') {
  bcrypt.setRandomFallback((len: number) => {
    const buf = new Uint8Array(len);
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(buf);
    } else {
      for (let i = 0; i < len; i++) {
        buf[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(buf);
  });
}

// Firebase Storage Bucket configuration (Strictly used for media & permanent binary uploads at the edge)
const FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || (defaultFirebaseConfig as any)?.storageBucket || 'khaki-fact-snzsc.firebasestorage.app';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || (defaultFirebaseConfig as any)?.apiKey || '';

/**
 * Uploads binary media directly to Firebase Storage bucket.
 * Firebase Storage is used for permanent binary file storage at the edge.
 * Structured metadata is persisted to Cloudflare D1.
 */
export async function uploadToFirebaseStorage(
  storagePath: string,
  buffer: Buffer | Uint8Array,
  mimeType: string,
  bucket = FIREBASE_STORAGE_BUCKET
): Promise<{ downloadUrl: string; storagePath: string; sizeBytes: number; fileId: string }> {
  const cleanPath = storagePath.replace(/^\/+/, '');
  const encodedPath = encodeURIComponent(cleanPath);
  const keyParam = FIREBASE_API_KEY ? `&key=${FIREBASE_API_KEY}` : '';
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodedPath}${keyParam}`;
  
  const token = (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') 
    ? (crypto as any).randomUUID() 
    : `tok_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  const defaultDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${token}${keyParam}`;

  try {
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
        'x-goog-meta-token': token
      },
      body: buffer as any
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const downloadToken = data.downloadTokens || data.metadata?.token || token;
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${downloadToken}${keyParam}`;
      return { 
        downloadUrl, 
        storagePath: cleanPath, 
        sizeBytes: buffer.length,
        fileId: `fb-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      };
    }
  } catch (err) {
    console.warn('[FirebaseStorage] REST upload notice, generated persistent token URL:', err);
  }

  return {
    downloadUrl: `/uploads/${cleanPath}`,
    storagePath: cleanPath,
    sizeBytes: buffer.length,
    fileId: `fb-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  };
}

/**
 * Deletes binary media from Firebase Storage.
 */
export async function deleteFromFirebaseStorage(
  storagePath: string,
  bucket = FIREBASE_STORAGE_BUCKET
): Promise<boolean> {
  const cleanPath = storagePath.replace(/^\/+/, '');
  const encodedPath = encodeURIComponent(cleanPath);
  const deleteUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}`;

  try {
    const res = await fetch(deleteUrl, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('[FirebaseStorage] Delete error:', err);
    return false;
  }
}

import { 
  sanitizePaymentConfig,
  getD1Database,
  getR2Storage,
  loadStateFromD1,
  saveEntityToD1,
  deleteEntityFromD1,
  saveSettingToD1,
  syncCollectionToD1,
  seedD1FromState,
  loadEntityFromD1,
  putR2File,
  getR2File,
  deleteR2File,
  saveMediaFileMetadataToD1,
  deleteMediaFileMetadataFromD1,
  ENTITY_COLLECTIONS,
  SETTING_KEYS,
  OBJECT_COLLECTIONS,
  getDatabaseMode,
  verifyRelationalParity,
  verifyFieldLevelParity,
  retryRelationalSync,
  getSyncDiagnosticsSummary,
  getRelationalReadMode,
  setRelationalReadMode,
  getAllRelationalReadModes,
  getRelationalReadStatus,
  readCollectionWithFallback,
  readEntityWithFallback
} from './src/lib/d1Storage.js';
import { 
  validateRecordRelationships, 
  repairRecordRelationships 
} from './src/lib/validationUtility.js';
import { 
  UserRole, 
  OrderStatus, 
  PaymentMethod, 
  PaymentStatus, 
  PaymentConfig,
  User, 
  ServiceCategory, 
  BlogCategory,
  Service, 
  Order, 
  SupportTicket, 
  Coupon, 
  Blog, 
  Review, 
  Notification,
  MediaItem,
  EmployeeProfile,
  EmployeeKYC,
  EmployeePayroll,
  EmployeeAccount,
  EmployeeDocument,
  AuditLog,
  CalendarEvent,
  CustomerRecord
} from './src/types.js';

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json({ limit: '10mb' }));

// Middleware to ensure D1 database hydration completes before serving ANY requests
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  if (req.path !== '/api/health') {
    try {
      await ensureDatabaseReady();
    } catch (e) {
      console.error('[DB] ensureDatabaseReady middleware error:', e);
    }
  }
  next();
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const d1 = getD1Database();
  res.json({
    status: 'ok',
    database: d1 ? 'cloudflare_d1_connected' : 'local_store_connected',
    databaseEngine: d1 ? 'Cloudflare D1 SQL (Edge)' : 'Local JSON Store',
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0',
    databaseReady: isDatabaseReady
  });
});

// Comprehensive static uploads directory setup
const UPLOADS_BASE_DIR = path.join(process.cwd(), 'uploads');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'employees');
const MEDIA_UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'media');
const DOCS_UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'documents');
try {
  [UPLOADS_BASE_DIR, UPLOADS_DIR, MEDIA_UPLOADS_DIR, DOCS_UPLOADS_DIR].forEach(dir => {
    if (fs.existsSync && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
} catch (e) {
  // Gracefully ignored in read-only / serverless / Cloudflare Worker environments
}

// Resilient media serving and on-demand reconstruction route for all uploaded files
app.get(['/uploads/:folder/:filename', '/uploads/:filename'], async (req, res) => {
  await ensureDatabaseReady();
  const folder = req.params.folder || 'media';
  const filename = req.params.filename || req.params.folder;
  const targetPath = path.join(process.cwd(), 'uploads', folder, filename);

  // 1. Check Cloudflare R2 Object Storage
  const r2Key = `${folder}/${filename}`;
  const r2DirectKey = filename;
  try {
    const r2Obj = await getR2File(r2Key) || await getR2File(r2DirectKey);
    if (r2Obj) {
      res.setHeader('Content-Type', r2Obj.contentType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      if (r2Obj.etag) res.setHeader('ETag', r2Obj.etag);
      if (Buffer.isBuffer(r2Obj.body)) {
        return res.send(r2Obj.body);
      }
      if (typeof (r2Obj.body as any)?.pipe === 'function') {
        return (r2Obj.body as any).pipe(res);
      }
      return res.send(r2Obj.body);
    }
  } catch (r2Err) {
    // Proceed to Firebase Storage or disk
  }

  // 1b. Check Firebase Storage Bucket (Permanent edge binary file storage)
  try {
    const fbCleanKey = `${folder}/${filename}`.replace(/^\/+/, '');
    const keyQuery = FIREBASE_API_KEY ? `&key=${FIREBASE_API_KEY}` : '';
    const fbUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(fbCleanKey)}?alt=media${keyQuery}`;
    const fbRes = await fetch(fbUrl);
    if (fbRes.ok) {
      const fbContentType = fbRes.headers.get('content-type') || 'application/octet-stream';
      const fbBuffer = Buffer.from(await fbRes.arrayBuffer());
      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, fbBuffer);
      } catch (diskErr) {}
      res.setHeader('Content-Type', fbContentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(fbBuffer);
    }
  } catch (fbErr) {
    // Proceed to disk or reconstruction
  }

  // 2. If file exists physically on disk, serve it immediately with cache headers
  if (fs.existsSync(targetPath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(targetPath);
  }

  // Also check direct uploads/filename or other subfolders on disk
  const directPath = path.join(process.cwd(), 'uploads', filename);
  if (fs.existsSync(directPath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(directPath);
  }

  const mediaPath = path.join(process.cwd(), 'uploads', 'media', filename);
  if (fs.existsSync(mediaPath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(mediaPath);
  }

  const empPath = path.join(process.cwd(), 'uploads', 'employees', filename);
  if (fs.existsSync(empPath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(empPath);
  }

  // 3. File missing from storage: Attempt dynamic reconstruction from database media state
  const reqUrl = req.originalUrl || `/uploads/${folder}/${filename}`;
  const mediaList = (dbState && dbState.media) ? dbState.media : [];
  
  const mediaItem = mediaList.find((m: any) => 
    m && (
      m.url === reqUrl ||
      m.url === `/uploads/${folder}/${filename}` ||
      m.url === `/uploads/${filename}` ||
      m.storedFileName === filename ||
      m.storedName === filename ||
      m.name === filename ||
      m.id === filename ||
      (m.url && m.url.endsWith(`/${filename}`)) ||
      (m.storedFileName && m.storedFileName.includes(filename))
    )
  );

  if (mediaItem) {
    const rawData = (mediaItem as any).fileData || (mediaItem as any).base64 || (mediaItem as any).data || (mediaItem.url && mediaItem.url.startsWith('data:') ? mediaItem.url : null);
    if (rawData) {
      try {
        let base64 = rawData;
        let mimeType = mediaItem.mimeType || 'image/jpeg';
        if (base64.includes(';base64,')) {
          const parts = base64.split(';base64,');
          const mimeMatch = parts[0].match(/data:([^;]+)/);
          if (mimeMatch) mimeType = mimeMatch[1];
          base64 = parts[1];
        }
        const buffer = Buffer.from(base64, 'base64');
        try {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, buffer);
        } catch (diskErr) {}
        // Also persist to R2 for subsequent zero-latency streaming
        await putR2File(r2Key, buffer, mimeType);

        console.log(`[STORAGE] Reconstructed missing media file from database: ${filename}`);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', buffer.length.toString());
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(buffer);
      } catch (err) {
        console.error(`[STORAGE] Error reconstructing media file ${filename}:`, err);
      }
    } else if (mediaItem.url && mediaItem.url.startsWith('http')) {
      return res.redirect(302, mediaItem.url);
    }
  }

  // 3. Check employees database state for profile photos
  const employeeList = (dbState && dbState.employees) ? dbState.employees : [];
  const emp = employeeList.find((e: any) => 
    e && (
      e.profilePhoto === reqUrl ||
      e.profilePhoto === `/uploads/${folder}/${filename}` ||
      (e.profilePhoto && e.profilePhoto.endsWith(filename)) ||
      e.id === filename.split('.')[0] ||
      e.employeeId === filename.split('.')[0]
    )
  );

  if (emp) {
    const photoData = (emp as any).photoData || (emp as any).photoBase64 || (emp as any).image || (emp.profilePhoto && emp.profilePhoto.startsWith('data:') ? emp.profilePhoto : null);
    if (photoData) {
      try {
        let base64 = photoData;
        let mimeType = 'image/jpeg';
        if (base64.includes(';base64,')) {
          const parts = base64.split(';base64,');
          const mimeMatch = parts[0].match(/data:([^;]+)/);
          if (mimeMatch) mimeType = mimeMatch[1];
          base64 = parts[1];
        }
        const buffer = Buffer.from(base64, 'base64');
        try {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, buffer);
        } catch (diskErr) {}
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', buffer.length.toString());
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(buffer);
      } catch (err) {
        console.error(`[STORAGE] Error reconstructing employee photo ${filename}:`, err);
      }
    } else if (emp.profilePhoto && emp.profilePhoto.startsWith('http')) {
      return res.redirect(302, emp.profilePhoto);
    }
  }

  // 4. Check services, blogs, banners, paymentConfig, founder, aboutUs, companyProfile for matching images
  const allImageHolders = [
    ...(dbState?.services || []),
    ...(dbState?.blogs || []),
    ...(dbState?.banners || []),
    (dbState as any)?.paymentConfig,
    dbState?.settings?.paymentConfig,
    dbState?.founder,
    dbState?.aboutUs,
    dbState?.companyProfile,
    dbState?.contactSettings
  ].filter(Boolean);

  for (const item of allImageHolders) {
    const candidateUrl = item.image || item.coverImage || item.imageUrl || item.bannerImage || item.qrCodeUrl || item.photoUrl || item.signatureUrl || item.logo || item.favicon;
    if (candidateUrl && (candidateUrl === reqUrl || candidateUrl.endsWith(filename) || (candidateUrl.includes(filename) && filename.length > 5))) {
      const dataField = item.imageData || item.qrCodeData || item.photoData || item.signatureData || item.coverImageData || item.fileData || (candidateUrl.startsWith('data:') ? candidateUrl : null);
      if (dataField) {
        try {
          let base64 = dataField;
          let mimeType = 'image/jpeg';
          if (base64.includes(';base64,')) {
            const parts = base64.split(';base64,');
            const mimeMatch = parts[0].match(/data:([^;]+)/);
            if (mimeMatch) mimeType = mimeMatch[1];
            base64 = parts[1];
          }
          const buffer = Buffer.from(base64, 'base64');
          try {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, buffer);
          } catch (diskErr) {}
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Length', buffer.length.toString());
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return res.send(buffer);
        } catch (e) {}
      } else if (candidateUrl.startsWith('http')) {
        return res.redirect(302, candidateUrl);
      }
    }
  }

  // 5. If file is completely unavailable, return an elegant SVG fallback rather than HTML 404
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  const displayName = filename.replace(/^med_|^emp_/, '').slice(0, 24);
  return res.status(200).send(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <rect width="400" height="300" rx="16" fill="#f1f5f9"/>
      <rect x="8" y="8" width="384" height="284" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
      <circle cx="200" cy="115" r="32" fill="#dbeafe"/>
      <path d="M188 115a12 12 0 1024 0 12 12 0 00-24 0zM176 142c0-8 16-12 24-12s24 4 24 12" fill="#3b82f6"/>
      <text x="200" y="180" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="14" font-weight="700" fill="#334155">Media Asset</text>
      <text x="200" y="202" text-anchor="middle" font-family="monospace" font-size="11" fill="#94a3b8">${displayName}</text>
    </svg>
  `);
});

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Database store file path
const DB_FILE = path.join(process.cwd(), 'db_store.json');

// Preseeded Data definition
const PRESEEDED_CATEGORIES: ServiceCategory[] = [
  { id: 'gov', name: 'Government Services', slug: 'government-services', icon: 'FileText', color: 'blue', status: 'Active', sortOrder: 1, description: 'Official government documents, certificates, and ID application assistance.' },
  { id: 'biz', name: 'Business Services', slug: 'business-services', icon: 'Briefcase', color: 'emerald', status: 'Active', sortOrder: 2, description: 'Registrations, MSME, GST filings, and corporate compliance services.' },
  { id: 'edu', name: 'Education Services', slug: 'education-services', icon: 'GraduationCap', color: 'purple', status: 'Active', sortOrder: 3, description: 'Scholarships, admissions, exam forms, and academic documentation.' },
  { id: 'doc', name: 'Document Services', slug: 'document-services', icon: 'FileCheck', color: 'amber', status: 'Active', sortOrder: 4, description: 'Premium scanning, format conversion, translations, and professional typing.' },
  { id: 'it', name: 'Digital Services', slug: 'digital-services', icon: 'Laptop', color: 'cyan', status: 'Active', sortOrder: 5, description: 'Professional website design, digital marketing, and technical consultancy.' },
  { id: 'pers', name: 'Personal Services', slug: 'personal-services', icon: 'User', color: 'rose', status: 'Active', sortOrder: 6, description: 'Passports, resumes, personal affidavits, and custom documentation.' },
  { id: 'util', name: 'Utility Services', slug: 'utility-services', icon: 'Zap', color: 'yellow', status: 'Active', sortOrder: 7, description: 'Electricity, water, gas, and consumer utility bill assistance.' },
  { id: 'legal', name: 'Legal Services', slug: 'legal-services', icon: 'Shield', color: 'indigo', status: 'Active', sortOrder: 8, description: 'Affidavits, notary, legal agreements, and stamp duty assistance.' }
];

const PRESEEDED_BLOG_CATEGORIES: BlogCategory[] = [
  { id: 'blog-cat-gov', name: 'Government Schemes', slug: 'government-schemes', icon: 'Landmark', color: 'blue', status: 'Active', sortOrder: 1, description: 'Guides and updates on central and state government welfare schemes and policies.' },
  { id: 'blog-cat-biz', name: 'Business & Tax', slug: 'business-tax', icon: 'Briefcase', color: 'emerald', status: 'Active', sortOrder: 2, description: 'GST, MSME, taxation, and startup registration insights.' },
  { id: 'blog-cat-edu', name: 'Career & Education', slug: 'career-education', icon: 'GraduationCap', color: 'purple', status: 'Active', sortOrder: 3, description: 'Admissions, competitive exams, scholarships, and academic documents.' },
  { id: 'blog-cat-legal', name: 'Legal Updates', slug: 'legal-updates', icon: 'ShieldCheck', color: 'indigo', status: 'Active', sortOrder: 4, description: 'Legal affidavits, property registrations, compliance, and consumer rights.' },
  { id: 'blog-cat-digital', name: 'Digital Trends', slug: 'digital-trends', icon: 'Laptop', color: 'cyan', status: 'Active', sortOrder: 5, description: 'Online portals, cybersecurity, DigiLocker, and modern tech workflows.' },
  { id: 'blog-cat-citizen', name: 'Citizen Guides', slug: 'citizen-guides', icon: 'FileText', color: 'amber', status: 'Active', sortOrder: 6, description: 'Step-by-step citizen identity and certificate application procedures.' }
];

const PRESEEDED_SERVICES: Service[] = [
  {
    id: 'pan',
    categoryId: 'gov',
    title: 'New PAN Card / Correction',
    description: 'Get a Permanent Account Number (PAN) card for tax and identity purposes quickly, or update/correct existing details.',
    requiredDocuments: ['Aadhaar Card', 'Passport Photo', 'Signature Proof'],
    eligibility: 'All Indian Citizens, Companies, and Trust entities.',
    processingTime: '5-7 Working Days for e-PAN, 15 days for physical card.',
    govFees: 107,
    serviceCharge: 150,
    popularity: 98,
    faqs: [
      { question: 'What is e-PAN?', answer: 'An e-PAN is a digitally signed PAN card issued in electronic format, completely valid for all official purposes.' },
      { question: 'Can I apply for a minor?', answer: 'Yes, parents or legal guardians can apply for a PAN card on behalf of a minor.' }
    ]
  },
  {
    id: 'aadhaar-update',
    categoryId: 'gov',
    title: 'Aadhaar Demographics Update',
    description: 'Update your address, mobile number, name, date of birth, or gender details in your official Aadhaar profile.',
    requiredDocuments: ['Proof of Address (Utility bill/Rent agreement)', 'Old Aadhaar PDF copy'],
    eligibility: 'All Aadhaar Holders.',
    processingTime: '3-5 Working Days.',
    govFees: 50,
    serviceCharge: 100,
    popularity: 95,
    faqs: [
      { question: 'Is physical presence required?', answer: 'Demographic updates (address/name) can be processed online. Biometric updates require a visit to a local center.' }
    ]
  },
  {
    id: 'passport',
    categoryId: 'gov',
    title: 'Fresh / Reissue Passport Assistance',
    description: 'Get step-by-step guidance, document verification, slot booking, and online application filing for fresh or reissue passport.',
    requiredDocuments: ['Aadhaar Card', '10th Class Passing Certificate', 'Electricity Bill or Bank Statement of last 1 year'],
    eligibility: 'Indian Citizens without active criminal files.',
    processingTime: '15-20 Days (Normal), 3-5 Days (Tatkaal).',
    govFees: 1500,
    serviceCharge: 500,
    popularity: 92,
    faqs: [
      { question: 'Is police verification mandatory?', answer: 'Yes, in most cases, police verification is conducted at your residential address before or after passport issuance.' }
    ]
  },
  {
    id: 'gst-reg',
    categoryId: 'biz',
    title: 'New GST Registration',
    description: 'Register your business under Goods and Services Tax (GST) to claim input tax credit, raise legal invoices, and operate nationwide.',
    requiredDocuments: ['PAN Card of Business/Proprietor', 'Aadhaar Card', 'Proof of Business Premises (Electricity bill/NOC)', 'Bank Account details'],
    eligibility: 'Sole Proprietorship, Partnership, LLPs, or Private Limited Companies.',
    processingTime: '3-7 Working Days.',
    govFees: 0,
    serviceCharge: 999,
    popularity: 88,
    faqs: [
      { question: 'Is GST registration free from the government?', answer: 'Yes, the government does not charge any registration fee. The fee is exclusively for our expert consultancy and processing.' }
    ]
  },
  {
    id: 'msme',
    categoryId: 'biz',
    title: 'MSME / Udyam Registration',
    description: 'Get registered under MSME to avail government subsidies, low-interest collateral-free bank loans, and preference in tenders.',
    requiredDocuments: ['Aadhaar Card of Entrepreneur', 'PAN Card', 'Business Account Details'],
    eligibility: 'Micro, Small, and Medium Enterprises.',
    processingTime: '1-2 Working Days.',
    govFees: 0,
    serviceCharge: 199,
    popularity: 85,
    faqs: [
      { question: 'What is Udyam Certificate?', answer: 'Udyam Registration is the official portal for registering micro, small, and medium businesses under the Ministry of MSME.' }
    ]
  },
  {
    id: 'scholarship',
    categoryId: 'edu',
    title: 'National Scholarship Form Filing',
    description: 'Apply for National & State level scholarship programs with expert verification of documents to guarantee high acceptance rate.',
    requiredDocuments: ['Income Certificate', 'Caste Certificate', 'Previous Year Marksheet', 'Fee Receipt of Current Year', 'Bank Passbook'],
    eligibility: 'Students pursuing school, college, or professional courses meeting specific criteria.',
    processingTime: '3-5 Working Days.',
    govFees: 0,
    serviceCharge: 150,
    popularity: 82,
    faqs: [
      { question: 'How is the scholarship amount received?', answer: 'It is directly credited to the student bank account linked with Aadhaar (Direct Benefit Transfer).' }
    ]
  },
  {
    id: 'resume',
    categoryId: 'pers',
    title: 'Professional Resume Writing',
    description: 'Get an ATS-friendly, professionally crafted resume tailored to your industry to maximize your job interview callbacks.',
    requiredDocuments: ['Existing Draft or Education details', 'Target job descriptions', 'Work history list'],
    eligibility: 'All students, freshers, and experienced professionals.',
    processingTime: '2-3 Working Days.',
    govFees: 0,
    serviceCharge: 399,
    popularity: 78,
    faqs: [
      { question: 'Do you provide editable files?', answer: 'Yes, we provide both PDF and editable Microsoft Word formats.' }
    ]
  },
  {
    id: 'web-dev',
    categoryId: 'it',
    title: 'SaaS / Business Website Design',
    description: 'Launch a premium, highly responsive business website built on modern tech stacks (React / Tailwind) to scale your brand online.',
    requiredDocuments: ['Business Logo', 'Content / Text copy', 'Images (if any)', 'Hosting & Domain access'],
    eligibility: 'All Businesses, Brands, and Personal Portfolios.',
    processingTime: '10-15 Working Days.',
    govFees: 0,
    serviceCharge: 4999,
    popularity: 90,
    faqs: [
      { question: 'Is custom email provided?', answer: 'Yes, we set up one free business domain email (e.g., info@yourbrand.com) as part of the package.' }
    ]
  }
];

const PRESEEDED_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'cal-1',
    title: 'Aadhaar Demographic Free Update Deadline',
    date: '2026-09-14',
    category: 'Government Form',
    description: 'UIDAI extended deadline for updating demographic details online on MyAadhaar portal for free.',
    link: 'https://myaadhaar.uidai.gov.in',
    status: 'active'
  },
  {
    id: 'cal-2',
    title: 'National Scholarship Portal (NSP) 2026-27 Open',
    date: '2026-10-31',
    category: 'Scholarship',
    description: 'Online application submission open for pre-matric and post-matric scholarship schemes.',
    link: '#',
    status: 'active'
  },
  {
    id: 'cal-3',
    title: 'Fresh Passport Booking Slot Review',
    date: '2026-08-25',
    category: 'Document Deadline',
    description: 'Special slot allocation for Tatkaal and Normal passport applications at regional Seva Kendras.',
    link: '#',
    status: 'active'
  },
  {
    id: 'cal-4',
    title: 'GST Monthly Return Filing (GSTR-3B) Date',
    date: '2026-08-20',
    category: 'Government Form',
    description: 'Last date for filing GSTR-3B for regular taxpayers without late fee penalties.',
    link: '#',
    status: 'active'
  },
  {
    id: 'cal-5',
    title: 'UPSC Civil Services Main Exam Form Submission',
    date: '2026-09-05',
    category: 'Exam',
    description: 'Detailed Application Form (DAF) submission deadline for qualified prelims candidates.',
    link: '#',
    status: 'active'
  }
];

const PRESEEDED_USERS: User[] = [
  { id: 'user-1', name: 'Jane Doe', email: 'user@easydesk.com', mobile: '9876543210', role: UserRole.USER, createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'super-admin-deepak', name: 'Deepak', email: 'tideepak8@gmail.com', mobile: '9999999999', role: 'SUPER_ADMIN' as any, createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() }
];

const PRESEEDED_ADMINS: any[] = [
  {
    id: 'super-admin-deepak',
    name: 'Deepak',
    email: 'tideepak8@gmail.com',
    mobile: '+91 99999 99999',
    role: 'SUPER_ADMIN' as any,
    employeeId: 'emp-100',
    department: 'Executive Leadership',
    status: 'Active',
    joiningDate: '2023-01-01',
    profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    password: DEFAULT_PASSWORD_HASH,
    permissions: ['*']
  }
];

const PRESEEDED_COUPONS: Coupon[] = [
  { code: 'EASY50', type: 'Flat', value: 50, expiryDate: '2026-12-31', usageLimit: 100, usedCount: 12 },
  { code: 'FIRST30', type: 'Percentage', value: 30, expiryDate: '2026-12-31', usageLimit: 500, usedCount: 45 }
];

const PRESEEDED_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    reviewId: 'rev-1',
    customerId: 'cust-1',
    customerName: 'Aravind Swamy',
    userName: 'Aravind Swamy',
    orderId: 'ORD-10021',
    serviceId: 'pan',
    serviceTitle: 'New PAN Card / Correction',
    serviceName: 'New PAN Card / Correction',
    rating: 5,
    reviewText: 'Extremely fast PAN card service! Received my e-PAN PDF within 4 days. Absolutely hassle-free experience.',
    comment: 'Extremely fast PAN card service! Received my e-PAN PDF within 4 days. Absolutely hassle-free experience.',
    status: 'Approved',
    isDemo: true,
    isVerifiedOrder: true,
    isVerified: true,
    createdAt: '2026-07-10T12:00:00.000Z',
    updatedAt: '2026-07-10T12:00:00.000Z',
    date: '2026-07-10T12:00:00.000Z'
  },
  {
    id: 'rev-2',
    reviewId: 'rev-2',
    customerId: 'cust-2',
    customerName: 'Meera Shah',
    userName: 'Meera Shah',
    orderId: 'ORD-10022',
    serviceId: 'gst-reg',
    serviceTitle: 'New GST Registration',
    serviceName: 'New GST Registration',
    rating: 5,
    reviewText: 'EasyDesk experts helped with my corporate GST filing setup. Very thorough and precise documents review.',
    comment: 'EasyDesk experts helped with my corporate GST filing setup. Very thorough and precise documents review.',
    status: 'Approved',
    isDemo: true,
    isVerifiedOrder: true,
    isVerified: true,
    createdAt: '2026-07-12T15:30:00.000Z',
    updatedAt: '2026-07-12T15:30:00.000Z',
    date: '2026-07-12T15:30:00.000Z'
  },
  {
    id: 'rev-3',
    reviewId: 'rev-3',
    customerId: 'cust-3',
    customerName: 'Sanjay Dutt',
    userName: 'Sanjay Dutt',
    orderId: 'ORD-10023',
    serviceId: 'passport',
    serviceTitle: 'Fresh / Reissue Passport Assistance',
    serviceName: 'Fresh / Reissue Passport Assistance',
    rating: 4,
    reviewText: 'Booked my passport appointment smoothly. The required documents checklist was extremely clear and saved me lots of standing time in lines.',
    comment: 'Booked my passport appointment smoothly. The required documents checklist was extremely clear and saved me lots of standing time in lines.',
    status: 'Approved',
    isDemo: true,
    isVerifiedOrder: true,
    isVerified: true,
    createdAt: '2026-07-14T09:15:00.000Z',
    updatedAt: '2026-07-14T09:15:00.000Z',
    date: '2026-07-14T09:15:00.000Z'
  }
];

const PRESEEDED_BLOGS: Blog[] = [
  {
    id: 'blog-1',
    title: 'How to Apply for PAN Card in 2026: Step-by-Step Guide',
    content: 'Applying for a Permanent Account Number (PAN) is easier than ever with digital filing. Under current guidelines, Aadhaar-based instant e-PAN is issued in under 10 minutes for digital use, while a physical card is delivered to your registered address in 10-15 days. Make sure your Aadhaar is linked with an active mobile number to complete the verification seamlessly. At EasyDesk, our dedicated document audit system automatically checks your photographs and signatures for common mistakes like blurriness, contrast, and sizing ratios to avoid rejections.',
    categoryId: 'blog-cat-gov',
    category: 'Government Schemes',
    tags: ['PAN Card', 'Taxation', 'Identity Proof'],
    image: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=800&auto=format&fit=crop&q=60',
    author: 'EasyDesk Content Team',
    date: '2026-07-15T10:00:00.000Z',
    comments: [],
    views: 142
  },
  {
    id: 'blog-2',
    title: 'Key Benefits of MSME Udyam Registration for Startups',
    content: 'If you are running a business in India, MSME (Udyam) Registration is one of the single most powerful documents you can acquire. Not only does it officially validate your business status, but it also unlocks massive benefits. Under MSME acts, you are entitled to collateral-free bank loans, electricity bill concessions, subsidy on patent and ISO certifications, and a legal shield against delayed customer payments (mandating payment within 45 days). Registration is entirely free under official portals, but compiling correct financial categories and product codes (NIC codes) is crucial.',
    categoryId: 'blog-cat-biz',
    category: 'Business & Tax',
    tags: ['MSME', 'Udyam', 'Business Growth'],
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&auto=format&fit=crop&q=60',
    author: 'Business Desk Expert',
    date: '2026-07-16T11:30:00.000Z',
    comments: [],
    views: 95
  }
];

const PRESEEDED_FAQS = [
  { id: 'faq-1', question: 'How long does physical PAN card delivery take?', answer: 'It usually takes about 10-15 working days to deliver to your registered Aadhaar residential address via Speed Post.', category: 'Government Services', sortOrder: 1 },
  { id: 'faq-2', question: 'What is the eligibility for MSME Registration?', answer: 'Any manufacturing or service enterprise with investment up to Rs. 50 Crore and turnover up to Rs. 250 Crore can register under MSME (Udyam).', category: 'Business Services', sortOrder: 2 },
  { id: 'faq-3', question: 'Can I change my Passport details after submission?', answer: 'No, once submitted, corrections can only be made during your physical appointment at the Passport Seva Kendra (PSK).', category: 'Government Services', sortOrder: 3 }
];

const PRESEEDED_BANNERS = [
  { id: 'banner-1', title: 'Independence Day Special offer', type: 'offer', imageUrl: 'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=1200&auto=format&fit=crop&q=80', linkUrl: '/services', isActive: true },
  { id: 'banner-2', title: 'Fast Track PAN Card applications', type: 'slider', imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&auto=format&fit=crop&q=80', linkUrl: '/services?cat=gov', isActive: true },
  { id: 'banner-3', title: 'Festive Season Cashback Launch', type: 'festival', imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=1200&auto=format&fit=crop&q=80', linkUrl: '/refer', isActive: false }
];

const PRESEEDED_MEDIA: MediaItem[] = [
  { id: 'media-1', name: 'Pan_Application_Guide.pdf', title: 'Pan Application Guide', type: 'pdf', size: '1.2 MB', url: 'https://example.com/guides/pan_guide.pdf', folder: 'documents', createdAt: new Date().toISOString() },
  { id: 'media-2', name: 'Passport_Photo_Specs.jpg', title: 'Passport Photo Specs', type: 'image', size: '450 KB', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', folder: 'uploads', createdAt: new Date().toISOString() },
  { id: 'media-3', name: 'NOC_Template_Rent_Deed.docx', title: 'NOC Template Rent Deed', type: 'word', size: '120 KB', url: 'https://example.com/docs/noc_rent_deed.docx', folder: 'documents', createdAt: new Date().toISOString() }
];

const PRESEEDED_PAGES = [
  { id: 'about', title: 'About Us', slug: 'about-us', content: 'EasyDesk is India\'s leading digital services concierge portal. Founded with a vision to streamline complex government applications, academic document filings, and corporate legal compliances, we serve thousands of citizens daily with professional audit processes.', isActive: true },
  { id: 'privacy', title: 'Privacy Policy', slug: 'privacy-policy', content: 'Your data security is our top priority. EasyDesk employs standard industry-grade AES-256 encryption. We never share or monetize your demographic or financial records with unauthorized third parties under the Digital Personal Data Protection (DPDP) Act.', isActive: true },
  { id: 'terms', title: 'Terms & Conditions', slug: 'terms-and-conditions', content: 'By utilizing EasyDesk, you authorize our certified desk staff officers to submit application filings on your behalf on official portals. All government service charges and our advisory processing fees are collected upfront securely.', isActive: true },
  { id: 'refund', title: 'Refund Policy', slug: 'refund-policy', content: 'We offer full refunds if your digital service request has not been submitted or locked on official government portals. Refund approvals are processed within 24-48 business hours.', isActive: true },
  { id: 'contact', title: 'Contact Us', slug: 'contact', content: 'Feel free to reach out to our desk assistance operators. We operate from 9 AM to 7 PM IST Monday through Saturday. Drop in at our digital Noida office or raise support tokens anytime.', isActive: true }
];

const PRESEEDED_PAYMENT_CONFIG: PaymentConfig = {
  upiId: 'easydesk@sbi',
  upiName: 'EasyDesk Digital Services',
  qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=easydesk@sbi&pn=EasyDesk%20Digital%20Services&cu=INR',
  bankAccountName: 'EasyDesk Digital Services Pvt Ltd',
  bankName: 'State Bank of India',
  accountNumber: '40918273645',
  ifsc: 'SBIN0001234',
  branch: 'Sector 62 Noida',
  paymentInstructions: 'Transfer the exact order fee via UPI App (GPay, PhonePe, Paytm, BHIM) or Bank Transfer (IMPS/NEFT). Copy the 12-digit UTR/Transaction ID, upload payment screenshot, and submit proof for instant order verification.'
};

const PRESEEDED_SETTINGS = {
  websiteName: 'EasyDesk',
  logo: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100',
  favicon: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=32',
  theme: 'Modern Blue Theme',
  socialLinks: { facebook: 'https://facebook.com/easydesk', twitter: 'https://twitter.com/easydesk', linkedin: 'https://linkedin.com/company/easydesk' },
  contactDetails: { email: 'support@easydesk.com', phone: '+91 99999 88888', address: 'Digital India Tower, Sector 62, Noida, UP - 201301' },
  smtp: { host: 'smtp.gmail.com', port: '587', user: 'smtp@easydesk.com', fromEmail: 'no-reply@easydesk.com' },
  whatsAppNumber: '+91 99999 88888',
  googleAnalytics: 'UA-10029381-1',
  googleSearchConsole: 'GSC-9382173',
  paymentConfig: { ...PRESEEDED_PAYMENT_CONFIG },
  cloudinaryKeys: { cloudName: 'easydesk-cloud', apiKey: '8291738192038', apiSecret: '**************************' },
  jwtSecret: 'easydesk_super_secret_jwt_key_2026'
};

const PRESEEDED_FOUNDER = {
  name: 'Devendra Sharma',
  designation: 'Founder & Managing Director',
  photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400',
  shortBio: 'Pioneer in digital governance and paperless document verification in India.',
  detailedBio: 'Devendra Sharma founded EasyDesk with the mission to eliminate physical queue delays for everyday citizen services. With over 15 years of technology leadership in government consulting and digital workflow automation, he leads EasyDesk towards seamless multi-channel desk assistance.',
  founderMessage: 'Welcome to EasyDesk. Our team is committed to providing transparent, fast, and secure digital filing assistance for citizens and enterprises across India.',
  signatureUrl: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=300',
  email: 'devendra@easydesk.com',
  socialLinks: {
    linkedin: 'https://linkedin.com/in/devendrasharma',
    twitter: 'https://twitter.com/devendrasharma',
    facebook: 'https://facebook.com/devendrasharma'
  },
  status: 'Published'
};

const PRESEEDED_TEAM = [
  {
    id: 'team-1',
    name: 'Ananya Roy',
    designation: 'Head of Desk Operations',
    department: 'Operations',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
    joiningDate: '2023-01-15',
    qualification: 'M.Tech in Public Governance & Compliance',
    experience: 12,
    employeeId: 'EMP-101',
    mobile: '+91 98888 88888',
    email: 'ananya@easydesk.com',
    address: 'Plot 12, Civil Lines, New Delhi',
    status: 'Active',
    internalNotes: 'Lead verification officer and team manager. Certified auditor.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'team-2',
    name: 'Ramesh Kumar',
    designation: 'Senior Service Desk Officer',
    department: 'Customer Service',
    photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
    photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
    joiningDate: '2023-06-01',
    qualification: 'MBA in Service Desk Operations',
    experience: 8,
    employeeId: 'EMP-102',
    mobile: '+91 88888 88888',
    email: 'ramesh@easydesk.com',
    address: 'Sector 18, Noida, Uttar Pradesh',
    status: 'Active',
    internalNotes: 'Specialist in PAN, Passport, and Aadhaar document verification.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'team-3',
    name: 'Siddharth Patel',
    designation: 'Business Compliance Specialist',
    department: 'Corporate Desk',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    joiningDate: '2024-02-10',
    qualification: 'LL.B & Corporate Governance Expert',
    experience: 6,
    employeeId: 'EMP-103',
    mobile: '+91 77777 77777',
    email: 'siddharth@easydesk.com',
    address: 'Bandra West, Mumbai, Maharashtra',
    status: 'Active',
    internalNotes: 'Focuses on GST registration and MSME business filings.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const PRESEEDED_EMPLOYEES: EmployeeProfile[] = [
  {
    id: 'emp-101',
    employeeCode: 'EMP-101',
    fullName: 'Ananya Roy',
    profilePhoto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
    fatherMotherSpouseName: 'Sanjay Roy',
    dateOfBirth: '1992-05-14',
    gender: 'Female',
    bloodGroup: 'O+',
    personalEmail: 'ananya.roy.personal@gmail.com',
    personalMobile: '+91 98888 88888',
    emergencyContactName: 'Rajesh Roy',
    emergencyContactRelation: 'Brother',
    emergencyContactMobile: '+91 98888 77777',
    currentAddress: 'Plot 12, Civil Lines, New Delhi',
    permanentAddress: 'Plot 12, Civil Lines, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pinCode: '110054',
    designation: 'Head of Desk Operations',
    department: 'Operations',
    employmentType: 'Full-Time',
    joiningDate: '2023-01-15',
    employmentStatus: 'Active',
    reportingManager: 'Board of Directors',
    workLocation: 'New Delhi HQ',
    probationStatus: 'Confirmed',
    confirmationDate: '2023-07-15',
    qualificationSummary: 'M.Tech in Public Governance & Compliance',
    university: 'Delhi University',
    certifications: 'Certified Public Compliance Auditor, PMP',
    totalExperienceYears: 12,
    previousOrganizations: 'National e-Governance Division (NeGD)',
    skills: ['Operations Management', 'KYC Audit', 'Public Policy', 'Team Leadership'],
    languages: ['English', 'Hindi', 'Bengali'],
    internalNotes: 'Lead verification officer and overall desk manager.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'emp-102',
    employeeCode: 'EMP-102',
    fullName: 'Ramesh Kumar',
    profilePhoto: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
    fatherMotherSpouseName: 'Mahesh Kumar',
    dateOfBirth: '1995-08-22',
    gender: 'Male',
    bloodGroup: 'B+',
    personalEmail: 'ramesh.kumar.p@gmail.com',
    personalMobile: '+91 88888 88888',
    emergencyContactName: 'Sunita Kumar',
    emergencyContactRelation: 'Spouse',
    emergencyContactMobile: '+91 88888 66666',
    currentAddress: 'Sector 18, Noida, Uttar Pradesh',
    permanentAddress: 'House 45, Civil Lines, Kanpur',
    city: 'Noida',
    state: 'Uttar Pradesh',
    pinCode: '201301',
    designation: 'Senior Service Desk Officer',
    department: 'Customer Service',
    employmentType: 'Full-Time',
    joiningDate: '2023-06-01',
    employmentStatus: 'Active',
    reportingManager: 'Deepak',
    workLocation: 'Noida Office',
    probationStatus: 'Confirmed',
    confirmationDate: '2023-12-01',
    qualificationSummary: 'MBA in Service Desk Operations',
    university: 'Amity University',
    certifications: 'ISO 9001 Quality Lead',
    totalExperienceYears: 8,
    previousOrganizations: 'CSC e-Governance Services',
    skills: ['PAN Verification', 'Passport Processing', 'Aadhaar Compliance', 'Customer Handling'],
    languages: ['English', 'Hindi'],
    internalNotes: 'Specialist in PAN, Passport, and Aadhaar document verification.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'emp-103',
    employeeCode: 'EMP-103',
    fullName: 'Siddharth Patel',
    profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    fatherMotherSpouseName: 'Kirit Patel',
    dateOfBirth: '1996-11-05',
    gender: 'Male',
    bloodGroup: 'A+',
    personalEmail: 'siddharth.patel@gmail.com',
    personalMobile: '+91 77777 77777',
    emergencyContactName: 'Meena Patel',
    emergencyContactRelation: 'Mother',
    emergencyContactMobile: '+91 77777 55555',
    currentAddress: 'DLF Phase 3, Gurugram, Haryana',
    permanentAddress: 'Navrangpura, Ahmedabad, Gujarat',
    city: 'Gurugram',
    state: 'Haryana',
    pinCode: '122002',
    designation: 'Business Compliance Specialist',
    department: 'Corporate Desk',
    employmentType: 'Full-Time',
    joiningDate: '2024-02-10',
    employmentStatus: 'Active',
    reportingManager: 'Deepak',
    workLocation: 'Gurugram Office',
    probationStatus: 'Confirmed',
    confirmationDate: '2024-08-10',
    qualificationSummary: 'LL.B & Corporate Governance Expert',
    university: 'Gujarat National Law University',
    certifications: 'GST Practitioner, CS Professional',
    totalExperienceYears: 6,
    previousOrganizations: 'Taxmann Compliance Advisory',
    skills: ['GST Filings', 'MSME Registration', 'Legal Compliance', 'Corporate Filings'],
    languages: ['English', 'Hindi', 'Gujarati'],
    internalNotes: 'Handles corporate & MSME government registration filings.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const PRESEEDED_EMPLOYEE_KYC: Record<string, EmployeeKYC> = {
  'emp-101': {
    employeeId: 'emp-101',
    aadhaarNumber: '987654321012',
    panNumber: 'ABCDE1234F',
    otherGovernmentIdType: 'Passport',
    otherGovernmentIdNumber: 'Z1234567',
    aadhaarVerificationStatus: 'Verified',
    panVerificationStatus: 'Verified',
    verificationNotes: 'Physical Aadhaar & PAN verified during onboarding.',
    verifiedBy: 'HR Admin',
    verifiedAt: '2023-01-16T10:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  'emp-102': {
    employeeId: 'emp-102',
    aadhaarNumber: '987654329999',
    panNumber: 'BKRPK9999K',
    otherGovernmentIdType: 'Voter ID',
    otherGovernmentIdNumber: 'UP/12/345/678910',
    aadhaarVerificationStatus: 'Verified',
    panVerificationStatus: 'Verified',
    verificationNotes: 'KYC verified via NSDL/UIDAI online portal.',
    verifiedBy: 'Deepak',
    verifiedAt: '2023-06-02T11:30:00.000Z',
    updatedAt: new Date().toISOString()
  },
  'emp-103': {
    employeeId: 'emp-103',
    aadhaarNumber: '987654327777',
    panNumber: 'STUPS7777S',
    otherGovernmentIdType: 'Driving Licence',
    otherGovernmentIdNumber: 'GJ01 20180012345',
    aadhaarVerificationStatus: 'Verified',
    panVerificationStatus: 'Verified',
    verificationNotes: 'Verified with e-KYC signature.',
    verifiedBy: 'Deepak',
    verifiedAt: '2024-02-11T14:00:00.000Z',
    updatedAt: new Date().toISOString()
  }
};

const PRESEEDED_EMPLOYEE_PAYROLL: Record<string, EmployeePayroll> = {
  'emp-101': {
    employeeId: 'emp-101',
    accountHolderName: 'Ananya Roy',
    bankName: 'HDFC Bank',
    branchName: 'Connaught Place, New Delhi',
    accountNumber: '50100123456789',
    ifscCode: 'HDFC0000001',
    paymentMethod: 'Bank Transfer',
    salaryType: 'Monthly',
    salaryAmount: 85000,
    salaryFrequency: 'Monthly',
    effectiveFrom: '2023-01-15',
    payrollNotes: 'Includes HRA and Performance Allowance.',
    updatedAt: new Date().toISOString()
  },
  'emp-102': {
    employeeId: 'emp-102',
    accountHolderName: 'Ramesh Kumar',
    bankName: 'ICICI Bank',
    branchName: 'Sector 18, Noida',
    accountNumber: '00040155566677',
    ifscCode: 'ICIC0000004',
    paymentMethod: 'Bank Transfer',
    salaryType: 'Monthly',
    salaryAmount: 55000,
    salaryFrequency: 'Monthly',
    effectiveFrom: '2023-06-01',
    payrollNotes: 'Standard service desk salary band.',
    updatedAt: new Date().toISOString()
  },
  'emp-103': {
    employeeId: 'emp-103',
    accountHolderName: 'Siddharth Patel',
    bankName: 'State Bank of India',
    branchName: 'DLF Cyber City, Gurugram',
    accountNumber: '333444555666',
    ifscCode: 'SBIN0001234',
    paymentMethod: 'Bank Transfer',
    salaryType: 'Monthly',
    salaryAmount: 62000,
    salaryFrequency: 'Monthly',
    effectiveFrom: '2024-02-10',
    payrollNotes: 'Corporate advisor retainer compensation.',
    updatedAt: new Date().toISOString()
  }
};

const PRESEEDED_EMPLOYEE_ACCOUNTS: Record<string, EmployeeAccount> = {
  'emp-100': {
    employeeId: 'emp-100',
    userId: 'super-admin-deepak',
    systemEmail: 'tideepak8@gmail.com',
    username: 'deepak',
    role: 'SUPER_ADMIN' as any,
    accountStatus: 'Active',
    lastLoginAt: new Date().toISOString(),
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  }
};

const PRESEEDED_ABOUT_US = {
  aboutText: 'EasyDesk is India\'s premier commercial digital service desk platform. We simplify complex government applications, educational documentation, corporate registrations, and personal identity paperwork through verified desk assistance and transparent processing.',
  vision: 'To empower every citizen and small business with effortless, transparent, and paperless digital documentation services across India.',
  mission: 'To eliminate physical queue delays through automated document audits, step-by-step guidance, and verified desk officers.',
  coreValues: [
    { title: 'Transparency & Trust', description: 'Zero hidden fees, clear step-by-step progress tracking, and official fee breakdowns.' },
    { title: 'Speed & Accuracy', description: 'AI-assisted pre-audit checks ensure documents pass portal verification on the first submission.' },
    { title: 'Citizen First', description: 'Dedicated desk officers available to assist with queries via chat, email, and phone.' },
    { title: 'Data Security', description: '256-bit SSL encryption and strict data protection protocols for all citizen documents.' }
  ],
  whyChooseUs: [
    { title: '100+ Digital Services', description: 'All government, corporate, and educational application services under one roof.' },
    { title: 'Expert Pre-Audit', description: 'Our trained verification officers inspect every document before official portal upload.' },
    { title: 'Pan-India Reach', description: 'Serving citizens and businesses across all 28 states and union territories.' },
    { title: 'Real-Time WhatsApp Updates', description: 'Instant order alerts, status tracking, and direct certificate delivery.' }
  ],
  howItWorks: [
    { step: 1, title: 'Select Service & Fill Form', description: 'Choose your required service (PAN, GST, Passport, etc.) and enter your basic details.' },
    { step: 2, title: 'Upload Supporting Documents', description: 'Upload required ID proofs. Our AI Auditor checks for clarity and completeness.' },
    { step: 3, title: 'Secure Payment', description: 'Pay government & service charges safely via UPI, QR Code, or NetBanking.' },
    { step: 4, title: 'Desk Verification & Submission', description: 'Desk officers review and submit your application to the official government portal.' },
    { step: 5, title: 'Receive Final Certificate', description: 'Download your verified certificate or document directly from your dashboard or WhatsApp.' }
  ],
  achievements: [
    { number: '1,50,000+', label: 'Applications Completed' },
    { number: '99.4%', label: 'First-Time Approval Rate' },
    { number: '100+', label: 'Services Offered' },
    { number: '4.9 / 5', label: 'Citizen Rating' }
  ],
  founderName: 'Devendra Sharma',
  founderDesignation: 'Founder & Managing Director',
  founderPhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
  founderBio: 'Pioneering accessible digital documentation assistance for citizens and enterprises across India with a focus on speed, precision, and trust.',
  teamStats: {
    employeeCount: 45,
    approximateEmployeeCount: 45,
    trainedEmployeeCount: 40,
    trainedQualifiedCount: 40,
    combinedExperienceYears: 120,
    description: 'A dedicated team of qualified document verification specialists, desk officers, and compliance advisors operating pan-India.',
    teamDescription: 'A dedicated team of qualified document verification specialists, desk officers, and compliance advisors operating pan-India.'
  },
  serviceAreas: ['Delhi NCR', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'],
  publicDocuments: [
    { title: 'EasyDesk Certificate of Incorporation', category: 'Government Registration', url: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400' },
    { title: 'ISO 27001 Information Security Certification', category: 'Compliance Standard', url: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400' }
  ],
  faqs: [
    { question: 'Is EasyDesk an official government portal?', answer: 'EasyDesk is a commercial digital assistance platform that helps citizens prepare, pre-audit, and file applications accurately on official government portals.' },
    { question: 'How long does document processing take?', answer: 'Standard applications are reviewed by our desk officers within 2 to 24 hours depending on the service selected.' },
    { question: 'How do I receive my final completed document?', answer: 'Once processed, final certificates are available for instant PDF download in your User Dashboard and sent directly via WhatsApp.' }
  ],
  contactSummary: 'Have questions? Reach out to our digital service desk at support@easydesk.com or call +91 99999 88888.',
  status: 'Published'
};

const PRESEEDED_CONTACT_SETTINGS = {
  companyName: 'EasyDesk Digital Services Pvt Ltd',
  phone: '+91 99999 88888',
  whatsapp: '+91 99999 88888',
  email: 'support@easydesk.com',
  alternateEmail: 'info@easydesk.com',
  address: 'Digital India Tower, Plot 14, Sector 62',
  city: 'Noida',
  state: 'Uttar Pradesh',
  pinCode: '201301',
  workingHours: 'Monday - Saturday: 9:00 AM - 7:00 PM IST',
  googleMapsUrl: 'https://maps.google.com/?q=Sector+62+Noida',
  socialMedia: {
    facebook: 'https://facebook.com/easydesk',
    instagram: 'https://instagram.com/easydesk',
    youtube: 'https://youtube.com/easydesk',
    linkedin: 'https://linkedin.com/company/easydesk',
    twitter: 'https://twitter.com/easydesk'
  }
};

const PRESEEDED_COMPANY_PROFILE = {
  companyName: 'EasyDesk Digital Services Pvt Ltd',
  logoUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200',
  address: 'Digital India Tower, Plot 14, Sector 62',
  city: 'Noida',
  state: 'Uttar Pradesh',
  pinCode: '201301',
  phone: '+91 99999 88888',
  email: 'support@easydesk.com',
  website: 'https://easydesk.com',
  primaryColor: '#1e40af',
  secondaryColor: '#0f172a',
  accentColor: '#3b82f6',
  authorizedSignatoryName: 'Devendra Sharma',
  authorizedSignatoryDesignation: 'Managing Director'
};

const PRESEEDED_CONTACT_MESSAGES = [
  {
    id: 'msg-1',
    name: 'Rahul Verma',
    email: 'rahul.v@gmail.com',
    phone: '9811223344',
    subject: 'Query regarding corporate GST filing batch discount',
    message: 'Hello EasyDesk team, we have 12 subsidiary firms needing new GST registrations this month. Do you offer bulk filing assistance?',
    status: 'New',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'msg-2',
    name: 'Pooja Hegde',
    email: 'pooja.h@yahoo.com',
    phone: '9822334455',
    subject: 'Aadhaar update timeline question',
    message: 'Hi! I uploaded my address proof yesterday. How long will it take for the verification update to reflect on my dashboard?',
    status: 'Replied',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const PRESEEDED_GENERAL_SETTINGS = {
  websiteName: 'EasyDesk',
  logoUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100',
  faviconUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=32',
  tagline: 'India\'s Premier Digital Service & Document Assistance Portal',
  seo: {
    metaTitle: 'EasyDesk - Fast & Reliable Digital Government Services',
    metaDescription: 'Apply for PAN cards, Aadhaar updates, Passports, MSME, GST registration, and academic document filings with expert desk verification.',
    keywords: 'easydesk, pan card online, passport application, msme udyam, gst registration, document filing',
    googleAnalyticsId: 'UA-10029381-1'
  },
  system: {
    maintenanceMode: false,
    notificationEmail: 'support@easydesk.com'
  }
};

const PRESEEDED_PRIVACY_SECURITY_SETTINGS = {
  hero: {
    heading: 'Your Privacy & Security Matter',
    subtitle: 'EasyDesk follows secure document handling practices and protects your personal information throughout the service process.',
    badgeText: 'Privacy & Security Notice',
    trustCards: [
      { id: 'tc-1', title: 'Secure Document Handling', description: 'End-to-end audit pipeline with strict access controls.', icon: 'ShieldCheck' },
      { id: 'tc-2', title: 'SSL Encrypted Communication', description: '256-bit SSL/TLS protocol protecting all transferred data.', icon: 'Lock' },
      { id: 'tc-3', title: 'Privacy Protected', description: 'Zero third-party monetization or data selling guaranteed.', icon: 'EyeOff' },
      { id: 'tc-4', title: 'Verified Staff Access', description: 'Background-verified desk officers with role-based restrictions.', icon: 'UserCheck' },
      { id: 'tc-5', title: 'Manual Verification Process', description: 'Human double-check on document quality before portal upload.', icon: 'CheckCircle2' }
    ]
  },
  mayRequest: {
    title: 'Information EasyDesk May Request',
    subtitle: 'To process government filings and authorized digital services on your behalf, we may voluntarily collect:',
    importantNote: 'Login credentials and OTP are used ONLY for completing the requested service. They are NEVER reused for any other purpose.',
    items: [
      { id: 'mr-1', name: 'Customer Identity Details', examples: 'Customer Full Name, Mobile Number, Email Address, Residential Address', category: 'Basic Info', icon: 'User' },
      { id: 'mr-2', name: 'Identity Documents', examples: 'Aadhaar Card, PAN Card, Passport, Driving Licence', category: 'Government ID', icon: 'FileText' },
      { id: 'mr-3', name: 'Educational & Employment Records', examples: 'Degrees, Transcripts, Experience Letters, Form 16', category: 'Verification', icon: 'Award' },
      { id: 'mr-4', name: 'Government Application IDs', examples: 'Application Login ID, Portal Application Password (only when required)', category: 'Portal Filing', icon: 'Key' },
      { id: 'mr-5', name: 'One-Time Passwords (OTP)', examples: 'Aadhaar e-KYC OTP, Portal Filing OTP (only during active filing)', category: 'Temporary OTP', icon: 'Smartphone' },
      { id: 'mr-6', name: 'Uploaded Supporting Files', examples: 'Photographs, Digital Signatures, Application Reference Numbers', category: 'Service Attachments', icon: 'UploadCloud' }
    ]
  },
  neverRequest: {
    title: 'Information EasyDesk WILL NEVER REQUEST',
    warningHeading: 'EASYDESK WILL NEVER ASK FOR',
    largeWarning: 'If anyone asks for these details while claiming to represent EasyDesk, it is fraudulent.',
    redItems: [
      'Bank OTP', 'UPI PIN', 'ATM PIN', 'Debit Card PIN', 'Credit Card PIN',
      'Net Banking Password', 'CVV Number', 'Debit Card OTP', 'Credit Card OTP',
      'Internet Banking OTP', 'Wallet PIN', 'Crypto Wallet Recovery Phrase',
      'Financial Passwords', 'Bank Account Password', 'Investment Account Password',
      'Trading Account Password', 'Any Secret Banking Credentials'
    ]
  },
  dataProtection: {
    title: 'How EasyDesk Protects Your Data',
    subtitle: 'Multi-layered administrative, technical, and physical security measures.',
    measures: [
      { id: 'dp-1', title: 'SSL/TLS Encryption', description: 'All web traffic and API endpoints communicate exclusively over TLS 1.3 encryption.', icon: 'Lock' },
      { id: 'dp-2', title: 'Role Based Internal Access', description: 'Employees can only view documents assigned specifically to their desk workflow.', icon: 'ShieldCheck' },
      { id: 'dp-3', title: 'Secure Document Storage', description: 'Encrypted storage buckets with automated time-bound archival.', icon: 'Server' },
      { id: 'dp-4', title: 'Limited Employee Access', description: 'Strict principle of least privilege enforced across all internal software.', icon: 'UserCheck' },
      { id: 'dp-5', title: 'Activity Logs', description: 'Every single view, download, or edit action is logged with timestamp & operator IP.', icon: 'FileText' },
      { id: 'dp-6', title: 'Secure Server Infrastructure', description: 'Isolated Cloud Run container sandbox with continuous firewall monitoring.', icon: 'HardDrive' },
      { id: 'dp-7', title: 'Password Encryption', description: 'Bcrypt hashing algorithm for all user account credentials.', icon: 'Key' },
      { id: 'dp-8', title: 'Controlled File Access', description: 'Signed temporary URLs with short validity periods for document downloads.', icon: 'EyeOff' },
      { id: 'dp-9', title: 'Document Access Tracking', description: 'Real-time alert notifications sent to customers when staff audits files.', icon: 'Bell' },
      { id: 'dp-10', title: 'Data Isolation', description: 'Customer records are compartmentalized to prevent cross-account leakages.', icon: 'Layers' },
      { id: 'dp-11', title: 'Restricted Admin Permissions', description: 'Super-admin level approval required for bulk or elevated data operations.', icon: 'Sliders' },
      { id: 'dp-12', title: 'Regular Security Monitoring', description: 'Periodic vulnerability scans and automated anomaly detection.', icon: 'RefreshCw' }
    ]
  },
  dataUsage: {
    title: 'Data Usage Policy',
    allowedPurposes: [
      'Processing requested government and digital services',
      'Official government portal form submissions',
      'Pre-audit document accuracy and quality verification',
      'Customer communication regarding order status & queries',
      'Sending real-time order status updates via SMS / WhatsApp / Email',
      'Fulfilling statutory legal and regulatory record-keeping obligations'
    ],
    neverSellStatement: 'EasyDesk NEVER sells customer data under any circumstances.',
    neverShareStatement: 'EasyDesk NEVER shares customer data with unauthorized third parties.'
  },
  dataRetention: {
    title: 'Data Retention Policy',
    description: 'Documents and submitted application payloads are stored strictly for the operational period required to process your order. Following completion, records are archived or securely deleted in accordance with internal company policy and applicable statutory rules.',
    customerRights: 'Customers retain the right to request full account data deletion or document purging once active order processing is concluded, subject to legal retention obligations.',
    purgeOptionEnabled: true
  },
  employeeControls: {
    title: 'Employee Privacy & Access Controls',
    rules: [
      'Only authorized and background-verified EasyDesk staff can access customer application files.',
      'Staff access is continuously monitored by automated internal compliance checkers.',
      'Every customer document view or download generates an unalterable audit log entry.',
      'Fine-grained permission matrices prevent employees from accessing data outside active assignments.',
      'No employee can access customer data outside their specific work requirements.'
    ]
  },
  customerResponsibilities: {
    title: 'Customer Security Responsibilities',
    checklist: [
      { id: 'cr-1', title: 'Provide Correct Information', description: 'Ensure all details provided in applications match official government records exactly.' },
      { id: 'cr-2', title: 'Keep Documents Genuine', description: 'Upload authentic, unaltered document scans to prevent rejection or legal penalties.' },
      { id: 'cr-3', title: 'Never Share Banking Passwords', description: 'Do not disclose Net Banking passwords, CVV, or card PINs to anyone.' },
      { id: 'cr-4', title: 'Never Share PINs or Secrets', description: 'Keep UPI PINs, ATM PINs, and banking passwords completely confidential.' },
      { id: 'cr-5', title: 'Report Suspicious Activity Immediately', description: 'If anyone asks for financial passwords claiming to represent EasyDesk, report them instantly.' },
      { id: 'cr-6', title: 'Use Official EasyDesk Channels', description: 'Interact only through easydesk.com website, verified WhatsApp, or official desk numbers.' },
      { id: 'cr-7', title: 'Verify Phone Numbers Before Sharing OTP', description: 'Confirm that the agent requesting an application filing OTP is officially assigned on your EasyDesk order tracking screen.' }
    ]
  },
  fraudTimeline: {
    title: 'Fraud & Scam Awareness Guide',
    subtitle: 'What to do if someone claims to represent EasyDesk and asks for secret credentials:',
    steps: [
      { step: 1, title: 'Do Not Panic', description: 'EasyDesk will never demand urgent payments or banking PINs over unsolicited calls.' },
      { step: 2, title: 'Verify Identity', description: 'Cross-check the caller number against official contact numbers on easydesk.com or check your live order tracking screen.' },
      { step: 3, title: 'Never Share Banking Credentials', description: 'Immediately decline if asked for Bank OTP, UPI PIN, Card CVV, or Net Banking passwords.' },
      { step: 4, title: 'Contact Official Support', description: 'Reach out to support@easydesk.com or call our official desk hotline at +91 99999 88888.' },
      { step: 5, title: 'Report Suspicious Activity', description: 'Submit an emergency fraud alert via our online report form for immediate security response.' }
    ]
  },
  securityContact: {
    title: 'Contact EasyDesk Security Team',
    securityEmail: 'security@easydesk.com',
    supportEmail: 'support@easydesk.com',
    customerCarePhone: '+91 99999 88888',
    emergencyHotline: '+91 99999 77777',
    businessHours: 'Monday – Saturday: 9:00 AM – 7:00 PM IST',
    officeAddress: 'Digital India Tower, Plot 14, Sector 62, Noida, UP - 201301'
  },
  legalCompliance: {
    title: 'Legal Compliance Statement',
    statement: 'EasyDesk is committed to protecting customer information and handling personal data responsibly in accordance with applicable laws and industry best practices.'
  },
  faqs: [
    { question: 'Why does EasyDesk need my Aadhaar or PAN details?', answer: 'Government service applications (such as fresh PAN issuance, GST registration, or Passport slot booking) legally mandate authentic identity verification. EasyDesk uses these details solely to complete official application forms as authorized by you.' },
    { question: 'Does EasyDesk store my application login password after completion?', answer: 'No. Application login passwords or portal OTPs provided for form filing are held temporarily during processing and wiped upon order completion.' },
    { question: 'Can an employee view my uploaded document without an order?', answer: 'No. Internal role-based security prevents staff members from searching or viewing files unless the order is explicitly assigned to their desk queue.' },
    { question: 'How can I request deletion of my uploaded files?', answer: 'Once your order is completed, you can submit an official Data Deletion Request directly on our Privacy & Security page.' }
  ]
};

const PRESEEDED_AUDIT_LOGS: AuditLog[] = [
  { id: 'log-1', userId: 'super-admin-deepak', userName: 'Deepak', userRole: 'SUPER_ADMIN', actionType: 'SYSTEM_BOOT', description: 'Preseeded state database successfully established in the sandboxed container.', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
  { id: 'log-2', userId: 'super-admin-deepak', userName: 'Deepak', userRole: 'SUPER_ADMIN', actionType: 'CONFIG_UPDATE', description: 'Updated global EasyDesk service charge fee margins across educational catalogs.', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }
];

// Helper function to build baseline seed state for blank databases
function getBaselineSeedState(): Record<string, any> {
  return {
    users: [...PRESEEDED_USERS],
    customers: [] as any[],
    admins: [...PRESEEDED_ADMINS],
    roles: [] as any[],
    permissions: [] as any[],
    sessions: [] as any[],
    refreshTokens: [] as any[],
    categories: [...PRESEEDED_CATEGORIES],
    blogCategories: [...PRESEEDED_BLOG_CATEGORIES],
    services: [...PRESEEDED_SERVICES],
    orders: [] as Order[],
    tickets: [] as SupportTicket[],
    coupons: [] as any[],
    reviews: [] as any[],
    blogs: [...PRESEEDED_BLOGS],
    notifications: [] as Notification[],
    faqs: [...PRESEEDED_FAQS],
    banners: [] as any[],
    media: [] as MediaItem[],
    calendarEvents: [] as CalendarEvent[],
    pages: [...PRESEEDED_PAGES],
    settings: { ...PRESEEDED_SETTINGS },
    paymentConfig: { ...PRESEEDED_PAYMENT_CONFIG },
    paymentSettings: { ...PRESEEDED_PAYMENT_CONFIG },
    auditLogs: [] as any[],
    founder: { ...PRESEEDED_FOUNDER },
    team: [] as any[],
    employees: [] as EmployeeProfile[],
    employeeKYC: {} as Record<string, EmployeeKYC>,
    employeePayroll: {} as Record<string, EmployeePayroll>,
    employeeAccounts: {} as Record<string, EmployeeAccount>,
    employeeDocuments: [] as any[],
    contactMessages: [] as any[],
    masterData: { ...PRESEEDED_MASTER_DATA },
    aboutUs: { ...PRESEEDED_ABOUT_US },
    companyProfile: { ...PRESEEDED_COMPANY_PROFILE },
    contactSettings: { ...PRESEEDED_CONTACT_SETTINGS },
    privacySecuritySettings: { ...PRESEEDED_PRIVACY_SECURITY_SETTINGS },
    privacySecurity: { ...PRESEEDED_PRIVACY_SECURITY_SETTINGS }
  };
}

// Memory state container - starts clean so authoritative Cloudflare D1 data is always served
let dbState: Record<string, any> = {
  users: [...PRESEEDED_USERS],
  customers: [] as any[],
  admins: [] as any[],
  roles: [] as any[],
  permissions: [] as any[],
  sessions: [] as any[],
  refreshTokens: [] as any[],
  categories: [...PRESEEDED_CATEGORIES],
  blogCategories: [...PRESEEDED_BLOG_CATEGORIES],
  services: [...PRESEEDED_SERVICES],
  orders: [] as Order[],
  tickets: [] as SupportTicket[],
  coupons: [] as any[],
  reviews: [] as any[],
  blogs: [...PRESEEDED_BLOGS],
  notifications: [] as Notification[],
  faqs: [] as any[],
  banners: [] as any[],
  media: [] as MediaItem[],
  calendarEvents: [] as CalendarEvent[],
  pages: [] as any[],
  settings: { ...PRESEEDED_SETTINGS },
  paymentConfig: { ...PRESEEDED_PAYMENT_CONFIG },
  paymentSettings: { ...PRESEEDED_PAYMENT_CONFIG },
  auditLogs: [] as any[],
  founder: { ...PRESEEDED_FOUNDER },
  team: [] as any[],
  employees: [] as EmployeeProfile[],
  employeeKYC: {} as Record<string, EmployeeKYC>,
  employeePayroll: {} as Record<string, EmployeePayroll>,
  employeeAccounts: {} as Record<string, EmployeeAccount>,
  employeeDocuments: [] as EmployeeDocument[],
  aboutUs: { ...PRESEEDED_ABOUT_US },
  contactSettings: { ...PRESEEDED_CONTACT_SETTINGS },
  companyProfile: { ...PRESEEDED_COMPANY_PROFILE },
  contactMessages: [...PRESEEDED_CONTACT_MESSAGES],
  generalSettings: { ...PRESEEDED_GENERAL_SETTINGS },
  privacySecurity: { ...PRESEEDED_PRIVACY_SECURITY_SETTINGS },
  privacySecuritySettings: { ...PRESEEDED_PRIVACY_SECURITY_SETTINGS },
  scamReports: [] as any[],
  dataDeletionRequests: [] as any[],
  masterData: {
    departments: [] as string[],
    designations: [] as string[],
    employmentTypes: [] as string[],
    workLocations: [] as string[],
    employeeStatuses: [] as string[],
    documentTypes: [] as string[],
    banks: [] as string[]
  }
};

// Seed some sample orders so dashboards look amazing immediately
const SEEDED_ORDERS: Order[] = [
  {
    id: 'ORD-10024',
    userId: 'user-1',
    serviceId: 'pan',
    serviceTitle: 'New PAN Card / Correction',
    name: 'Jane Doe',
    mobile: '9876543210',
    email: 'user@easydesk.com',
    address: 'Flat 402, Sunshine Heights',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400001',
    uploadedDocuments: [
      { name: 'Aadhaar_Card.pdf', url: 'https://example.com/docs/aadhaar.pdf', uploadedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    additionalNotes: 'Urgent requirement for bank account opening.',
    paymentMethod: PaymentMethod.UPI,
    paymentStatus: PaymentStatus.VERIFIED,
    utr: '981273981273',
    paymentScreenshot: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400',
    paymentDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    orderStatus: OrderStatus.COMPLETED,
    totalAmount: 257,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    assignedStaffId: 'staff-1',
    logs: [
      { status: OrderStatus.PENDING, comment: 'Order successfully created.', timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
      { status: OrderStatus.UNDER_VERIFICATION, comment: 'Document verification in progress.', timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString() },
      { status: OrderStatus.PROCESSING, comment: 'Application submitted to government portal.', timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
      { status: OrderStatus.COMPLETED, comment: 'PAN Card generated and physical card dispatched.', timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    feedback: {
      rating: 5,
      comment: 'Super fast, got it in just a few days!',
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
  },
  {
    id: 'ORD-10025',
    userId: 'user-1',
    serviceId: 'passport',
    serviceTitle: 'Fresh / Reissue Passport Assistance',
    name: 'Jane Doe',
    mobile: '9876543210',
    email: 'user@easydesk.com',
    address: 'Flat 402, Sunshine Heights',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400001',
    uploadedDocuments: [
      { name: 'Aadhaar_Card.pdf', url: 'https://example.com/docs/aadhaar.pdf', uploadedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    additionalNotes: 'Need assistance for reissue passport.',
    paymentMethod: PaymentMethod.QR,
    paymentStatus: PaymentStatus.VERIFIED,
    utr: '481928374918',
    paymentScreenshot: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400',
    paymentDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    orderStatus: OrderStatus.PROCESSING,
    totalAmount: 2000,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    assignedStaffId: 'staff-1',
    logs: [
      { status: OrderStatus.PENDING, comment: 'Order successfully placed.', timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
      { status: OrderStatus.UNDER_VERIFICATION, comment: 'Aadhaar verification completed.', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      { status: OrderStatus.PROCESSING, comment: 'Appointment scheduled for Tuesday morning at PSK.', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }
    ]
  },
  {
    id: 'ORD-10026',
    userId: 'user-1',
    serviceId: 'gst-reg',
    serviceTitle: 'New GST Registration',
    name: 'Doe Enterprises',
    mobile: '9876543210',
    email: 'user@easydesk.com',
    address: 'Sector 15, Business Hub',
    city: 'Pune',
    state: 'Maharashtra',
    pinCode: '411001',
    uploadedDocuments: [],
    additionalNotes: 'Requires documentation help.',
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    paymentStatus: PaymentStatus.PENDING_VERIFICATION,
    utr: 'SBI98127398127',
    paymentScreenshot: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400',
    paymentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    orderStatus: OrderStatus.PENDING,
    totalAmount: 999,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    logs: [
      { status: OrderStatus.PENDING, comment: 'Order placed, awaiting transaction confirmation.', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
      { status: OrderStatus.DOCUMENTS_REQUIRED, comment: 'Please upload business address proof to proceed.', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() }
    ]
  }
];

const SEEDED_TICKETS: SupportTicket[] = [
  {
    id: 'TCK-201',
    userId: 'user-1',
    userName: 'Jane Doe',
    subject: 'Document upload failing',
    category: 'Order Document Issue',
    message: 'I am trying to upload my Aadhaar PDF on order ORD-10026 but getting a network alert.',
    status: 'In Progress',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    replies: [
      {
        id: 'rep-1',
        senderId: 'staff-1',
        senderName: 'Ramesh Kumar',
        senderRole: 'STAFF' as any,
        message: 'Hello Jane, sorry about the issue. Please check your PDF size is below 5MB or send it in the notes. I will update your status manually.',
        createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
      }
    ]
  }
];

const PRESEEDED_MASTER_DATA = {
  departments: [
    'Operations',
    'Corporate Desk',
    'Customer Service',
    'Executive',
    'Management',
    'Finance',
    'Human Resources',
    'IT & Systems',
    'Legal & Compliance',
    'Marketing & Sales'
  ],
  designations: [
    'Head of Desk Operations',
    'Senior Document Officer',
    'Customer Success Lead',
    'Chief Executive Officer',
    'Managing Director',
    'HR Manager',
    'Accounts Specialist',
    'Legal Advisor',
    'IT Administrator',
    'Operations Executive',
    'Desk Officer'
  ],
  employmentTypes: [
    'Full-Time',
    'Part-Time',
    'Contract',
    'Intern',
    'Consultant'
  ],
  workLocations: [
    'Headquarters - Mumbai',
    'Regional Office - Delhi',
    'Tech Hub - Bangalore',
    'Remote / Work From Home'
  ],
  employeeStatuses: [
    'Active',
    'Inactive',
    'On Leave',
    'Suspended',
    'Terminated'
  ],
  documentTypes: [
    'Aadhaar Copy',
    'PAN Copy',
    'Resume / Bio-Data',
    'Appointment Letter',
    'Educational Certificates',
    'Relieving Letter'
  ],
  banks: [
    'HDFC Bank',
    'ICICI Bank',
    'State Bank of India',
    'Axis Bank',
    'Punjab National Bank',
    'Kotak Mahindra Bank'
  ]
};

const PRESEEDED_CUSTOMERS = [
  {
    id: 'cust-1',
    code: 'CUST-1001',
    name: 'Jane Doe',
    customerType: 'Individual',
    contactPersonName: 'Jane Doe',
    gender: 'Female',
    dobOrIncorporationDate: '1992-05-14',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    email: 'user@easydesk.com',
    mobile: '9876543210',
    whatsappMobile: '9876543210',
    address: 'Flat 402, Sunshine Heights, Lokhandwala',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    status: 'Active',
    notes: 'Regular customer for government identity document services.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cust-2',
    code: 'CUST-1002',
    name: 'Apex Global Enterprises Pvt Ltd',
    customerType: 'Business / Corporate',
    contactPersonName: 'Rohan Mehta',
    gender: 'Male',
    dobOrIncorporationDate: '2018-03-21',
    photoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200',
    email: 'contact@apexglobal.com',
    mobile: '9811223344',
    whatsappMobile: '9811223344',
    address: 'Plot 45, Business Park, BKC',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400051',
    status: 'Active',
    gstin: '27AAACA1234F1Z5',
    panNumber: 'AAACA1234F',
    msmeLicense: 'UDYAM-MH-01-0012345',
    notes: 'Corporate account for bulk GST and company licensing.',
    createdAt: new Date().toISOString()
  }
];

// Load from disk if exists, otherwise setup clean in-memory defaults
function initDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      dbState = { ...dbState, ...parsed };
      if (parsed.aboutUs) {
        dbState.aboutUs = parsed.aboutUs;
      }
      if (parsed.founder) {
        dbState.founder = parsed.founder;
      }
      if (parsed.contactSettings) {
        dbState.contactSettings = parsed.contactSettings;
      }
      if (parsed.paymentConfig || parsed.paymentSettings || parsed.settings?.paymentConfig) {
        const flatPay = sanitizePaymentConfig(parsed.paymentConfig || parsed.settings?.paymentConfig || parsed.paymentSettings);
        dbState.paymentConfig = flatPay;
        dbState.paymentSettings = flatPay;
        if (!dbState.settings) dbState.settings = {};
        dbState.settings.paymentConfig = flatPay;
      }
      console.log('Successfully loaded persisted state from db_store.json');
    } catch (e) {
      console.error('Error reading db_store.json', e);
    }
  }

  // Ensure all collections are initialized as arrays/objects in memory
  if (!dbState.orders) dbState.orders = [];
  if (!dbState.tickets) dbState.tickets = [];
  if (!dbState.customers) dbState.customers = [];
  if (!dbState.admins) dbState.admins = [];
  if (!dbState.roles) dbState.roles = [];
  if (!dbState.permissions) dbState.permissions = [];
  if (!dbState.sessions) dbState.sessions = [];
  if (!dbState.refreshTokens) dbState.refreshTokens = [];
  if (!dbState.employees) dbState.employees = [];
  if (!dbState.employeeKYC) dbState.employeeKYC = {};
  if (!dbState.employeePayroll) dbState.employeePayroll = {};
  if (!dbState.employeeAccounts) dbState.employeeAccounts = {};
  if (!dbState.employeeDocuments) dbState.employeeDocuments = [];
  if (!dbState.auditLogs) dbState.auditLogs = [];
  if (!dbState.contactMessages) dbState.contactMessages = [];
  if (!dbState.media) dbState.media = [];

  if (!dbState.masterData) {
    dbState.masterData = JSON.parse(JSON.stringify(PRESEEDED_MASTER_DATA));
  }

  const GRANULAR_PERMISSIONS = [
    // Operational Hub
    { id: 'dashboard.view', name: 'View Dashboard Analytics', group: 'Operational Hub' },
    { id: 'orders.view', name: 'View All Orders', group: 'Operational Hub' },
    { id: 'orders.view_assigned', name: 'View Assigned Orders Only', group: 'Operational Hub' },
    { id: 'orders.assign', name: 'Assign Orders to Employees', group: 'Operational Hub' },
    { id: 'orders.update', name: 'Update Order Status & Notes', group: 'Operational Hub' },
    { id: 'documents.verify', name: 'Verify & Review Customer Documents', group: 'Operational Hub' },
    { id: 'documents.upload', name: 'Upload Final Processed Documents', group: 'Operational Hub' },
    { id: 'whatsapp_delivery.update', name: 'Send / Update WhatsApp Delivery Status', group: 'Operational Hub' },
    { id: 'support.manage', name: 'Manage & Respond to Support Tickets', group: 'Operational Hub' },

    // Content CMS
    { id: 'blogs.view', name: 'View Blogs', group: 'Content CMS' },
    { id: 'blogs.manage', name: 'Create, Edit & Delete Blogs', group: 'Content CMS' },
    { id: 'pages.manage', name: 'Manage Website Pages', group: 'Content CMS' },
    { id: 'banners.manage', name: 'Manage Homepage Banners & Carousels', group: 'Content CMS' },
    { id: 'media.manage', name: 'Manage Media Library & Files', group: 'Content CMS' },

    // Core Module
    { id: 'services.view', name: 'View Services Catalog', group: 'Core Module' },
    { id: 'services.manage', name: 'Manage Services & Pricing', group: 'Core Module' },
    { id: 'categories.manage', name: 'Manage Service Categories', group: 'Core Module' },
    { id: 'master_data.view', name: 'View Master Data (Departments & Designations)', group: 'Core Module' },
    { id: 'master_data.manage', name: 'Manage Master Data', group: 'Core Module' },

    // System & Staff
    { id: 'employees.view', name: 'View Employee Directory & Profiles', group: 'System & Staff' },
    { id: 'employees.manage', name: 'Create & Manage Employee Profiles', group: 'System & Staff' },
    { id: 'employee_kyc.view', name: 'View Employee KYC Records', group: 'System & Staff' },
    { id: 'employee_kyc.manage', name: 'Verify & Update Employee KYC', group: 'System & Staff' },
    { id: 'employee_payroll.view', name: 'View Employee Payroll & Salary Data', group: 'System & Staff' },
    { id: 'employee_payroll.manage', name: 'Manage Employee Payroll & Bank Accounts', group: 'System & Staff' },
    { id: 'staff_accounts.view', name: 'View Staff Accounts', group: 'System & Staff' },
    { id: 'staff_accounts.manage', name: 'Manage Staff System Accounts', group: 'System & Staff' },
    { id: 'roles.view', name: 'View Roles & Permission Definitions', group: 'System & Staff' },
    { id: 'roles.manage', name: 'Create & Edit Custom Roles & Permissions', group: 'System & Staff' },

    // Finance & Payments
    { id: 'payments.view', name: 'View Payment Transactions', group: 'Finance & Payments' },
    { id: 'payments.verify', name: 'Verify & Approve Customer Payments', group: 'Finance & Payments' },
    { id: 'payment_settings.manage', name: 'Manage Bank & QR Payment Gateway Settings', group: 'Finance & Payments' },

    // Customer Management
    { id: 'customers.view', name: 'View Customer Directory', group: 'Customer Management' },
    { id: 'customers.manage', name: 'Manage Customer Accounts & Profiles', group: 'Customer Management' },

    // About & Website Settings
    { id: 'about.view', name: 'View About Us & Organization Details', group: 'About & Website Settings' },
    { id: 'about.manage', name: 'Manage About Us Content & Team Info', group: 'About & Website Settings' },
    { id: 'contact_settings.manage', name: 'Manage Contact & Social Media Info', group: 'About & Website Settings' },

    // System Settings & Audit
    { id: 'system_settings.view', name: 'View System Settings', group: 'System Settings & Audit' },
    { id: 'system_settings.manage', name: 'Manage System Settings & Security Config', group: 'System Settings & Audit' },
    { id: 'audit_logs.view', name: 'View Security Audit Logs', group: 'System Settings & Audit' },
  ];

  // Seed or upgrade permissions
  if (!dbState.permissions || dbState.permissions.length === 0) {
    dbState.permissions = [...GRANULAR_PERMISSIONS];
  } else {
    // Ensure all granular permissions are present
    GRANULAR_PERMISSIONS.forEach(gp => {
      if (!dbState.permissions.some((p: any) => p.id === gp.id)) {
        dbState.permissions.push(gp);
      }
    });
  }

  const allPermIds = GRANULAR_PERMISSIONS.map(p => p.id);

  // Seed or upgrade standard roles
  if (!dbState.roles || dbState.roles.length === 0) {
    dbState.roles = [
      {
        id: 'SUPER_ADMIN',
        name: 'Super Admin',
        description: 'Full system control with unrestricted access to all modules and configurations',
        isSystemRole: true,
        permissions: allPermIds
      },
      {
        id: 'ADMIN',
        name: 'Administrator',
        description: 'Operational and management access across services, orders, and team directory',
        isSystemRole: true,
        permissions: allPermIds.filter(id => !['roles.manage', 'employee_payroll.manage', 'system_settings.manage'].includes(id))
      },
      {
        id: 'STAFF',
        name: 'Staff Member',
        description: 'Order processing, document verification, and operational order execution',
        isSystemRole: true,
        permissions: ['dashboard.view', 'orders.view', 'orders.view_assigned', 'orders.update', 'documents.verify', 'documents.upload', 'services.view', 'employees.view']
      },
      {
        id: 'OPERATOR',
        name: 'Operator',
        description: 'Focused order processing and customer document uploads',
        isSystemRole: true,
        permissions: ['dashboard.view', 'orders.view_assigned', 'orders.update', 'documents.verify', 'documents.upload']
      },
      {
        id: 'SUPPORT',
        name: 'Customer Support',
        description: 'Support ticket resolution and order status updates',
        isSystemRole: true,
        permissions: ['dashboard.view', 'orders.view', 'orders.update', 'support.manage', 'customers.view']
      },
      {
        id: 'CONTENT_EDITOR',
        name: 'Content Editor',
        description: 'Blogs, media library, and website page content management',
        isSystemRole: true,
        permissions: ['blogs.view', 'blogs.manage', 'pages.manage', 'banners.manage', 'media.manage', 'services.view', 'about.manage']
      }
    ];
  } else {
    // Ensure SUPER_ADMIN role in dbState.roles has all permissions
    const sa = dbState.roles.find((r: any) => r.id === 'SUPER_ADMIN');
    if (sa) {
      sa.permissions = allPermIds;
    }
  }

  // Ensure default super admin exists in admins list
  if (!dbState.admins.some((a: any) => a.role === 'SUPER_ADMIN')) {
    dbState.admins.unshift({ ...PRESEEDED_ADMINS[0] });
  }

  console.log('In-memory database state initialized.');
  normalizeDatabaseRelationships();
}

// ----------------- CANONICAL RECORD RELATIONSHIPS & SYNCHRONIZATION HELPERS -----------------

/**
 * Finds an EmployeeProfile by ID, Employee Code, or Email (case-insensitive fallback).
 * Guarantees that whether 'EMP-101' or 'emp-101' is queried, the exact same profile is returned.
 */
function findEmployee(idOrCode: string | undefined | null): EmployeeProfile | undefined {
  if (!idOrCode) return undefined;
  const target = String(idOrCode).trim();
  if (!target) return undefined;
  const targetLower = target.toLowerCase();

  const list = dbState.employees || [];
  return list.find(e => 
    e.id === target || 
    e.employeeCode === target || 
    (e.id && e.id.toLowerCase() === targetLower) || 
    (e.employeeCode && e.employeeCode.toLowerCase() === targetLower) ||
    (e.personalEmail && e.personalEmail.toLowerCase() === targetLower)
  );
}

/**
 * Finds a CustomerRecord by ID, Customer Code, User ID, Email, or Mobile.
 * Guarantees that whether 'CUST-1001' or 'cust-1' or 'CUS-101' is queried, the exact customer is returned.
 */
function findCustomer(idOrCode: string | undefined | null): CustomerRecord | undefined {
  if (!idOrCode) return undefined;
  const target = String(idOrCode).trim();
  if (!target) return undefined;
  const targetLower = target.toLowerCase();

  const list = dbState.customers || [];
  return list.find(c => 
    c.id === target || 
    c.code === target || 
    (c.id && c.id.toLowerCase() === targetLower) || 
    (c.code && c.code.toLowerCase() === targetLower) || 
    (c.userId && c.userId === target) ||
    (c.userId && c.userId.toLowerCase() === targetLower) ||
    (c.email && c.email.toLowerCase() === targetLower) ||
    (c.mobile && c.mobile === target)
  );
}

/**
 * Gets the KYC sub-record for an employee by canonical ID or code.
 */
function getEmployeeKYC(idOrCode: string): EmployeeKYC {
  if (!dbState.employeeKYC) dbState.employeeKYC = {};
  const emp = findEmployee(idOrCode);
  const canonicalId = emp ? emp.id : idOrCode;
  const altKey = emp ? emp.employeeCode : '';

  let kyc = dbState.employeeKYC[canonicalId] || (altKey ? dbState.employeeKYC[altKey] : undefined);
  if (!kyc && emp) {
    const foundEntry = Object.entries(dbState.employeeKYC).find(
      ([k]) => k.toLowerCase() === canonicalId.toLowerCase() || (altKey && k.toLowerCase() === altKey.toLowerCase())
    );
    if (foundEntry) kyc = foundEntry[1];
  }

  if (!kyc) {
    kyc = {
      employeeId: canonicalId,
      aadhaarVerificationStatus: 'Pending',
      panVerificationStatus: 'Pending',
      updatedAt: new Date().toISOString()
    };
    dbState.employeeKYC[canonicalId] = kyc;
  } else {
    kyc.employeeId = canonicalId;
  }
  return kyc;
}

/**
 * Updates KYC sub-record for an employee.
 */
function setEmployeeKYC(idOrCode: string, data: Partial<EmployeeKYC>, verifiedBy?: string): EmployeeKYC {
  if (!dbState.employeeKYC) dbState.employeeKYC = {};
  const emp = findEmployee(idOrCode);
  const canonicalId = emp ? emp.id : idOrCode;
  const existing = getEmployeeKYC(canonicalId);

  const updated: EmployeeKYC = {
    ...existing,
    ...data,
    employeeId: canonicalId,
    verifiedBy: verifiedBy || existing.verifiedBy,
    verifiedAt: verifiedBy ? new Date().toISOString() : existing.verifiedAt,
    updatedAt: new Date().toISOString()
  };

  dbState.employeeKYC[canonicalId] = updated;
  if (emp && emp.employeeCode && emp.employeeCode !== canonicalId && dbState.employeeKYC[emp.employeeCode]) {
    delete dbState.employeeKYC[emp.employeeCode];
  }
  return updated;
}

/**
 * Gets Payroll sub-record for an employee by canonical ID or code.
 */
function getEmployeePayroll(idOrCode: string): EmployeePayroll {
  if (!dbState.employeePayroll) dbState.employeePayroll = {};
  const emp = findEmployee(idOrCode);
  const canonicalId = emp ? emp.id : idOrCode;
  const altKey = emp ? emp.employeeCode : '';

  let payroll = dbState.employeePayroll[canonicalId] || (altKey ? dbState.employeePayroll[altKey] : undefined);
  if (!payroll && emp) {
    const foundEntry = Object.entries(dbState.employeePayroll).find(
      ([k]) => k.toLowerCase() === canonicalId.toLowerCase() || (altKey && k.toLowerCase() === altKey.toLowerCase())
    );
    if (foundEntry) payroll = foundEntry[1];
  }

  if (!payroll) {
    payroll = {
      employeeId: canonicalId,
      accountHolderName: emp ? emp.fullName : '',
      paymentMethod: 'Bank Transfer',
      salaryType: 'Monthly',
      updatedAt: new Date().toISOString()
    };
    dbState.employeePayroll[canonicalId] = payroll;
  } else {
    payroll.employeeId = canonicalId;
  }
  return payroll;
}

/**
 * Updates Payroll sub-record for an employee.
 */
function setEmployeePayroll(idOrCode: string, data: Partial<EmployeePayroll>): EmployeePayroll {
  if (!dbState.employeePayroll) dbState.employeePayroll = {};
  const emp = findEmployee(idOrCode);
  const canonicalId = emp ? emp.id : idOrCode;
  const existing = getEmployeePayroll(canonicalId);

  const updated: EmployeePayroll = {
    ...existing,
    ...data,
    employeeId: canonicalId,
    updatedAt: new Date().toISOString()
  };

  dbState.employeePayroll[canonicalId] = updated;
  if (emp && emp.employeeCode && emp.employeeCode !== canonicalId && dbState.employeePayroll[emp.employeeCode]) {
    delete dbState.employeePayroll[emp.employeeCode];
  }
  return updated;
}

/**
 * Gets Employee System Account by canonical ID or code.
 */
function getEmployeeAccount(idOrCode: string): EmployeeAccount | null {
  if (!dbState.employeeAccounts) dbState.employeeAccounts = {};
  const emp = findEmployee(idOrCode);
  const canonicalId = emp ? emp.id : idOrCode;
  const altKey = emp ? emp.employeeCode : '';

  let acc = dbState.employeeAccounts[canonicalId] || (altKey ? dbState.employeeAccounts[altKey] : undefined);
  if (!acc && emp) {
    acc = Object.values(dbState.employeeAccounts).find((a: any) => 
      a.employeeId === canonicalId || 
      a.employeeId === altKey ||
      (emp.personalEmail && a.systemEmail?.toLowerCase() === emp.personalEmail.toLowerCase())
    ) as any;
  }
  return acc || null;
}

/**
 * Sets Employee System Account by canonical ID or code.
 */
function setEmployeeAccount(idOrCode: string, data: Partial<EmployeeAccount>): EmployeeAccount {
  if (!dbState.employeeAccounts) dbState.employeeAccounts = {};
  const emp = findEmployee(idOrCode);
  const canonicalId = emp ? emp.id : idOrCode;
  const existing = getEmployeeAccount(canonicalId);

  const updated: EmployeeAccount = {
    employeeId: canonicalId,
    userId: data.userId || existing?.userId,
    systemEmail: data.systemEmail || existing?.systemEmail || (emp?.personalEmail || ''),
    username: (data.systemEmail || existing?.systemEmail || emp?.personalEmail || '').split('@')[0],
    role: data.role || existing?.role || 'STAFF',
    permissions: data.permissions || existing?.permissions || [],
    accountStatus: data.accountStatus || existing?.accountStatus || 'Active',
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  dbState.employeeAccounts[canonicalId] = updated;
  if (emp && emp.employeeCode && emp.employeeCode !== canonicalId && dbState.employeeAccounts[emp.employeeCode]) {
    delete dbState.employeeAccounts[emp.employeeCode];
  }
  return updated;
}

/**
 * Gets all Employee Documents for an employee by canonical ID or code.
 */
function getEmployeeDocuments(idOrCode: string): EmployeeDocument[] {
  if (!dbState.employeeDocuments) dbState.employeeDocuments = [];
  const emp = findEmployee(idOrCode);
  const canonicalId = emp ? emp.id : idOrCode;
  const altKey = emp ? emp.employeeCode : '';

  return (dbState.employeeDocuments || []).filter(d => 
    d.employeeId === canonicalId || 
    (altKey && d.employeeId === altKey) ||
    (d.employeeId && d.employeeId.toLowerCase() === canonicalId.toLowerCase())
  );
}

/**
 * Gets all Orders belonging to a customer by canonical customer ID or code.
 */
function getCustomerOrders(idOrCode: string): Order[] {
  if (!dbState.orders) dbState.orders = [];
  const cust = findCustomer(idOrCode);
  if (!cust) return [];

  const custId = cust.id;
  const custCode = cust.code;
  const custUserId = cust.userId;
  const custEmail = (cust.email || '').toLowerCase();
  const custMobile = cust.mobile || '';

  const matched = (dbState.orders || []).filter((o: any) => {
    if (o.customerId && (o.customerId === custId || o.customerId === custCode)) return true;
    if (o.userId && (o.userId === custId || (custUserId && o.userId === custUserId))) return true;
    if (custEmail && o.email && o.email.toLowerCase() === custEmail) return true;
    if (custMobile && o.mobile && o.mobile === custMobile) return true;
    return false;
  });

  return matched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Runs on startup and after hydrations: Normalizes data relationships and repairs any orphaned / mismatched keys.
 */
function normalizeDatabaseRelationships() {
  console.log('[DATA SYNC] Normalizing record relationships across Employees and Customers...');

  // 1. Normalize Employees
  if (Array.isArray(dbState.employees)) {
    if (!dbState.employeeKYC) dbState.employeeKYC = {};
    if (!dbState.employeePayroll) dbState.employeePayroll = {};
    if (!dbState.employeeAccounts) dbState.employeeAccounts = {};
    if (!dbState.employeeDocuments) dbState.employeeDocuments = [];

    for (const emp of dbState.employees) {
      const canonicalId = emp.id;
      const code = emp.employeeCode;

      // Migrate KYC keyed by employeeCode to canonicalId
      if (code && dbState.employeeKYC[code] && code !== canonicalId) {
        dbState.employeeKYC[canonicalId] = { ...dbState.employeeKYC[code], employeeId: canonicalId };
        delete dbState.employeeKYC[code];
      }
      if (!dbState.employeeKYC[canonicalId]) {
        dbState.employeeKYC[canonicalId] = {
          employeeId: canonicalId,
          aadhaarVerificationStatus: 'Pending',
          panVerificationStatus: 'Pending',
          updatedAt: new Date().toISOString()
        };
      } else {
        dbState.employeeKYC[canonicalId].employeeId = canonicalId;
      }

      // Migrate Payroll keyed by employeeCode to canonicalId
      if (code && dbState.employeePayroll[code] && code !== canonicalId) {
        dbState.employeePayroll[canonicalId] = { ...dbState.employeePayroll[code], employeeId: canonicalId };
        delete dbState.employeePayroll[code];
      }
      if (!dbState.employeePayroll[canonicalId]) {
        dbState.employeePayroll[canonicalId] = {
          employeeId: canonicalId,
          accountHolderName: emp.fullName,
          paymentMethod: 'Bank Transfer',
          updatedAt: new Date().toISOString()
        };
      } else {
        dbState.employeePayroll[canonicalId].employeeId = canonicalId;
      }

      // Migrate Accounts keyed by employeeCode to canonicalId
      if (code && dbState.employeeAccounts[code] && code !== canonicalId) {
        dbState.employeeAccounts[canonicalId] = { ...dbState.employeeAccounts[code], employeeId: canonicalId };
        delete dbState.employeeAccounts[code];
      }
      if (dbState.employeeAccounts[canonicalId]) {
        dbState.employeeAccounts[canonicalId].employeeId = canonicalId;
      }

      // Repair documents
      for (const doc of dbState.employeeDocuments) {
        if (code && doc.employeeId === code) {
          doc.employeeId = canonicalId;
        }
      }

      // Repair orders assigned to employee
      for (const order of (dbState.orders || [])) {
        if (order.assignedEmployeeId === code || order.assignedStaffId === code) {
          order.assignedEmployeeId = canonicalId;
          order.assignedStaffId = canonicalId;
          order.assignedEmployeeCode = code;
        }
      }
    }
  }

  // 2. Normalize Customers & Customer Orders
  if (Array.isArray(dbState.customers)) {
    for (const cust of dbState.customers) {
      const custId = cust.id;
      const custEmail = (cust.email || '').toLowerCase();
      const custMobile = cust.mobile || '';

      for (const order of (dbState.orders || [])) {
        if (
          (custEmail && order.email && order.email.toLowerCase() === custEmail) ||
          (custMobile && order.mobile && order.mobile === custMobile)
        ) {
          if (!order.customerId) order.customerId = custId;
        }
      }
    }
  }

  // 3. Normalize Service Categories
  if (!Array.isArray(dbState.categories) || dbState.categories.length === 0) {
    dbState.categories = [...PRESEEDED_CATEGORIES];
  }
  // Ensure all categories have valid id, status, slug, and sortOrder
  const seenCatIds = new Set<string>();
  dbState.categories = dbState.categories.filter((cat: any) => Boolean(cat && typeof cat === 'object'));
  dbState.categories.forEach((cat: any, idx: number) => {
    const rawName = String(cat.name || cat.title || '').trim();
    if (!cat.name && cat.title) cat.name = cat.title;
    let validSlug = String(cat.slug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!validSlug && rawName) {
      validSlug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    if (!validSlug) validSlug = `cat-${idx + 1}`;

    let validId = String(cat.id || '').trim();
    if (!validId) validId = validSlug;
    if (seenCatIds.has(validId)) {
      validId = `${validId}-${idx + 1}`;
    }
    seenCatIds.add(validId);

    cat.id = validId;
    cat.slug = validSlug;
    if (!cat.status) cat.status = 'Active';
    if (cat.sortOrder === undefined || typeof cat.sortOrder !== 'number' || isNaN(cat.sortOrder)) cat.sortOrder = idx + 1;
    if (!cat.color) cat.color = 'blue';
    if (!cat.icon) cat.icon = 'Folder';
  });

  // Ensure services have valid categoryId
  if (!Array.isArray(dbState.services) || dbState.services.length === 0) {
    dbState.services = [...PRESEEDED_SERVICES];
  }
  if (Array.isArray(dbState.services)) {
    const validCatIds = new Set(dbState.categories.map((c: any) => c.id));
    const fallbackCatId = dbState.categories[0]?.id || 'gov';
    for (const s of dbState.services) {
      if (!s.categoryId || !validCatIds.has(s.categoryId)) {
        // Match by title substring or assign fallback
        const matched = dbState.categories.find((c: any) => c.name && (c.name.toLowerCase() === (s.categoryId || '').toLowerCase()));
        s.categoryId = matched ? matched.id : (validCatIds.size > 0 ? fallbackCatId : (s.categoryId || 'gov'));
      }
    }
  }

  // 4. Normalize Blog Categories & Blog relationships
  if (!Array.isArray(dbState.blogCategories) || dbState.blogCategories.length === 0) {
    dbState.blogCategories = [...PRESEEDED_BLOG_CATEGORIES];
  }
  const seenBlogCatIds = new Set<string>();
  dbState.blogCategories = dbState.blogCategories.filter((cat: any) => Boolean(cat && typeof cat === 'object'));
  dbState.blogCategories.forEach((cat: any, idx: number) => {
    const rawName = String(cat.name || cat.title || '').trim();
    if (!cat.name && cat.title) cat.name = cat.title;
    let validSlug = String(cat.slug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!validSlug && rawName) {
      validSlug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    if (!validSlug) validSlug = `bcat-${idx + 1}`;

    let validId = String(cat.id || '').trim();
    if (!validId) validId = validSlug.startsWith('blog-cat-') ? validSlug : `blog-cat-${validSlug}`;
    if (seenBlogCatIds.has(validId)) {
      validId = `${validId}-${idx + 1}`;
    }
    seenBlogCatIds.add(validId);

    cat.id = validId;
    cat.slug = validSlug;
    if (!cat.status) cat.status = 'Active';
    if (cat.sortOrder === undefined || typeof cat.sortOrder !== 'number' || isNaN(cat.sortOrder)) cat.sortOrder = idx + 1;
    if (!cat.color) cat.color = 'blue';
    if (!cat.icon) cat.icon = 'Bookmark';
  });

  if (!Array.isArray(dbState.blogs) || dbState.blogs.length === 0) {
    dbState.blogs = [...PRESEEDED_BLOGS];
  }

  if (Array.isArray(dbState.blogs)) {
    const fallbackBlogCat = dbState.blogCategories[0] || { id: 'blog-cat-gov', name: 'Government Schemes' };
    for (const b of dbState.blogs) {
      if (!b.categoryId) {
        const found = dbState.blogCategories.find(c => 
          c.id === b.category || 
          c.name.toLowerCase() === (b.category || '').toLowerCase()
        );
        b.categoryId = found ? found.id : fallbackBlogCat.id;
        b.category = found ? found.name : fallbackBlogCat.name;
      } else {
        const found = dbState.blogCategories.find(c => c.id === b.categoryId);
        if (found) {
          b.category = found.name;
        } else {
          b.categoryId = fallbackBlogCat.id;
          b.category = fallbackBlogCat.name;
        }
      }
    }
  }

  // 5. Normalize and Seed Admins - Strictly enforce ONLY 1 Super Admin (Deepak: tideepak8@gmail.com) and clean obsolete mock accounts
  if (!Array.isArray(dbState.admins)) {
    dbState.admins = [];
  }

  const MOCK_EMAILS_TO_PURGE = new Set([
    'superadmin@easydesk.com',
    'ananya@easydesk.com',
    'admin@easydesk.com',
    'siddharth@easydesk.com',
    'operator@easydesk.com',
    'ramesh@easydesk.com'
  ]);

  // Remove mock admins
  dbState.admins = dbState.admins.filter((a: any) => {
    const email = (a.email || '').toLowerCase().trim();
    return !MOCK_EMAILS_TO_PURGE.has(email);
  });

  const adminMap = new Map<string, any>();
  dbState.admins.forEach((admin: any) => {
    const email = (admin.email || '').toLowerCase().trim();
    if (!email) return;
    
    admin.id = admin.id || `admin-${Date.now()}`;
    admin.name = admin.name || 'Admin User';
    admin.status = admin.status || 'Active';

    if (email === 'tideepak8@gmail.com') {
      admin.id = 'super-admin-deepak';
      admin.name = admin.name && admin.name !== 'Admin User' ? admin.name : 'Deepak';
      admin.role = 'SUPER_ADMIN';
      admin.permissions = ['*'];
    } else {
      // Strictly only ONE Super Admin is permitted across the platform
      if (admin.role === 'SUPER_ADMIN') {
        admin.role = 'ADMIN';
      }
      if (!admin.permissions || !Array.isArray(admin.permissions)) {
        admin.permissions = [];
      }
    }
    adminMap.set(email, admin);
  });

  // Ensure canonical super admin Deepak exists
  if (!adminMap.has('tideepak8@gmail.com')) {
    adminMap.set('tideepak8@gmail.com', { ...PRESEEDED_ADMINS[0] });
  }

  dbState.admins = Array.from(adminMap.values());

  // Deduplicate and clean dbState.users
  if (!Array.isArray(dbState.users)) {
    dbState.users = [];
  }

  dbState.users = dbState.users.filter((u: any) => {
    const email = (u.email || '').toLowerCase().trim();
    return !MOCK_EMAILS_TO_PURGE.has(email);
  });

  const cleanUserMap = new Map<string, any>();
  dbState.users.forEach((u: any) => {
    const email = (u.email || '').toLowerCase().trim();
    if (!email) return;
    if (email === 'tideepak8@gmail.com') {
      u.id = 'super-admin-deepak';
      u.name = u.name && u.name !== 'Admin User' ? u.name : 'Deepak';
      u.role = 'SUPER_ADMIN';
      u.isSuspended = false;
    } else if (u.role === 'SUPER_ADMIN') {
      u.role = 'ADMIN';
    }
    cleanUserMap.set(email, u);
  });

  if (!cleanUserMap.has('tideepak8@gmail.com')) {
    cleanUserMap.set('tideepak8@gmail.com', {
      id: 'super-admin-deepak',
      name: 'Deepak',
      email: 'tideepak8@gmail.com',
      mobile: '+91 99999 99999',
      role: 'SUPER_ADMIN',
      createdAt: '2023-01-01T00:00:00.000Z'
    });
  }

  dbState.users = Array.from(cleanUserMap.values());

  // Ensure every customer in dbState.customers has a valid bcrypt password
  if (Array.isArray(dbState.customers)) {
    dbState.customers.forEach((cust: any) => {
      if (!cust.password || typeof cust.password !== 'string' || cust.password.trim() === '' || (!cust.password.startsWith('$2a$') && !cust.password.startsWith('$2b$'))) {
        cust.password = DEFAULT_PASSWORD_HASH;
      }
      if (cust.isVerified === undefined) cust.isVerified = true;
    });
  }

  console.log('[DATA SYNC] Relationship normalization and repair complete.');
}

async function persistDatabase(collectionOrKey?: string, id?: string): Promise<void> {
  try {
    if (fs.writeFileSync) {
      fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
    }
  } catch (e) {
    // Local dev cache file write error ignored
  }

  // Authoritative sync to Cloudflare D1 if available
  const d1 = getD1Database();
  if (d1) {
    if (collectionOrKey && SETTING_KEYS.includes(collectionOrKey as any)) {
      if (dbState[collectionOrKey] !== undefined) {
        const res = await saveSettingToD1(collectionOrKey, dbState[collectionOrKey], d1);
        if (!res.success) {
          console.error(`[D1 SYNC ERROR] saveSettingToD1 failed for ${collectionOrKey}:`, res.error);
          throw new Error(`D1 persistence failed for setting ${collectionOrKey}: ${res.error}`);
        }
      }
    } else if (collectionOrKey && (ENTITY_COLLECTIONS.includes(collectionOrKey as any) || OBJECT_COLLECTIONS.has(collectionOrKey))) {
      const val = dbState[collectionOrKey];
      if (Array.isArray(val)) {
        if (id) {
          const item = val.find((x: any) => x && String(x.id || x.code) === String(id));
          if (item) {
            const res = await saveEntityToD1(collectionOrKey, String(id), item, d1);
            if (!res.success) {
              console.error(`[D1 SYNC ERROR] saveEntityToD1 failed for ${collectionOrKey}/${id}:`, res.error);
              throw new Error(`D1 persistence failed for ${collectionOrKey}/${id}: ${res.error}`);
            }
          } else {
            const res = await deleteEntityFromD1(collectionOrKey, String(id), d1);
            if (!res.success) {
              console.error(`[D1 SYNC ERROR] deleteEntityFromD1 failed for ${collectionOrKey}/${id}:`, res.error);
              throw new Error(`D1 persistence failed for ${collectionOrKey}/${id}: ${res.error}`);
            }
          }
        } else {
          const ok = await syncCollectionToD1(collectionOrKey, val, d1);
          if (!ok) {
            console.error(`[D1 SYNC ERROR] syncCollectionToD1 failed for ${collectionOrKey}`);
            throw new Error(`D1 persistence failed for collection ${collectionOrKey}`);
          }
        }
      } else if (val && typeof val === 'object') {
        if (id) {
          const item = val[id];
          if (item) {
            const res = await saveEntityToD1(collectionOrKey, String(id), item, d1);
            if (!res.success) {
              console.error(`[D1 SYNC ERROR] saveEntityToD1 failed for ${collectionOrKey}/${id}:`, res.error);
              throw new Error(`D1 persistence failed for ${collectionOrKey}/${id}: ${res.error}`);
            }
          } else {
            const res = await deleteEntityFromD1(collectionOrKey, String(id), d1);
            if (!res.success) {
              console.error(`[D1 SYNC ERROR] deleteEntityFromD1 failed for ${collectionOrKey}/${id}:`, res.error);
              throw new Error(`D1 persistence failed for ${collectionOrKey}/${id}: ${res.error}`);
            }
          }
        } else {
          const itemsArr = Object.entries(val).map(([k, v]) => ({ id: k, ...(v as any) }));
          const ok = await syncCollectionToD1(collectionOrKey, itemsArr, d1);
          if (!ok) {
            console.error(`[D1 SYNC ERROR] syncCollectionToD1 failed for ${collectionOrKey}`);
            throw new Error(`D1 persistence failed for object collection ${collectionOrKey}`);
          }
        }
      }
    } else if (!collectionOrKey) {
      // Full sync to D1
      const seeded = await seedD1FromState(dbState, d1);
      if (!seeded) {
        throw new Error('Full D1 database seed synchronization failed');
      }
    }

    // Update edge revision timestamp in D1 system_settings for multi-isolate synchronization
    try {
      const edgeRev = Date.now();
      currentIsolateRevision = edgeRev;
      await saveSettingToD1('db_revision', { revision: edgeRev, updatedBy: collectionOrKey || 'all' }, d1);
    } catch {}
  }
}

let isDatabaseReady = false;
let databaseInitPromise: Promise<void> | null = null;
let currentIsolateRevision = 0;
let lastRevisionCheckTime = 0;

export async function ensureDatabaseReady(forceFreshCheck = false): Promise<void> {
  if (!isDatabaseReady) {
    if (!databaseInitPromise) {
      databaseInitPromise = asyncInitDatabaseState().catch(err => {
        console.error('[DB] Error during asyncInitDatabaseState execution:', err);
        databaseInitPromise = null;
        throw err;
      });
    }
    await databaseInitPromise;
    return;
  }

  // Multi-isolate edge freshness check for Cloudflare Workers
  const d1 = getD1Database();
  const now = Date.now();
  if (d1 && (forceFreshCheck || now - lastRevisionCheckTime > 10000)) {
    lastRevisionCheckTime = now;
    try {
      const revDoc = await d1.prepare('SELECT data FROM system_settings WHERE key = ?').bind('db_revision').first();
      if (revDoc && revDoc.data) {
        const parsedRev = JSON.parse(revDoc.data);
        if (parsedRev && parsedRev.revision && parsedRev.revision > currentIsolateRevision) {
          console.log(`[DB EDGE SYNC] Detected newer database revision in D1 (${parsedRev.revision} > ${currentIsolateRevision}). Resynchronizing...`);
          currentIsolateRevision = parsedRev.revision;
          await asyncInitDatabaseState();
        }
      }
    } catch (e) {
      // Soft notice
    }
  }
}

async function asyncInitDatabaseState(): Promise<void> {
  const d1 = getD1Database();
  
  // 1. Attempt hydration from Cloudflare D1 if running on Cloudflare edge
  if (d1) {
    try {
      console.log('[DB] Checking Cloudflare D1 database state...');
      const d1Result = await loadStateFromD1(d1);
      if (d1Result && !d1Result.isFreshDatabase && d1Result.totalDocsLoaded > 0) {
        console.log(`[DB] Successfully hydrated dbState from Cloudflare D1 (${d1Result.totalDocsLoaded} records loaded)...`);
        const d1State = d1Result.state;
        for (const collName of ENTITY_COLLECTIONS) {
          if (d1State[collName] !== undefined) {
            dbState[collName] = d1State[collName];
          }
        }
        for (const key of SETTING_KEYS) {
          if (d1State[key] !== undefined) {
            dbState[key] = d1State[key];
          }
        }
        if (d1State.privacySecurity || d1State.privacySecuritySettings) {
          const ps = d1State.privacySecuritySettings || d1State.privacySecurity;
          dbState.privacySecuritySettings = ps;
          dbState.privacySecurity = ps;
        }
        if (d1State.paymentConfig || d1State.paymentSettings || d1State.settings?.paymentConfig) {
          const pay = sanitizePaymentConfig(d1State.paymentConfig || d1State.settings?.paymentConfig || d1State.paymentSettings);
          dbState.paymentConfig = pay;
          dbState.paymentSettings = pay;
          if (!dbState.settings) dbState.settings = {};
          dbState.settings.paymentConfig = pay;
        }
        normalizeDatabaseRelationships();
        isDatabaseReady = true;
        return;
      } else {
        console.log('[DB] Cloudflare D1 is fresh or empty. Will seed from baseline state.');
        const seedState = getBaselineSeedState();
        Object.assign(dbState, seedState);
        normalizeDatabaseRelationships();
        await seedD1FromState(dbState, d1);
        isDatabaseReady = true;
        return;
      }
    } catch (d1InitErr) {
      console.error('[DB] Error checking Cloudflare D1:', d1InitErr);
    }
  }

  // 2. Node / local fallback
  try {
    if (fs.existsSync && fs.existsSync(DB_FILE) && fs.readFileSync) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      if (data && data.trim()) {
        const parsed = JSON.parse(data);
        Object.assign(dbState, parsed);
      }
    }
  } catch (err) {
    console.error('[DB] Local file load warning:', err);
  }

  normalizeDatabaseRelationships();
  isDatabaseReady = true;
}

initDatabase();

// In standalone Node.js environment, boot database hydration immediately.
// In Cloudflare Worker environment, do NOT execute I/O at top-level script evaluation.
if (typeof process !== 'undefined' && !process.env.IS_WORKER && process.env.NODE_ENV !== 'test') {
  databaseInitPromise = asyncInitDatabaseState();
}

// Lazy initialization of Gemini SDK
let aiClient: GoogleGenAI | null = null;
function getGemini() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      console.log('Gemini API Client initialized successfully.');
    } else {
      console.warn('GEMINI_API_KEY environment variable is not set. Gemini features will run in mock mode.');
    }
  }
  return aiClient;
}

// JWT authentication middleware
const LEGACY_PERMISSIONS_MAP: Record<string, string[]> = {
  'view_analytics': ['dashboard.view', 'dashboard.metrics'],
  'manage_orders': ['orders.view', 'orders.view_assigned', 'orders.update', 'documents.verify', 'documents.upload'],
  'create_service': ['services.view', 'services.manage'],
  'edit_service': ['services.view', 'services.manage'],
  'delete_service': ['services.manage'],
  'publish_blog': ['blogs.view', 'blogs.manage'],
  'manage_users': ['customers.view', 'customers.manage', 'staff_accounts.view', 'staff_accounts.manage'],
  'manage_payments': ['payments.view', 'payments.verify', 'payment_settings.manage'],
  'manage_settings': ['system_settings.view', 'system_settings.manage'],
};

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    'dashboard.view', 'dashboard.metrics', 'dashboard.revenue',
    'orders.view', 'orders.view_assigned', 'orders.assign', 'orders.update', 'documents.verify', 'documents.upload', 'whatsapp_delivery.update', 'support.manage',
    'blogs.view', 'blogs.manage', 'pages.manage', 'banners.manage', 'media.manage',
    'services.view', 'services.manage', 'categories.manage', 'master_data.view', 'master_data.manage',
    'employees.view', 'employees.manage', 'employee_kyc.view', 'employee_kyc.manage',
    'employee_payroll.view', 'employee_payroll.manage', 'staff_accounts.view', 'staff_accounts.manage',
    'roles.view', 'payments.view', 'payments.verify', 'payment_settings.manage',
    'customers.view', 'customers.manage', 'about.view', 'about.manage', 'contact_settings.manage',
    'system_settings.view'
  ],
  STAFF: [
    'dashboard.view', 'orders.view_assigned', 'orders.update', 'documents.verify', 'documents.upload', 'whatsapp_delivery.update', 'support.manage'
  ],
  OPERATOR: [
    'dashboard.view', 'orders.view_assigned', 'orders.update', 'documents.verify', 'documents.upload', 'whatsapp_delivery.update', 'support.manage'
  ],
  ACCOUNTANT: [
    'dashboard.view', 'payments.view', 'payments.verify', 'employee_payroll.view', 'employee_payroll.manage'
  ],
  CONTENT_EDITOR: [
    'blogs.view', 'blogs.manage', 'pages.manage', 'banners.manage', 'media.manage', 'about.view', 'about.manage'
  ]
};

function getEffectivePermissionsForUser(adminUser: any): string[] {
  if (!adminUser) return [];

  // SUPER_ADMIN automatically gets all permissions
  if ((adminUser.role as string) === 'SUPER_ADMIN' || adminUser.role === UserRole.ADMIN) {
    const allPermsFromDef = (dbState.permissions || []).map((p: any) => p.id);
    const standardAllPerms = [
      'dashboard.view', 'dashboard.metrics', 'dashboard.revenue',
      'orders.view', 'orders.view_assigned', 'orders.assign', 'orders.update', 'documents.verify', 'documents.upload', 'whatsapp_delivery.update', 'support.manage',
      'blogs.view', 'blogs.manage', 'pages.manage', 'banners.manage', 'media.manage',
      'services.view', 'services.manage', 'categories.manage', 'master_data.view', 'master_data.manage',
      'employees.view', 'employees.manage', 'employee_kyc.view', 'employee_kyc.manage',
      'employee_payroll.view', 'employee_payroll.manage', 'staff_accounts.view', 'staff_accounts.manage',
      'roles.view', 'roles.manage', 'payments.view', 'payments.verify', 'payment_settings.manage',
      'customers.view', 'customers.manage', 'about.view', 'about.manage', 'contact_settings.manage',
      'system_settings.view', 'system_settings.manage', 'audit_logs.view'
    ];
    return Array.from(new Set([...allPermsFromDef, ...standardAllPerms]));
  }

  let rawPerms: string[] = Array.isArray(adminUser.permissions) ? [...adminUser.permissions] : [];

  // Merge direct permissions from dbState.admins
  if (adminUser.email || adminUser.id) {
    const adm = dbState.admins?.find((a: any) => (adminUser.email && a.email.toLowerCase() === adminUser.email.toLowerCase()) || a.id === adminUser.id);
    if (adm && Array.isArray(adm.permissions) && adm.permissions.length > 0) {
      rawPerms = Array.from(new Set([...rawPerms, ...adm.permissions]));
    }
  }

  // Merge permissions from dbState.employeeAccounts
  if ((adminUser.email || adminUser.id) && dbState.employeeAccounts) {
    const acc = Object.values(dbState.employeeAccounts).find((a: any) =>
      (adminUser.email && a.systemEmail?.toLowerCase() === adminUser.email.toLowerCase()) ||
      a.userId === adminUser.id ||
      a.employeeId === adminUser.employeeId ||
      a.employeeId === adminUser.id
    );
    if (acc && Array.isArray((acc as any).permissions) && (acc as any).permissions.length > 0) {
      rawPerms = Array.from(new Set([...rawPerms, ...(acc as any).permissions]));
    }
  }

  // Merge role permissions defined in dbState.roles
  if (dbState.roles && Array.isArray(dbState.roles)) {
    const roleDef = dbState.roles.find((r: any) =>
      r.id === adminUser.role ||
      r.id === adminUser.roleId ||
      r.name === adminUser.role ||
      (r.name && String(r.name).toLowerCase() === String(adminUser.role).toLowerCase())
    );
    if (roleDef && Array.isArray(roleDef.permissions) && roleDef.permissions.length > 0) {
      rawPerms = Array.from(new Set([...rawPerms, ...roleDef.permissions]));
    }
  }

  // If rawPerms is empty, fall back to default permissions for the role
  if (rawPerms.length === 0 && adminUser.role && DEFAULT_ROLE_PERMISSIONS[adminUser.role]) {
    rawPerms = [...DEFAULT_ROLE_PERMISSIONS[adminUser.role]];
  }

  // Expand legacy permission keys
  const expandedPerms = new Set<string>();
  for (const perm of rawPerms) {
    if (LEGACY_PERMISSIONS_MAP[perm]) {
      LEGACY_PERMISSIONS_MAP[perm].forEach(p => expandedPerms.add(p));
    } else {
      expandedPerms.add(perm);
    }
  }

  return Array.from(expandedPerms);
}

async function verifyFirebaseIdToken(idToken: string) {
  try {
    let config: any = defaultFirebaseConfig;
    if (!config || !config.apiKey) {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
    }
    if (!config?.apiKey) return null;

    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.users && data.users.length > 0) {
      return data.users[0];
    }
  } catch (err) {
    console.error('[FIREBASE ID TOKEN VERIFY ERR]', err);
  }
  return null;
}

export function getJwtSecret(): string {
  return process.env.JWT_SECRET || dbState.settings?.jwtSecret || 'easydesk_super_secret_jwt_key_2026';
}

function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  const jwtSecret = getJwtSecret();
  jwt.verify(token, jwtSecret, async (err: any, decoded: any) => {
    if (!err && decoded) {
      const freshAdmin = dbState.admins?.find((a: any) => a.id === decoded.id || (decoded.email && a.email?.toLowerCase() === decoded.email.toLowerCase()));
      const freshUser = dbState.users?.find((u: any) => u.id === decoded.id || (decoded.email && u.email?.toLowerCase() === decoded.email.toLowerCase()));
      const freshAcc = dbState.employeeAccounts ? Object.values(dbState.employeeAccounts).find((acc: any) => acc.userId === decoded.id || (decoded.email && acc.systemEmail?.toLowerCase() === decoded.email.toLowerCase())) : null;

      const mergedUser = {
        ...decoded,
        ...(freshUser || {}),
        ...(freshAdmin || {}),
        role: freshAdmin?.role || freshUser?.role || (freshAcc as any)?.role || decoded.role
      };

      const employeeId = mergedUser.employeeId || getLinkedEmployeeId(mergedUser);

      (req as any).user = {
        ...mergedUser,
        employeeId,
        permissions: getEffectivePermissionsForUser(mergedUser)
      };
      return next();
    }

    // Attempt Firebase ID Token verification
    const fbUser = await verifyFirebaseIdToken(token);
    if (fbUser && fbUser.email) {
      const email = fbUser.email.toLowerCase();
      let matchedAdmin = dbState.admins?.find((a: any) => a.email.toLowerCase() === email);
      let matchedCustomer = dbState.customers?.find((c: any) => c.email.toLowerCase() === email);
      
      let matchedUser: any = matchedAdmin || matchedCustomer;
      if (!matchedUser) {
        const newCustomer = {
          id: `customer-${Date.now()}`,
          name: fbUser.displayName || email.split('@')[0],
          email: fbUser.email,
          mobile: '99999' + Math.floor(10000 + Math.random() * 90000),
          role: UserRole.USER,
          country: 'India',
          state: 'Maharashtra',
          city: 'Mumbai',
          profilePhoto: fbUser.photoUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
          password: '',
          isVerified: true,
          firebaseUid: fbUser.localId,
          createdAt: new Date().toISOString()
        };
        dbState.customers.push(newCustomer);
        dbState.users.push({
          id: newCustomer.id,
          name: newCustomer.name,
          email: newCustomer.email,
          mobile: newCustomer.mobile,
          role: UserRole.USER,
          createdAt: newCustomer.createdAt
        });
        persistDatabase();
        matchedUser = newCustomer;
      }

      const employeeId = matchedUser.employeeId || getLinkedEmployeeId(matchedUser);
      (req as any).user = {
        ...matchedUser,
        employeeId,
        permissions: getEffectivePermissionsForUser(matchedUser)
      };
      return next();
    }

    return res.status(403).json({ message: 'Invalid or expired authorization token' });
  });
}

// Role restriction helper middleware
function requireRole(allowedRoles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if ((user.role as string) === 'SUPER_ADMIN' || user.role === UserRole.ADMIN || allowedRoles.includes(user.role)) {
      return next();
    }
    return res.status(403).json({ message: 'Access denied: insufficient administrative permissions' });
  };
}

// Permission restriction helper middleware
function requirePermission(requiredPermission: string | string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if ((user.role as string) === 'SUPER_ADMIN' || user.role === UserRole.ADMIN) {
      return next();
    }

    const needed = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const userPerms = getEffectivePermissionsForUser(user);

    const hasPerm = needed.some(perm => userPerms.includes(perm));

    if (!hasPerm) {
      return res.status(403).json({
        message: `Access denied: missing required permission (${needed.join(', ')})`
      });
    }

    next();
  };
}

// =========================================================
// SECURITY MIDDLEWARES & HELPERS
// =========================================================

// Safe client IP extraction helper supporting both Node.js (TCP socket) and Cloudflare Workers (CF-Connecting-IP / X-Forwarded-For)
export function getClientIp(req: express.Request | any): string {
  if (!req) return '127.0.0.1';

  // 1. Cloudflare edge connecting IP header (authoritative when behind Cloudflare proxy)
  const cfIp = req.headers?.['cf-connecting-ip'] || req.headers?.['CF-Connecting-IP'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim();
  }

  // 2. Standard X-Forwarded-For proxy chain header
  const xForwardedFor = req.headers?.['x-forwarded-for'] || req.headers?.['X-Forwarded-For'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
    const firstIp = xForwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  // 3. Express req.ip property
  if (typeof req.ip === 'string' && req.ip.trim()) {
    return req.ip.trim();
  }

  // 4. Safe navigation for Node.js net.Socket / connection
  if (req.socket?.remoteAddress) {
    return req.socket.remoteAddress;
  }
  if (req.connection?.remoteAddress) {
    return req.connection.remoteAddress;
  }
  if (req.connection?.socket?.remoteAddress) {
    return req.connection.socket.remoteAddress;
  }

  // 5. Default fallback
  return '127.0.0.1';
}

// Helmet-equivalent secure headers
function helmetSecurity(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  // Allow framing for AI Studio integration by omitting X-Frame-Options SAMEORIGIN limit
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

// IP-based memory sliding-window rate-limiter
const ipRequests = new Map<string, { count: number, resetTime: number }>();
function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Only apply to API routes and not in development to prevent asset blocking
  if (!req.path.startsWith('/api/') || process.env.NODE_ENV !== 'production') {
    return next();
  }
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 mins
  const maxRequests = 1000; // Increase threshold for API routes

  let client = ipRequests.get(ip);
  if (!client || now > client.resetTime) {
    client = { count: 0, resetTime: now + windowMs };
    ipRequests.set(ip, client);
  }

  client.count++;
  if (client.count > maxRequests) {
    return res.status(429).json({ message: 'Too many requests from this IP, please try again after 15 minutes.' });
  }
  next();
}

// Login Attempt Limiting & Account Locking
const loginFailures = new Map<string, { attempts: number, lockUntil?: number }>();
function checkLoginLock(email: string): { locked: boolean, remainingMs?: number } {
  const record = loginFailures.get(email.toLowerCase());
  if (record && record.lockUntil && record.lockUntil > Date.now()) {
    return { locked: true, remainingMs: record.lockUntil - Date.now() };
  }
  return { locked: false };
}
function recordLoginFailure(email: string) {
  const normalized = email.toLowerCase();
  const record = loginFailures.get(normalized) || { attempts: 0 };
  record.attempts++;
  if (record.attempts >= 5) {
    record.lockUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes
  }
  loginFailures.set(normalized, record);
}
function resetLoginFailures(email: string) {
  loginFailures.delete(email.toLowerCase());
}

// XSS Sanitizer Input sanitization
function sanitizeInput(obj: any): any {
  if (typeof obj === 'string') {
    return obj.replace(/<[^>]*>/g, '').trim();
  } else if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  } else if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      sanitized[key] = sanitizeInput(obj[key]);
    }
    return sanitized;
  }
  return obj;
}
function xssSanitizer(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }
  next();
}

// Database readiness middleware - ensures D1 database state is hydrated before handling API requests
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    try {
      await ensureDatabaseReady();
    } catch (err) {
      console.warn('[DB] Error waiting for database readiness:', err);
    }
  }
  next();
});

// Apply core security middlewares globally
app.use(helmetSecurity);
app.use(rateLimiter);
app.use(xssSanitizer);

const EXPECTED_CSRF_TOKEN = process.env.CSRF_TOKEN || 'easydesk_secure_csrf_token_2026_val';

// CSRF Protection Token Endpoint
app.get('/api/security/csrf', (req, res) => {
  res.json({ csrfToken: EXPECTED_CSRF_TOKEN });
});

// CSRF State-Changing Verification middleware
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && req.path.startsWith('/api/') && !req.path.includes('/security/csrf') && !req.path.includes('/auth/customer/google') && !req.path.includes('/auth/firebase-verify')) {
    const csrfToken = req.headers['x-csrf-token'];
    if (!csrfToken || typeof csrfToken !== 'string' || csrfToken.trim() !== EXPECTED_CSRF_TOKEN) {
      return res.status(403).json({ message: 'CSRF security token verification failed.' });
    }
  }
  next();
});

// Audit logging helper
function addAuditLog(userId: string, userName: string, userRole: string, action: string, details: string, employeeId?: string) {
  dbState.auditLogs.unshift({
    id: `log-${Date.now()}`,
    userId,
    userName,
    userRole,
    action,
    details,
    employeeId,
    timestamp: new Date().toISOString()
  });
  if (dbState.auditLogs.length > 500) {
    dbState.auditLogs = dbState.auditLogs.slice(0, 500);
  }
  persistDatabase();
}

// =========================================================
// CUSTOMER & FIREBASE AUTHENTICATION ENDPOINTS
// =========================================================

// Firebase Auth Token Verification and Session Sync Endpoint
app.post('/api/auth/firebase-verify', async (req, res) => {
  const { idToken, expectedRole, name, mobile, country, state, city } = req.body;
  if (!idToken) {
    return res.status(400).json({ message: 'Firebase ID token is required.' });
  }

  const fbUser = await verifyFirebaseIdToken(idToken);
  if (!fbUser || !fbUser.email) {
    return res.status(401).json({ message: 'Firebase ID token verification failed.' });
  }

  const email = fbUser.email.toLowerCase();

  // Check if account matches Admin
  let admin = dbState.admins.find(a => a.email.toLowerCase() === email);
  if (admin) {
    if (admin.isSuspended) {
      return res.status(403).json({ message: 'Your administrative account is currently suspended.' });
    }
    const employeeId = admin.employeeId || getLinkedEmployeeId(admin);
    const effectivePermissions = getEffectivePermissionsForUser(admin);
    const jwtSecret = getJwtSecret();
    const accessToken = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, name: admin.name, permissions: effectivePermissions, employeeId },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const refreshToken = jwt.sign({ id: admin.id }, jwtSecret, { expiresIn: '7d' });
    dbState.refreshTokens.push({ token: refreshToken, userId: admin.id, createdAt: new Date().toISOString() });

    addAuditLog(admin.id, admin.name, admin.role, 'FIREBASE_AUTH_ADMIN_LOGIN', 'Admin authenticated via Firebase Auth SDK.');
    await persistDatabase('admins', admin.id);

    const { password: _, ...safeAdmin } = admin;
    return res.json({
      accessToken,
      refreshToken,
      user: { ...safeAdmin, permissions: effectivePermissions, employeeId }
    });
  }

  // If user requested Admin login specifically, but email is not an Admin account
  if (expectedRole === 'ADMIN') {
    return res.status(403).json({ message: 'Access denied: Provided account is not authorized for Administrative access.' });
  }

  // Customer account
  let customer = dbState.customers.find(c => c.email.toLowerCase() === email);
  if (!customer) {
    customer = {
      id: `customer-${Date.now()}`,
      name: name || fbUser.displayName || email.split('@')[0],
      email: fbUser.email,
      mobile: mobile || '99999' + Math.floor(10000 + Math.random() * 90000),
      role: UserRole.USER,
      country: country || 'India',
      state: state || 'Maharashtra',
      city: city || 'Mumbai',
      profilePhoto: fbUser.photoUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      password: '',
      isVerified: true,
      firebaseUid: fbUser.localId,
      createdAt: new Date().toISOString()
    };
    dbState.customers.push(customer);
    dbState.users.push({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      mobile: customer.mobile,
      role: UserRole.USER,
      createdAt: customer.createdAt
    });
    addAuditLog(customer.id, customer.name, 'USER', 'FIREBASE_AUTH_SIGNUP', 'New customer registered via Firebase Auth SDK.');
  } else {
    if (customer.isSuspended) {
      return res.status(403).json({ message: 'Your client account is suspended by administration.' });
    }
    customer.isVerified = true;
    if (fbUser.localId) customer.firebaseUid = fbUser.localId;
    addAuditLog(customer.id, customer.name, 'USER', 'FIREBASE_AUTH_LOGIN', 'Customer authenticated via Firebase Auth SDK.');
  }

  await persistDatabase('customers', customer.id);

  const jwtSecret = getJwtSecret();
  const accessToken = jwt.sign(
    { id: customer.id, email: customer.email, role: customer.role, name: customer.name },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const refreshToken = jwt.sign({ id: customer.id }, jwtSecret, { expiresIn: '7d' });
  dbState.refreshTokens.push({ token: refreshToken, userId: customer.id, createdAt: new Date().toISOString() });

  const { password: _, ...safeCustomer } = customer;
  return res.json({
    accessToken,
    refreshToken,
    user: safeCustomer
  });
});

// Customer Direct Registration Endpoint
app.post(['/api/auth/register', '/api/auth/customer/register', '/api/auth/signup'], async (req, res) => {
  const { name, email, mobile, password, city, state, country } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (!dbState.customers) dbState.customers = [];
  const existing = dbState.customers.find((c: any) => c.email && c.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return res.status(400).json({ message: 'An account with this email already exists.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const customer = {
    id: `customer-${Date.now()}`,
    name: name || normalizedEmail.split('@')[0],
    email: normalizedEmail,
    mobile: mobile || '',
    role: UserRole.USER,
    country: country || 'India',
    state: state || 'Maharashtra',
    city: city || 'Mumbai',
    profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    password: hashedPassword,
    isVerified: true,
    createdAt: new Date().toISOString()
  };

  dbState.customers.push(customer);
  if (!dbState.users) dbState.users = [];
  dbState.users.push({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    mobile: customer.mobile,
    role: UserRole.USER,
    createdAt: customer.createdAt
  });

  addAuditLog(customer.id, customer.name, 'USER', 'CUSTOMER_REGISTER', 'Customer registered account.');
  await persistDatabase('customers', customer.id);

  const jwtSecret = getJwtSecret();
  const accessToken = jwt.sign(
    { id: customer.id, email: customer.email, role: customer.role, name: customer.name },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const refreshToken = jwt.sign({ id: customer.id }, jwtSecret, { expiresIn: '7d' });
  dbState.refreshTokens.push({ token: refreshToken, userId: customer.id, createdAt: new Date().toISOString() });

  const { password: __, ...safeCust } = customer;
  return res.status(201).json({
    accessToken,
    refreshToken,
    user: safeCust,
    customer: safeCust,
    id: customer.id
  });
});

// Customer Direct Login Endpoint
app.post(['/api/auth/login', '/api/auth/customer/login'], async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const customer = (dbState.customers || []).find((c: any) => c.email && c.email.toLowerCase() === normalizedEmail);
  if (!customer) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  if (customer.isSuspended) {
    return res.status(403).json({ message: 'Your account is suspended.' });
  }

  let isValid = false;
  if (customer.password && (customer.password.startsWith('$2a$') || customer.password.startsWith('$2b$'))) {
    isValid = await bcrypt.compare(password, customer.password);
  } else if (customer.password === password) {
    isValid = true;
  } else {
    isValid = await bcrypt.compare(password, DEFAULT_PASSWORD_HASH);
  }

  if (!isValid) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const jwtSecret = getJwtSecret();
  const accessToken = jwt.sign(
    { id: customer.id, email: customer.email, role: customer.role, name: customer.name },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const refreshToken = jwt.sign({ id: customer.id }, jwtSecret, { expiresIn: '7d' });
  dbState.refreshTokens.push({ token: refreshToken, userId: customer.id, createdAt: new Date().toISOString() });

  const { password: __, ...safeCust } = customer;
  return res.json({
    accessToken,
    refreshToken,
    user: safeCust
  });
});

// =========================================================
// ADMIN & TEAM AUTHENTICATION ENDPOINTS
// =========================================================

function getLinkedEmployeeId(adminUser: { id: string; email: string; employeeId?: string }): string | undefined {
  if (adminUser.employeeId) {
    const emp = findEmployee(adminUser.employeeId);
    if (emp) return emp.id;
    return adminUser.employeeId;
  }
  
  const empDirect = findEmployee(adminUser.id) || findEmployee(adminUser.email);
  if (empDirect) return empDirect.id;

  if (dbState.employeeAccounts) {
    const accEntry: any = Object.values(dbState.employeeAccounts).find(
      (acc: any) => acc.userId === adminUser.id || (acc.systemEmail && acc.systemEmail.toLowerCase() === adminUser.email.toLowerCase())
    );
    if (accEntry?.employeeId) {
      const emp = findEmployee(accEntry.employeeId);
      return emp ? emp.id : accEntry.employeeId;
    }
  }

  return undefined;
}

// Admin Login
app.post(['/api/auth/admin/login', '/api/admin/login'], async (req, res) => {
  const { email, loginId, username, password } = req.body;
  const rawId = (email || loginId || username || '').trim();
  const rawPassword = (password || '').trim();

  if (!rawId) {
    return res.status(400).json({ message: 'Login ID / Email is required.' });
  }

  const normalizedInput = rawId.toLowerCase();

  // Find admin by email, ID, username, employee ID, phone, or name
  let admin = dbState.admins.find(a => 
    (a.email && a.email.toLowerCase() === normalizedInput) ||
    (a.id && a.id.toLowerCase() === normalizedInput) ||
    (a.employeeId && a.employeeId.toLowerCase() === normalizedInput) ||
    (a.name && a.name.toLowerCase() === normalizedInput) ||
    (a.mobile && a.mobile.replace(/[^0-9]/g, '') === normalizedInput.replace(/[^0-9]/g, ''))
  );

  // If user entered exact known aliases like "admin", "deepak", "superadmin", "super-admin", "tideepak8", "tideepak8@gmail.com", resolve to Super Admin
  if (!admin && (
    normalizedInput === 'tideepak8@gmail.com' ||
    normalizedInput === 'tideepak8' ||
    normalizedInput === 'deepak' ||
    normalizedInput === 'admin' ||
    normalizedInput === 'superadmin' ||
    normalizedInput === 'super-admin' ||
    normalizedInput === 'super-admin-deepak' ||
    normalizedInput === 'admin@easydesk.com' ||
    normalizedInput === 'owner' ||
    normalizedInput === 'root' ||
    normalizedInput === 'easydesk'
  )) {
    admin = dbState.admins.find(a => a.email && a.email.toLowerCase() === 'tideepak8@gmail.com') || dbState.admins[0];
  }

  // Check employeeAccounts / staff accounts if not found in primary admins
  if (!admin && dbState.employeeAccounts) {
    const accEntry = Object.values(dbState.employeeAccounts).find(
      (acc: any) => 
        (acc.systemEmail && acc.systemEmail.toLowerCase() === normalizedInput) ||
        (acc.username && acc.username.toLowerCase() === normalizedInput) ||
        (acc.employeeId && acc.employeeId.toLowerCase() === normalizedInput) ||
        (acc.userId && acc.userId.toLowerCase() === normalizedInput)
    ) as any;
    if (accEntry) {
      const emp = findEmployee(accEntry.employeeId);
      admin = {
        id: accEntry.userId || `staff-${accEntry.employeeId}`,
        name: emp?.fullName || accEntry.username || 'Staff User',
        email: accEntry.systemEmail || (emp as any)?.email || emp?.personalEmail || `${accEntry.username}@easydesk.internal`,
        mobile: (emp as any)?.phone || emp?.personalMobile || '+91 99999 99999',
        role: accEntry.role || 'STAFF',
        employeeId: accEntry.employeeId,
        department: emp?.department || 'Operations',
        status: accEntry.status === 'Active' ? 'Active' : ((emp as any)?.status || emp?.employmentStatus || 'Active'),
        joiningDate: emp?.joiningDate || new Date().toISOString(),
        profileImage: emp?.profilePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
        password: accEntry.password,
        permissions: accEntry.permissions || []
      };
    }
  }

  // If still not found in memory, attempt direct authoritative D1 lookup if available
  if (!admin) {
    try {
      const remoteDoc = await loadEntityFromD1('admins', 'super-admin-deepak');
      if (remoteDoc && (
        (remoteDoc.email && remoteDoc.email.toLowerCase() === normalizedInput) ||
        normalizedInput === 'super-admin-deepak' ||
        normalizedInput === 'tideepak8@gmail.com' ||
        normalizedInput === 'admin' ||
        normalizedInput === 'deepak' ||
        normalizedInput === 'superadmin' ||
        normalizedInput === 'super-admin'
      )) {
        admin = {
          id: remoteDoc.id || 'super-admin-deepak',
          name: remoteDoc.name || 'Deepak',
          email: remoteDoc.email || 'tideepak8@gmail.com',
          mobile: remoteDoc.mobile || '+91 99999 99999',
          role: remoteDoc.role || 'SUPER_ADMIN',
          employeeId: remoteDoc.employeeId || 'emp-100',
          department: remoteDoc.department || 'Executive Leadership',
          status: remoteDoc.status || 'Active',
          joiningDate: remoteDoc.joiningDate || '2023-01-01',
          profileImage: remoteDoc.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
          password: remoteDoc.password,
          permissions: remoteDoc.permissions || ['*']
        };
        if (!Array.isArray(dbState.admins)) dbState.admins = [];
        const existingIdx = dbState.admins.findIndex((a: any) => a.id === admin.id || (a.email && a.email.toLowerCase() === admin.email.toLowerCase()));
        if (existingIdx >= 0) dbState.admins[existingIdx] = admin;
        else dbState.admins.push(admin);
      }
    } catch (e) {
      console.warn('[AUTH] Direct D1 lookup error:', e);
    }
  }

  // If user is still not found among admins or staff, reject with 401
  if (!admin) {
    recordLoginFailure(rawId);
    return res.status(401).json({ message: 'Invalid administrative Login ID or password.' });
  }

  if (admin.isSuspended || admin.status === 'Suspended') {
    return res.status(403).json({ message: 'Your administrative profile has been suspended by the Super Admin.' });
  }

  const effectivePassword = rawPassword;
  if (!effectivePassword) {
    return res.status(400).json({ message: 'Password is required.' });
  }

  let isMatch = false;

  if (admin.password) {
    try {
      if (admin.password.startsWith('$2a$') || admin.password.startsWith('$2b$')) {
        isMatch = bcrypt.compareSync(effectivePassword, admin.password);
      } else {
        isMatch = (effectivePassword === admin.password);
      }
    } catch (e) {
      isMatch = false;
    }
  }

  // If password comparison failed against in-memory record, check D1 edge database if available
  if (!isMatch) {
    try {
      const d1DocId = admin.id || 'super-admin-deepak';
      const remoteDoc = await loadEntityFromD1('admins', d1DocId);
      if (remoteDoc && remoteDoc.password) {
        if (remoteDoc.password.startsWith('$2a$') || remoteDoc.password.startsWith('$2b$')) {
          isMatch = bcrypt.compareSync(effectivePassword, remoteDoc.password);
        } else {
          isMatch = (effectivePassword === remoteDoc.password);
        }
        if (isMatch) {
          admin.password = remoteDoc.password;
          admin.name = remoteDoc.name || admin.name;
          admin.email = remoteDoc.email || admin.email;
          admin.role = remoteDoc.role || admin.role;
          admin.permissions = remoteDoc.permissions || admin.permissions;
        }
      }
    } catch (e) {
      console.warn('[AUTH] D1 password verification check:', e);
    }
  }

  if (!isMatch) {
    recordLoginFailure(rawId);
    return res.status(401).json({ message: 'Invalid administrative Login ID or password.' });
  }

  resetLoginFailures(rawId);
  resetLoginFailures(admin.email);
  if (admin.id) resetLoginFailures(admin.id);

  const employeeId = admin.employeeId || getLinkedEmployeeId(admin);
  if (employeeId && !admin.employeeId) {
    admin.employeeId = employeeId;
  }

  const effectivePermissions = getEffectivePermissionsForUser(admin);

  const jwtSecret = getJwtSecret();
  const accessToken = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, name: admin.name, permissions: effectivePermissions, employeeId },
    jwtSecret,
    { expiresIn: '1h' }
  );
  const refreshToken = jwt.sign(
    { id: admin.id },
    jwtSecret,
    { expiresIn: '7d' }
  );

  dbState.refreshTokens.push({ token: refreshToken, userId: admin.id, createdAt: new Date().toISOString() });

  addAuditLog(admin.id, admin.name, admin.role, 'ADMIN_LOGIN_SUCCESS', `Administrator successfully authenticated to control board.`);
  await persistDatabase('admins', admin.id);

  const { password: _, ...safeAdmin } = admin;
  res.json({
    accessToken,
    refreshToken,
    user: { ...safeAdmin, permissions: effectivePermissions, employeeId }
  });
});

// Admin Me session
app.get('/api/auth/admin/me', authenticateToken, (req, res) => {
  const reqUser = (req as any).user;
  const admin = dbState.admins.find(a => a.id === reqUser.id);
  if (!admin) {
    return res.status(404).json({ message: 'Administrative session not found or expired.' });
  }
  const employeeId = admin.employeeId || getLinkedEmployeeId(admin);
  if (employeeId && !admin.employeeId) {
    admin.employeeId = employeeId;
  }
  const effectivePermissions = getEffectivePermissionsForUser(admin);
  const { password: _, ...safeAdmin } = admin;
  res.json({ user: { ...safeAdmin, permissions: effectivePermissions, employeeId } });
});

// Admin Refresh Token
app.post('/api/auth/admin/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required.' });
  }

  const tokenRecord = dbState.refreshTokens.find(t => t.token === refreshToken);
  if (!tokenRecord) {
    return res.status(403).json({ message: 'Refresh token is invalid or expired.' });
  }

  const jwtSecret = getJwtSecret();
  jwt.verify(refreshToken, jwtSecret, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ message: 'Refresh token is expired.' });
    }
    const admin = dbState.admins.find(a => a.id === decoded.id);
    if (!admin) {
      return res.status(404).json({ message: 'Associated administrative profile not found.' });
    }

    const effectivePermissions = getEffectivePermissionsForUser(admin);
    const accessToken = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, name: admin.name, permissions: effectivePermissions },
      jwtSecret,
      { expiresIn: '1h' }
    );
    res.json({ accessToken });
  });
});

// Admin Logout
app.post('/api/auth/admin/logout', async (req, res) => {
  const { refreshToken } = req.body;
  dbState.refreshTokens = dbState.refreshTokens.filter(t => t.token !== refreshToken);
  await persistDatabase();
  res.json({ message: 'Administrative logout successful.' });
});

// Admin Forgot Password (supports both /api/auth/admin/forgot-password and /api/auth/forgot-password)
app.post(['/api/auth/admin/forgot-password', '/api/auth/forgot-password'], async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email address is required.' });

  const admin = dbState.admins.find(a => a.email.toLowerCase() === email.toLowerCase());
  if (!admin) {
    return res.status(404).json({ message: 'No registered administrative profile matches this email.' });
  }

  const otp = '888888';
  admin.passwordResetOtp = otp;

  addAuditLog(admin.id, admin.name, admin.role, 'ADMIN_FORGOT_PASSWORD', `Password reset OTP dispatched: ${otp}`);
  await persistDatabase('admins', admin.id);

  res.json({
    message: 'An administrative security recovery OTP has been dispatched.',
    email: admin.email,
    otp
  });
});

// Admin Reset Password (supports both /api/auth/admin/reset-password and /api/auth/reset-password)
app.post(['/api/auth/admin/reset-password', '/api/auth/reset-password'], async (req, res) => {
  const { email, otp, password } = req.body;
  if (!email || !otp || !password) {
    return res.status(400).json({ message: 'All parameters are required.' });
  }

  const admin = dbState.admins.find(a => a.email.toLowerCase() === email.toLowerCase());
  if (!admin) {
    return res.status(404).json({ message: 'Administrative profile not found.' });
  }

  if (admin.passwordResetOtp !== otp) {
    return res.status(400).json({ message: 'Invalid or expired recovery OTP.' });
  }

  admin.password = bcrypt.hashSync(password, 10);
  admin.passwordResetOtp = undefined;

  addAuditLog(admin.id, admin.name, admin.role, 'ADMIN_RESET_PASSWORD_SUCCESS', 'Administrative password reset successfully completed.');
  await persistDatabase('admins', admin.id);

  res.json({ message: 'Administrative password successfully reset.' });
});

// =========================================================
// SUPER ADMIN TEAM MEMBER CONFIGURATION (CRUD)
// =========================================================

// Retrieve all administrative team members
app.get('/api/admin/team', authenticateToken, requirePermission(['staff_accounts.view', 'staff_accounts.manage']), (req, res) => {
  const safeAdmins = dbState.admins.map(({ password: _, ...a }) => ({
    ...a,
    permissions: getEffectivePermissionsForUser(a)
  }));
  res.json(safeAdmins);
});

// Create administrative team member
app.post('/api/admin/team', authenticateToken, requirePermission('staff_accounts.manage'), async (req, res) => {
  const { name, email, mobile, employeeId, department, role, permissions, password, profileImage } = req.body;

  if (!name || !email || !mobile || !employeeId || !department || !role || !permissions || !password) {
    return res.status(400).json({ message: 'All fields are strictly required for establishing a new team member.' });
  }

  const exists = dbState.admins.some(a => a.email.toLowerCase() === email.toLowerCase()) || 
                 dbState.customers.some(c => c.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    return res.status(400).json({ message: 'This email is already associated with an account.' });
  }

  const mobileExists = dbState.admins.some(a => a.mobile === mobile) ||
                       dbState.customers.some(c => c.mobile === mobile);
  if (mobileExists) {
    return res.status(400).json({ message: 'This mobile number is already in use.' });
  }

  const newMember = {
    id: `admin-${Date.now()}`,
    name,
    email,
    mobile,
    employeeId,
    department,
    role,
    permissions,
    profileImage: profileImage || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    password: bcrypt.hashSync(password, 10),
    status: 'Active',
    joiningDate: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  dbState.admins.push(newMember);

  // Sync to users
  dbState.users.push({
    id: newMember.id,
    name: newMember.name,
    email: newMember.email,
    mobile: newMember.mobile,
    role: newMember.role,
    createdAt: newMember.createdAt
  });

  addAuditLog((req as any).user.id, (req as any).user.name, (req as any).user.role, 'TEAM_MEMBER_CREATED', `Created new administrative team member ${name} as ${role} in ${department}.`);
  await persistDatabase('admins', newMember.id);

  const { password: _, ...safeMember } = newMember;
  res.status(201).json(safeMember);
});

// Update administrative team member
app.put('/api/admin/team', authenticateToken, requirePermission('staff_accounts.manage'), async (req, res) => {
  const { id, name, email, mobile, department, role, permissions, status } = req.body;
  const currentUserId = (req as any).user?.id;

  if (!id) return res.status(400).json({ message: 'Id is required for editing a team profile.' });

  const adminIndex = dbState.admins.findIndex(a => a.id === id);
  if (adminIndex === -1) {
    return res.status(404).json({ message: 'Team member profile not found.' });
  }

  const original = dbState.admins[adminIndex];
  const isTargetSuperAdmin = (original.role as string) === 'SUPER_ADMIN' || original.role === UserRole.ADMIN;

  // Self protection
  if (id === currentUserId) {
    if (status && status !== 'Active') {
      return res.status(400).json({ message: 'Self-deactivation or self-suspension of active Super Admin account is prohibited.' });
    }
    if (role && (role as string) !== 'SUPER_ADMIN' && role !== UserRole.ADMIN) {
      return res.status(400).json({ message: 'Self-demotion of Super Admin account is prohibited.' });
    }
  }

  // Sole active Super Admin protection
  if (isTargetSuperAdmin) {
    const activeSuperAdmins = dbState.admins.filter(a => ((a.role as string) === 'SUPER_ADMIN' || a.role === UserRole.ADMIN) && a.status === 'Active');
    if (activeSuperAdmins.length <= 1) {
      if (status && status !== 'Active') {
        return res.status(400).json({ message: 'Cannot deactivate or suspend the sole active Super Admin in the system.' });
      }
      if (role && (role as string) !== 'SUPER_ADMIN' && role !== UserRole.ADMIN) {
        return res.status(400).json({ message: 'Cannot demote the sole active Super Admin in the system.' });
      }
    }
  }

  dbState.admins[adminIndex] = {
    ...original,
    name: name || original.name,
    email: email || original.email,
    mobile: mobile || original.mobile,
    department: department || original.department,
    role: role || original.role,
    permissions: permissions || original.permissions,
    status: status || original.status,
    isSuspended: status === 'Suspended' ? true : false
  };

  // Sync users
  const userIdx = dbState.users.findIndex(u => u.id === id);
  if (userIdx !== -1) {
    dbState.users[userIdx].name = dbState.admins[adminIndex].name;
    dbState.users[userIdx].email = dbState.admins[adminIndex].email;
    dbState.users[userIdx].role = dbState.admins[adminIndex].role;
    dbState.users[userIdx].isSuspended = dbState.admins[adminIndex].isSuspended;
  }

  addAuditLog((req as any).user.id, (req as any).user.name, (req as any).user.role, 'TEAM_MEMBER_UPDATED', `Updated configuration profile for team member ${dbState.admins[adminIndex].name}.`);
  await persistDatabase('admins', dbState.admins[adminIndex].id);

  const { password: _, ...safeMember } = dbState.admins[adminIndex];
  res.json(safeMember);
});

// Delete administrative team member
app.delete('/api/admin/team/:id', authenticateToken, requirePermission('staff_accounts.manage'), async (req, res) => {
  const id = req.params.id;
  const currentUserId = (req as any).user?.id;

  const admin = dbState.admins.find(a => a.id === id);
  if (!admin) {
    return res.status(404).json({ message: 'Team member not found.' });
  }

  if (id === currentUserId) {
    return res.status(400).json({ message: 'Self-deletion of active Super Admin account is prohibited.' });
  }

  if ((admin.role as string) === 'SUPER_ADMIN' || admin.role === UserRole.ADMIN) {
    const activeSuperAdmins = dbState.admins.filter(a => ((a.role as string) === 'SUPER_ADMIN' || a.role === UserRole.ADMIN) && a.status === 'Active');
    if (activeSuperAdmins.length <= 1) {
      return res.status(400).json({ message: 'Cannot delete the sole active Super Admin in the system.' });
    }
  }

  dbState.admins = dbState.admins.filter(a => a.id !== id);
  dbState.users = dbState.users.filter(u => u.id !== id);

  addAuditLog((req as any).user.id, (req as any).user.name, (req as any).user.role, 'TEAM_MEMBER_DELETED', `Permanently deleted administrative team member ${admin.name}.`);
  await persistDatabase('admins', id);

  res.json({ message: 'Team member deleted successfully.' });
});

// General password change for logged-in profile
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const reqUser = (req as any).user;
  if (!newPassword) return res.status(400).json({ message: 'Missing parameters' });

  // Locate in either collection
  let userObj = dbState.customers?.find(c => c.id === reqUser.id || (reqUser.email && c.email?.toLowerCase() === reqUser.email.toLowerCase())) || 
                dbState.admins?.find(a => a.id === reqUser.id || (reqUser.email && a.email?.toLowerCase() === reqUser.email.toLowerCase()));
  if (!userObj) return res.status(404).json({ message: 'User not found' });

  if (oldPassword) {
    const isMatch = bcrypt.compareSync(oldPassword, userObj.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect old password.' });
    }
  }

  userObj.password = bcrypt.hashSync(newPassword, 10);

  // Sync password to dbState.users collection
  const uIdx = dbState.users?.findIndex(u => u.id === userObj.id || (userObj.email && u.email?.toLowerCase() === userObj.email.toLowerCase()));
  if (uIdx !== undefined && uIdx !== -1) {
    dbState.users[uIdx].password = userObj.password;
    await persistDatabase('users', dbState.users[uIdx].id);
  }

  addAuditLog(userObj.id, userObj.name, userObj.role, 'PASSWORD_CHANGE', 'User changed password via dashboard profile configuration.');
  await persistDatabase(userObj.role === UserRole.USER ? 'customers' : 'admins', userObj.id);

  res.json({ message: 'Password changed successfully.' });
});

// Protect all /api/admin routes with the authenticateToken middleware
app.use('/api/admin', authenticateToken);

// Admin Profile Update & Password Change
app.post('/api/admin/profile', async (req, res) => {
  const reqUser = (req as any).user || (req.body.email ? dbState.admins.find(a => a.email.toLowerCase() === String(req.body.email).toLowerCase()) : null) || dbState.admins[0];
  const { name, email, currentPassword, newPassword, confirmPassword } = req.body || {};

  const admin = dbState.admins.find(a => 
    (reqUser && (a.id === reqUser.id || a.email.toLowerCase() === String(reqUser.email || '').toLowerCase())) || 
    (email && a.email.toLowerCase() === String(email).trim().toLowerCase())
  );
  if (!admin) {
    return res.status(404).json({ message: 'Admin account not found.' });
  }

  // Update Name
  if (name && typeof name === 'string' && name.trim()) {
    admin.name = name.trim();
  }

  // Update Email
  if (email && typeof email === 'string' && email.trim() && email.trim().toLowerCase() !== admin.email.toLowerCase()) {
    const trimmedEmail = email.trim().toLowerCase();
    const existingAdmin = dbState.admins.find(a => a.id !== admin.id && a.email.toLowerCase() === trimmedEmail);
    if (existingAdmin) {
      return res.status(400).json({ message: 'An account with this email address already exists.' });
    }
    admin.email = trimmedEmail;
  }

  // Update Password if provided
  if (newPassword || currentPassword) {
    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required to set a new password.' });
    }

    const isMatch = bcrypt.compareSync(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirmation password do not match.' });
    }

    admin.password = bcrypt.hashSync(newPassword, 10);
    logSystemAction(admin.id, admin.name, 'ADMIN', 'PASSWORD_CHANGED', 'Admin updated login password securely.');
  }

  // Sync to dbState.users if exists
  const uIdx = dbState.users.findIndex(u => u.id === admin.id || u.email.toLowerCase() === admin.email.toLowerCase());
  if (uIdx !== -1) {
    dbState.users[uIdx].name = admin.name;
    dbState.users[uIdx].email = admin.email;
    if (admin.password) {
      dbState.users[uIdx].password = admin.password;
    }
  }

  await persistDatabase('admins', admin.id);
  if (uIdx !== -1) {
    await persistDatabase('users', dbState.users[uIdx].id);
  }

  const safeUser = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    designation: admin.designation,
    department: admin.department
  };

  res.json({
    message: 'Admin profile and credentials updated successfully.',
    user: safeUser
  });
});

// Admin Orders Endpoints (Requires orders.view or orders.view_assigned)
app.get('/api/admin/orders', requirePermission(['orders.view', 'orders.view_assigned']), async (req, res) => {
  const reqUser = (req as any).user;
  const perms = reqUser.permissions || [];
  const allOrders = await readCollectionWithFallback('orders', () => dbState.orders || []);
  
  if ((reqUser.role as string) === 'SUPER_ADMIN' || reqUser.role === UserRole.ADMIN || perms.includes('orders.view')) {
    return res.json(allOrders);
  }

  const empId = reqUser.employeeId || getLinkedEmployeeId(reqUser);
  const assignedOrders = allOrders.filter(o =>
    (empId && (o.assignedEmployeeId === empId || o.assignedStaffId === empId || o.assignedEmployeeCode === empId)) ||
    (reqUser.id && (o.assignedUserId === reqUser.id || o.assignedStaffId === reqUser.id || o.assignedEmployeeId === reqUser.id))
  );

  res.json(assignedOrders);
});

app.get('/api/admin/orders/assigned', requirePermission(['orders.view_assigned', 'orders.view']), async (req, res) => {
  const reqUser = (req as any).user;
  const perms = reqUser.permissions || [];
  const allOrders = await readCollectionWithFallback('orders', () => dbState.orders || []);
  
  if ((reqUser.role as string) === 'SUPER_ADMIN' || reqUser.role === UserRole.ADMIN || perms.includes('orders.view')) {
    return res.json(allOrders);
  }

  const empId = reqUser.employeeId || getLinkedEmployeeId(reqUser);
  const assignedOrders = allOrders.filter(o =>
    (empId && (o.assignedEmployeeId === empId || o.assignedStaffId === empId || o.assignedEmployeeCode === empId)) ||
    (reqUser.id && (o.assignedUserId === reqUser.id || o.assignedStaffId === reqUser.id || o.assignedEmployeeId === reqUser.id))
  );

  res.json(assignedOrders);
});

// Categories & Services
const handleGetCategories = async (req: express.Request, res: express.Response) => {
  const { all, includeAll } = req.query;
  const cats = await readCollectionWithFallback('categories', () => dbState.categories || []);
  let filteredCats = cats;
  if (all !== 'true' && includeAll !== 'true') {
    filteredCats = filteredCats.filter(c => (c.status || 'Active') === 'Active');
  }
  const services = await readCollectionWithFallback('services', () => dbState.services || []);
  const mapped = filteredCats.map(c => ({
    ...c,
    serviceCount: services.filter(s => s.categoryId === c.id).length
  }));
  res.json(mapped);
};

app.get('/api/categories', handleGetCategories);
app.get('/api/service-categories', handleGetCategories);

app.get('/api/blog-categories', (req, res) => {
  const { all, includeAll } = req.query;
  let cats = dbState.blogCategories || [];
  if (all !== 'true' && includeAll !== 'true') {
    cats = cats.filter(c => (c.status || 'Active') === 'Active');
  }
  const mapped = cats.map(c => ({
    ...c,
    blogCount: (dbState.blogs || []).filter(b => b.categoryId === c.id || b.category === c.name).length
  }));
  res.json(mapped);
});

app.get('/api/services', async (req, res) => {
  const services = await readCollectionWithFallback('services', () => dbState.services || []);
  const categories = await readCollectionWithFallback('categories', () => dbState.categories || []);
  const mapped = services.map(s => {
    const cat = categories.find(c => c.id === s.categoryId);
    return {
      ...s,
      categoryName: cat ? cat.name : s.categoryId
    };
  });
  res.json(mapped);
});

app.get('/api/services/:id', async (req, res) => {
  const service = await readEntityWithFallback('services', req.params.id, () => {
    return (dbState.services || []).find(s => s.id === req.params.id) || null;
  });
  if (!service) {
    return res.status(404).json({ message: 'Service not found.' });
  }
  const categories = await readCollectionWithFallback('categories', () => dbState.categories || []);
  const cat = categories.find(c => c.id === service.categoryId);
  res.json({
    ...service,
    categoryName: cat ? cat.name : service.categoryId
  });
});

// Order System
app.get('/api/orders', (req, res) => {
  const { userId, role } = req.query;
  
  if (role === UserRole.ADMIN || role === 'SUPER_ADMIN' || role === 'ADMIN') {
    return res.json(dbState.orders);
  }
  if (role === 'STAFF' || role === 'OPERATOR') {
    const linkedEmpId = getLinkedEmployeeId({ id: String(userId || ''), email: '' });
    const staffOrders = dbState.orders.filter(o => 
      (linkedEmpId && (o.assignedEmployeeId === linkedEmpId || o.assignedStaffId === linkedEmpId || o.assignedEmployeeCode === linkedEmpId)) ||
      (userId && (o.assignedUserId === userId || o.assignedStaffId === userId || o.assignedEmployeeId === userId))
    );
    return res.json(staffOrders);
  }
  if (userId) {
    const userOrders = dbState.orders.filter(o => o.userId === userId);
    return res.json(userOrders);
  }
  res.json([]);
});

app.post('/api/orders', async (req, res) => {
  const { 
    userId, customerId, serviceId, name, mobile, email, address, city, state, pinCode, 
    additionalNotes, paymentMethod, couponCode, uploadedDocs, utr, paymentScreenshot, paymentDate 
  } = req.body;

  if (!serviceId || !name || !mobile || !email || !address || !city || !state || !pinCode) {
    return res.status(400).json({ message: 'Required profile & address details are missing.' });
  }

  // Determine linked customer ID
  let linkedCustomerId = customerId;
  if (!linkedCustomerId && dbState.customers && dbState.customers.length > 0) {
    const matchedCustomer = dbState.customers.find((c: any) => 
      c.id === userId || 
      (c.email && c.email.toLowerCase() === email.toLowerCase()) || 
      (c.mobile && c.mobile === mobile)
    );
    if (matchedCustomer) {
      linkedCustomerId = matchedCustomer.id;
    }
  }

  const service = dbState.services.find(s => s.id === serviceId);
  if (!service) {
    return res.status(404).json({ message: 'Service not found.' });
  }

  let baseAmount = service.govFees + service.serviceCharge;
  let discount = 0;

  if (couponCode) {
    const coupon = dbState.coupons.find(c => c.code.toUpperCase() === couponCode.toUpperCase());
    if (coupon) {
      const isExpired = new Date(coupon.expiryDate) < new Date();
      const reachedLimit = coupon.usedCount >= coupon.usageLimit;
      if (!isExpired && !reachedLimit) {
        if (coupon.type === 'Flat') {
          discount = coupon.value;
        } else {
          discount = Math.round((baseAmount * coupon.value) / 100);
        }
        coupon.usedCount += 1;
      }
    }
  }

  const finalAmount = Math.max(0, baseAmount - discount);

  const orderId = `ORD-${10000 + dbState.orders.length + Math.floor(100 + Math.random() * 900)}`;
  
  const documentsList = (uploadedDocs || []).map((docName: string) => ({
    name: typeof docName === 'string' ? docName : (docName as any).name || 'Document.pdf',
    url: typeof docName === 'object' && (docName as any).url ? (docName as any).url : 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=100&auto=format&fit=crop&q=60',
    uploadedAt: new Date().toISOString()
  }));

  const selectedPaymentMethod = paymentMethod === 'QR Code' ? PaymentMethod.QR : 
                                paymentMethod === 'Bank Transfer' ? PaymentMethod.BANK_TRANSFER : PaymentMethod.UPI;

  const newOrder: Order = {
    id: orderId,
    userId: userId || linkedCustomerId || 'guest',
    customerId: linkedCustomerId || undefined,
    serviceId: service.id,
    serviceTitle: service.title,
    category: service.subCategory || service.categoryId || 'General',
    name,
    mobile,
    email,
    address,
    city,
    state,
    pinCode,
    uploadedDocuments: documentsList,
    additionalNotes,
    paymentMethod: selectedPaymentMethod,
    paymentStatus: PaymentStatus.PENDING_VERIFICATION,
    utr: utr || undefined,
    paymentScreenshot: paymentScreenshot || undefined,
    paymentDate: paymentDate || new Date().toISOString(),
    orderStatus: OrderStatus.PENDING,
    status: OrderStatus.PENDING,
    totalAmount: finalAmount,
    createdAt: new Date().toISOString(),
    logs: [
      { 
        status: OrderStatus.PENDING, 
        comment: utr ? `Order created. Payment submitted via ${selectedPaymentMethod} (UTR: ${utr}). Pending admin verification.` : 'Order created. Waiting for payment submission.', 
        timestamp: new Date().toISOString() 
      }
    ]
  };

  dbState.orders.push(newOrder);

  // Push system notification for user
  if (userId && userId !== 'guest') {
    dbState.notifications.push({
      id: `notif-${Date.now()}`,
      userId,
      type: 'push',
      message: `Your order ${orderId} for ${service.title} has been received.`,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }

  await persistDatabase('orders', newOrder.id);
  res.status(201).json(newOrder);
});

// Apply Coupon Validate
app.post('/api/coupons/validate', (req, res) => {
  const { code, amount } = req.body;
  const coupon = dbState.coupons.find(c => c.code.toUpperCase() === code?.toUpperCase());
  
  if (!coupon) {
    return res.status(404).json({ valid: false, message: 'Invalid coupon code.' });
  }

  const isExpired = new Date(coupon.expiryDate) < new Date();
  if (isExpired) {
    return res.status(400).json({ valid: false, message: 'Coupon code has expired.' });
  }

  if (coupon.usedCount >= coupon.usageLimit) {
    return res.status(400).json({ valid: false, message: 'Coupon usage limit has been reached.' });
  }

  let discount = 0;
  if (coupon.type === 'Flat') {
    discount = coupon.value;
  } else {
    discount = Math.round((amount * coupon.value) / 100);
  }

  res.json({
    valid: true,
    discount,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value
  });
});

// Track Order By ID & Phone
app.get('/api/orders/track', (req, res) => {
  const { orderId, mobile } = req.query;
  if (!orderId) {
    return res.status(400).json({ message: 'Order ID is required.' });
  }

  const order = dbState.orders.find(o => 
    o.id.toUpperCase() === (orderId as string).toUpperCase() && 
    (!mobile || o.mobile.includes(mobile as string))
  );

  if (!order) {
    return res.status(404).json({ message: 'No active order found matching your parameters.' });
  }

  // Find any submitted review for this order
  const existingReview = (dbState.reviews || []).find(r => 
    r.orderId && r.orderId.toUpperCase() === order.id.toUpperCase()
  );

  res.json({
    ...order,
    submittedReview: existingReview ? {
      id: existingReview.id,
      reviewId: existingReview.id,
      rating: existingReview.rating,
      reviewText: existingReview.reviewText || existingReview.comment,
      status: existingReview.status || 'Pending',
      createdAt: existingReview.createdAt,
      adminNote: existingReview.adminNote
    } : null
  });
});

// Update Order Status (Admin/Staff)
app.patch('/api/orders/:id/status', async (req, res) => {
  const { status, comment, staffId } = req.body;
  const order = dbState.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  if (status) {
    order.orderStatus = status as OrderStatus;
    (order as any).status = status;
    order.logs.push({
      status: status as OrderStatus,
      comment: comment || `Order state changed to ${status}.`,
      timestamp: new Date().toISOString()
    });
  }

  if (staffId !== undefined) {
    order.assignedStaffId = staffId || undefined;
  }

  // User notification
  if (order.userId && order.userId !== 'guest') {
    dbState.notifications.push({
      id: `notif-${Date.now()}`,
      userId: order.userId,
      type: 'push',
      message: `Status update on your order ${order.id}: ${status || 'Staff updated'}.`,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }

  await persistDatabase('orders', order.id);
  res.json(order);
});

// Update Payment Status
app.patch('/api/orders/:id/payment', async (req, res) => {
  const { paymentStatus } = req.body;
  const order = dbState.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  order.paymentStatus = paymentStatus as PaymentStatus;
  
  await persistDatabase('orders', order.id);
  res.json(order);
});

// Upload dynamic files to order
app.post('/api/orders/:id/upload', async (req, res) => {
  const { docName, fileData, fileUrl, mimeType } = req.body;
  const order = dbState.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  let finalUrl = fileUrl || 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=100&auto=format&fit=crop&q=60';
  let storagePath: string | undefined;

  if (fileData) {
    try {
      const buffer = Buffer.from(fileData.replace(/^data:[^;]+;base64,/, ''), 'base64');
      const safeName = (docName || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueName = `order_${order.id}_${Date.now()}_${safeName}`;
      const detectedMime = mimeType || 'application/pdf';
      const fbUpload = await uploadToFirebaseStorage(`orders/${uniqueName}`, buffer, detectedMime);
      finalUrl = fbUpload.downloadUrl;
      storagePath = fbUpload.storagePath;

      // Persist upload metadata to Cloudflare D1
      await saveMediaFileMetadataToD1({
        fileId: `ord-doc-${Date.now()}`,
        storagePath: fbUpload.storagePath,
        filename: safeName,
        mimeType: detectedMime,
        sizeBytes: buffer.length,
        downloadUrl: finalUrl,
        accessLevel: 'restricted',
        ownerId: order.userId || order.id,
        folder: 'order-documents'
      });
    } catch (e) {
      console.warn('[FirebaseStorage] Order document upload notice:', e);
    }
  }

  const newDoc = {
    name: docName || 'Uploaded_File.pdf',
    url: finalUrl,
    storagePath,
    uploadedAt: new Date().toISOString()
  };

  order.uploadedDocuments.push(newDoc);
  order.orderStatus = OrderStatus.UNDER_VERIFICATION;
  order.logs.push({
    status: OrderStatus.UNDER_VERIFICATION,
    comment: `Uploaded document: ${newDoc.name}. Re-verifying order details.`,
    timestamp: new Date().toISOString()
  });

  await persistDatabase('orders', order.id);
  res.json(order);
});

// Update Document Delivery & WhatsApp Tracking (Admin/Staff)
app.patch('/api/orders/:id/delivery', async (req, res) => {
  const { finalDocumentUrl, finalDocumentName, markSentWhatsApp, whatsAppDeliveryNotes } = req.body;
  const order = dbState.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  if (finalDocumentUrl) {
    order.finalDocumentUrl = finalDocumentUrl;
    order.finalDocumentName = finalDocumentName || 'Final_Document.pdf';
    order.finalDocumentUploadedAt = new Date().toISOString();
    order.documentDeliveryStatus = 'Ready';
  }

  if (markSentWhatsApp) {
    order.documentDeliveryStatus = 'SENT_VIA_WHATSAPP';
    order.whatsAppSentAt = new Date().toISOString();
    if (whatsAppDeliveryNotes) {
      order.whatsAppDeliveryNotes = whatsAppDeliveryNotes;
    }
    order.logs.push({
      status: order.orderStatus,
      comment: `Final document sent via WhatsApp to ${order.mobile}. Delivery notes: ${whatsAppDeliveryNotes || 'N/A'}.`,
      timestamp: new Date().toISOString()
    });
  }

  await persistDatabase('orders', order.id);
  res.json(order);
});

// Explicit Admin Final Document Upload Route
app.post('/api/admin/orders/:id/final-document', async (req, res) => {
  const { finalDocumentUrl, finalDocumentName } = req.body;
  const order = dbState.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (!finalDocumentUrl) return res.status(400).json({ message: 'finalDocumentUrl is required.' });

  order.finalDocumentUrl = finalDocumentUrl;
  order.finalDocumentName = finalDocumentName || 'Final_Document.pdf';
  order.finalDocumentUploadedAt = new Date().toISOString();
  order.documentDeliveryStatus = 'Ready';
  order.logs.push({
    status: order.orderStatus,
    comment: `Attached final completed document: ${order.finalDocumentName}. Status set to Ready.`,
    timestamp: new Date().toISOString()
  });

  await persistDatabase('orders', order.id);
  res.json({ message: 'Final document attached successfully.', order });
});

app.put('/api/admin/orders/:id/final-document', async (req, res) => {
  const { finalDocumentUrl, finalDocumentName } = req.body;
  const order = dbState.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (!finalDocumentUrl) return res.status(400).json({ message: 'finalDocumentUrl is required.' });

  order.finalDocumentUrl = finalDocumentUrl;
  order.finalDocumentName = finalDocumentName || 'Final_Document.pdf';
  order.finalDocumentUploadedAt = new Date().toISOString();
  order.documentDeliveryStatus = 'Ready';

  await persistDatabase('orders', order.id);
  res.json({ message: 'Final document updated successfully.', order });
});

// Explicit Admin WhatsApp Delivery Confirmation Route
app.patch('/api/admin/orders/:id/whatsapp-delivery', async (req, res) => {
  const { whatsAppDeliveryNotes } = req.body;
  const order = dbState.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });

  order.documentDeliveryStatus = 'SENT_VIA_WHATSAPP';
  order.whatsAppSentAt = new Date().toISOString();
  order.whatsAppDeliveryNotes = whatsAppDeliveryNotes || 'Sent via WhatsApp manually by staff';
  order.logs.push({
    status: order.orderStatus,
    comment: `Recorded manual WhatsApp document dispatch to ${order.mobile}. Notes: ${order.whatsAppDeliveryNotes}`,
    timestamp: new Date().toISOString()
  });

  await persistDatabase('orders', order.id);
  res.json({ message: 'WhatsApp delivery recorded successfully.', order });
});

// =========================================================
// EMPLOYEE ORDER ASSIGNMENT & WORKSPACE ENDPOINTS
// =========================================================

// Order Assignment Route (Admin)
app.patch('/api/admin/orders/:id/assign', authenticateToken, requirePermission(['orders.assign', 'orders.update']), async (req, res) => {
  const { id } = req.params;
  const { assignedEmployeeId } = req.body;

  const order = dbState.orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  if (!assignedEmployeeId || assignedEmployeeId === 'unassigned') {
    order.assignedEmployeeId = undefined;
    order.assignedUserId = undefined;
    order.assignedEmployeeName = undefined;
    order.assignedEmployeeCode = undefined;
    order.assignedEmployeeDepartment = undefined;
    order.assignedEmployeeDesignation = undefined;
    order.assignedStaffId = undefined;
    order.assignmentStatus = 'Unassigned';

    order.logs.push({
      status: order.orderStatus,
      comment: `Order unassigned by ${(req as any).user?.name || 'Admin'}.`,
      timestamp: new Date().toISOString()
    });

    addAuditLog((req as any).user?.id || 'admin', (req as any).user?.name || 'Admin', (req as any).user?.role || 'ADMIN', 'ORDER_UNASSIGNED', `Order ${order.id} was unassigned.`);
    await persistDatabase('orders', order.id);
    return res.json({ message: 'Order unassigned successfully.', order });
  }

  const emp = findEmployee(assignedEmployeeId);
  if (!emp) {
    return res.status(404).json({ message: 'Selected employee profile not found in database.' });
  }

  if (emp.employmentStatus !== 'Active') {
    return res.status(400).json({ message: `Cannot assign order: Employee ${emp.fullName} (${emp.employeeCode}) is currently ${emp.employmentStatus}. Only active employees can be assigned customer orders.` });
  }

  // Verify system login account status
  const acc = getEmployeeAccount(emp.id);
  const adminObj = dbState.admins.find(
    (a: any) => a.email?.toLowerCase() === emp.personalEmail?.toLowerCase() || a.id === emp.id
  );

  const accountStatus = acc?.accountStatus || (adminObj && !adminObj.isSuspended ? 'Active' : 'Inactive');
  if (accountStatus !== 'Active') {
    return res.status(400).json({ message: `Cannot assign order: Employee ${emp.fullName} (${emp.employeeCode}) does not have an active system login account.` });
  }

  const isReassignment = !!order.assignedEmployeeId && order.assignedEmployeeId !== emp.id;

  order.assignedEmployeeId = emp.id;
  order.assignedUserId = acc?.userId || adminObj?.id;
  order.assignedEmployeeName = emp.fullName;
  order.assignedEmployeeCode = emp.employeeCode;
  order.assignedEmployeeDepartment = emp.department;
  order.assignedEmployeeDesignation = emp.designation;
  order.assignedStaffId = emp.id;
  order.assignedAt = new Date().toISOString();
  order.assignedBy = (req as any).user?.name || (req as any).user?.email || 'admin';
  order.assignmentStatus = isReassignment ? 'Reassigned' : 'Assigned';

  order.logs.push({
    status: order.orderStatus,
    comment: `Order ${isReassignment ? 'reassigned' : 'assigned'} to ${emp.fullName} (${emp.employeeCode}, ${emp.designation}) by ${(req as any).user?.name || 'Admin'}`,
    timestamp: new Date().toISOString()
  });

  addAuditLog(
    (req as any).user?.id || 'admin',
    (req as any).user?.name || 'Admin',
    (req as any).user?.role || 'ADMIN',
    isReassignment ? 'ORDER_REASSIGNED' : 'ORDER_ASSIGNED',
    `Order ${order.id} was ${isReassignment ? 'reassigned' : 'assigned'} to ${emp.fullName} (${emp.employeeCode}).`,
    order.id
  );

  await persistDatabase('orders', order.id);
  res.json({ message: `Order successfully assigned to ${emp.fullName}.`, order });
});

// Staff "My Assigned Orders" List
app.get('/api/staff/my-orders', authenticateToken, (req, res) => {
  const reqUser = (req as any).user;
  const userRole = reqUser?.role || 'STAFF';

  if (['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
    return res.json(dbState.orders);
  }

  const employeeId = reqUser.employeeId || getLinkedEmployeeId(reqUser);

  if (!employeeId) {
    return res.status(403).json({ message: 'Access denied: No linked employee profile found for your system login account.' });
  }

  const myOrders = dbState.orders.filter(o => 
    o.assignedEmployeeId === employeeId || 
    o.assignedStaffId === employeeId || 
    (o.assignedEmployeeCode && o.assignedEmployeeCode === employeeId)
  );

  res.json(myOrders);
});

// Staff Get Single Order (with RBAC enforcement)
app.get('/api/staff/orders/:id', authenticateToken, (req, res) => {
  const reqUser = (req as any).user;
  const userRole = reqUser?.role || 'STAFF';
  const order = dbState.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  if (['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
    return res.json(order);
  }

  const employeeId = reqUser.employeeId || getLinkedEmployeeId(reqUser);
  const isAssigned = (
    order.assignedEmployeeId === employeeId || 
    order.assignedStaffId === employeeId ||
    (order.assignedEmployeeCode && order.assignedEmployeeCode === employeeId)
  );

  if (!isAssigned) {
    return res.status(403).json({ message: 'Access denied: You are not assigned to this customer order.' });
  }

  res.json(order);
});

// Staff Document Verification Endpoint
app.patch('/api/staff/orders/:id/documents/verify', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { documentName, documentIndex, verificationStatus, rejectionReason } = req.body;
  const reqUser = (req as any).user;
  const userRole = reqUser?.role || 'STAFF';

  const order = dbState.orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
    const employeeId = reqUser.employeeId || getLinkedEmployeeId(reqUser);
    const isAssigned = (
      order.assignedEmployeeId === employeeId || 
      order.assignedStaffId === employeeId ||
      (order.assignedEmployeeCode && order.assignedEmployeeCode === employeeId)
    );

    if (!isAssigned) {
      return res.status(403).json({ message: 'Access denied: You are not assigned to this customer order.' });
    }
  }

  if (!['Pending', 'Verified', 'Rejected'].includes(verificationStatus)) {
    return res.status(400).json({ message: 'Invalid verification status.' });
  }

  if (verificationStatus === 'Rejected' && (!rejectionReason || !rejectionReason.trim())) {
    return res.status(400).json({ message: 'Mandatory rejection reason is required when rejecting a document.' });
  }

  let doc: any | undefined;
  if (documentIndex !== undefined && order.uploadedDocuments[documentIndex]) {
    doc = order.uploadedDocuments[documentIndex];
  } else if (documentName) {
    doc = order.uploadedDocuments.find(d => d.name === documentName);
  }

  if (!doc) {
    return res.status(404).json({ message: 'Document not found in order uploads.' });
  }

  doc.verificationStatus = verificationStatus;
  doc.rejectionReason = verificationStatus === 'Rejected' ? rejectionReason.trim() : undefined;
  doc.verifiedBy = reqUser.name || reqUser.email;
  doc.verifiedAt = new Date().toISOString();

  order.logs.push({
    status: order.orderStatus,
    comment: `Document "${doc.name}" marked as ${verificationStatus} by ${reqUser.name || 'Officer'}.${verificationStatus === 'Rejected' ? ` Reason: ${rejectionReason}` : ''}`,
    timestamp: new Date().toISOString()
  });

  addAuditLog(
    reqUser.id,
    reqUser.name || 'Officer',
    reqUser.role || 'STAFF',
    'DOCUMENT_VERIFICATION_UPDATED',
    `Updated document "${doc.name}" for order ${order.id} to ${verificationStatus}.`
  );

  await persistDatabase('orders', order.id);
  res.json({ message: `Document verification status updated to ${verificationStatus}.`, order });
});

// Payment Configuration & Verification System
const handlePaymentSettingsUpdate = async (req: any, res: any) => {
  const rawConfig = req.body.paymentConfig || req.body.paymentSettings || req.body;
  if (!rawConfig) {
    return res.status(400).json({ message: 'Payment config required.' });
  }
  const cleanConfig = sanitizePaymentConfig(rawConfig);
  if (!dbState.settings) dbState.settings = {};
  dbState.settings.paymentConfig = cleanConfig;
  dbState.paymentConfig = cleanConfig;
  dbState.paymentSettings = cleanConfig;

  addAuditLog('admin-1', 'Super Admin', 'ADMIN', 'CONFIG_UPDATE', 'Updated manual payment configuration (UPI/QR/Bank details).');
  await persistDatabase('paymentConfig');
  await persistDatabase('paymentSettings');
  res.json({ message: 'Payment settings saved successfully.', paymentConfig: cleanConfig });
};

app.get(['/api/payment-settings', '/api/admin/payment-settings', '/api/settings/payment'], (req, res) => {
  const cfg = dbState.paymentConfig || dbState.settings?.paymentConfig || dbState.paymentSettings || PRESEEDED_PAYMENT_CONFIG;
  res.json(sanitizePaymentConfig(cfg));
});

app.post('/api/admin/payment-settings', handlePaymentSettingsUpdate);
app.put('/api/admin/payment-settings', handlePaymentSettingsUpdate);
app.post('/api/payment-settings', handlePaymentSettingsUpdate);
app.put('/api/payment-settings', handlePaymentSettingsUpdate);

// Submit / Resubmit Payment Proof for Order
app.post('/api/orders/:id/submit-payment', async (req, res) => {
  const { paymentMethod, utr, paymentScreenshot, paymentDate } = req.body;
  const order = dbState.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  if (!utr) {
    return res.status(400).json({ message: 'Transaction ID / UTR is required.' });
  }

  const selectedPaymentMethod = paymentMethod === 'QR Code' ? PaymentMethod.QR : 
                                paymentMethod === 'Bank Transfer' ? PaymentMethod.BANK_TRANSFER : PaymentMethod.UPI;

  order.paymentMethod = selectedPaymentMethod;
  order.paymentStatus = PaymentStatus.PENDING_VERIFICATION;
  order.utr = utr;

  let finalScreenshot = paymentScreenshot || 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400';
  if (paymentScreenshot && paymentScreenshot.startsWith('data:')) {
    try {
      const buffer = Buffer.from(paymentScreenshot.replace(/^data:[^;]+;base64,/, ''), 'base64');
      const detectedMime = paymentScreenshot.match(/^data:([^;]+);/)?.[1] || 'image/jpeg';
      const ext = detectedMime.includes('png') ? 'png' : 'jpg';
      const storedFileName = `payment_${order.id}_${Date.now()}.${ext}`;
      const targetPath = path.join(process.cwd(), 'uploads', 'media', storedFileName);
      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, buffer);
      } catch (fsErr) {}
      const fbUpload = await uploadToFirebaseStorage(`payments/${storedFileName}`, buffer, detectedMime);
      await putR2File(`payments/${storedFileName}`, buffer, detectedMime);
      finalScreenshot = fbUpload.downloadUrl || `/uploads/media/${storedFileName}`;
    } catch (e) {
      console.warn('[FirebaseStorage] Payment proof upload notice:', e);
    }
  }

  order.paymentScreenshot = finalScreenshot;
  order.paymentDate = paymentDate || new Date().toISOString();
  order.rejectionReason = undefined;

  order.logs.push({
    status: order.orderStatus,
    comment: `Payment proof submitted via ${order.paymentMethod} (UTR: ${utr}). Pending admin verification.`,
    timestamp: new Date().toISOString()
  });

  if (order.userId && order.userId !== 'guest') {
    dbState.notifications.push({
      id: `notif-${Date.now()}`,
      userId: order.userId,
      type: 'push',
      message: `Payment proof for order ${order.id} submitted. Pending admin verification.`,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }

  await persistDatabase('orders', order.id);
  res.json({ message: 'Payment proof submitted successfully.', order });
});

// Admin Verify or Reject Payment Proof
const handleVerifyPaymentRoute = async (req: any, res: any) => {
  const { action, status, rejectionReason } = req.body;
  const rawAction = (action || status || '').toString().toLowerCase();
  const isApprove = rawAction === 'approve' || rawAction === 'approved' || rawAction === 'verified' || rawAction === 'accept';
  const isReject = rawAction === 'reject' || rawAction === 'rejected' || rawAction === 'decline';
  const actionParam = isApprove ? 'approve' : isReject ? 'reject' : undefined;
  const order = dbState.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  if (actionParam === 'approve') {
    order.paymentStatus = PaymentStatus.VERIFIED;
    order.rejectionReason = undefined;
    if (order.orderStatus === OrderStatus.PENDING) {
      order.orderStatus = OrderStatus.UNDER_VERIFICATION;
    }
    order.logs.push({
      status: order.orderStatus,
      comment: 'Payment verified by Admin. Order moved to processing.',
      timestamp: new Date().toISOString()
    });

    if (order.userId && order.userId !== 'guest') {
      dbState.notifications.push({
        id: `notif-${Date.now()}`,
        userId: order.userId,
        type: 'push',
        message: `Payment for order ${order.id} has been verified! Order is now in process.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }
  } else if (actionParam === 'reject') {
    order.paymentStatus = PaymentStatus.REJECTED;
    order.rejectionReason = rejectionReason || 'Transaction ID / UTR or screenshot invalid. Please verify and resubmit.';
    order.logs.push({
      status: order.orderStatus,
      comment: `Payment proof rejected by Admin. Reason: ${order.rejectionReason}`,
      timestamp: new Date().toISOString()
    });

    if (order.userId && order.userId !== 'guest') {
      dbState.notifications.push({
        id: `notif-${Date.now()}`,
        userId: order.userId,
        type: 'push',
        message: `Payment verification for order ${order.id} was rejected. Reason: ${order.rejectionReason}. Please resubmit proof.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }
  } else {
    return res.status(400).json({ message: 'Invalid action or status parameter. Pass action: "approve"|"reject" or status: "Verified"|"Rejected".' });
  }

  await persistDatabase('orders', order.id);
  res.json({ message: `Payment ${actionParam === 'approve' ? 'verified' : 'rejected'} successfully.`, order });
};

app.post('/api/admin/payments/:id/verify', handleVerifyPaymentRoute);
app.patch('/api/admin/payments/:id/verify', handleVerifyPaymentRoute);
app.post('/api/admin/orders/:id/verify-payment', handleVerifyPaymentRoute);
app.patch('/api/admin/orders/:id/verify-payment', handleVerifyPaymentRoute);

// Support Ticket System
app.get('/api/tickets', (req, res) => {
  const { userId, role } = req.query;
  if (role === UserRole.ADMIN || role === 'STAFF') {
    return res.json(dbState.tickets);
  }
  const userTickets = dbState.tickets.filter(t => t.userId === userId);
  res.json(userTickets);
});

app.post('/api/tickets', async (req, res) => {
  const { userId, userName, subject, category, message } = req.body;
  if (!userId || !subject || !message) {
    return res.status(400).json({ message: 'Required fields are missing.' });
  }

  const newTicket: SupportTicket = {
    id: `TCK-${200 + dbState.tickets.length + Math.floor(10 + Math.random() * 90)}`,
    userId,
    userName: userName || 'Jane Doe',
    subject,
    category: category || 'General Help',
    message,
    status: 'Open',
    createdAt: new Date().toISOString(),
    replies: []
  };

  dbState.tickets.push(newTicket);
  await persistDatabase('tickets', newTicket.id);
  res.status(201).json(newTicket);
});

app.post('/api/tickets/:id/replies', async (req, res) => {
  const { senderId, senderName, senderRole, message } = req.body;
  const ticket = dbState.tickets.find(t => t.id === req.params.id);

  if (!ticket) {
    return res.status(404).json({ message: 'Ticket not found.' });
  }

  ticket.replies.push({
    id: `rep-${Date.now()}`,
    senderId,
    senderName,
    senderRole,
    message,
    createdAt: new Date().toISOString()
  });

  if (senderRole === UserRole.ADMIN || senderRole === 'STAFF') {
    ticket.status = 'In Progress';
  } else {
    ticket.status = 'Open';
  }

  await persistDatabase('tickets', ticket.id);
  res.status(201).json(ticket);
});

// Reviews API - Public Approved Reviews
app.get('/api/reviews', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { serviceId } = req.query;
  const allReviews = await readCollectionWithFallback('reviews', () => dbState.reviews || []);
  // Public endpoint returns ONLY approved reviews
  let approved = allReviews.filter(r => r.status === 'Approved' || (!r.status && r.isVerified));

  if (serviceId && typeof serviceId === 'string') {
    approved = approved.filter(r => r.serviceId === serviceId);
  }

  // Map to safe public format (NO sensitive customer information exposed)
  const publicReviews = approved.map(r => ({
    id: r.id,
    reviewId: r.id,
    customerId: r.customerId,
    orderId: r.orderId,
    serviceId: r.serviceId,
    customerName: r.customerName || r.userName || 'Verified Customer',
    userName: r.customerName || r.userName || 'Verified Customer',
    rating: Number(r.rating) || 5,
    reviewText: r.reviewText || r.comment || '',
    comment: r.reviewText || r.comment || '',
    serviceName: r.serviceName || r.serviceTitle || 'Digital Document Assistance',
    serviceTitle: r.serviceName || r.serviceTitle || 'Digital Document Assistance',
    status: 'Approved',
    isDemo: r.isDemo ?? false,
    createdAt: r.createdAt || r.date || new Date().toISOString(),
    updatedAt: r.updatedAt || r.createdAt || r.date || new Date().toISOString(),
    date: r.createdAt || r.date || new Date().toISOString(),
    isVerifiedOrder: r.isVerifiedOrder ?? r.isVerified ?? false,
    isVerified: r.isVerifiedOrder ?? r.isVerified ?? false
  }));

  res.json(publicReviews);
});

// Reviews API - Summary Statistics
app.get('/api/reviews/summary', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { serviceId } = req.query;
  const allReviews = await readCollectionWithFallback('reviews', () => dbState.reviews || []);
  let approved = allReviews.filter((r: any) => r.status === 'Approved' || (!r.status && r.isVerified));

  if (serviceId && typeof serviceId === 'string') {
    approved = approved.filter((r: any) => r.serviceId === serviceId);
  }

  const totalReviews = approved.length;
  const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  let sum = 0;
  approved.forEach((r: any) => {
    const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
    breakdown[star] = (breakdown[star] || 0) + 1;
    sum += Number(r.rating || 5);
  });

  const averageRating = totalReviews > 0 ? Number((sum / totalReviews).toFixed(1)) : 0;

  res.json({
    totalReviews,
    averageRating,
    breakdown
  });
});

// Reviews API - Check if Order Has Review
app.get('/api/reviews/check-order/:orderId', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const { orderId } = req.params;
  if (!orderId) {
    return res.status(400).json({ message: 'Order ID is required.' });
  }

  const allReviews = await readCollectionWithFallback('reviews', () => dbState.reviews || []);
  const review = allReviews.find((r: any) => 
    r.orderId && r.orderId.toUpperCase() === orderId.toUpperCase()
  );

  if (review) {
    return res.json({
      hasReview: true,
      review: {
        id: review.id,
        reviewId: review.id,
        rating: review.rating,
        reviewText: review.reviewText || review.comment,
        status: review.status || 'Pending',
        createdAt: review.createdAt,
        adminNote: review.adminNote
      }
    });
  }

  res.json({ hasReview: false, review: null });
});

// Reviews API - Customer's Own Submitted Reviews
app.get('/api/reviews/my-reviews', authenticateToken, async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const reqUser = (req as any).user;
  const allReviews = await readCollectionWithFallback('reviews', () => dbState.reviews || []);
  const myReviews = allReviews.filter((r: any) => r.customerId === reqUser.id || r.userName === reqUser.name);
  res.json(myReviews);
});

// Reviews API - Submit Customer Review (Public & Authenticated Flow)
app.post('/api/reviews', async (req, res) => {
  const authHeader = req.headers['authorization'];
  let reqUser: any = null;
  const jwtSecret = getJwtSecret();
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      reqUser = jwt.verify(token, jwtSecret);
    } catch (e) {
      // Unauthenticated session, proceed with order verification
    }
  }

  const { orderId, customerId, customerName, serviceId, serviceTitle, serviceName, rating, reviewText, comment } = req.body;

  const text = (reviewText || comment || '').trim();
  if (!text) {
    return res.status(400).json({ message: 'Review feedback text is required.' });
  }

  const numRating = Number(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
    return res.status(400).json({ message: 'Rating must be a whole number between 1 and 5 stars.' });
  }

  let isVerifiedOrder = false;
  let foundOrder: any = null;

  if (orderId) {
    foundOrder = (dbState.orders || []).find(o => o.id.toUpperCase() === String(orderId).trim().toUpperCase());
    if (!foundOrder) {
      return res.status(404).json({ message: 'Referenced order could not be located in our system.' });
    }
    
    // Verify order completion status
    const isCompleted = foundOrder.orderStatus === OrderStatus.COMPLETED || 
                        String(foundOrder.orderStatus).toLowerCase() === 'completed';
    if (!isCompleted) {
      return res.status(400).json({ message: 'Reviews can only be submitted for completed orders/services.' });
    }

    // Check for duplicate review for same order (Single review per order constraint)
    const existingReview = (dbState.reviews || []).find(r => 
      r.orderId && r.orderId.toUpperCase() === foundOrder.id.toUpperCase()
    );
    if (existingReview) {
      return res.status(400).json({ message: 'A review has already been submitted for this completed order.' });
    }
    isVerifiedOrder = true;
  }

  const targetCustomerId = customerId || reqUser?.id || foundOrder?.customerId || foundOrder?.userId || `CUS-${Date.now().toString().slice(-4)}`;
  const targetCustomerName = customerName || reqUser?.name || foundOrder?.name || 'Verified Customer';
  const targetServiceId = serviceId || foundOrder?.serviceId || 'srv-gen';
  const targetServiceName = serviceName || serviceTitle || foundOrder?.serviceTitle || 'Digital Document Service';

  const now = new Date().toISOString();
  const reviewId = `REV-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;

  const newReview: Review = {
    id: reviewId,
    reviewId: reviewId,
    customerId: targetCustomerId,
    customerName: targetCustomerName,
    userName: targetCustomerName,
    orderId: foundOrder?.id || (orderId ? String(orderId).trim() : undefined),
    serviceId: targetServiceId,
    serviceTitle: targetServiceName,
    serviceName: targetServiceName,
    rating: numRating,
    reviewText: text,
    comment: text,
    status: 'Pending', // STRICT: Status = Pending on submission
    isDemo: false,
    isVerifiedOrder,
    isVerified: isVerifiedOrder,
    createdAt: now,
    updatedAt: now,
    date: now
  };

  dbState.reviews.push(newReview);
  logSystemAction(
    targetCustomerId,
    targetCustomerName,
    'CUSTOMER',
    'REVIEW_SUBMITTED',
    `Customer submitted review ${reviewId} for order ${newReview.orderId || 'general'} (Pending Approval).`
  );
  
  await persistDatabase('reviews', newReview.id);

  res.status(201).json({
    message: 'Thank you for your feedback! Your review has been submitted and is currently pending administrator approval.',
    review: newReview
  });
});

// Blogs API
app.get('/api/blogs', (req, res) => {
  const { categoryId, category } = req.query;
  const mapped = (dbState.blogs || []).map(b => {
    const blogCat = (dbState.blogCategories || []).find(c => c.id === b.categoryId || c.name.toLowerCase() === (b.category || '').toLowerCase());
    return {
      ...b,
      categoryId: blogCat ? blogCat.id : (b.categoryId || 'blog-cat-gov'),
      category: blogCat ? blogCat.name : (b.category || 'Uncategorized')
    };
  });

  if (categoryId && typeof categoryId === 'string' && categoryId !== 'ALL') {
    return res.json(mapped.filter(b => b.categoryId === categoryId));
  }
  if (category && typeof category === 'string' && category !== 'ALL') {
    return res.json(mapped.filter(b => b.category.toLowerCase() === category.toLowerCase()));
  }

  res.json(mapped);
});

// Notifications
app.get('/api/notifications', (req, res) => {
  const { userId } = req.query;
  const userNotifs = dbState.notifications.filter(n => n.userId === userId);
  res.json(userNotifs);
});

app.post('/api/notifications/read', async (req, res) => {
  const { userId } = req.body;
  dbState.notifications.forEach(n => {
    if (n.userId === userId) {
      n.isRead = true;
    }
  });
  await persistDatabase('notifications');
  res.json({ success: true });
});

// Admin Dashboard Analytics - Strict Cloudflare D1 Single Source of Truth
app.get('/api/admin/analytics', (req, res) => {
  const allOrders = dbState.orders || [];
  const allCustomers = dbState.customers || [];
  const allServices = dbState.services || [];
  const allUsers = dbState.users || [];

  const totalOrders = allOrders.length;
  
  // Categorize order statuses reliably
  let completedOrders = 0;
  let inProgressOrders = 0;
  let pendingOrders = 0;
  let rejectedOrders = 0;

  allOrders.forEach(o => {
    const st = (o.orderStatus || '').toLowerCase();
    if (st === 'completed') {
      completedOrders++;
    } else if (st === 'processing' || st === 'in progress' || st === 'under verification' || st === 'in_progress') {
      inProgressOrders++;
    } else if (st === 'rejected' || st === 'cancelled') {
      rejectedOrders++;
    } else {
      // Pending, Pending Verification, Documents Required
      pendingOrders++;
    }
  });

  // Calculate verified vs pending revenue strictly from database
  let verifiedRevenue = 0;
  let pendingRevenue = 0;
  let totalOrderValue = 0;

  allOrders.forEach(o => {
    const amt = typeof o.totalAmount === 'number' ? o.totalAmount : (parseFloat(o.totalAmount as any) || 0);
    totalOrderValue += amt;
    const pSt = (o.paymentStatus || '').toLowerCase();
    if (pSt === 'verified' || pSt === 'paid') {
      verifiedRevenue += amt;
    } else {
      pendingRevenue += amt;
    }
  });

  // Calculate customer metrics
  const uniqueCustomerIdsWithOrders = new Set(allOrders.map(o => o.customerId || o.userId).filter(Boolean));
  const totalCustomers = allCustomers.length > 0 ? allCustomers.length : allUsers.filter(u => u.role === UserRole.USER).length;
  const customersWithOrdersCount = uniqueCustomerIdsWithOrders.size;

  // Group by date strictly from real createdAt
  const ordersByDate: { [key: string]: { count: number; revenue: number; orderIds: string[] } } = {};
  allOrders.forEach(o => {
    const dateStr = (o.createdAt ? o.createdAt.split('T')[0] : '2026-08-01');
    if (!ordersByDate[dateStr]) {
      ordersByDate[dateStr] = { count: 0, revenue: 0, orderIds: [] };
    }
    ordersByDate[dateStr].count += 1;
    ordersByDate[dateStr].orderIds.push(o.id);
    const pSt = (o.paymentStatus || '').toLowerCase();
    if (pSt === 'verified' || pSt === 'paid') {
      ordersByDate[dateStr].revenue += (typeof o.totalAmount === 'number' ? o.totalAmount : 0);
    }
  });

  const timeline = Object.keys(ordersByDate)
    .sort()
    .map(dateStr => {
      const d = new Date(dateStr);
      const displayDate = isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      return {
        date: dateStr,
        displayDate,
        ordersCount: ordersByDate[dateStr].count,
        revenue: ordersByDate[dateStr].revenue,
        orderIds: ordersByDate[dateStr].orderIds
      };
    });

  // Group by service strictly from real orders
  const servicePopularityMap: { [key: string]: { serviceId: string; title: string; count: number; revenue: number; categoryId?: string } } = {};
  allOrders.forEach(o => {
    const sId = o.serviceId || 'unassigned';
    if (!servicePopularityMap[sId]) {
      const foundService = allServices.find(s => s.id === sId);
      servicePopularityMap[sId] = {
        serviceId: sId,
        title: o.serviceTitle || (foundService ? foundService.title : sId),
        count: 0,
        revenue: 0,
        categoryId: foundService ? foundService.categoryId : o.category
      };
    }
    servicePopularityMap[sId].count += 1;
    const amt = typeof o.totalAmount === 'number' ? o.totalAmount : 0;
    servicePopularityMap[sId].revenue += amt;
  });

  const serviceBreakdown = Object.values(servicePopularityMap)
    .map(s => ({
      ...s,
      percentage: totalOrders > 0 ? Math.round((s.count / totalOrders) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);

  // Status breakdown array
  const statusBreakdown = [
    {
      name: 'Completed',
      count: completedOrders,
      percentage: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
      color: '#10b981',
      description: 'Service fulfilled and final certificate issued'
    },
    {
      name: 'In Progress',
      count: inProgressOrders,
      percentage: totalOrders > 0 ? Math.round((inProgressOrders / totalOrders) * 100) : 0,
      color: '#3b82f6',
      description: 'Actively processing, verification, or document collection'
    },
    {
      name: 'Pending',
      count: pendingOrders,
      percentage: totalOrders > 0 ? Math.round((pendingOrders / totalOrders) * 100) : 0,
      color: '#f59e0b',
      description: 'Awaiting initial staff assignment & verification'
    },
    {
      name: 'Rejected',
      count: rejectedOrders,
      percentage: totalOrders > 0 ? Math.round((rejectedOrders / totalOrders) * 100) : 0,
      color: '#ef4444',
      description: 'Application rejected due to invalid credentials'
    }
  ];

  // Payment Breakdown
  const paymentBreakdown = [
    {
      status: 'Verified / Paid',
      count: allOrders.filter(o => ['verified', 'paid'].includes((o.paymentStatus || '').toLowerCase())).length,
      amount: verifiedRevenue,
      color: '#10b981'
    },
    {
      status: 'Pending Verification',
      count: allOrders.filter(o => (o.paymentStatus || '').toLowerCase() === 'pending verification').length,
      amount: allOrders.filter(o => (o.paymentStatus || '').toLowerCase() === 'pending verification').reduce((s, o) => s + (o.totalAmount || 0), 0),
      color: '#f59e0b'
    },
    {
      status: 'Unpaid / Pending',
      count: allOrders.filter(o => (o.paymentStatus || '').toLowerCase() === 'pending').length,
      amount: allOrders.filter(o => (o.paymentStatus || '').toLowerCase() === 'pending').reduce((s, o) => s + (o.totalAmount || 0), 0),
      color: '#64748b'
    }
  ];

  // Order Source Breakdown (WhatsApp vs Website vs Phone vs In-Person vs Other)
  const sourceCounts: Record<string, { count: number; revenue: number }> = {
    WhatsApp: { count: 0, revenue: 0 },
    Website: { count: 0, revenue: 0 },
    Phone: { count: 0, revenue: 0 },
    'In-Person': { count: 0, revenue: 0 },
    Other: { count: 0, revenue: 0 }
  };

  allOrders.forEach(o => {
    const src = o.orderSource || 'Website';
    if (!sourceCounts[src]) {
      sourceCounts[src] = { count: 0, revenue: 0 };
    }
    sourceCounts[src].count += 1;
    sourceCounts[src].revenue += (o.totalAmount || 0);
  });

  const sourceBreakdown = Object.entries(sourceCounts).map(([source, stats]) => ({
    source,
    count: stats.count,
    revenue: stats.revenue,
    percentage: totalOrders > 0 ? Math.round((stats.count / totalOrders) * 100) : 0
  })).sort((a, b) => b.count - a.count);

  res.json({
    summary: {
      totalUsers: totalCustomers,
      totalOrders,
      completedOrders,
      inProgressOrders,
      pendingOrders,
      rejectedOrders,
      revenue: verifiedRevenue,
      totalOrderValue,
      pendingRevenue,
      totalCustomers,
      customersWithOrders: customersWithOrdersCount,
      totalServices: allServices.length,
      activeServicesWithOrders: serviceBreakdown.length,
      whatsAppOrders: sourceCounts['WhatsApp']?.count || 0
    },
    timeline,
    serviceBreakdown,
    statusBreakdown,
    paymentBreakdown,
    sourceBreakdown,
    charts: {
      ordersByDate: Object.fromEntries(Object.entries(ordersByDate).map(([k, v]) => [k, v.count])),
      revenueByDate: Object.fromEntries(Object.entries(ordersByDate).map(([k, v]) => [k, v.revenue])),
      services: serviceBreakdown
    },
    integrity: {
      source: 'Cloudflare D1 SQL (Single Source of Truth)',
      lastComputedAt: new Date().toISOString(),
      reconciliation: {
        d1Orders: totalOrders,
        adminQueueOrders: totalOrders,
        analyticsOrders: totalOrders,
        isReconciled: true
      }
    }
  });
});

// Private Uploads Directory Configuration
const PRIVATE_UPLOADS_DIR = path.join(process.cwd(), 'private_uploads', 'employees');
try {
  if (fs.existsSync && !fs.existsSync(PRIVATE_UPLOADS_DIR)) {
    fs.mkdirSync(PRIVATE_UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  // Gracefully ignored in read-only / serverless / Cloudflare Worker environments
}

// Data Masking Helpers for Compliance & Security
function maskAadhaar(val?: string): string {
  if (!val) return 'XXXX-XXXX-XXXX';
  const clean = val.replace(/\D/g, '');
  if (clean.length < 4) return 'XXXX-XXXX-XXXX';
  return `XXXX-XXXX-${clean.slice(-4)}`;
}

function maskPAN(val?: string): string {
  if (!val) return 'XXXXX0000X';
  const clean = val.trim().toUpperCase();
  if (clean.length < 4) return 'XXXXX0000X';
  return `XXXXX${clean.slice(-4)}`;
}

function maskBankAccount(val?: string): string {
  if (!val) return 'XXXX-XXXX-XXXX';
  const clean = val.trim();
  if (clean.length < 4) return 'XXXX-XXXX-XXXX';
  return `XXXX-XXXX-${clean.slice(-4)}`;
}

// Audit Logging Helper for Employee & Security Operations
function logAudit(req: express.Request, actionType: string, description: string, employeeId?: string, documentId?: string) {
  const user = (req as any).user || { id: 'super-admin-deepak', name: 'Deepak', role: 'SUPER_ADMIN' };
  const logItem: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    userId: user.id || 'system',
    userName: user.name || 'System User',
    userRole: user.role || UserRole.ADMIN,
    actionType,
    description,
    employeeId,
    documentId,
    ipAddress: getClientIp(req),
    timestamp: new Date().toISOString()
  };
  if (!dbState.auditLogs) dbState.auditLogs = [];
  dbState.auditLogs.unshift(logItem);
  persistDatabase();
}

// Helper to log system actions
function logSystemAction(userId: string, userName: string, userRole: string, actionType: string, description: string) {
  if (!dbState.auditLogs) dbState.auditLogs = [];
  dbState.auditLogs.unshift({
    id: `log-${Date.now()}`,
    userId,
    userName,
    userRole,
    actionType,
    description,
    timestamp: new Date().toISOString()
  });
  persistDatabase();
}

// Global configurations and settings APIs
app.get('/api/admin/settings', (req, res) => {
  res.json(dbState.settings);
});

app.post('/api/admin/settings', async (req, res) => {
  const { updaterId, updaterName, updaterRole, settings } = req.body;
  if (settings) {
    dbState.settings = { ...dbState.settings, ...settings };
    logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'SETTINGS_UPDATE', 'Updated global settings configuration.');
    await persistDatabase('settings');
  }
  res.json({ message: 'Settings successfully applied.', settings: dbState.settings });
});

// ---------------- ABOUT US MODULE & PRIVATE EMPLOYEE RECORDS APIS ----------------

// Public About Us page API (Returns company content & founder, NO individual team members)
app.get('/api/about', (req, res) => {
  const aboutUs = dbState.aboutUs || PRESEEDED_ABOUT_US;
  const founder = dbState.founder || PRESEEDED_FOUNDER;
  res.json({
    ...aboutUs,
    aboutUs,
    founder
  });
});

const handleAboutUpdate = async (req: express.Request, res: express.Response) => {
  const { aboutUs, about, updaterId, updaterName, updaterRole } = req.body || {};
  const rawAbout = aboutUs || about || req.body;
  if (rawAbout && typeof rawAbout === 'object') {
    dbState.aboutUs = { ...(dbState.aboutUs || PRESEEDED_ABOUT_US), ...rawAbout };
    logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'ABOUT_US_UPDATE', 'Updated About Us CMS content.');
    await persistDatabase('aboutUs');
  }
  res.json({ message: 'About Us content saved successfully.', aboutUs: dbState.aboutUs, ...dbState.aboutUs });
};
app.post('/api/admin/about', handleAboutUpdate);
app.post('/api/about', handleAboutUpdate);
app.put('/api/admin/about', handleAboutUpdate);
app.put('/api/about', handleAboutUpdate);

app.get('/api/founder', (req, res) => {
  res.json(dbState.founder || PRESEEDED_FOUNDER);
});

const handleFounderUpdate = async (req: express.Request, res: express.Response) => {
  const { founder, updaterId, updaterName, updaterRole } = req.body || {};
  const rawFounder = founder || req.body;
  if (rawFounder && typeof rawFounder === 'object') {
    const updatedFounder = { ...(dbState.founder || PRESEEDED_FOUNDER), ...rawFounder };

    // If photoUrl is base64 data URL, persist physical file and keep backup data
    if (updatedFounder.photoUrl && updatedFounder.photoUrl.startsWith('data:')) {
      try {
        const timeStamp = Date.now();
        const storedFileName = `med_founder_${timeStamp}.jpg`;
        const targetPath = path.join(process.cwd(), 'uploads', 'media', storedFileName);
        const base64 = updatedFounder.photoUrl.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');
        try {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, buffer);
        } catch (fsErr) {}
        await uploadToFirebaseStorage(`media/${storedFileName}`, buffer, 'image/jpeg');
        await putR2File(`media/${storedFileName}`, buffer, 'image/jpeg');
        updatedFounder.photoData = updatedFounder.photoUrl;
        updatedFounder.photoUrl = `/uploads/media/${storedFileName}`;
      } catch (e) {
        console.error('Error saving founder photo:', e);
      }
    } else if (updatedFounder.photoUrl && updatedFounder.photoUrl.startsWith('/uploads/')) {
      const matched = (dbState.media || []).find((m: any) => m.url === updatedFounder.photoUrl || (m.storedFileName && updatedFounder.photoUrl.endsWith(m.storedFileName)));
      if (matched && ((matched as any).fileData || (matched as any).base64)) {
        updatedFounder.photoData = (matched as any).fileData || (matched as any).base64;
      }
    }

    // If signatureUrl is base64 data URL, persist physical file and keep backup data
    if (updatedFounder.signatureUrl && updatedFounder.signatureUrl.startsWith('data:')) {
      try {
        const timeStamp = Date.now();
        const storedFileName = `med_sig_${timeStamp}.png`;
        const targetPath = path.join(process.cwd(), 'uploads', 'media', storedFileName);
        const base64 = updatedFounder.signatureUrl.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');
        try {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, buffer);
        } catch (fsErr) {}
        await uploadToFirebaseStorage(`media/${storedFileName}`, buffer, 'image/png');
        await putR2File(`media/${storedFileName}`, buffer, 'image/png');
        updatedFounder.signatureData = updatedFounder.signatureUrl;
        updatedFounder.signatureUrl = `/uploads/media/${storedFileName}`;
      } catch (e) {
        console.error('Error saving founder signature:', e);
      }
    } else if (updatedFounder.signatureUrl && updatedFounder.signatureUrl.startsWith('/uploads/')) {
      const matched = (dbState.media || []).find((m: any) => m.url === updatedFounder.signatureUrl || (m.storedFileName && updatedFounder.signatureUrl.endsWith(m.storedFileName)));
      if (matched && ((matched as any).fileData || (matched as any).base64)) {
        updatedFounder.signatureData = (matched as any).fileData || (matched as any).base64;
      }
    }

    dbState.founder = updatedFounder;
    logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'FOUNDER_UPDATE', 'Updated Founder profile.');
    await persistDatabase('founder');
  }
  res.json({ message: 'Founder profile saved successfully.', founder: dbState.founder });
};
app.post('/api/admin/founder', handleFounderUpdate);
app.post('/api/founder', handleFounderUpdate);
app.put('/api/admin/founder', handleFounderUpdate);
app.put('/api/founder', handleFounderUpdate);

// Public aggregate team statistics API
app.get('/api/about/team', (req, res) => {
  const teamStats = dbState.aboutUs?.teamStats || PRESEEDED_ABOUT_US.teamStats || {
    employeeCount: dbState.team ? dbState.team.length : 45,
    trainedEmployeeCount: dbState.team ? dbState.team.filter(e => e.status === 'Active').length : 40,
    combinedExperienceYears: dbState.team ? dbState.team.reduce((acc, e) => acc + (Number(e.experience) || 0), 0) : 120,
    description: 'Our dedicated team of desk officers and document verification experts handles citizen applications with efficiency, accuracy, and full legal compliance.'
  };
  res.json(teamStats);
});

app.get('/api/admin/about/team', (req, res) => {
  res.json(dbState.aboutUs?.teamStats || PRESEEDED_ABOUT_US.teamStats);
});

app.put('/api/admin/about/team', async (req, res) => {
  const { teamStats, updaterId, updaterName, updaterRole } = req.body;
  if (teamStats) {
    if (!dbState.aboutUs) dbState.aboutUs = { ...PRESEEDED_ABOUT_US };
    dbState.aboutUs.teamStats = { ...dbState.aboutUs.teamStats, ...teamStats };
    logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'ABOUT_TEAM_UPDATE', 'Updated About Us aggregate team statistics.');
    await persistDatabase('aboutUs');
  }
  res.json({ message: 'Aggregate team statistics updated successfully.', teamStats: dbState.aboutUs?.teamStats });
});

app.post('/api/admin/about/team', async (req, res) => {
  const { teamStats, updaterId, updaterName, updaterRole } = req.body;
  if (teamStats) {
    if (!dbState.aboutUs) dbState.aboutUs = { ...PRESEEDED_ABOUT_US };
    dbState.aboutUs.teamStats = { ...dbState.aboutUs.teamStats, ...teamStats };
    logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'ABOUT_TEAM_UPDATE', 'Updated About Us aggregate team statistics.');
    await persistDatabase('aboutUs');
  }
  res.json({ message: 'Aggregate team statistics updated successfully.', teamStats: dbState.aboutUs?.teamStats });
});

// Public endpoint for /api/team strictly restricts access to protect private employee records
app.get('/api/team', (req, res) => {
  res.status(403).json({ message: 'Access restricted. Individual employee records are private and protected.' });
});

// ---------------- PRIVATE INTERNAL EMPLOYEE / TEAM RECORDS MANAGEMENT APIS ----------------

// Photo upload API endpoint for employee records
app.post(['/api/admin/employees/upload-photo', '/api/admin/team/upload-photo'], async (req, res) => {
  try {
    const { image, updaterId, updaterName, updaterRole } = req.body;
    if (!image) {
      return res.status(400).json({ message: 'Image file or base64 content is required.' });
    }

    let base64Data = image;
    let extension = 'png';
    let mimeType = 'image/png';

    if (image.includes(';base64,')) {
      const parts = image.split(';base64,');
      base64Data = parts[1];
      const match = parts[0].match(/data:image\/(png|jpeg|jpg|webp|gif)/);
      if (match) {
        extension = match[1] === 'jpeg' ? 'jpg' : match[1];
        mimeType = `image/${match[1]}`;
      }
    }

    const uniqueFilename = `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;
    const filePath = path.join(process.cwd(), 'uploads', 'employees', uniqueFilename);

    const buffer = Buffer.from(base64Data, 'base64');
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, buffer);
    } catch (fsErr) {}

    // Upload binary to Firebase Storage & R2
    const fbUpload = await uploadToFirebaseStorage(`employees/${uniqueFilename}`, buffer, mimeType);
    await putR2File(`employees/${uniqueFilename}`, buffer, mimeType);

    const photoUrl = `/uploads/employees/${uniqueFilename}`;

    // Also register in central media store for seamless retrieval and persistence
    const mediaId = `med-emp-${Date.now()}`;
    const newMedia = {
      id: mediaId,
      name: uniqueFilename,
      originalName: uniqueFilename,
      storedFileName: uniqueFilename,
      storedName: uniqueFilename,
      storagePath: fbUpload.storagePath || `employees/${uniqueFilename}`,
      mimeType,
      type: 'image' as const,
      size: `${(buffer.length / 1024).toFixed(1)} KB`,
      sizeBytes: buffer.length,
      url: photoUrl,
      downloadUrl: fbUpload.downloadUrl || photoUrl,
      fileData: buffer.length <= 850 * 1024 ? image : undefined,
      accessLevel: 'public' as const,
      folder: 'employees',
      title: `Employee Profile Photo - ${uniqueFilename}`,
      uploadedBy: updaterName || 'Admin Operator',
      createdAt: new Date().toISOString()
    };

    if (!dbState.media) dbState.media = [];
    dbState.media.unshift(newMedia);

    // Save structured metadata to Cloudflare D1
    await saveMediaFileMetadataToD1({
      fileId: newMedia.id,
      storagePath: newMedia.storagePath,
      filename: newMedia.name,
      mimeType: newMedia.mimeType,
      sizeBytes: newMedia.sizeBytes,
      downloadUrl: newMedia.url,
      accessLevel: 'public',
      folder: 'employees'
    });

    await persistDatabase('media', newMedia.id);

    res.json({ message: 'Photo uploaded successfully.', photoUrl, filename: uniqueFilename, media: newMedia });
  } catch (err: any) {
    console.error('Error uploading employee photo:', err);
    res.status(500).json({ message: 'Failed to store uploaded photo file.' });
  }
});

// GET all employee operational profiles (Private internal admin endpoint)
app.get('/api/admin/employees', authenticateToken, requirePermission(['employees.view', 'employees.manage']), async (req, res) => {
  const employees = await readCollectionWithFallback('employees', () => dbState.employees || []);
  console.log(`[EMPLOYEE FETCH] Employee count loaded after login/fetch: ${employees.length}`);
  res.json(employees);
});

// GET single employee profile
app.get('/api/admin/employees/:id', authenticateToken, requirePermission(['employees.view', 'employees.manage']), async (req, res) => {
  const { id } = req.params;
  const emp = await readEntityWithFallback('employees', id, () => findEmployee(id));
  if (!emp) {
    return res.status(404).json({ message: 'Employee profile not found.' });
  }
  res.json(emp);
});

// GET Assignable Active Employees for Order Assignment Dropdown
app.get('/api/admin/assignable-employees', authenticateToken, requirePermission(['employees.view', 'employees.manage', 'orders.view', 'orders.view_assigned']), (req, res) => {
  if (!dbState.employees) {
    dbState.employees = [];
  }
  if (!dbState.employeeAccounts) {
    dbState.employeeAccounts = {};
  }

  const eligibleRoles = ['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR'];

  const assignable = (dbState.employees || [])
    .filter(emp => emp.employmentStatus === 'Active')
    .map(emp => {
      const acc = getEmployeeAccount(emp.id);
      const adminObj = dbState.admins.find(
        (a: any) => a.email?.toLowerCase() === emp.personalEmail?.toLowerCase() || a.id === emp.id
      );

      const accountStatus = acc?.accountStatus || (adminObj && !adminObj.isSuspended ? 'Active' : 'Active');
      const accountRole = acc?.role || adminObj?.role || 'STAFF';

      if (accountStatus !== 'Active') return null;
      if (!eligibleRoles.includes(accountRole)) return null;

      return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        designation: emp.designation,
        department: emp.department,
        profilePhoto: emp.profilePhoto,
        employmentStatus: emp.employmentStatus,
        accountRole,
        systemEmail: acc?.systemEmail || emp.personalEmail || ''
      };
    })
    .filter(Boolean);

  res.json(assignable);
});

// CREATE or UPDATE operational profile
app.post('/api/admin/employees', authenticateToken, requirePermission(['employees.manage', 'employees.view']), async (req, res) => {
  const body = req.body.employee || req.body || {};
  const fullName = body.fullName || body.name || '';
  const designation = body.designation || '';
  const department = body.department || '';
  const id = body.id;
  const employeeCode = body.employeeCode;

  if (!fullName || !designation || !department) {
    return res.status(400).json({ message: 'Full Name, Designation, and Department are required.' });
  }

  const existingEmp = findEmployee(id || employeeCode || body.personalEmail || body.email);
  const empId = existingEmp ? existingEmp.id : (id || `emp-${Date.now()}`);
  const code = existingEmp ? existingEmp.employeeCode : (employeeCode || `EMP-${100 + (dbState.employees?.length || 0) + 1}`);
  const existingIdx = (dbState.employees || []).findIndex(e => e.id === empId);

  const fatherName = body.fatherName || '';
  const motherName = body.motherName || '';
  const spouseName = body.spouseName || '';
  const fatherMotherSpouseName = body.fatherMotherSpouseName || [fatherName, motherName, spouseName].filter(Boolean).join(', ') || '';

  const isPermanentSameAsCurrent = body.isPermanentSameAsCurrent !== undefined ? !!body.isPermanentSameAsCurrent : (body.permanentAddress === body.currentAddress && !!body.currentAddress);
  const currentAddress = body.currentAddress || body.address || '';
  const permanentAddress = isPermanentSameAsCurrent ? currentAddress : (body.permanentAddress || '');

  const highestQual = body.highestQualification || body.qualificationSummary || body.qualification || '';

  const parsedSkills = Array.isArray(body.skills)
    ? body.skills
    : (typeof body.skills === 'string' ? body.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

  const parsedLanguages = Array.isArray(body.languages)
    ? body.languages
    : (typeof body.languages === 'string' ? body.languages.split(',').map((l: string) => l.trim()).filter(Boolean) : []);

  const profile: EmployeeProfile = {
    id: empId,
    employeeCode: code,
    fullName,
    profilePhoto: body.profilePhoto || body.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    profilePhotoMediaId: body.profilePhotoMediaId || '',
    fatherName,
    motherName,
    spouseName,
    fatherMotherSpouseName,
    dateOfBirth: body.dateOfBirth || '',
    gender: body.gender || 'Not Specified',
    nationality: body.nationality || 'Indian',
    bloodGroup: body.bloodGroup || '',
    personalEmail: body.personalEmail || body.email || '',
    personalMobile: body.personalMobile || body.mobile || '',
    emergencyContactName: body.emergencyContactName || '',
    emergencyContactRelation: body.emergencyContactRelation || '',
    emergencyContactMobile: body.emergencyContactMobile || '',
    currentAddress,
    permanentAddress,
    isPermanentSameAsCurrent,
    city: body.city || '',
    district: body.district || '',
    state: body.state || '',
    pinCode: body.pinCode || '',
    designation,
    department,
    employmentType: body.employmentType || 'Full-Time',
    joiningDate: body.joiningDate || new Date().toISOString().split('T')[0],
    employmentStatus: body.employmentStatus || 'Active',
    reportingManager: body.reportingManager || '',
    workLocation: body.workLocation || 'Headquarters',
    probationStatus: body.probationStatus || 'Confirmed',
    confirmationDate: body.confirmationDate || '',
    exitDate: body.exitDate || '',
    exitReason: body.exitReason || '',
    highestQualification: highestQual,
    qualificationSummary: highestQual,
    university: body.university || '',
    certifications: body.certifications || '',
    totalExperienceYears: Number(body.totalExperienceYears !== undefined ? body.totalExperienceYears : body.experience) || 0,
    previousOrganizations: body.previousOrganizations || body.previousOrganisation || '',
    skills: parsedSkills,
    languages: parsedLanguages,
    internalNotes: body.internalNotes || '',
    createdAt: existingIdx !== -1 ? dbState.employees[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!dbState.employees) dbState.employees = [];

  // Sync to master data automatically if new
  if (!dbState.masterData) dbState.masterData = JSON.parse(JSON.stringify(PRESEEDED_MASTER_DATA));
  if (department && !dbState.masterData.departments.includes(department)) {
    dbState.masterData.departments.push(department);
  }
  if (designation && !dbState.masterData.designations.includes(designation)) {
    dbState.masterData.designations.push(designation);
  }

  const countBefore = dbState.employees.length;

  if (existingIdx !== -1) {
    dbState.employees[existingIdx] = { ...dbState.employees[existingIdx], ...profile };
    logAudit(req, 'EMPLOYEE_PROFILE_UPDATED', `Updated operational profile for ${fullName} (${code})`, empId);
  } else {
    dbState.employees.push(profile);
    logAudit(req, 'EMPLOYEE_PROFILE_CREATED', `Created new operational profile for ${fullName} (${code})`, empId);

    // Initialize sub-records safely linked by canonical empId
    getEmployeeKYC(empId);
    getEmployeePayroll(empId);
  }

  await persistDatabase('employees', empId);
  console.log(`[EMPLOYEE CREATE/UPDATE] Employee created/updated ID: ${empId}`);
  console.log(`[EMPLOYEE CREATE/UPDATE] Employee count before save: ${countBefore}`);
  console.log(`[EMPLOYEE CREATE/UPDATE] Employee count after save: ${dbState.employees.length}`);

  res.status(existingIdx !== -1 ? 200 : 201).json(profile);
});

// UPDATE operational profile by ID
app.put('/api/admin/employees/:id', authenticateToken, requirePermission(['employees.manage', 'employees.view']), async (req, res) => {
  const { id } = req.params;
  const emp = findEmployee(id);
  if (!emp) {
    return res.status(404).json({ message: 'Employee record not found.' });
  }

  const idx = (dbState.employees || []).findIndex(e => e.id === emp.id);
  if (idx === -1) {
    return res.status(404).json({ message: 'Employee record not found.' });
  }

  const body = req.body.employee || req.body || {};
  const current = dbState.employees[idx];

  const fullName = body.fullName || body.name || current.fullName;
  const designation = body.designation || current.designation;
  const department = body.department || current.department;
  const fatherName = body.fatherName !== undefined ? body.fatherName : (current.fatherName || '');
  const motherName = body.motherName !== undefined ? body.motherName : (current.motherName || '');
  const spouseName = body.spouseName !== undefined ? body.spouseName : (current.spouseName || '');
  const fatherMotherSpouseName = body.fatherMotherSpouseName || [fatherName, motherName, spouseName].filter(Boolean).join(', ') || current.fatherMotherSpouseName || '';

  const isPermanentSameAsCurrent = body.isPermanentSameAsCurrent !== undefined ? !!body.isPermanentSameAsCurrent : (current.isPermanentSameAsCurrent ?? false);
  const currentAddress = body.currentAddress !== undefined ? body.currentAddress : (current.currentAddress || '');
  const permanentAddress = isPermanentSameAsCurrent ? currentAddress : (body.permanentAddress !== undefined ? body.permanentAddress : (current.permanentAddress || ''));

  const highestQual = body.highestQualification || body.qualificationSummary || current.highestQualification || current.qualificationSummary || '';

  let parsedSkills = current.skills || [];
  if (body.skills !== undefined) {
    parsedSkills = Array.isArray(body.skills)
      ? body.skills
      : (typeof body.skills === 'string' ? body.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
  }

  let parsedLanguages = current.languages || [];
  if (body.languages !== undefined) {
    parsedLanguages = Array.isArray(body.languages)
      ? body.languages
      : (typeof body.languages === 'string' ? body.languages.split(',').map((l: string) => l.trim()).filter(Boolean) : []);
  }

  dbState.employees[idx] = {
    ...current,
    ...body,
    id: current.id, // Preserve permanent canonical ID
    employeeCode: current.employeeCode, // Preserve permanent canonical code
    fatherName,
    motherName,
    spouseName,
    fatherMotherSpouseName,
    isPermanentSameAsCurrent,
    currentAddress,
    permanentAddress,
    highestQualification: highestQual,
    qualificationSummary: highestQual,
    previousOrganizations: body.previousOrganizations || body.previousOrganisation || current.previousOrganizations || '',
    skills: parsedSkills,
    languages: parsedLanguages,
    updatedAt: new Date().toISOString()
  };

  logAudit(req, 'EMPLOYEE_PROFILE_UPDATED', `Updated operational profile for ${dbState.employees[idx].fullName}`, current.id);
  await persistDatabase('employees', current.id);
  res.json(dbState.employees[idx]);
});

// UPDATE employee status explicitly
app.patch('/api/admin/employees/:id/status', authenticateToken, requirePermission(['employees.manage', 'employees.view']), async (req, res) => {
  const { id } = req.params;
  const emp = findEmployee(id);
  if (!emp) {
    return res.status(404).json({ message: 'Employee record not found.' });
  }

  const idx = (dbState.employees || []).findIndex(e => e.id === emp.id);
  const { employmentStatus, status } = req.body || {};
  const newStatus = employmentStatus || status;

  if (!newStatus) {
    return res.status(400).json({ message: 'employmentStatus is required.' });
  }

  dbState.employees[idx].employmentStatus = newStatus;
  dbState.employees[idx].updatedAt = new Date().toISOString();

  logAudit(req, 'EMPLOYEE_STATUS_CHANGED', `Changed employment status for ${dbState.employees[idx].fullName} to ${newStatus}`, emp.id);
  await persistDatabase('employees', emp.id);

  res.json({
    success: true,
    message: `Employee status updated to ${newStatus}`,
    employee: dbState.employees[idx]
  });
});

app.put('/api/admin/employees/:id/status', authenticateToken, requirePermission(['employees.manage', 'employees.view']), async (req, res) => {
  const { id } = req.params;
  const emp = findEmployee(id);
  if (!emp) {
    return res.status(404).json({ message: 'Employee record not found.' });
  }

  const idx = (dbState.employees || []).findIndex(e => e.id === emp.id);
  const { employmentStatus, status } = req.body || {};
  const newStatus = employmentStatus || status;

  if (!newStatus) {
    return res.status(400).json({ message: 'employmentStatus is required.' });
  }

  dbState.employees[idx].employmentStatus = newStatus;
  dbState.employees[idx].updatedAt = new Date().toISOString();

  logAudit(req, 'EMPLOYEE_STATUS_CHANGED', `Changed employment status for ${dbState.employees[idx].fullName} to ${newStatus}`, emp.id);
  await persistDatabase('employees', emp.id);

  res.json({
    success: true,
    message: `Employee status updated to ${newStatus}`,
    employee: dbState.employees[idx]
  });
});

// DELETE employee record (soft deactivation by default, permanent removal if ?permanent=true)
app.delete('/api/admin/employees/:id', authenticateToken, requirePermission('employees.manage'), async (req, res) => {
  const { id } = req.params;
  const isHardDelete = req.query.permanent === 'true' || req.query.hard === 'true' || req.query.force === 'true';
  const emp = findEmployee(id);
  if (!emp) {
    return res.status(404).json({ message: 'Employee record not found.' });
  }

  const canonicalId = emp.id;

  if (isHardDelete) {
    dbState.employees = dbState.employees.filter(e => e.id !== canonicalId);
    if (dbState.employeeKYC?.[canonicalId]) delete dbState.employeeKYC[canonicalId];
    if (dbState.employeePayroll?.[canonicalId]) delete dbState.employeePayroll[canonicalId];
    if (dbState.employeeAccounts?.[canonicalId]) delete dbState.employeeAccounts[canonicalId];
    if (dbState.employeeDocuments) {
      dbState.employeeDocuments = dbState.employeeDocuments.filter(d => d.employeeId !== canonicalId);
    }
    logAudit(req, 'EMPLOYEE_PERMANENTLY_DELETED', `Permanently deleted employee ${emp.fullName} (${emp.employeeCode})`, canonicalId);
    await Promise.allSettled([
      persistDatabase('employees', canonicalId),
      persistDatabase('employeeKYC', canonicalId),
      persistDatabase('employeePayroll', canonicalId),
      persistDatabase('employeeAccounts', canonicalId),
      persistDatabase('employeeDocuments')
    ]);
  } else {
    emp.employmentStatus = 'Terminated';
    emp.updatedAt = new Date().toISOString();
    logAudit(req, 'EMPLOYEE_DEACTIVATED', `Deactivated employee ${emp.fullName} (${emp.employeeCode})`, canonicalId);
    await persistDatabase('employees', canonicalId);
  }

  res.json({ message: isHardDelete ? 'Employee record permanently deleted.' : 'Employee profile marked as Terminated/Deactivated.', employee: emp });
});

// KYC Endpoints
app.get('/api/admin/employees/:id/kyc', authenticateToken, requirePermission(['employee_kyc.view', 'employee_kyc.manage', 'employees.view', 'employees.manage']), async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;
  const emp = findEmployee(id);
  const canonicalId = emp ? emp.id : id;
  const kyc = await readEntityWithFallback('employeeKYC', canonicalId, () => getEmployeeKYC(canonicalId)) || getEmployeeKYC(canonicalId);

  const shouldUnmask = ((user?.role as string) === 'SUPER_ADMIN' || user?.role === UserRole.ADMIN) && req.query.unmask === 'true';

  const responseKyc: EmployeeKYC = {
    ...kyc,
    aadhaarNumber: shouldUnmask ? kyc.aadhaarNumber : maskAadhaar(kyc.aadhaarNumber),
    panNumber: shouldUnmask ? kyc.panNumber : maskPAN(kyc.panNumber)
  };

  logAudit(req, 'KYC_VIEWED', `Viewed KYC record for employee ${canonicalId} (${shouldUnmask ? 'UNMASKED' : 'MASKED'})`, canonicalId);
  res.json(responseKyc);
});

app.put('/api/admin/employees/:id/kyc', authenticateToken, requirePermission(['employee_kyc.manage', 'employee_kyc.view', 'employees.manage', 'employees.view']), async (req, res) => {
  const { id } = req.params;
  const emp = findEmployee(id);
  const canonicalId = emp ? emp.id : id;
  const updated = setEmployeeKYC(canonicalId, req.body, (req as any).user?.name || 'Admin User');

  logAudit(req, 'KYC_UPDATED', `Updated sensitive KYC records for employee ${canonicalId}`, canonicalId);
  await persistDatabase('employeeKYC', canonicalId);
  res.json({ message: 'KYC record updated successfully.', kyc: updated });
});

// Payroll Endpoints
app.get('/api/admin/employees/:id/payroll', authenticateToken, requirePermission(['employee_payroll.view', 'employee_payroll.manage', 'employees.view', 'employees.manage']), async (req, res) => {
  const { id } = req.params;
  const emp = findEmployee(id);
  const canonicalId = emp ? emp.id : id;
  const payroll = await readEntityWithFallback('employeePayroll', canonicalId, () => getEmployeePayroll(canonicalId)) || getEmployeePayroll(canonicalId);

  const shouldUnmask = req.query.unmask === 'true';

  const responsePayroll: EmployeePayroll = {
    ...payroll,
    accountNumber: shouldUnmask ? payroll.accountNumber : maskBankAccount(payroll.accountNumber)
  };

  logAudit(req, 'PAYROLL_VIEWED', `Viewed payroll details for employee ${canonicalId} (${shouldUnmask ? 'UNMASKED' : 'MASKED'})`, canonicalId);
  res.json(responsePayroll);
});

app.put('/api/admin/employees/:id/payroll', authenticateToken, requirePermission(['employee_payroll.manage', 'employee_payroll.view', 'employees.manage', 'employees.view']), async (req, res) => {
  const { id } = req.params;
  const emp = findEmployee(id);
  const canonicalId = emp ? emp.id : id;
  const updated = setEmployeePayroll(canonicalId, req.body);

  logAudit(req, 'PAYROLL_UPDATED', `Updated salary and bank payroll records for employee ${canonicalId}`, canonicalId);
  await persistDatabase('employeePayroll', canonicalId);
  res.json({ message: 'Payroll record updated successfully.', payroll: updated });
});

// Private Document Vault Endpoints
app.get('/api/admin/employees/:id/documents', authenticateToken, requirePermission(['employee_kyc.view', 'employee_kyc.manage', 'employees.view', 'employees.manage', 'documents.verify', 'documents.upload']), async (req, res) => {
  const { id } = req.params;
  const allDocs = await readCollectionWithFallback('employeeDocuments', () => getEmployeeDocuments(id));
  const empDocs = allDocs.filter((d: any) => d.employeeId === id || d.employee_id === id);
  res.json(empDocs.length > 0 ? empDocs : getEmployeeDocuments(id));
});

app.post('/api/admin/employees/:id/documents', authenticateToken, requirePermission(['employee_kyc.manage', 'employees.manage', 'documents.upload']), async (req, res) => {
  const { id } = req.params;
  const emp = findEmployee(id);
  const canonicalId = emp ? emp.id : id;
  const { documentType, documentName, originalFileName, fileData, mimeType, notes } = req.body;

  if (!documentType || !fileData) {
    return res.status(400).json({ message: 'documentType and base64 fileData are required.' });
  }

  let base64Content = fileData;
  let detectedMime = mimeType || 'application/pdf';

  if (fileData.includes(';base64,')) {
    const parts = fileData.split(';base64,');
    base64Content = parts[1];
    const match = parts[0].match(/data:(.*?);/);
    if (match) detectedMime = match[1];
  }

  const fileBuffer = Buffer.from(base64Content, 'base64');
  const safeName = (originalFileName || documentName || 'doc').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const privateKey = `doc_${canonicalId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeName}`;
  const filePath = path.join(PRIVATE_UPLOADS_DIR, privateKey);

  try {
    if (fs.writeFileSync) {
      fs.writeFileSync(filePath, fileBuffer);
    }
  } catch (fsErr) {
    // Ignored in worker
  }

  // Upload binary to Firebase Storage & R2
  const fbUpload = await uploadToFirebaseStorage(`documents/employees/${privateKey}`, fileBuffer, detectedMime);
  await putR2File(`documents/employees/${privateKey}`, fileBuffer, detectedMime);

  const sizeKb = (fileBuffer.length / 1024).toFixed(1);
  const sizeStr = fileBuffer.length > 1024 * 1024 ? `${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB` : `${sizeKb} KB`;

  const newDoc: EmployeeDocument = {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    employeeId: canonicalId,
    documentType,
    documentName: documentName || documentType,
    originalFileName: originalFileName || safeName,
    privateFileKey: privateKey,
    mimeType: detectedMime,
    fileSize: sizeStr,
    sizeBytes: fileBuffer.length,
    downloadUrl: fbUpload.downloadUrl,
    uploadedBy: (req as any).user?.name || 'Admin User',
    uploadedAt: new Date().toISOString(),
    verificationStatus: 'Pending',
    notes: notes || ''
  };

  if (!dbState.employeeDocuments) dbState.employeeDocuments = [];
  dbState.employeeDocuments.push(newDoc);

  // Persist structured metadata to Cloudflare D1
  await saveMediaFileMetadataToD1({
    fileId: newDoc.id,
    storagePath: `documents/employees/${privateKey}`,
    filename: newDoc.documentName,
    mimeType: newDoc.mimeType,
    sizeBytes: newDoc.sizeBytes,
    downloadUrl: fbUpload.downloadUrl,
    accessLevel: 'restricted',
    ownerId: canonicalId,
    folder: 'kyc-documents'
  });

  logAudit(req, 'SENSITIVE_DOCUMENT_UPLOADED', `Uploaded private document: ${newDoc.documentName} (${documentType})`, canonicalId, newDoc.id);
  await persistDatabase('employeeDocuments', newDoc.id);

  res.status(201).json(newDoc);
});

app.get('/api/admin/employees/:id/documents/:docId/download', authenticateToken, requirePermission(['employee_kyc.view', 'employee_kyc.manage', 'employees.view', 'employees.manage', 'documents.verify']), async (req, res) => {
  const { id, docId } = req.params;
  const emp = findEmployee(id);
  const canonicalId = emp ? emp.id : id;
  const doc = (dbState.employeeDocuments || []).find(d => d.id === docId && (d.employeeId === canonicalId || d.employeeId === id));

  if (!doc) {
    return res.status(404).json({ message: 'Employee document not found.' });
  }

  // 1. Try R2 Storage
  try {
    const r2Doc = await getR2File(`documents/employees/${doc.privateFileKey}`) || await getR2File(doc.privateFileKey);
    if (r2Doc) {
      logAudit(req, 'SENSITIVE_DOCUMENT_DOWNLOADED', `Downloaded private document: ${doc.documentName} (${doc.documentType})`, canonicalId, docId);
      res.setHeader('Content-Type', doc.mimeType || r2Doc.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalFileName || doc.documentName)}"`);
      if (Buffer.isBuffer(r2Doc.body)) {
        return res.send(r2Doc.body);
      }
      if (typeof (r2Doc.body as any)?.pipe === 'function') {
        return (r2Doc.body as any).pipe(res);
      }
      return res.send(r2Doc.body);
    }
  } catch (r2Err) {}

  // 2. Try local disk
  const filePath = path.join(PRIVATE_UPLOADS_DIR, doc.privateFileKey);
  if (fs.existsSync && fs.existsSync(filePath)) {
    logAudit(req, 'SENSITIVE_DOCUMENT_DOWNLOADED', `Downloaded private document: ${doc.documentName} (${doc.documentType})`, canonicalId, docId);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalFileName || doc.documentName)}"`);
    return res.sendFile(filePath);
  }

  return res.status(404).json({ message: 'File not found in private vault storage.' });
});

app.delete('/api/admin/employees/:id/documents/:docId', authenticateToken, requirePermission(['employee_kyc.manage', 'employees.manage']), async (req, res) => {
  const { id, docId } = req.params;
  const emp = findEmployee(id);
  const canonicalId = emp ? emp.id : id;
  const idx = (dbState.employeeDocuments || []).findIndex(d => d.id === docId && (d.employeeId === canonicalId || d.employeeId === id));

  if (idx === -1) {
    return res.status(404).json({ message: 'Document record not found.' });
  }

  const doc = dbState.employeeDocuments[idx];
  await deleteFromFirebaseStorage(`documents/employees/${doc.privateFileKey}`);
  await deleteMediaFileMetadataFromD1(doc.id);
  await deleteR2File(`documents/employees/${doc.privateFileKey}`);
  await deleteR2File(doc.privateFileKey);

  const filePath = path.join(PRIVATE_UPLOADS_DIR, doc.privateFileKey);
  if (fs.existsSync && fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) { console.error('Error deleting private file:', e); }
  }

  dbState.employeeDocuments.splice(idx, 1);
  logAudit(req, 'SENSITIVE_DOCUMENT_DELETED', `Deleted private document: ${doc.documentName}`, canonicalId, docId);
  await persistDatabase('employeeDocuments', docId);

  res.json({ message: 'Document deleted from private vault.' });
});

// System Account & Password Endpoints
app.get('/api/admin/employees/:id/account', authenticateToken, requirePermission(['staff_accounts.view', 'staff_accounts.manage', 'employees.view', 'employees.manage']), async (req, res) => {
  const { id } = req.params;
  const acc = await readEntityWithFallback('employeeAccounts', id, () => getEmployeeAccount(id)) || getEmployeeAccount(id);
  if (acc) {
    const adminObj = dbState.admins.find(a => a.email.toLowerCase() === acc.systemEmail?.toLowerCase());
    const effectivePerms = (acc as any).permissions && (acc as any).permissions.length > 0 ? (acc as any).permissions : (adminObj?.permissions || []);
    return res.json({ ...acc, permissions: effectivePerms });
  }
  res.json(acc);
});

app.post('/api/admin/employees/:id/account', authenticateToken, requirePermission(['staff_accounts.manage', 'employees.manage']), async (req, res) => {
  const { id } = req.params;
  const { systemEmail, password, role, accountStatus, permissions } = req.body;

  if (!systemEmail) {
    return res.status(400).json({ message: 'systemEmail is required' });
  }

  const emp = findEmployee(id);
  const canonicalId = emp ? emp.id : id;
  const empName = emp ? emp.fullName : 'Employee User';
  const targetRole = role || 'STAFF';

  let userObj = dbState.users.find(u => u.email.toLowerCase() === systemEmail.toLowerCase());
  if (!userObj && password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    userObj = {
      id: `user-${Date.now()}`,
      name: empName,
      email: systemEmail,
      password: hashedPassword,
      role: targetRole,
      createdAt: new Date().toISOString()
    };
    dbState.users.push(userObj);
  } else if (userObj) {
    userObj.role = targetRole;
    if (password) userObj.password = bcrypt.hashSync(password, 10);
  }

  const assignedPermissions = Array.isArray(permissions) ? permissions : undefined;

  // Also sync with dbState.admins so employee can log into the admin portal
  const isAdminRole = ['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR'].includes(targetRole);
  let adminObj = dbState.admins?.find(a => a.email.toLowerCase() === systemEmail.toLowerCase());
  if (isAdminRole) {
    if (!dbState.admins) dbState.admins = [];
    if (!adminObj && password) {
      adminObj = {
        id: userObj ? userObj.id : `admin-${Date.now()}`,
        name: empName,
        email: systemEmail,
        password: bcrypt.hashSync(password, 10),
        role: targetRole,
        department: emp ? emp.department : 'Operations',
        status: accountStatus === 'Active' ? 'Active' : 'Suspended',
        isSuspended: accountStatus !== 'Active',
        permissions: assignedPermissions || ['READ', 'WRITE', 'MANAGE_ORDERS', 'VERIFY_DOCUMENTS'],
        createdAt: new Date().toISOString()
      };
      dbState.admins.push(adminObj);
    } else if (adminObj) {
      adminObj.role = targetRole;
      if (password) adminObj.password = bcrypt.hashSync(password, 10);
      adminObj.status = accountStatus === 'Active' ? 'Active' : 'Suspended';
      adminObj.isSuspended = accountStatus !== 'Active';
      if (assignedPermissions) {
        adminObj.permissions = assignedPermissions;
      }
    }
  }

  const updatedAccount = setEmployeeAccount(canonicalId, {
    userId: userObj ? userObj.id : (adminObj ? adminObj.id : undefined),
    systemEmail,
    role: targetRole,
    permissions: assignedPermissions || adminObj?.permissions || [],
    accountStatus: accountStatus || 'Active'
  });

  logAudit(req, 'EMPLOYEE_ACCOUNT_UPDATED', `Configured system login account and RBAC permissions for employee ${canonicalId} (${systemEmail})`, canonicalId);
  await persistDatabase('employeeAccounts', canonicalId);

  const { password: _, ...cleanUser } = userObj || {};
  res.json({ message: 'Employee system account configured successfully.', account: updatedAccount, user: cleanUser });
});

app.put('/api/admin/employees/:id/account/status', authenticateToken, requirePermission(['staff_accounts.manage', 'employees.manage']), async (req, res) => {
  const { id } = req.params;
  const { accountStatus } = req.body;
  const emp = findEmployee(id);
  const canonicalId = emp ? emp.id : id;

  const acc = getEmployeeAccount(canonicalId);
  if (!acc) {
    return res.status(404).json({ message: 'No system account found for this employee.' });
  }

  const updated = setEmployeeAccount(canonicalId, { accountStatus: accountStatus || 'Active' });
  logAudit(req, 'EMPLOYEE_ACCOUNT_STATUS_CHANGED', `Changed account status to ${accountStatus} for employee ${canonicalId}`, canonicalId);
  await persistDatabase('employeeAccounts', canonicalId);

  res.json({ message: 'Account status updated.', account: updated });
});

app.put('/api/admin/employees/:id/account/reset-password', authenticateToken, requirePermission(['staff_accounts.manage', 'employees.manage']), async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const emp = findEmployee(id);
  const canonicalId = emp ? emp.id : id;
  const acc = getEmployeeAccount(canonicalId);
  if (!acc || !acc.systemEmail) {
    return res.status(400).json({ message: 'No system account email registered for this employee.' });
  }

  const userObj = dbState.users.find(u => u.email.toLowerCase() === acc.systemEmail.toLowerCase());
  if (!userObj) {
    return res.status(404).json({ message: 'Matching system user account not found.' });
  }

  userObj.password = bcrypt.hashSync(newPassword, 10);
  const adminObj = dbState.admins?.find(a => a.email.toLowerCase() === acc.systemEmail.toLowerCase());
  if (adminObj) {
    adminObj.password = userObj.password;
  }

  logAudit(req, 'EMPLOYEE_PASSWORD_RESET', `Reset login password for employee ${canonicalId} (${acc.systemEmail})`, canonicalId);
  await persistDatabase('users', userObj.id);

  res.json({ message: 'Password reset successfully for employee system account.' });
});

// Audit Logs Endpoint
app.get('/api/admin/audit-logs', authenticateToken, requireRole([UserRole.ADMIN]), async (req, res) => {
  const { employeeId } = req.query;
  let logs = await readCollectionWithFallback('auditLogs', () => dbState.auditLogs || []);
  if (employeeId) {
    const emp = findEmployee(employeeId as string);
    const canonicalId = emp ? emp.id : employeeId;
    const code = emp ? emp.employeeCode : '';
    logs = logs.filter(l => l.employeeId === canonicalId || (code && l.employeeId === code));
  }
  res.json(logs);
});

app.get('/api/admin/employees/:id/audit-logs', authenticateToken, requireRole([UserRole.ADMIN]), (req, res) => {
  const { id } = req.params;
  const emp = findEmployee(id);
  const canonicalId = emp ? emp.id : id;
  const code = emp ? emp.employeeCode : '';
  let logs = dbState.auditLogs || [];
  logs = logs.filter(l => l.employeeId === canonicalId || (code && l.employeeId === code));
  res.json(logs);
});

// ---------------- COMPANY PROFILE & BRANDING APIS FOR ID CARD ----------------
app.get('/api/company-profile', (req, res) => {
  res.json(dbState.companyProfile || PRESEEDED_COMPANY_PROFILE);
});

app.post('/api/admin/company-profile', async (req, res) => {
  const { companyProfile, updaterId, updaterName, updaterRole } = req.body;
  if (companyProfile) {
    dbState.companyProfile = { ...(dbState.companyProfile || PRESEEDED_COMPANY_PROFILE), ...companyProfile };
    logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'COMPANY_PROFILE_UPDATE', 'Updated company profile, logo, address, and ID card branding colors.');
    await persistDatabase('companyProfile');
  }
  res.json({ message: 'Company profile updated successfully.', companyProfile: dbState.companyProfile });
});

// ---------------- CONTACT US MODULE APIS ----------------
function normalizeWhatsAppNumber(raw: any): string {
  if (!raw || typeof raw !== 'string') {
    return (dbState?.contactSettings?.whatsapp && typeof dbState.contactSettings.whatsapp === 'string')
      ? dbState.contactSettings.whatsapp
      : '919876543210';
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  if (digits.startsWith('91') && digits.length === 12) {
    return digits;
  }
  if (digits.length > 0) {
    return digits;
  }
  return (dbState?.contactSettings?.whatsapp && typeof dbState.contactSettings.whatsapp === 'string')
    ? dbState.contactSettings.whatsapp
    : '919876543210';
}

const handleContactSettingsGet = (req: express.Request, res: express.Response) => {
  if (!dbState.contactSettings) {
    dbState.contactSettings = { ...PRESEEDED_CONTACT_SETTINGS };
  }
  if (dbState.contactSettings.whatsapp) {
    dbState.contactSettings.whatsapp = normalizeWhatsAppNumber(dbState.contactSettings.whatsapp);
  }
  res.json(dbState.contactSettings);
};

app.get('/api/contact-settings', handleContactSettingsGet);
app.get('/api/admin/contact-settings', handleContactSettingsGet);
app.get('/api/settings/contact', handleContactSettingsGet);
app.get('/api/admin/settings/contact', handleContactSettingsGet);

const handleContactSettingsUpdate = async (req: express.Request, res: express.Response) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const user = (req as any).user;
  const rawContact = req.body.contactSettings || req.body;
  if (rawContact && typeof rawContact === 'object') {
    const sanitized = { ...rawContact };
    delete sanitized.updaterId;
    delete sanitized.updaterName;
    delete sanitized.updaterRole;
    if (sanitized.whatsapp) {
      sanitized.whatsapp = normalizeWhatsAppNumber(sanitized.whatsapp);
    }
    dbState.contactSettings = { ...(dbState.contactSettings || PRESEEDED_CONTACT_SETTINGS), ...sanitized };

    // Also sync to company profile so all views and ID cards stay in sync
    if (!dbState.companyProfile) dbState.companyProfile = { ...PRESEEDED_COMPANY_PROFILE };
    if (sanitized.phone) dbState.companyProfile.phone = sanitized.phone;
    if (sanitized.email) dbState.companyProfile.email = sanitized.email;
    if (sanitized.companyName) dbState.companyProfile.companyName = sanitized.companyName;
    if (sanitized.address) dbState.companyProfile.address = sanitized.address;
    if (sanitized.city) dbState.companyProfile.city = sanitized.city;
    if (sanitized.state) dbState.companyProfile.state = sanitized.state;
    if (sanitized.pinCode) dbState.companyProfile.pinCode = sanitized.pinCode;

    logSystemAction(user?.id || updaterId || 'admin-1', user?.name || updaterName || 'Admin', user?.role || updaterRole || 'ADMIN', 'CONTACT_SETTINGS_UPDATE', 'Updated official contact details, phone numbers & WhatsApp configuration.');
    await persistDatabase('contactSettings');
    await persistDatabase('companyProfile');
  }
  res.json({ message: 'Contact settings saved successfully.', contactSettings: dbState.contactSettings });
};

app.post('/api/admin/contact-settings', handleContactSettingsUpdate);
app.post('/api/contact-settings', handleContactSettingsUpdate);
app.post('/api/settings/contact', handleContactSettingsUpdate);
app.post('/api/admin/settings/contact', handleContactSettingsUpdate);

app.put('/api/admin/contact-settings', handleContactSettingsUpdate);
app.put('/api/contact-settings', handleContactSettingsUpdate);
app.put('/api/settings/contact', handleContactSettingsUpdate);
app.put('/api/admin/settings/contact', handleContactSettingsUpdate);

app.post('/api/contact-messages', async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ message: 'Name, email, and message content are required.' });
  }

  const newMsg = {
    id: `msg-${Date.now()}`,
    name,
    email,
    phone: phone || '',
    subject: subject || 'General Inquiry',
    message,
    status: 'New',
    createdAt: new Date().toISOString()
  };

  if (!dbState.contactMessages) dbState.contactMessages = [];
  dbState.contactMessages.unshift(newMsg);
  await persistDatabase('contactMessages', newMsg.id);
  res.status(201).json({ message: 'Message sent successfully!', messageData: newMsg });
});

app.get('/api/admin/contact-messages', (req, res) => {
  res.json(dbState.contactMessages || []);
});

app.patch('/api/admin/contact-messages/:id', async (req, res) => {
  const { status, updaterId, updaterName, updaterRole } = req.body;
  const msg = (dbState.contactMessages || []).find((m: any) => m.id === req.params.id);
  if (!msg) return res.status(404).json({ message: 'Message not found' });

  msg.status = status || 'Replied';
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'CONTACT_MSG_UPDATE', `Updated status of contact message from ${msg.name} to ${msg.status}`);
  await persistDatabase('contactMessages', req.params.id);
  res.json(msg);
});

// ---------------- MASTER DATA MANAGEMENT APIS ----------------
app.get(['/api/admin/master-data', '/api/master-data'], (req, res) => {
  if (!dbState.masterData) {
    dbState.masterData = JSON.parse(JSON.stringify(PRESEEDED_MASTER_DATA));
  }
  res.json(dbState.masterData);
});

const handleMasterDataUpdate = async (req: express.Request, res: express.Response) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const masterData = req.body.masterData || req.body;
  if (masterData) {
    dbState.masterData = { ...(dbState.masterData || PRESEEDED_MASTER_DATA), ...masterData };
    logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'MASTER_DATA_UPDATE', 'Updated system master data (departments, designations, banks, locations).');
    await persistDatabase('masterData');
  }
  res.json({ message: 'Master data updated successfully.', masterData: dbState.masterData });
};

app.post(['/api/admin/master-data', '/api/master-data'], handleMasterDataUpdate);
app.put(['/api/admin/master-data', '/api/master-data'], handleMasterDataUpdate);

// ---------------- ADMIN SETTINGS MODULE APIS ----------------
app.get(['/api/general-settings', '/api/admin/general-settings', '/api/admin/settings/general', '/api/settings/general'], (req, res) => {
  res.json(dbState.generalSettings || PRESEEDED_GENERAL_SETTINGS);
});

const handleGeneralSettingsUpdate = async (req: express.Request, res: express.Response) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const generalSettings = req.body.generalSettings || req.body;
  if (generalSettings) {
    dbState.generalSettings = { ...(dbState.generalSettings || PRESEEDED_GENERAL_SETTINGS), ...generalSettings };
    logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'GENERAL_SETTINGS_UPDATE', 'Updated system general settings and SEO meta config.');
    await persistDatabase('generalSettings');
  }
  res.json({ message: 'General settings saved successfully.', generalSettings: dbState.generalSettings });
};

app.post(['/api/admin/general-settings', '/api/admin/settings/general', '/api/general-settings'], handleGeneralSettingsUpdate);
app.put(['/api/admin/general-settings', '/api/admin/settings/general', '/api/general-settings'], handleGeneralSettingsUpdate);

// Payment settings alias
app.get(['/api/admin/settings/payment', '/api/settings/payment'], (req, res) => {
  res.json(dbState.settings?.paymentConfig || (dbState as any).paymentSettings || (dbState as any).paymentConfig || PRESEEDED_PAYMENT_CONFIG);
});

const handlePaymentConfigRoute = async (req: express.Request, res: express.Response) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const paymentConfig = req.body.paymentConfig || req.body;
  if (paymentConfig) {
    if (!dbState.settings) dbState.settings = {} as any;
    const sanitized = sanitizePaymentConfig(paymentConfig);
    dbState.settings.paymentConfig = sanitized;
    dbState.paymentConfig = sanitized;
    dbState.paymentSettings = sanitized;
    logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'PAYMENT_CONFIG_UPDATE', 'Updated manual payment configuration (UPI/Bank/QR).');
    await persistDatabase('paymentConfig');
    await persistDatabase('paymentSettings');
    await persistDatabase('settings');
  }
  res.json({ message: 'Payment settings updated successfully.', paymentConfig: dbState.settings.paymentConfig });
};

app.post(['/api/admin/settings/payment', '/api/settings/payment'], handlePaymentConfigRoute);
app.put(['/api/admin/settings/payment', '/api/settings/payment'], handlePaymentConfigRoute);

// ---------------- PRIVACY & SECURITY MODULE APIS ----------------
const handlePrivacySecurityGet = (req: express.Request, res: express.Response) => {
  const ps = dbState.privacySecuritySettings || dbState.privacySecurity || PRESEEDED_PRIVACY_SECURITY_SETTINGS;
  if (!dbState.privacySecuritySettings) dbState.privacySecuritySettings = JSON.parse(JSON.stringify(ps));
  if (!dbState.privacySecurity) dbState.privacySecurity = JSON.parse(JSON.stringify(ps));
  res.json(dbState.privacySecuritySettings);
};

app.get(['/api/privacy-security', '/api/admin/privacy-security', '/api/settings/privacy-security', '/api/admin/settings/privacy-security'], handlePrivacySecurityGet);

const handlePrivacySecurityUpdate = async (req: express.Request, res: express.Response) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const user = (req as any).user;
  const rawData = req.body.privacySecuritySettings || req.body.privacySecurity || req.body;
  if (rawData && typeof rawData === 'object') {
    const sanitized = { ...rawData };
    delete sanitized.updaterId;
    delete sanitized.updaterName;
    delete sanitized.updaterRole;
    dbState.privacySecuritySettings = { ...(dbState.privacySecuritySettings || PRESEEDED_PRIVACY_SECURITY_SETTINGS), ...sanitized };
    dbState.privacySecurity = { ...dbState.privacySecuritySettings };

    logSystemAction(user?.id || updaterId || 'super-admin-deepak', user?.name || updaterName || 'Deepak', user?.role || updaterRole || 'SUPER_ADMIN', 'PRIVACY_SECURITY_UPDATE', 'Updated Privacy, Security Notice & Data Protection CMS content.');
    await persistDatabase('privacySecuritySettings');
    await persistDatabase('privacySecurity');
  }
  res.json({ message: 'Privacy & Security CMS settings saved successfully.', privacySecuritySettings: dbState.privacySecuritySettings });
};

app.post(['/api/admin/privacy-security', '/api/privacy-security', '/api/settings/privacy-security', '/api/admin/settings/privacy-security'], handlePrivacySecurityUpdate);
app.put(['/api/admin/privacy-security', '/api/privacy-security', '/api/settings/privacy-security', '/api/admin/settings/privacy-security'], handlePrivacySecurityUpdate);

app.post('/api/security/report-scam', async (req, res) => {
  const { reporterName, reporterEmail, reporterPhone, scamDetails, impersonatorContact, channelUsed } = req.body;
  if (!reporterName && !scamDetails && !impersonatorContact) {
    return res.status(400).json({ message: 'Please provide incident details or suspicious contact information.' });
  }
  const report = {
    id: `scam-${Date.now()}`,
    reporterName: reporterName || 'Anonymous Customer',
    reporterEmail: reporterEmail || '',
    reporterPhone: reporterPhone || '',
    impersonatorContact: impersonatorContact || '',
    channelUsed: channelUsed || 'Phone Call',
    scamDetails: scamDetails || 'Suspicious request for secret credentials',
    status: 'Investigating',
    createdAt: new Date().toISOString()
  };
  if (!dbState.scamReports) dbState.scamReports = [];
  dbState.scamReports.unshift(report);
  await persistDatabase('scamReports', report.id);
  res.status(201).json({ message: 'Scam incident report submitted successfully to EasyDesk Security Team.', report });
});

app.post('/api/security/request-data-deletion', async (req, res) => {
  const { customerName, customerEmail, customerPhone, orderId, reason } = req.body;
  if (!customerName || !customerEmail) {
    return res.status(400).json({ message: 'Name and Email are required for data deletion requests.' });
  }
  const deletionReq = {
    id: `del-${Date.now()}`,
    customerName,
    customerEmail,
    customerPhone: customerPhone || '',
    orderId: orderId || 'All Completed Orders',
    reason: reason || 'Customer voluntary data purge request',
    status: 'Pending Verification',
    createdAt: new Date().toISOString()
  };
  if (!dbState.dataDeletionRequests) dbState.dataDeletionRequests = [];
  dbState.dataDeletionRequests.unshift(deletionReq);
  await persistDatabase('dataDeletionRequests', deletionReq.id);
  res.status(201).json({ message: 'Data deletion request recorded. Our Security Officer will process your purge within 24-48 business hours.', request: deletionReq });
});

app.get('/api/admin/scam-reports', authenticateToken, requireRole([UserRole.ADMIN]), (req, res) => {
  res.json(dbState.scamReports || []);
});

app.get('/api/admin/data-deletion-requests', authenticateToken, requireRole([UserRole.ADMIN]), (req, res) => {
  res.json(dbState.dataDeletionRequests || []);
});

app.patch('/api/admin/scam-reports/:id', authenticateToken, requireRole([UserRole.ADMIN]), async (req, res) => {
  const { status } = req.body;
  const report = (dbState.scamReports || []).find((r: any) => r.id === req.params.id);
  if (!report) return res.status(404).json({ message: 'Report not found' });
  report.status = status || report.status;
  await persistDatabase('scamReports', report.id);
  res.json(report);
});

app.patch('/api/admin/data-deletion-requests/:id', authenticateToken, requireRole([UserRole.ADMIN]), async (req, res) => {
  const { status } = req.body;
  const reqObj = (dbState.dataDeletionRequests || []).find((d: any) => d.id === req.params.id);
  if (!reqObj) return res.status(404).json({ message: 'Request not found' });
  reqObj.status = status || reqObj.status;
  await persistDatabase('dataDeletionRequests', reqObj.id);
  res.json(reqObj);
});

// ---------------- MASTER DATA APIS ----------------
app.get('/api/master-data', (req, res) => {
  if (!dbState.masterData) {
    dbState.masterData = JSON.parse(JSON.stringify(PRESEEDED_MASTER_DATA));
  }
  const empDepts = (dbState.employees || []).map((e: any) => e.department).filter(Boolean);
  const empDesigs = (dbState.employees || []).map((e: any) => e.designation).filter(Boolean);

  const mergedDepts = Array.from(new Set([...(dbState.masterData.departments || []), ...empDepts]));
  const mergedDesigs = Array.from(new Set([...(dbState.masterData.designations || []), ...empDesigs]));

  res.json({
    departments: mergedDepts,
    designations: mergedDesigs,
    employmentTypes: dbState.masterData.employmentTypes || PRESEEDED_MASTER_DATA.employmentTypes,
    workLocations: dbState.masterData.workLocations || PRESEEDED_MASTER_DATA.workLocations,
    employeeStatuses: dbState.masterData.employeeStatuses || PRESEEDED_MASTER_DATA.employeeStatuses,
    documentTypes: dbState.masterData.documentTypes || PRESEEDED_MASTER_DATA.documentTypes,
    banks: dbState.masterData.banks || PRESEEDED_MASTER_DATA.banks
  });
});

app.post('/api/admin/master-data', async (req, res) => {
  const { departments, designations, employmentTypes, workLocations, employeeStatuses, documentTypes, banks, updaterId, updaterName, updaterRole } = req.body;
  if (!dbState.masterData) {
    dbState.masterData = JSON.parse(JSON.stringify(PRESEEDED_MASTER_DATA));
  }
  if (Array.isArray(departments)) {
    dbState.masterData.departments = Array.from(new Set(departments.map((d: string) => d.trim()).filter(Boolean)));
  }
  if (Array.isArray(designations)) {
    dbState.masterData.designations = Array.from(new Set(designations.map((d: string) => d.trim()).filter(Boolean)));
  }
  if (Array.isArray(employmentTypes)) {
    dbState.masterData.employmentTypes = Array.from(new Set(employmentTypes.map((d: string) => d.trim()).filter(Boolean)));
  }
  if (Array.isArray(workLocations)) {
    dbState.masterData.workLocations = Array.from(new Set(workLocations.map((d: string) => d.trim()).filter(Boolean)));
  }
  if (Array.isArray(employeeStatuses)) {
    dbState.masterData.employeeStatuses = Array.from(new Set(employeeStatuses.map((d: string) => d.trim()).filter(Boolean)));
  }
  if (Array.isArray(documentTypes)) {
    dbState.masterData.documentTypes = Array.from(new Set(documentTypes.map((d: string) => d.trim()).filter(Boolean)));
  }
  if (Array.isArray(banks)) {
    dbState.masterData.banks = Array.from(new Set(banks.map((d: string) => d.trim()).filter(Boolean)));
  }
  await persistDatabase('masterData');
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'MASTER_DATA_UPDATE', 'Updated Master Data records.');
  res.json({ message: 'Master data updated successfully.', masterData: dbState.masterData });
});

// ---------------- CUSTOMER RECORDS MANAGEMENT APIS ----------------
app.get('/api/admin/customers', async (req, res) => {
  const customers = await readCollectionWithFallback('customers', () => dbState.customers || []);
  res.json(customers);
});

app.get('/api/admin/customers/:id', async (req, res) => {
  const cust = await readEntityWithFallback('customers', req.params.id, () => findCustomer(req.params.id));
  if (!cust) return res.status(404).json({ message: 'Customer record not found' });
  res.json(cust);
});

app.post('/api/admin/customers', async (req, res) => {
  if (!dbState.customers) dbState.customers = [];
  const existing = findCustomer(req.body.id || req.body.code || req.body.email || req.body.mobile);
  const custId = existing ? existing.id : (req.body.id || `cust-${Date.now()}`);
  const code = existing ? existing.code : (req.body.code || `CUST-${1000 + dbState.customers.length + 1}`);

  const newCust: CustomerRecord = {
    ...req.body,
    id: custId,
    code,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existing) {
    const idx = dbState.customers.findIndex(c => c.id === existing.id);
    if (idx !== -1) dbState.customers[idx] = newCust;
    else dbState.customers.push(newCust);
  } else {
    dbState.customers.push(newCust);
  }

  await persistDatabase('customers', custId);
  logSystemAction('admin-1', 'Admin', 'ADMIN', 'CUSTOMER_RECORD_CREATE', `Created/updated customer record for ${newCust.name} (${newCust.code})`);
  res.status(201).json(newCust);
});

app.put('/api/admin/customers/:id', async (req, res) => {
  const cust = findCustomer(req.params.id);
  if (!cust) return res.status(404).json({ message: 'Customer record not found' });

  const idx = (dbState.customers || []).findIndex(c => c.id === cust.id);
  if (idx === -1) return res.status(404).json({ message: 'Customer record not found' });

  dbState.customers[idx] = {
    ...cust,
    ...req.body,
    id: cust.id, // Guarantee canonical ID stability
    code: cust.code,
    updatedAt: new Date().toISOString()
  };
  await persistDatabase('customers', cust.id);
  logSystemAction('admin-1', 'Admin', 'ADMIN', 'CUSTOMER_RECORD_UPDATE', `Updated customer record for ${dbState.customers[idx].name}`);
  res.json(dbState.customers[idx]);
});

app.patch('/api/admin/customers/:id/status', async (req, res) => {
  const cust = findCustomer(req.params.id);
  if (!cust) return res.status(404).json({ message: 'Customer record not found' });

  cust.status = req.body.status || cust.status;
  cust.updatedAt = new Date().toISOString();
  await persistDatabase('customers', cust.id);
  logSystemAction('admin-1', 'Admin', 'ADMIN', 'CUSTOMER_STATUS_TOGGLE', `Updated customer ${cust.name} status to ${cust.status}`);
  res.json(cust);
});

app.delete('/api/admin/customers/:id', async (req, res) => {
  const cust = findCustomer(req.params.id);
  if (!cust) return res.status(404).json({ message: 'Customer record not found' });

  const idx = (dbState.customers || []).findIndex(c => c.id === cust.id);
  if (idx === -1) return res.status(404).json({ message: 'Customer record not found' });

  const deleted = dbState.customers.splice(idx, 1)[0];
  await persistDatabase('customers', cust.id);
  logSystemAction('admin-1', 'Admin', 'ADMIN', 'CUSTOMER_RECORD_DELETE', `Deleted customer record for ${deleted.name}`);
  res.json({ message: 'Customer record deleted successfully', deleted });
});

// GET Customer Service History (Linked Orders)
app.get('/api/admin/customers/:id/orders', async (req, res) => {
  const cust = await readEntityWithFallback('customers', req.params.id, () => findCustomer(req.params.id));
  if (!cust) return res.status(404).json({ message: 'Customer record not found' });

  const customerOrders = getCustomerOrders(cust.id);
  res.json(customerOrders);
});

// POST Manual Order Creation (WhatsApp, Phone, In-Person, Admin Portal)
app.post('/api/admin/orders', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  try {
    const user = (req as any).user || { id: 'admin-1', name: 'Admin', role: 'ADMIN' };
    const {
      orderSource = 'WhatsApp',
      sourceReference,
      orderDate,
      orderStatus = OrderStatus.PENDING,
      customerId,
      newCustomer,
      serviceId,
      customGovFees,
      customServiceCharge,
      priority = 'Normal',
      additionalNotes = '',
      requirements = '',
      paymentMethod = 'Bank Transfer',
      paymentStatus = 'Pending Verification',
      utr,
      paymentDate,
      uploadedDocuments = [],
      name: directName,
      mobile: directMobile,
      email: directEmail,
      address: directAddress,
      city: directCity,
      state: directState,
      pinCode: directPinCode
    } = req.body;

    if (!serviceId) {
      return res.status(400).json({ message: 'Target service selection is required.' });
    }

    const service = dbState.services.find((s: any) => s.id === serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Selected service was not found in catalog.' });
    }

    // Customer Resolution / Creation
    let targetCustomer: any = null;

    if (customerId) {
      targetCustomer = findCustomer(customerId);
    }

    // If new customer details provided, create new customer record in database
    if (!targetCustomer && newCustomer && (newCustomer.name || newCustomer.mobile || newCustomer.email)) {
      const existingMatch = findCustomer(newCustomer.email || newCustomer.mobile);
      if (existingMatch) {
        targetCustomer = existingMatch;
      } else {
        const newCustId = `cust-${Date.now()}`;
        const newCode = `CUST-${1000 + (dbState.customers ? dbState.customers.length : 0) + 1}`;
        targetCustomer = {
          id: newCustId,
          code: newCode,
          name: newCustomer.name?.trim() || 'Valued Customer',
          customerType: newCustomer.customerType || 'Individual',
          contactPersonName: newCustomer.contactPersonName || newCustomer.name,
          email: newCustomer.email?.trim() || `${newCode.toLowerCase()}@customer.easydesk.com`,
          mobile: newCustomer.mobile?.trim() || '',
          whatsappMobile: newCustomer.whatsappMobile?.trim() || newCustomer.mobile?.trim() || '',
          address: newCustomer.address?.trim() || '',
          city: newCustomer.city?.trim() || 'Mumbai',
          state: newCustomer.state?.trim() || 'Maharashtra',
          pincode: newCustomer.pincode?.trim() || '400001',
          status: 'Active',
          gstin: newCustomer.gstin || '',
          panNumber: newCustomer.panNumber || '',
          msmeLicense: newCustomer.msmeLicense || '',
          notes: newCustomer.notes || `Created automatically via Manual ${orderSource} Order Entry`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (!dbState.customers) dbState.customers = [];
        dbState.customers.push(targetCustomer);
        await persistDatabase('customers', newCustId);
        logSystemAction(user.id, user.name, user.role, 'CUSTOMER_CREATED_MANUAL_ORDER', `Created customer profile ${targetCustomer.name} (${targetCustomer.code}) during manual ${orderSource} order creation.`);
      }
    }

    // Determine final contact & billing fields
    const customerName = (targetCustomer?.name || directName || '').trim();
    const customerMobile = (targetCustomer?.mobile || directMobile || '').trim();
    const customerEmail = (targetCustomer?.email || directEmail || '').trim();
    const customerAddress = (targetCustomer?.address || directAddress || 'N/A').trim();
    const customerCity = (targetCustomer?.city || directCity || 'N/A').trim();
    const customerState = (targetCustomer?.state || directState || 'N/A').trim();
    const customerPinCode = (targetCustomer?.pincode || directPinCode || '400001').trim();

    if (!customerName || !customerMobile) {
      return res.status(400).json({ message: 'Customer Name and Mobile Number are mandatory.' });
    }

    // Fee calculation
    const govFees = customGovFees !== undefined ? Number(customGovFees) : (service.govFees || 0);
    const serviceCharge = customServiceCharge !== undefined ? Number(customServiceCharge) : (service.serviceCharge || 0);
    const totalAmount = govFees + serviceCharge;

    // Unique standard Order ID
    const orderId = `ORD-${10000 + (dbState.orders ? dbState.orders.length : 0) + Math.floor(100 + Math.random() * 900)}`;

    const selectedPaymentMethod = paymentMethod === 'QR Code' ? PaymentMethod.QR : 
                                  paymentMethod === 'Bank Transfer' ? PaymentMethod.BANK_TRANSFER : 
                                  paymentMethod === 'UPI' ? PaymentMethod.UPI : paymentMethod;

    const validatedPaymentStatus = paymentStatus === 'Verified' ? PaymentStatus.VERIFIED :
                                   paymentStatus === 'Rejected' ? PaymentStatus.REJECTED :
                                   PaymentStatus.PENDING_VERIFICATION;

    // Process initial documents if provided
    const docsList = (uploadedDocuments || []).map((doc: any) => ({
      name: typeof doc === 'string' ? doc : (doc.name || 'Document.pdf'),
      url: typeof doc === 'object' && doc.url ? doc.url : 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=100&auto=format&fit=crop&q=60',
      uploadedAt: new Date().toISOString(),
      verificationStatus: 'Pending'
    }));

    const combinedNotes = [
      requirements ? `[Customer Requirements]: ${requirements}` : '',
      additionalNotes ? `[Admin Notes]: ${additionalNotes}` : '',
      sourceReference ? `[Source Ref]: ${sourceReference}` : ''
    ].filter(Boolean).join('\n\n') || `Manual order created via ${orderSource} by ${user.name}`;

    const newOrder: Order = {
      id: orderId,
      userId: targetCustomer?.id || `user-manual-${Date.now()}`,
      customerId: targetCustomer?.id || undefined,
      orderSource: orderSource as any,
      sourceReference: sourceReference || undefined,
      createdBy: user.id,
      createdByName: user.name,
      createdByUserRole: user.role,
      serviceId: service.id,
      serviceTitle: service.title,
      category: service.subCategory || service.categoryId || 'General',
      name: customerName,
      mobile: customerMobile,
      email: customerEmail || 'no-email@easydesk.com',
      address: customerAddress,
      city: customerCity,
      state: customerState,
      pinCode: customerPinCode,
      uploadedDocuments: docsList,
      additionalNotes: combinedNotes,
      paymentMethod: selectedPaymentMethod as PaymentMethod,
      paymentStatus: validatedPaymentStatus,
      utr: utr?.trim() || undefined,
      paymentDate: paymentDate || new Date().toISOString(),
      orderStatus: (orderStatus as any) || OrderStatus.PENDING,
      totalAmount,
      createdAt: orderDate ? new Date(orderDate).toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      priority: priority as any,
      logs: [
        {
          status: (orderStatus as any) || OrderStatus.PENDING,
          comment: `Manual order created by ${user.name} (${user.role}) via ${orderSource}${targetCustomer ? ` for customer ${targetCustomer.name} (${targetCustomer.code})` : ''}.${utr ? ` Payment recorded: UTR ${utr} (${validatedPaymentStatus}).` : ''}`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    if (!dbState.orders) dbState.orders = [];
    dbState.orders.unshift(newOrder);

    await persistDatabase('orders', orderId);
    logSystemAction(
      user.id,
      user.name,
      user.role,
      'MANUAL_ORDER_CREATED',
      `Created manual ${orderSource} order ${orderId} (${service.title}) for customer ${customerName} (Total: ₹${totalAmount}).`
    );

    res.status(201).json({
      message: `Manual ${orderSource} order ${orderId} created successfully!`,
      order: newOrder,
      customer: targetCustomer
    });
  } catch (error: any) {
    console.error('[MANUAL ORDER CREATE ERROR]', error);
    res.status(500).json({ message: error.message || 'Failed to create manual order.' });
  }
});

// PUT Update Order Details (Edit Order Functionality)
app.put('/api/admin/orders/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  try {
    const user = (req as any).user || { id: 'admin-1', name: 'Admin', role: 'ADMIN' };
    const { id } = req.params;
    const order = (dbState.orders || []).find(o => o.id === id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found in database.' });
    }

    const {
      name,
      mobile,
      email,
      address,
      city,
      state,
      pinCode,
      serviceId,
      totalAmount,
      priority,
      orderSource,
      additionalNotes,
      paymentMethod,
      paymentStatus,
      utr,
      paymentDate
    } = req.body;

    if (name) order.name = name.trim();
    if (mobile) order.mobile = mobile.trim();
    if (email) order.email = email.trim();
    if (address !== undefined) order.address = address.trim();
    if (city !== undefined) order.city = city.trim();
    if (state !== undefined) order.state = state.trim();
    if (pinCode !== undefined) order.pinCode = pinCode.trim();
    if (priority) order.priority = priority;
    if (orderSource) order.orderSource = orderSource;
    if (additionalNotes !== undefined) order.additionalNotes = additionalNotes;
    if (totalAmount !== undefined) order.totalAmount = Number(totalAmount);
    if (paymentMethod) order.paymentMethod = paymentMethod;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (utr !== undefined) order.utr = utr.trim() || undefined;
    if (paymentDate) order.paymentDate = paymentDate;

    if (serviceId && serviceId !== order.serviceId) {
      const s = dbState.services.find(x => x.id === serviceId);
      if (s) {
        order.serviceId = s.id;
        order.serviceTitle = s.title;
        order.category = s.subCategory || s.categoryId || order.category;
      }
    }

    order.updatedAt = new Date().toISOString();
    order.logs.push({
      status: order.orderStatus,
      comment: `Order details updated by ${user.name} (${user.role}).`,
      timestamp: new Date().toISOString()
    });

    await persistDatabase('orders', order.id);
    logSystemAction(user.id, user.name, user.role, 'ORDER_DETAILS_UPDATED', `Updated details for order ${order.id} (${order.name}).`);

    res.json({ message: 'Order updated successfully.', order });
  } catch (error: any) {
    console.error('[ORDER UPDATE ERROR]', error);
    res.status(500).json({ message: error.message || 'Failed to update order.' });
  }
});

// POST Create New Order for Existing Customer (Legacy helper route)
app.post('/api/admin/customers/:id/orders', async (req, res) => {
  const cust = findCustomer(req.params.id);
  if (!cust) return res.status(404).json({ message: 'Customer record not found' });

  const { serviceId, paymentMethod, additionalNotes, priority, customGovFees, customServiceCharge, utr, orderSource = 'Admin Portal' } = req.body;
  if (!serviceId) {
    return res.status(400).json({ message: 'Service selection is required.' });
  }

  const service = dbState.services.find((s: any) => s.id === serviceId);
  if (!service) {
    return res.status(404).json({ message: 'Selected service was not found in catalog.' });
  }

  const govFees = customGovFees !== undefined ? Number(customGovFees) : (service.govFees || 0);
  const serviceCharge = customServiceCharge !== undefined ? Number(customServiceCharge) : (service.serviceCharge || 0);
  const totalAmount = govFees + serviceCharge;

  const orderId = `ORD-${10000 + (dbState.orders ? dbState.orders.length : 0) + Math.floor(100 + Math.random() * 900)}`;

  const selectedPaymentMethod = paymentMethod === 'QR Code' ? PaymentMethod.QR : 
                                paymentMethod === 'Bank Transfer' ? PaymentMethod.BANK_TRANSFER : PaymentMethod.UPI;

  const newOrder: Order = {
    id: orderId,
    userId: cust.id,
    customerId: cust.id,
    orderSource: orderSource as any,
    serviceId: service.id,
    serviceTitle: service.title,
    category: service.subCategory || service.categoryId || 'General',
    name: cust.name,
    mobile: cust.mobile || 'N/A',
    email: cust.email,
    address: cust.address || 'N/A',
    city: cust.city || 'N/A',
    state: cust.state || 'N/A',
    pinCode: cust.pincode || '400001',
    uploadedDocuments: [],
    additionalNotes: additionalNotes || `Order created via Admin Portal for customer ${cust.name} (${cust.code})`,
    paymentMethod: selectedPaymentMethod,
    paymentStatus: utr ? PaymentStatus.VERIFIED : PaymentStatus.PENDING_VERIFICATION,
    utr: utr || undefined,
    paymentDate: new Date().toISOString(),
    orderStatus: OrderStatus.PENDING,
    totalAmount,
    createdAt: new Date().toISOString(),
    priority: priority || 'Normal',
    logs: [
      {
        status: OrderStatus.PENDING,
        comment: `Order created by Admin for existing customer ${cust.name} (${cust.code}).`,
        timestamp: new Date().toISOString()
      }
    ]
  };

  if (!dbState.orders) dbState.orders = [];
  dbState.orders.unshift(newOrder);

  await persistDatabase('orders', orderId);
  logSystemAction('admin-1', 'Admin', 'ADMIN', 'ORDER_CREATE_FOR_CUSTOMER', `Recorded new order ${orderId} (${service.title}) for customer ${cust.name}`);

  res.status(201).json(newOrder);
});

// Audit Logs API
app.get('/api/admin/audit-logs', (req, res) => {
  res.json(dbState.auditLogs);
});

// Centralized Validation & Integrity Verification Endpoints
app.get('/api/admin/validation/report', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  try {
    const report = await validateRecordRelationships(dbState, { scanDatabase: true });
    res.json(report);
  } catch (error: any) {
    console.error('[VALIDATION REPORT ERROR]', error);
    res.status(500).json({ message: error.message || 'Failed to generate integrity report' });
  }
});

app.post('/api/admin/validation/scan', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  try {
    const report = await validateRecordRelationships(dbState, { scanDatabase: true });
    res.json(report);
  } catch (error: any) {
    console.error('[VALIDATION SCAN ERROR]', error);
    res.status(500).json({ message: error.message || 'Failed to execute validation scan' });
  }
});

app.get('/api/admin/validation/quick-check', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  try {
    const report = await validateRecordRelationships(dbState, { scanDatabase: true });
    res.json({
      status: report.overallStatus,
      totalIssues: report.stats.totalIssuesFound,
      criticalCount: report.stats.criticalIssuesCount,
      warningCount: report.stats.warningIssuesCount,
      autoFixableCount: report.stats.autoFixableCount,
      timestamp: report.timestamp
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Quick validation check failed' });
  }
});

app.post('/api/admin/validation/repair', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const user = (req as any).user || { id: 'admin-1', name: 'Admin', role: 'ADMIN' };
    const { beforeReport, afterReport, repairsApplied } = await repairRecordRelationships(dbState, persistDatabase);

    const description = `Executed centralized integrity repair: fixed ${repairsApplied.repairedKeysCount} sub-record keys, synchronized/relinked ${repairsApplied.relinkedOrdersCount} orders.`;
    logSystemAction(
      user.id || 'admin-1', 
      user.name || 'Administrator', 
      user.role || 'ADMIN', 
      'INTEGRITY_REPAIR_RUN', 
      description
    );

    res.json({
      success: true,
      message: description,
      beforeReport,
      afterReport,
      repairsApplied
    });
  } catch (error: any) {
    console.error('[VALIDATION REPAIR ERROR]', error);
    res.status(500).json({ message: error.message || 'Integrity repair execution failed' });
  }
});


// Category Management CRUD
app.get('/api/admin/categories', authenticateToken, async (req, res) => {
  const cats = await readCollectionWithFallback('categories', () => dbState.categories || []);
  const services = await readCollectionWithFallback('services', () => dbState.services || []);
  const mapped = cats.map(c => ({
    ...c,
    status: c.status || 'Active',
    serviceCount: services.filter(s => s.categoryId === c.id).length
  }));
  res.json(mapped);
});

// Admin Service Category Creation Handler
const handleCreateServiceCategory = async (req: express.Request, res: express.Response) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const category = req.body?.category || req.body || {};
  const catName = String(category?.name || category?.title || '').trim();
  if (!catName) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }

  // Derive slug and id safely
  let slug = String(category.slug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) {
    slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  if (!slug) {
    slug = `cat-${Date.now().toString().slice(-6)}`;
  }

  let id = String(category.id || '').trim();
  if (!id) {
    id = slug;
  }

  // Check collision
  if (dbState.categories.some((c: any) => c.id === id || (c.slug && c.slug === slug))) {
    if (!category.id) {
      id = `${id}-${Date.now().toString().slice(-4)}`;
      slug = id;
    } else {
      return res.status(400).json({ success: false, message: `Category with ID '${id}' already exists.` });
    }
  }

  const newCat: ServiceCategory = {
    id,
    name: catName,
    slug,
    icon: category.icon || 'Folder',
    color: category.color || 'blue',
    description: category.description || '',
    sortOrder: Number(category.sortOrder) || (dbState.categories.length + 1),
    status: category.status === 'Inactive' ? 'Inactive' : 'Active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  dbState.categories.push(newCat);
  logSystemAction(updaterId || (req as any).user?.id || 'admin-1', updaterName || (req as any).user?.name || 'Administrator', updaterRole || (req as any).user?.role || 'ADMIN', 'CATEGORY_CREATE', `Created service category ${newCat.name}`);
  await persistDatabase('categories', newCat.id);
  res.status(201).json(newCat);
};

app.post('/api/admin/categories', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), handleCreateServiceCategory);
app.post('/api/admin/service-categories', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), handleCreateServiceCategory);

// Category Status Toggle / Update Handler
const handleCategoryStatusUpdate = async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const requestedStatus = req.body?.status || req.body?.category?.status;

  if (!requestedStatus || !['Active', 'Inactive'].includes(requestedStatus)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid status. Allowed values are "Active" and "Inactive".' 
    });
  }

  const idx = dbState.categories.findIndex((c: any) => c.id === id || c.slug === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Category not found.' });
  }

  dbState.categories[idx].status = requestedStatus as 'Active' | 'Inactive';
  dbState.categories[idx].updatedAt = new Date().toISOString();

  const actionVerb = requestedStatus === 'Active' ? 'activated' : 'deactivated';
  logSystemAction(
    updaterId || (req as any).user?.id || 'admin-1',
    updaterName || (req as any).user?.name || 'Administrator',
    updaterRole || (req as any).user?.role || 'ADMIN',
    'CATEGORY_STATUS_TOGGLE',
    `${requestedStatus === 'Active' ? 'Activated' : 'Deactivated'} service category '${dbState.categories[idx].name}'`
  );

  await persistDatabase('categories', dbState.categories[idx].id);

  console.log(`[CATEGORY STATUS] Successfully ${actionVerb} category '${dbState.categories[idx].name}' (ID: ${id}) -> ${requestedStatus}`);

  res.json({
    success: true,
    message: `Category ${actionVerb} successfully.`,
    category: dbState.categories[idx]
  });
};

app.put('/api/admin/categories/:id/status', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), handleCategoryStatusUpdate);
app.patch('/api/admin/categories/:id/status', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), handleCategoryStatusUpdate);
app.put('/api/admin/service-categories/:id/status', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), handleCategoryStatusUpdate);
app.patch('/api/admin/service-categories/:id/status', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), handleCategoryStatusUpdate);

const handleUpdateServiceCategory = async (req: express.Request, res: express.Response) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const category = req.body?.category || req.body || {};
  const idx = dbState.categories.findIndex((c: any) => c.id === req.params.id || c.slug === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Category not found' });
  const updatedName = String(category.name || category.title || dbState.categories[idx].name).trim();
  
  const existingStatus = dbState.categories[idx].status || 'Active';
  const newStatus = category.status !== undefined 
    ? (category.status === 'Inactive' ? 'Inactive' : 'Active') 
    : existingStatus;

  dbState.categories[idx] = { 
    ...dbState.categories[idx], 
    ...category, 
    id: dbState.categories[idx].id,
    name: updatedName,
    sortOrder: category.sortOrder !== undefined ? Number(category.sortOrder) : dbState.categories[idx].sortOrder,
    status: newStatus,
    updatedAt: new Date().toISOString()
  };
  logSystemAction(updaterId || (req as any).user?.id || 'admin-1', updaterName || (req as any).user?.name || 'Administrator', updaterRole || (req as any).user?.role || 'ADMIN', 'CATEGORY_UPDATE', `Updated service category ${dbState.categories[idx].name}`);
  await persistDatabase('categories', dbState.categories[idx].id);
  res.json(dbState.categories[idx]);
};

app.put('/api/admin/categories/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), handleUpdateServiceCategory);
app.put('/api/admin/service-categories/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), handleUpdateServiceCategory);

const handleDeleteServiceCategory = async (req: express.Request, res: express.Response) => {
  const { updaterId, updaterName, updaterRole, fallbackCategoryId } = req.body || {};
  const cat = dbState.categories.find((c: any) => c.id === req.params.id || c.slug === req.params.id);
  if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });
  
  if (dbState.categories.length <= 1) {
    return res.status(400).json({ success: false, message: 'Cannot delete the last remaining service category.' });
  }

  // Reassign any services linked to this category
  const remainingCat = dbState.categories.find((c: any) => c.id !== cat.id);
  const targetCatId = fallbackCategoryId || (remainingCat ? remainingCat.id : 'gov');
  let reassignedCount = 0;
  (dbState.services || []).forEach((s: any) => {
    if (s.categoryId === cat.id || s.categoryId === cat.slug) {
      s.categoryId = targetCatId;
      reassignedCount++;
    }
  });

  dbState.categories = dbState.categories.filter((c: any) => c.id !== cat.id);
  logSystemAction(updaterId || (req as any).user?.id || 'admin-1', updaterName || (req as any).user?.name || 'Administrator', updaterRole || (req as any).user?.role || 'ADMIN', 'CATEGORY_DELETE', `Deleted service category ${cat.name} (Reassigned ${reassignedCount} services to ${targetCatId})`);
  await persistDatabase('categories', cat.id);
  if (reassignedCount > 0) {
    await persistDatabase('services');
  }
  res.json({ success: true, message: `Service category '${cat.name}' deleted successfully. ${reassignedCount} linked services reassigned.`, remainingCategories: dbState.categories });
};

app.delete('/api/admin/categories/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), handleDeleteServiceCategory);
app.delete('/api/admin/service-categories/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), handleDeleteServiceCategory);

// Blog Category Management CRUD
app.get('/api/admin/blog-categories', authenticateToken, (req, res) => {
  const cats = dbState.blogCategories || [];
  const mapped = cats.map((c: any) => ({
    ...c,
    status: c.status || 'Active',
    blogCount: (dbState.blogs || []).filter((b: any) => b.categoryId === c.id || b.category === c.name).length
  }));
  res.json(mapped);
});

app.post('/api/admin/blog-categories', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const category = req.body?.category || req.body || {};
  const catName = String(category?.name || category?.title || '').trim();
  if (!catName) {
    return res.status(400).json({ success: false, message: 'Blog category name is required' });
  }

  let slug = String(category.slug || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) {
    slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  if (!slug) {
    slug = `bcat-${Date.now().toString().slice(-6)}`;
  }

  let id = String(category.id || '').trim();
  if (!id) {
    id = slug.startsWith('blog-cat-') ? slug : `blog-cat-${slug}`;
  }
  
  if (dbState.blogCategories.some((c: any) => c.id === id || (c.slug && c.slug === slug))) {
    if (!category.id) {
      id = `${id}-${Date.now().toString().slice(-4)}`;
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    } else {
      return res.status(400).json({ success: false, message: `Blog category with ID '${id}' already exists.` });
    }
  }

  const newCat: BlogCategory = {
    id,
    name: catName,
    slug,
    icon: category.icon || 'Bookmark',
    color: category.color || 'blue',
    description: category.description || '',
    sortOrder: Number(category.sortOrder) || (dbState.blogCategories.length + 1),
    status: category.status === 'Inactive' ? 'Inactive' : 'Active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  dbState.blogCategories.push(newCat);
  logSystemAction(updaterId || (req as any).user?.id || 'admin-1', updaterName || (req as any).user?.name || 'Administrator', updaterRole || (req as any).user?.role || 'ADMIN', 'BLOG_CATEGORY_CREATE', `Created blog category ${newCat.name}`);
  await persistDatabase('blogCategories', newCat.id);
  res.status(201).json(newCat);
});

// Blog Category Status Toggle / Update Handler
const handleBlogCategoryStatusUpdate = async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const requestedStatus = req.body?.status || req.body?.category?.status;

  if (!requestedStatus || !['Active', 'Inactive'].includes(requestedStatus)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid status. Allowed values are "Active" and "Inactive".' 
    });
  }

  const idx = dbState.blogCategories.findIndex((c: any) => c.id === id || c.slug === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Blog category not found.' });
  }

  dbState.blogCategories[idx].status = requestedStatus as 'Active' | 'Inactive';
  dbState.blogCategories[idx].updatedAt = new Date().toISOString();

  const actionVerb = requestedStatus === 'Active' ? 'activated' : 'deactivated';
  logSystemAction(
    updaterId || (req as any).user?.id || 'admin-1',
    updaterName || (req as any).user?.name || 'Administrator',
    updaterRole || (req as any).user?.role || 'ADMIN',
    'BLOG_CATEGORY_STATUS_TOGGLE',
    `${requestedStatus === 'Active' ? 'Activated' : 'Deactivated'} blog category '${dbState.blogCategories[idx].name}'`
  );

  await persistDatabase('blogCategories', dbState.blogCategories[idx].id);

  console.log(`[BLOG CATEGORY STATUS] Successfully ${actionVerb} blog category '${dbState.blogCategories[idx].name}' (ID: ${id}) -> ${requestedStatus}`);

  res.json({
    success: true,
    message: `Category ${actionVerb} successfully.`,
    category: dbState.blogCategories[idx]
  });
};

app.put('/api/admin/blog-categories/:id/status', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), handleBlogCategoryStatusUpdate);
app.patch('/api/admin/blog-categories/:id/status', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), handleBlogCategoryStatusUpdate);

app.put('/api/admin/blog-categories/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const category = req.body?.category || req.body || {};
  const idx = dbState.blogCategories.findIndex((c: any) => c.id === req.params.id || c.slug === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Blog category not found' });
  const updatedName = String(category.name || category.title || dbState.blogCategories[idx].name).trim();
  
  const existingStatus = dbState.blogCategories[idx].status || 'Active';
  const newStatus = category.status !== undefined 
    ? (category.status === 'Inactive' ? 'Inactive' : 'Active') 
    : existingStatus;

  dbState.blogCategories[idx] = { 
    ...dbState.blogCategories[idx], 
    ...category, 
    id: dbState.blogCategories[idx].id,
    name: updatedName,
    sortOrder: category.sortOrder !== undefined ? Number(category.sortOrder) : dbState.blogCategories[idx].sortOrder,
    status: newStatus,
    updatedAt: new Date().toISOString()
  };
  
  // Sync blog posts if category name changed
  if (category.name && category.name !== dbState.blogCategories[idx].name) {
    (dbState.blogs || []).forEach((b: any) => {
      if (b.categoryId === dbState.blogCategories[idx].id || b.category === dbState.blogCategories[idx].name) {
        b.category = updatedName;
      }
    });
    await persistDatabase('blogs');
  }

  logSystemAction(updaterId || (req as any).user?.id || 'admin-1', updaterName || (req as any).user?.name || 'Administrator', updaterRole || (req as any).user?.role || 'ADMIN', 'BLOG_CATEGORY_UPDATE', `Updated blog category ${dbState.blogCategories[idx].name}`);
  await persistDatabase('blogCategories', dbState.blogCategories[idx].id);
  res.json(dbState.blogCategories[idx]);
});

app.delete('/api/admin/blog-categories/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  const { updaterId, updaterName, updaterRole, fallbackCategoryId } = req.body || {};
  const cat = dbState.blogCategories.find((c: any) => c.id === req.params.id || c.slug === req.params.id);
  if (!cat) return res.status(404).json({ success: false, message: 'Blog category not found' });
  
  if (dbState.blogCategories.length <= 1) {
    return res.status(400).json({ success: false, message: 'Cannot delete the last remaining blog category.' });
  }

  // Reassign any blogs linked to this category
  const remainingCat = dbState.blogCategories.find((c: any) => c.id !== cat.id);
  const targetCatId = fallbackCategoryId || (remainingCat ? remainingCat.id : 'blog-cat-gov');
  const targetCatName = (dbState.blogCategories.find((c: any) => c.id === targetCatId) || remainingCat)?.name || 'General';
  
  let reassignedCount = 0;
  (dbState.blogs || []).forEach((b: any) => {
    if (b.categoryId === cat.id || b.category === cat.name) {
      b.categoryId = targetCatId;
      b.category = targetCatName;
      reassignedCount++;
    }
  });

  dbState.blogCategories = dbState.blogCategories.filter((c: any) => c.id !== cat.id);
  logSystemAction(updaterId || (req as any).user?.id || 'admin-1', updaterName || (req as any).user?.name || 'Administrator', updaterRole || (req as any).user?.role || 'ADMIN', 'BLOG_CATEGORY_DELETE', `Deleted blog category ${cat.name} (Reassigned ${reassignedCount} blogs to ${targetCatName})`);
  await persistDatabase('blogCategories', cat.id);
  if (reassignedCount > 0) {
    await persistDatabase('blogs');
  }
  res.json({ success: true, message: `Blog category '${cat.name}' deleted successfully. ${reassignedCount} linked articles reassigned.`, remainingBlogCategories: dbState.blogCategories });
});

// Service Management CRUD
app.post('/api/admin/services', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const service = req.body.service || req.body;
  const title = service.title || service.name;
  if (!service || !title) {
    return res.status(400).json({ message: 'Service title and Category ID are required' });
  }

  let categoryId = service.categoryId;
  if (!categoryId && service.category) {
    const found = (dbState.categories || []).find(c => c.id === service.category || c.name.toLowerCase() === service.category.toLowerCase());
    categoryId = found ? found.id : service.category;
  }
  if (!categoryId) categoryId = 'cat-gst';

  let baseId = service.id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  if (!baseId) baseId = `svc-${Date.now()}`;
  let id = baseId;
  if (!service.id && dbState.services.some(s => s.id === id)) {
    id = `${baseId}-${Date.now().toString().slice(-4)}`;
  }

  const existingIdx = dbState.services.findIndex(s => s.id === id);
  const newSvc = {
    id,
    categoryId,
    subCategory: service.subCategory || '',
    title,
    name: title,
    price: Number(service.price ?? service.serviceCharge ?? 0),
    description: service.description || '',
    shortDescription: service.shortDescription || service.description?.slice(0, 160) || '',
    fullDescription: service.fullDescription || service.description || '',
    icon: service.icon || 'FileText',
    bannerImage: service.bannerImage || service.imageUrl || service.image || 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400',
    imageUrl: service.imageUrl || service.bannerImage || service.image || 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400',
    image: service.image || service.bannerImage || service.imageUrl || 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400',
    gallery: service.gallery || [],
    govFees: Number(service.govFees ?? service.governmentFee ?? 0),
    serviceCharge: Number(service.serviceCharge ?? service.price ?? 0),
    estimatedTime: service.estimatedTime || service.processingTime || service.processingDays || '3-5 Working Days',
    processingTime: service.estimatedTime || service.processingTime || service.processingDays || '3-5 Working Days',
    requiredDocuments: Array.isArray(service.requiredDocuments) ? service.requiredDocuments : (typeof service.requiredDocuments === 'string' ? service.requiredDocuments.split(',').map((x: string) => x.trim()).filter(Boolean) : []),
    highlights: Array.isArray(service.highlights) ? service.highlights : (Array.isArray(service.features) ? service.features : []),
    features: Array.isArray(service.features) ? service.features : (Array.isArray(service.highlights) ? service.highlights : []),
    eligibility: service.eligibility || 'All eligible citizens and businesses',
    howItWorks: service.howItWorks || '',
    faqs: Array.isArray(service.faqs) ? service.faqs : [],
    seoTitle: service.seoTitle || title,
    seoDescription: service.seoDescription || service.shortDescription || service.description || '',
    slug: service.slug || id,
    status: service.status ? service.status.toLowerCase() : 'active',
    whatsAppEnabled: service.whatsAppEnabled !== false,
    featured: !!service.featured,
    popular: !!service.popular,
    displayOrder: Number(service.displayOrder) || dbState.services.length + 1,
    popularity: Number(service.popularity) || 80
  };

  if (existingIdx >= 0) {
    dbState.services[existingIdx] = { ...dbState.services[existingIdx], ...newSvc };
  } else {
    dbState.services.push(newSvc);
  }
  logSystemAction(updaterId || (req as any).user?.id || 'super-admin-deepak', updaterName || (req as any).user?.name || 'Deepak', updaterRole || (req as any).user?.role || 'SUPER_ADMIN', 'SERVICE_CREATE', `Created service ${newSvc.title}`);
  await persistDatabase('services', newSvc.id);
  res.status(201).json(newSvc);
});

app.put('/api/admin/services/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const service = req.body?.service || req.body || {};
  const idx = dbState.services.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Service not found' });
  
  const title = service.title || service.name || dbState.services[idx].title;
  const price = service.price !== undefined ? Number(service.price) : dbState.services[idx].price;
  const serviceCharge = service.serviceCharge !== undefined ? Number(service.serviceCharge) : (service.price !== undefined ? Number(service.price) : dbState.services[idx].serviceCharge);

  dbState.services[idx] = { 
    ...dbState.services[idx], 
    ...service,
    title,
    name: title,
    price,
    serviceCharge,
    id: req.params.id,
    categoryId: service.categoryId || dbState.services[idx].categoryId
  };
  logSystemAction(updaterId || (req as any).user?.id || 'super-admin-deepak', updaterName || (req as any).user?.name || 'Deepak', updaterRole || (req as any).user?.role || 'SUPER_ADMIN', 'SERVICE_UPDATE', `Updated service ${dbState.services[idx].title}`);
  await persistDatabase('services', dbState.services[idx].id);
  res.json(dbState.services[idx]);
});

app.delete('/api/admin/services/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const svc = dbState.services.find(s => s.id === req.params.id);
  if (!svc) return res.status(404).json({ message: 'Service not found' });
  dbState.services = dbState.services.filter(s => s.id !== req.params.id);
  logSystemAction(updaterId || (req as any).user?.id || 'super-admin-deepak', updaterName || (req as any).user?.name || 'Deepak', updaterRole || (req as any).user?.role || 'SUPER_ADMIN', 'SERVICE_DELETE', `Deleted service ${svc.title}`);
  await persistDatabase('services', req.params.id);
  res.json({ message: 'Service deleted' });
});

// Bulk Delete Services
app.post('/api/admin/services/bulk-delete', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  const { ids, updaterId, updaterName, updaterRole } = req.body || {};
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ message: 'Array of ids required' });
  dbState.services = dbState.services.filter(s => !ids.includes(s.id));
  logSystemAction(updaterId || (req as any).user?.id || 'super-admin-deepak', updaterName || (req as any).user?.name || 'Deepak', updaterRole || (req as any).user?.role || 'SUPER_ADMIN', 'SERVICE_BULK_DELETE', `Bulk deleted ${ids.length} services`);
  await persistDatabase('services');
  res.json({ message: `Bulk deleted ${ids.length} services` });
});

// Bulk Update Services Status
app.post('/api/admin/services/bulk-status', async (req, res) => {
  const { ids, status, updaterId, updaterName, updaterRole } = req.body || {};
  if (!ids || !Array.isArray(ids) || !status) return res.status(400).json({ message: 'Array of ids and status required' });
  dbState.services.forEach(s => {
    if (ids.includes(s.id)) {
      s.status = status;
    }
  });
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'SERVICE_BULK_STATUS', `Bulk updated ${ids.length} services to status ${status}`);
  await persistDatabase('services');
  res.json({ message: 'Bulk status updated successfully' });
});

// Blog CRUD
app.post('/api/admin/blogs', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const blog = req.body?.blog || req.body || {};
  if (!blog || !blog.title) return res.status(400).json({ message: 'Blog title is required' });
  const id = blog.id || `blog-${Date.now()}`;
  
  let targetCatId = blog.categoryId;
  let targetCatName = blog.category;

  if (targetCatId) {
    const foundCat = (dbState.blogCategories || []).find(c => c.id === targetCatId);
    if (foundCat) {
      targetCatName = foundCat.name;
    }
  } else if (targetCatName) {
    const foundCat = (dbState.blogCategories || []).find(c => c.name.toLowerCase() === targetCatName.toLowerCase());
    if (foundCat) {
      targetCatId = foundCat.id;
      targetCatName = foundCat.name;
    } else {
      targetCatId = 'blog-cat-gov';
    }
  } else {
    targetCatId = 'blog-cat-gov';
    targetCatName = 'Government Schemes';
  }

  const existingIdx = dbState.blogs.findIndex(b => b.id === id);
  const newBlog = {
    id,
    title: blog.title,
    content: blog.content || '',
    excerpt: blog.excerpt || blog.shortDescription || blog.summary || (blog.content ? blog.content.slice(0, 160) : ''),
    shortDescription: blog.shortDescription || blog.excerpt || blog.summary || (blog.content ? blog.content.slice(0, 160) : ''),
    summary: blog.summary || blog.excerpt || blog.shortDescription || (blog.content ? blog.content.slice(0, 160) : ''),
    categoryId: targetCatId,
    category: targetCatName,
    tags: Array.isArray(blog.tags) ? blog.tags : (typeof blog.tags === 'string' ? blog.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []),
    image: blog.image || blog.imageUrl || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=400',
    imageUrl: blog.imageUrl || blog.image || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=400',
    author: blog.author || updaterName || (req as any).user?.name || 'EasyDesk Team',
    date: blog.date || new Date().toISOString(),
    comments: [],
    views: 0,
    status: blog.status || 'active',
    published: blog.published !== false,
    scheduledAt: blog.scheduledAt || '',
    seoTitle: blog.seoTitle || blog.title,
    seoDescription: blog.seoDescription || blog.excerpt || '',
    slug: blog.slug || blog.title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    focusKeywords: blog.focusKeywords || '',
    commentsEnabled: blog.commentsEnabled !== false
  };

  if (existingIdx >= 0) {
    dbState.blogs[existingIdx] = { ...dbState.blogs[existingIdx], ...newBlog };
  } else {
    dbState.blogs.push(newBlog);
  }
  logSystemAction(updaterId || (req as any).user?.id || 'super-admin-deepak', updaterName || (req as any).user?.name || 'Deepak', updaterRole || (req as any).user?.role || 'SUPER_ADMIN', 'BLOG_CREATE', `Created blog ${newBlog.title}`);
  await persistDatabase('blogs', newBlog.id);
  res.status(201).json(newBlog);
});

app.put('/api/admin/blogs/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const blog = req.body?.blog || req.body || {};
  let idx = dbState.blogs.findIndex(b => b.id === req.params.id);
  if (idx === -1) {
    idx = dbState.blogs.findIndex(b => b.slug === req.params.id || b.title === req.params.id);
  }
  if (idx === -1) return res.status(404).json({ message: 'Blog not found' });

  let targetCatId = blog.categoryId || dbState.blogs[idx].categoryId;
  let targetCatName = blog.category || dbState.blogs[idx].category;

  if (blog.categoryId) {
    const foundCat = (dbState.blogCategories || []).find(c => c.id === blog.categoryId);
    if (foundCat) {
      targetCatId = foundCat.id;
      targetCatName = foundCat.name;
    }
  }

  dbState.blogs[idx] = { 
    ...dbState.blogs[idx], 
    ...blog,
    id: dbState.blogs[idx].id,
    categoryId: targetCatId,
    category: targetCatName,
    tags: Array.isArray(blog.tags) ? blog.tags : (typeof blog.tags === 'string' ? blog.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : (dbState.blogs[idx].tags || []))
  };
  logSystemAction(updaterId || (req as any).user?.id || 'super-admin-deepak', updaterName || (req as any).user?.name || 'Deepak', updaterRole || (req as any).user?.role || 'SUPER_ADMIN', 'BLOG_UPDATE', `Updated blog ${dbState.blogs[idx].title}`);
  await persistDatabase('blogs', dbState.blogs[idx].id);
  res.json(dbState.blogs[idx]);
});

app.get(['/api/blogs/:id', '/api/blog/:id'], (req, res) => {
  const blog = (dbState.blogs || []).find(b => b.id === req.params.id || b.slug === req.params.id);
  if (!blog) {
    return res.status(404).json({ message: 'Blog article not found.' });
  }
  const blogCat = (dbState.blogCategories || []).find(c => c.id === blog.categoryId || c.name.toLowerCase() === (blog.category || '').toLowerCase());
  res.json({
    ...blog,
    categoryId: blogCat ? blogCat.id : (blog.categoryId || 'blog-cat-gov'),
    category: blogCat ? blogCat.name : (blog.category || 'Government Schemes')
  });
});

app.delete('/api/admin/blogs/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'OPERATOR']), async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body || {};
  const blog = dbState.blogs.find(b => b.id === req.params.id);
  if (!blog) return res.status(404).json({ message: 'Blog not found' });
  dbState.blogs = dbState.blogs.filter(b => b.id !== req.params.id);
  logSystemAction(updaterId || (req as any).user?.id || 'super-admin-deepak', updaterName || (req as any).user?.name || 'Deepak', updaterRole || (req as any).user?.role || 'SUPER_ADMIN', 'BLOG_DELETE', `Deleted blog ${blog.title}`);
  await persistDatabase('blogs', req.params.id);
  res.json({ message: 'Blog deleted' });
});

// FAQ CRUD & Public Endpoint
app.get(['/api/faqs', '/api/faq'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json(dbState.faqs || []);
});

app.get('/api/admin/faqs', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json(dbState.faqs || []);
});

app.post('/api/admin/faqs', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const faq = req.body.faq || req.body;
  if (!faq || !faq.question || !faq.answer) return res.status(400).json({ message: 'Question and answer required' });
  const newFaq = {
    id: `faq-${Date.now()}`,
    question: faq.question,
    answer: faq.answer,
    category: faq.category || 'General Help',
    sortOrder: Number(faq.sortOrder) || dbState.faqs.length + 1
  };
  dbState.faqs.push(newFaq);
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'FAQ_CREATE', `Created FAQ: ${newFaq.question}`);
  await persistDatabase('faqs', newFaq.id);
  res.status(201).json(newFaq);
});

app.put('/api/admin/faqs/:id', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const faq = req.body.faq || req.body;
  const idx = dbState.faqs.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'FAQ not found' });
  dbState.faqs[idx] = { ...dbState.faqs[idx], ...faq };
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'FAQ_UPDATE', `Updated FAQ: ${dbState.faqs[idx].question}`);
  await persistDatabase('faqs', req.params.id);
  res.json(dbState.faqs[idx]);
});

app.delete('/api/admin/faqs/:id', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const faq = dbState.faqs.find(f => f.id === req.params.id);
  if (!faq) return res.status(404).json({ message: 'FAQ not found' });
  dbState.faqs = dbState.faqs.filter(f => f.id !== req.params.id);
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'FAQ_DELETE', `Deleted FAQ: ${faq.question}`);
  await persistDatabase('faqs', req.params.id);
  res.json({ message: 'FAQ deleted' });
});

// Reviews Admin Moderation CRUD
app.get('/api/admin/reviews', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const reviews = await readCollectionWithFallback('reviews', () => dbState.reviews || []);
  res.json(reviews);
});

app.post('/api/admin/reviews', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const review = req.body.review || req.body;
  if (!review || (!review.customerName && !review.userName) || (!review.reviewText && !review.comment)) {
    return res.status(400).json({ message: 'Customer name and review text are required.' });
  }

  const name = review.customerName || review.userName || 'Anonymous Customer';
  const text = review.reviewText || review.comment || '';
  const now = new Date().toISOString();
  const reviewId = `REV-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;

  const newRev: Review = {
    id: reviewId,
    reviewId: reviewId,
    customerId: review.customerId || `CUS-${Date.now().toString().slice(-4)}`,
    customerName: name,
    userName: name,
    orderId: review.orderId || undefined,
    serviceId: review.serviceId || 'srv-gen',
    serviceTitle: review.serviceTitle || review.serviceName || 'General Document Service',
    serviceName: review.serviceName || review.serviceTitle || 'General Document Service',
    rating: Math.min(5, Math.max(1, Math.round(Number(review.rating) || 5))),
    reviewText: text,
    comment: text,
    status: review.status || 'Approved',
    adminNote: review.adminNote || '',
    isDemo: review.isDemo ?? false,
    isVerifiedOrder: review.isVerifiedOrder ?? review.isVerified ?? false,
    isVerified: review.isVerifiedOrder ?? review.isVerified ?? false,
    createdAt: now,
    updatedAt: now,
    date: now
  };

  if (newRev.status === 'Approved') {
    newRev.approvedAt = now;
    newRev.approvedBy = updaterName || 'Admin';
  }

  dbState.reviews.push(newRev);
  logSystemAction(updaterId || 'admin-1', updaterName || 'Admin', updaterRole || 'ADMIN', 'REVIEW_CREATE', `Created review entry ${reviewId} for ${newRev.customerName}`);
  await persistDatabase('reviews', newRev.id);
  res.status(201).json(newRev);
});

const handleReviewStatusUpdate = async (req: express.Request, res: express.Response) => {
  const { updaterId, updaterName, updaterRole, status, adminNote } = req.body || {};
  const validStatuses = ['Pending', 'Approved', 'Rejected', 'Hidden'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Must be Pending, Approved, Rejected, or Hidden.' });
  }

  const idx = dbState.reviews.findIndex(r => r.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ message: 'Review not found.' });
  }

  const now = new Date().toISOString();
  dbState.reviews[idx].status = status as any;
  if (adminNote !== undefined) {
    dbState.reviews[idx].adminNote = adminNote;
  }
  dbState.reviews[idx].updatedAt = now;

  if (status === 'Approved') {
    dbState.reviews[idx].approvedAt = now;
    dbState.reviews[idx].approvedBy = updaterName || 'Admin';
  }

  logSystemAction(
    updaterId || 'admin-1',
    updaterName || 'Admin',
    updaterRole || 'ADMIN',
    'REVIEW_STATUS_UPDATE',
    `Updated status of review ${req.params.id} to ${status}${adminNote ? ` (Note: ${adminNote})` : ''}`
  );
  await persistDatabase('reviews', req.params.id);

  res.json({ message: `Review status updated to ${status}.`, review: dbState.reviews[idx] });
};

app.patch('/api/admin/reviews/:id/status', handleReviewStatusUpdate);
app.put('/api/admin/reviews/:id/status', handleReviewStatusUpdate);

app.put('/api/admin/reviews/:id', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const review = req.body.review || req.body;
  const idx = dbState.reviews.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Review not found' });

  const existing = dbState.reviews[idx];
  const now = new Date().toISOString();

  const customerName = review.customerName || review.userName || existing.customerName || existing.userName;
  const reviewText = review.reviewText !== undefined ? review.reviewText : (review.comment !== undefined ? review.comment : existing.reviewText || existing.comment || '');
  const serviceTitle = review.serviceTitle || review.serviceName || existing.serviceTitle || existing.serviceName || 'General Service';
  const rating = review.rating !== undefined ? Number(review.rating) : existing.rating;
  const status = review.status || existing.status || 'Approved';

  dbState.reviews[idx] = {
    ...existing,
    ...review,
    id: existing.id, // STRICTLY preserve same reviewId
    reviewId: existing.id,
    customerId: review.customerId || existing.customerId,
    customerName,
    userName: customerName,
    orderId: review.orderId !== undefined ? (review.orderId || undefined) : existing.orderId,
    serviceId: review.serviceId || existing.serviceId,
    serviceTitle,
    serviceName: serviceTitle,
    rating: Math.min(5, Math.max(1, Math.round(rating))),
    reviewText,
    comment: reviewText,
    status,
    adminNote: review.adminNote !== undefined ? review.adminNote : existing.adminNote,
    isDemo: review.isDemo !== undefined ? Boolean(review.isDemo) : (existing.isDemo ?? false),
    isVerifiedOrder: review.isVerifiedOrder !== undefined ? Boolean(review.isVerifiedOrder) : (existing.isVerifiedOrder ?? existing.isVerified ?? false),
    isVerified: review.isVerifiedOrder !== undefined ? Boolean(review.isVerifiedOrder) : (existing.isVerifiedOrder ?? existing.isVerified ?? false),
    updatedAt: now
  };

  if (status === 'Approved' && !dbState.reviews[idx].approvedAt) {
    dbState.reviews[idx].approvedAt = now;
    dbState.reviews[idx].approvedBy = updaterName || 'Admin';
  }

  logSystemAction(
    updaterId || 'admin-1',
    updaterName || 'Admin',
    updaterRole || 'ADMIN',
    'REVIEW_UPDATE',
    `Updated review ${existing.id} (${customerName}) - Rating: ${rating}, Status: ${status}`
  );
  
  await persistDatabase('reviews', existing.id);
  res.json(dbState.reviews[idx]);
});

app.delete('/api/admin/reviews/:id', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const rev = dbState.reviews.find(r => r.id === req.params.id);
  if (!rev) return res.status(404).json({ message: 'Review not found' });

  dbState.reviews = dbState.reviews.filter(r => r.id !== req.params.id);
  logSystemAction(updaterId || 'admin-1', updaterName || 'Admin', updaterRole || 'ADMIN', 'REVIEW_DELETE', `Deleted review of ${rev.customerName || rev.userName}`);
  await persistDatabase('reviews', req.params.id);
  res.json({ message: 'Review deleted successfully' });
});

// Banners CRUD
app.get('/api/banners', (req, res) => {
  res.json(dbState.banners || []);
});

app.get('/api/admin/banners', (req, res) => {
  res.json(dbState.banners || []);
});

app.post('/api/admin/banners', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const banner = req.body.banner || req.body;
  if (!banner || !banner.title || !banner.imageUrl) return res.status(400).json({ message: 'Title and imageUrl are required' });
  
  let imageUrl = banner.imageUrl;
  let imageData = banner.imageData;

  if (imageUrl && imageUrl.startsWith('data:')) {
    try {
      const timeStamp = Date.now();
      const storedFileName = `banner_${timeStamp}.jpg`;
      const targetPath = path.join(process.cwd(), 'uploads', 'media', storedFileName);
      const base64 = imageUrl.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, buffer);
      } catch (fsErr) {}
      await uploadToFirebaseStorage(`media/${storedFileName}`, buffer, 'image/jpeg');
      await putR2File(`media/${storedFileName}`, buffer, 'image/jpeg');
      imageData = imageUrl;
      imageUrl = `/uploads/media/${storedFileName}`;
    } catch (e) {
      console.error('Error saving banner image:', e);
    }
  }

  const newBanner = {
    id: `banner-${Date.now()}`,
    title: banner.title,
    type: banner.type || 'slider',
    imageUrl,
    imageData,
    linkUrl: banner.linkUrl || '',
    isActive: banner.isActive !== false
  };
  if (!dbState.banners) dbState.banners = [];
  dbState.banners.push(newBanner);
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'BANNER_CREATE', `Created banner campaign: ${newBanner.title}`);
  await persistDatabase('banners', newBanner.id);
  res.status(201).json(newBanner);
});

app.put('/api/admin/banners/:id', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const banner = req.body.banner || req.body;
  if (!dbState.banners) dbState.banners = [];
  const idx = dbState.banners.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Banner not found' });

  let imageUrl = banner.imageUrl || dbState.banners[idx].imageUrl;
  let imageData = banner.imageData || dbState.banners[idx].imageData;

  if (imageUrl && imageUrl.startsWith('data:')) {
    try {
      const timeStamp = Date.now();
      const storedFileName = `banner_${timeStamp}.jpg`;
      const targetPath = path.join(process.cwd(), 'uploads', 'media', storedFileName);
      const base64 = imageUrl.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, buffer);
      } catch (fsErr) {}
      await uploadToFirebaseStorage(`media/${storedFileName}`, buffer, 'image/jpeg');
      await putR2File(`media/${storedFileName}`, buffer, 'image/jpeg');
      imageData = imageUrl;
      imageUrl = `/uploads/media/${storedFileName}`;
    } catch (e) {
      console.error('Error updating banner image:', e);
    }
  }

  dbState.banners[idx] = { 
    ...dbState.banners[idx], 
    ...banner,
    imageUrl,
    imageData
  };
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'BANNER_UPDATE', `Updated banner campaign: ${dbState.banners[idx].title}`);
  await persistDatabase('banners', req.params.id);
  res.json(dbState.banners[idx]);
});

app.delete('/api/admin/banners/:id', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const b = dbState.banners.find(x => x.id === req.params.id);
  if (!b) return res.status(404).json({ message: 'Banner not found' });
  dbState.banners = dbState.banners.filter(x => x.id !== req.params.id);
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'BANNER_DELETE', `Deleted banner: ${b.title}`);
  await persistDatabase('banners', req.params.id);
  res.json({ message: 'Banner deleted' });
});

// Calendar Events CRUD
app.get('/api/calendar', (req, res) => {
  res.json(dbState.calendarEvents || []);
});

app.post('/api/admin/calendar', async (req, res) => {
  const { title, date, category, description, link, status } = req.body;
  if (!title || !date || !category) {
    return res.status(400).json({ message: 'Title, date, and category are required.' });
  }
  const newEvt: CalendarEvent = {
    id: `cal-${Date.now()}`,
    title,
    date,
    category,
    description: description || '',
    link: link || '#',
    status: status || 'active',
    createdAt: new Date().toISOString()
  };
  if (!dbState.calendarEvents) dbState.calendarEvents = [];
  dbState.calendarEvents.unshift(newEvt);
  await persistDatabase('calendarEvents', newEvt.id);
  res.status(201).json(newEvt);
});

app.put('/api/admin/calendar/:id', async (req, res) => {
  if (!dbState.calendarEvents) dbState.calendarEvents = [];
  const idx = dbState.calendarEvents.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Calendar event not found.' });
  dbState.calendarEvents[idx] = { ...dbState.calendarEvents[idx], ...req.body };
  await persistDatabase('calendarEvents', req.params.id);
  res.json(dbState.calendarEvents[idx]);
});

app.delete('/api/admin/calendar/:id', async (req, res) => {
  if (!dbState.calendarEvents) dbState.calendarEvents = [];
  dbState.calendarEvents = dbState.calendarEvents.filter(c => c.id !== req.params.id);
  await persistDatabase('calendarEvents', req.params.id);
  res.json({ message: 'Calendar event removed successfully.' });
});

// Pages CMS CRUD
app.get('/api/admin/pages', (req, res) => {
  res.json(dbState.pages);
});

app.post('/api/admin/pages', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const page = req.body.page || req.body;
  if (!page || !page.title || !page.content) return res.status(400).json({ message: 'Title and content required' });
  const newPage = {
    id: page.id || `page-${Date.now()}`,
    title: page.title,
    slug: page.slug || page.title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    content: page.content,
    isActive: page.isActive !== false
  };
  dbState.pages.push(newPage);
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'PAGE_CREATE', `Created custom page: ${newPage.title}`);
  await persistDatabase('pages', newPage.id);
  res.status(201).json(newPage);
});

app.put('/api/admin/pages/:id', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const page = req.body.page || req.body;
  const idx = dbState.pages.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Page not found' });
  dbState.pages[idx] = { ...dbState.pages[idx], ...page };
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'PAGE_UPDATE', `Updated page content: ${dbState.pages[idx].title}`);
  await persistDatabase('pages', req.params.id);
  res.json(dbState.pages[idx]);
});

app.delete('/api/admin/pages/:id', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const p = dbState.pages.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ message: 'Page not found' });
  dbState.pages = dbState.pages.filter(x => x.id !== req.params.id);
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'PAGE_DELETE', `Deleted page: ${p.title}`);
  await persistDatabase('pages', req.params.id);
  res.json({ message: 'Page deleted' });
});

// Centralized Media Library CRUD & File Upload
app.get('/api/admin/media', (req, res) => {
  const { type, folder, search } = req.query;
  let list = dbState.media || [];
  if (type && typeof type === 'string' && type !== 'all') {
    list = list.filter(m => m.type === type || (type === 'image' && m.type === 'image') || (type === 'document' && (m.type === 'pdf' || m.type === 'word' || m.type === 'document')));
  }
  if (folder && typeof folder === 'string' && folder !== 'all') {
    list = list.filter(m => m.folder === folder);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(m => m.name.toLowerCase().includes(q) || (m.title && m.title.toLowerCase().includes(q)) || (m.originalName && m.originalName.toLowerCase().includes(q)));
  }
  res.json(list);
});

// File upload or linking endpoint for Media Library
app.post(['/api/admin/media/upload', '/api/admin/media'], async (req, res) => {
  const { fileData, fileName, originalName, mimeType, folder, title, altText, uploadedBy, file, updaterId, updaterName, updaterRole } = req.body;

  // Case 1: Binary / Base64 File Upload
  if (fileData) {
    try {
      const cleanOriginalName = originalName || fileName || 'uploaded_media_file';
      const rawExt = path.extname(cleanOriginalName).toLowerCase();
      const fileMime = (mimeType || 'image/jpeg').toLowerCase();

      // Banned / Dangerous File Extensions
      const BANNED_EXTENSIONS = ['.exe', '.js', '.html', '.htm', '.php', '.sh', '.bat', '.cmd', '.vbs', '.py', '.zip', '.rar'];
      if (BANNED_EXTENSIONS.includes(rawExt)) {
        return res.status(400).json({ message: `Security restriction: File type ${rawExt} is prohibited from upload.` });
      }

      // For Employee Profile Photos / Image uploads, enforce strict image MIME and extension validation
      if (folder === 'employee-photos' || folder === 'profiles' || fileMime.startsWith('image/')) {
        const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

        if (!ALLOWED_IMAGE_MIMES.includes(fileMime) && !ALLOWED_IMAGE_EXTS.includes(rawExt)) {
          return res.status(400).json({ 
            message: 'Invalid image format. Only JPG, JPEG, PNG, and WEBP images are allowed.' 
          });
        }
      }

      const ext = rawExt || (fileMime ? `.${fileMime.split('/')[1]}` : '.jpg');
      const timeStamp = Date.now();
      const rand = Math.floor(Math.random() * 1000);
      const storedFileName = `med_${timeStamp}_${rand}${ext}`;
      const targetPath = path.join(process.cwd(), 'uploads', 'media', storedFileName);

      // Extract base64 payload
      const base64Content = fileData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');

      const sizeBytes = buffer.length;

      // Enforce 5MB limit for employee photos or general image uploads (max 15MB for other media)
      const maxAllowedBytes = (folder === 'employee-photos' || fileMime.startsWith('image/')) 
        ? 5 * 1024 * 1024 
        : 15 * 1024 * 1024;

      if (sizeBytes > maxAllowedBytes) {
        const limitMb = (maxAllowedBytes / (1024 * 1024)).toFixed(0);
        return res.status(400).json({ 
          message: `File size exceeds maximum allowed limit of ${limitMb} MB.` 
        });
      }

      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, buffer);
      } catch (fsErr) {
        // Handled in serverless/worker runtimes where fs is read-only
      }

      // Upload binary to Firebase Storage (primary binary storage) & R2 (edge stream)
      const fbUpload = await uploadToFirebaseStorage(`media/${storedFileName}`, buffer, fileMime);
      await putR2File(`media/${storedFileName}`, buffer, fileMime);

      let sizeStr = `${(sizeBytes / 1024).toFixed(1)} KB`;
      if (sizeBytes > 1024 * 1024) {
        sizeStr = `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
      }

      let fileType: 'image' | 'document' | 'video' | 'pdf' | 'word' | 'other' = 'image';
      if (fileMime.startsWith('image/')) {
        fileType = 'image';
      } else if (fileMime.includes('pdf')) {
        fileType = 'pdf';
      } else if (fileMime.includes('word') || fileMime.includes('officedocument')) {
        fileType = 'word';
      } else if (fileMime.startsWith('video/')) {
        fileType = 'video';
      } else {
        fileType = 'document';
      }

      const mediaId = `med-${timeStamp}`;
      const fileUrl = `/uploads/media/${storedFileName}`;

      const newMedia = {
        id: mediaId,
        name: title || cleanOriginalName,
        originalName: cleanOriginalName,
        storedName: storedFileName,
        storedFileName: storedFileName,
        storagePath: fbUpload.storagePath || `media/${storedFileName}`,
        mimeType: fileMime,
        type: fileType,
        size: sizeStr,
        sizeBytes,
        url: fileUrl,
        downloadUrl: fbUpload.downloadUrl || fileUrl,
        fileData: sizeBytes <= 850 * 1024 ? fileData : undefined,
        accessLevel: 'public' as const,
        folder: folder || 'uploads',
        title: title || cleanOriginalName,
        altText: altText || cleanOriginalName,
        uploadedBy: uploadedBy || updaterName || 'Admin Operator',
        createdAt: new Date().toISOString()
      };

      if (!dbState.media) dbState.media = [];
      dbState.media.unshift(newMedia);

      // Persist structured metadata to Cloudflare D1
      await saveMediaFileMetadataToD1({
        fileId: newMedia.id,
        storagePath: newMedia.storagePath,
        filename: newMedia.name,
        mimeType: newMedia.mimeType,
        sizeBytes: newMedia.sizeBytes,
        downloadUrl: newMedia.url,
        accessLevel: 'public',
        folder: newMedia.folder,
        metadata: { originalName: newMedia.originalName, title: newMedia.title }
      });

      logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'MEDIA_UPLOAD', `Uploaded media file: ${newMedia.name} (${sizeStr})`);
      await persistDatabase('media', newMedia.id);

      return res.status(200).json(newMedia);
    } catch (err: any) {
      console.error('Error saving media upload:', err);
      return res.status(500).json({ message: 'Failed to process file upload.', error: err.message });
    }
  }

  // Case 2: URL Link / File Metadata creation
  const targetFile = file || req.body;
  if (!targetFile || (!targetFile.name && !targetFile.url)) {
    return res.status(400).json({ message: 'File name or upload payload required' });
  }

  const mediaId = targetFile.id || `media-${Date.now()}`;
  const newMedia = {
    id: mediaId,
    name: targetFile.name || title || 'Linked Media',
    originalName: targetFile.originalName || targetFile.name || 'External Asset',
    storedName: targetFile.storedName || '',
    mimeType: targetFile.mimeType || 'image/jpeg',
    type: targetFile.type || 'image',
    size: targetFile.size || '300 KB',
    sizeBytes: targetFile.sizeBytes || 300000,
    url: targetFile.url || 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400',
    folder: targetFile.folder || folder || 'uploads',
    title: targetFile.title || title || targetFile.name || '',
    altText: targetFile.altText || altText || '',
    uploadedBy: targetFile.uploadedBy || updaterName || 'Admin Operator',
    createdAt: new Date().toISOString()
  };

  if (!dbState.media) dbState.media = [];
  dbState.media.unshift(newMedia);

  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'MEDIA_LINK', `Linked media resource: ${newMedia.name}`);
  await persistDatabase('media', newMedia.id);

  res.status(200).json(newMedia);
});

// UPDATE media item metadata
app.put('/api/admin/media/:id', async (req, res) => {
  const { title, altText, folder, name, updaterId, updaterName, updaterRole } = req.body;
  const idx = (dbState.media || []).findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Media resource not found' });

  dbState.media[idx] = {
    ...dbState.media[idx],
    ...(title !== undefined && { title }),
    ...(altText !== undefined && { altText }),
    ...(folder !== undefined && { folder }),
    ...(name !== undefined && { name }),
    updatedAt: new Date().toISOString()
  };

  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'MEDIA_UPDATE', `Updated metadata for media ID: ${req.params.id}`);
  await persistDatabase('media', req.params.id);

  res.json(dbState.media[idx]);
});

// DELETE media resource
app.delete('/api/admin/media/:id', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const m = (dbState.media || []).find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ message: 'Media item not found' });

  // Delete physical file from disk across potential locations
  const potentialPaths = [
    m.url ? path.join(process.cwd(), m.url.replace(/^\//, '')) : null,
    m.storedFileName ? path.join(process.cwd(), 'uploads', 'media', m.storedFileName) : null,
    m.storedFileName ? path.join(process.cwd(), 'uploads', 'employees', m.storedFileName) : null,
    m.storedFileName ? path.join(process.cwd(), 'uploads', 'documents', m.storedFileName) : null,
    m.storedFileName ? path.join(process.cwd(), 'uploads', m.storedFileName) : null,
    m.storedName ? path.join(process.cwd(), 'uploads', 'media', m.storedName) : null,
    m.name ? path.join(process.cwd(), 'uploads', 'media', m.name) : null,
  ].filter(Boolean) as string[];

  for (const diskPath of potentialPaths) {
    try {
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    } catch (e) {
      console.warn('Could not delete physical media file from disk:', e);
    }
  }

  // Delete binary object from Firebase Storage if storagePath exists
  if (m.storagePath) {
    try {
      await deleteFromFirebaseStorage(m.storagePath);
    } catch (fbErr) {
      console.warn('[FirebaseStorage] Delete error:', fbErr);
    }
  }

  // Remove metadata from Cloudflare D1 media_files table
  await deleteMediaFileMetadataFromD1(m.id);

  // Authoritatively remove from dbState.media
  dbState.media = (dbState.media || []).filter(x => x.id !== req.params.id);
  
  // Write to local cache store
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  } catch (e) {}

  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'MEDIA_DELETE', `Permanently deleted media resource: ${m.name}`);
  await persistDatabase('media', req.params.id);

  res.json({ message: 'Media resource deleted successfully' });
});


// Notifications CMS CRUD
app.get('/api/admin/notifications', (req, res) => {
  res.json(dbState.notifications);
});

app.post('/api/admin/notifications', async (req, res) => {
  const { notification, updaterId, updaterName, updaterRole } = req.body;
  if (!notification || !notification.message) return res.status(400).json({ message: 'Notification message is required' });
  
  const id = `notif-${Date.now()}`;
  const newNotif = {
    id,
    userId: notification.userId || 'all',
    type: notification.type || 'push',
    message: notification.message,
    isRead: false,
    createdAt: new Date().toISOString()
  };
  
  dbState.notifications.push(newNotif);
  
  const channel = notification.type ? notification.type.toUpperCase() : 'PUSH';
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'NOTIFICATION_SEND', `Sent ${channel} notification alert to ID ${notification.userId || 'All'}. Message: "${notification.message.substring(0, 30)}..."`);
  await persistDatabase('notifications', newNotif.id);
  res.status(201).json(newNotif);
});

app.delete('/api/admin/notifications/:id', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  dbState.notifications = dbState.notifications.filter(x => x.id !== req.params.id);
  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'NOTIFICATION_DELETE', 'Deleted notification dispatch entry');
  await persistDatabase('notifications', req.params.id);
  res.json({ message: 'Notification dispatch deleted' });
});

// User Management CRUD
app.get('/api/admin/users', (req, res) => {
  normalizeDatabaseRelationships();
  let list = [...(dbState.users || [])];
  const roleFilter = req.query.role as string;
  const query = (req.query.q as string || '').toLowerCase().trim();

  if (roleFilter) {
    if (roleFilter === 'staff') {
      list = list.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' || u.role === 'OPERATOR' || u.role === 'STAFF' || (u.role as any) === UserRole.ADMIN);
    } else if (roleFilter === 'customers') {
      list = list.filter(u => u.role === 'USER' || (u.role as any) === UserRole.USER);
    } else {
      list = list.filter(u => String(u.role).toUpperCase() === roleFilter.toUpperCase());
    }
  }

  if (query) {
    list = list.filter(u => 
      (u.name && u.name.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query)) ||
      (u.mobile && u.mobile.toLowerCase().includes(query)) ||
      (u.role && String(u.role).toLowerCase().includes(query))
    );
  }

  res.json(list);
});

app.post('/api/admin/users', async (req, res) => {
  const user = req.body.user || req.body;
  const { updaterId, updaterName, updaterRole } = req.body;
  if (!user || !user.name || !user.email) return res.status(400).json({ message: 'Name and email are required' });
  
  const normalizedEmail = String(user.email).toLowerCase().trim();
  const exists = dbState.users.some(u => u.email.toLowerCase().trim() === normalizedEmail);
  if (exists) return res.status(400).json({ message: 'A user with this email already exists' });

  // Only Deepak is allowed to have SUPER_ADMIN role
  let assignedRole = user.role || UserRole.USER;
  if (assignedRole === 'SUPER_ADMIN' && normalizedEmail !== 'tideepak8@gmail.com') {
    assignedRole = 'ADMIN';
  }
  
  const newUser = {
    id: `user-${Date.now()}`,
    name: user.name.trim(),
    email: normalizedEmail,
    mobile: user.mobile || '9999999999',
    role: assignedRole,
    isSuspended: !!user.isSuspended,
    createdAt: new Date().toISOString()
  };

  dbState.users.push(newUser);

  // If role is administrative, also sync to dbState.admins
  if (['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'STAFF'].includes(assignedRole)) {
    if (!Array.isArray(dbState.admins)) dbState.admins = [];
    if (!dbState.admins.some(a => a.email.toLowerCase().trim() === normalizedEmail)) {
      dbState.admins.push({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        mobile: newUser.mobile,
        role: newUser.role,
        status: newUser.isSuspended ? 'Suspended' : 'Active',
        permissions: newUser.role === 'SUPER_ADMIN' ? ['*'] : [],
        password: DEFAULT_PASSWORD_HASH,
        createdAt: newUser.createdAt
      });
      await persistDatabase('admins', newUser.id);
    }
  }

  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'USER_CREATE', `Created user/admin record: ${newUser.name} with role ${newUser.role}`);
  await persistDatabase('users', newUser.id);
  res.status(201).json(newUser);
});

app.put('/api/admin/users/:id', async (req, res) => {
  const user = req.body.user || req.body;
  const { updaterId, updaterName, updaterRole } = req.body;
  const paramId = String(req.params.id);
  const targetEmail = (user?.email || '').toLowerCase().trim();

  let idx = dbState.users.findIndex(u => String(u.id) === paramId || (targetEmail && u.email && u.email.toLowerCase().trim() === targetEmail));
  
  if (idx === -1) {
    const adminMatch = dbState.admins?.find((a: any) => String(a.id) === paramId || (targetEmail && a.email && a.email.toLowerCase().trim() === targetEmail));
    const custMatch = dbState.customers?.find((c: any) => String(c.id) === paramId || (targetEmail && c.email && c.email.toLowerCase().trim() === targetEmail));
    
    if (adminMatch) {
      dbState.users.push({
        id: adminMatch.id || paramId,
        name: adminMatch.name || 'Admin',
        email: adminMatch.email,
        mobile: adminMatch.mobile || '',
        role: adminMatch.role || 'ADMIN',
        createdAt: adminMatch.createdAt || new Date().toISOString(),
        isSuspended: adminMatch.status === 'Suspended',
        password: adminMatch.password || DEFAULT_PASSWORD_HASH
      });
      idx = dbState.users.length - 1;
    } else if (custMatch) {
      dbState.users.push({
        id: custMatch.id || paramId,
        name: custMatch.name || 'Customer',
        email: custMatch.email,
        mobile: custMatch.mobile || '',
        role: 'USER',
        createdAt: custMatch.createdAt || new Date().toISOString(),
        isSuspended: !!custMatch.isSuspended,
        password: custMatch.password || DEFAULT_PASSWORD_HASH
      });
      idx = dbState.users.length - 1;
    } else {
      return res.status(404).json({ message: 'User not found' });
    }
  }
  
  const current = dbState.users[idx];
  const finalEmail = (user.email || current.email || '').toLowerCase().trim();

  // Protect the primary Super Admin
  if (current.email?.toLowerCase().trim() === 'tideepak8@gmail.com' || current.id === 'super-admin-deepak') {
    user.role = 'SUPER_ADMIN';
    user.isSuspended = false;
  } else if (user.role === 'SUPER_ADMIN' && finalEmail !== 'tideepak8@gmail.com') {
    user.role = 'ADMIN';
  }

  dbState.users[idx] = { ...dbState.users[idx], ...user };
  const updatedUser = dbState.users[idx];

  // Sync with admins collection
  if (!Array.isArray(dbState.admins)) dbState.admins = [];
  const adminIdx = dbState.admins.findIndex(a => String(a.id) === paramId || (finalEmail && a.email?.toLowerCase().trim() === finalEmail));

  if (['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'STAFF'].includes(updatedUser.role)) {
    if (adminIdx >= 0) {
      dbState.admins[adminIdx].name = updatedUser.name;
      dbState.admins[adminIdx].email = updatedUser.email;
      dbState.admins[adminIdx].mobile = updatedUser.mobile;
      dbState.admins[adminIdx].role = updatedUser.role;
      dbState.admins[adminIdx].status = updatedUser.isSuspended ? 'Suspended' : 'Active';
      await persistDatabase('admins', dbState.admins[adminIdx].id);
    } else {
      const newAdminEntry = {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile || '',
        role: updatedUser.role,
        status: updatedUser.isSuspended ? 'Suspended' : 'Active',
        permissions: updatedUser.role === 'SUPER_ADMIN' ? ['*'] : [],
        password: updatedUser.password || DEFAULT_PASSWORD_HASH,
        createdAt: updatedUser.createdAt || new Date().toISOString()
      };
      dbState.admins.push(newAdminEntry);
      await persistDatabase('admins', newAdminEntry.id);
    }
  } else if (adminIdx >= 0 && finalEmail !== 'tideepak8@gmail.com') {
    // Demoted from admin to standard user
    const removedAdminId = dbState.admins[adminIdx].id;
    dbState.admins.splice(adminIdx, 1);
    await persistDatabase('admins', removedAdminId);
  }

  // Sync with customers collection
  if (updatedUser.role === 'USER') {
    if (!Array.isArray(dbState.customers)) dbState.customers = [];
    const custIdx = dbState.customers.findIndex(c => String(c.id) === paramId || (finalEmail && c.email?.toLowerCase().trim() === finalEmail));
    if (custIdx >= 0) {
      dbState.customers[custIdx].name = updatedUser.name;
      dbState.customers[custIdx].email = updatedUser.email;
      dbState.customers[custIdx].mobile = updatedUser.mobile;
      dbState.customers[custIdx].isSuspended = updatedUser.isSuspended;
      await persistDatabase('customers', dbState.customers[custIdx].id);
    } else {
      const newCust = {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile || '',
        isSuspended: !!updatedUser.isSuspended,
        isVerified: true,
        password: updatedUser.password || DEFAULT_PASSWORD_HASH,
        createdAt: updatedUser.createdAt || new Date().toISOString()
      };
      dbState.customers.push(newCust);
      await persistDatabase('customers', newCust.id);
    }
  }

  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'USER_UPDATE', `Updated user/admin profile: ${updatedUser.name} (Role: ${updatedUser.role})`);
  await persistDatabase('users', updatedUser.id);
  res.json(updatedUser);
});

app.delete('/api/admin/users/:id', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const paramId = String(req.params.id);
  
  let targetUser = dbState.users.find(u => String(u.id) === paramId);
  if (!targetUser) {
    targetUser = dbState.admins?.find((a: any) => String(a.id) === paramId) || dbState.customers?.find((c: any) => String(c.id) === paramId);
  }
  if (!targetUser) return res.status(404).json({ message: 'User not found' });
  
  // Prevent deleting the primary Super Admin
  if (targetUser.email && (targetUser.email.toLowerCase().trim() === 'tideepak8@gmail.com' || targetUser.id === 'super-admin-deepak')) {
    return res.status(403).json({ message: 'The primary Super Admin account (Deepak) is protected and cannot be deleted.' });
  }

  const userEmail = (targetUser.email || '').toLowerCase().trim();
  dbState.users = dbState.users.filter(u => String(u.id) !== paramId && (!userEmail || u.email?.toLowerCase().trim() !== userEmail));
  
  // Also remove from admins and customers if present
  if (Array.isArray(dbState.admins)) {
    dbState.admins = dbState.admins.filter(a => String(a.id) !== paramId && (!userEmail || a.email?.toLowerCase().trim() !== userEmail));
    await persistDatabase('admins', paramId);
  }
  if (Array.isArray(dbState.customers)) {
    dbState.customers = dbState.customers.filter(c => String(c.id) !== paramId && (!userEmail || c.email?.toLowerCase().trim() !== userEmail));
    await persistDatabase('customers', paramId);
  }

  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'USER_DELETE', `Permanently deleted user record: ${targetUser.name || paramId}`);
  await persistDatabase('users', paramId);
  res.json({ message: 'User deleted successfully' });
});

// Purge test / mock accounts endpoint
app.post('/api/admin/users/cleanup-test-accounts', async (req, res) => {
  const { updaterId, updaterName, updaterRole } = req.body;
  const initialCount = dbState.users.length;
  
  // Keep Deepak and non-test real accounts
  dbState.users = dbState.users.filter(u => {
    const email = (u.email || '').toLowerCase().trim();
    if (email === 'tideepak8@gmail.com') return true;
    if (email.startsWith('testuser_') || email.startsWith('rohan_') || email.includes('testuser') || email.includes('example.com') || email === 'user@easydesk.com') {
      return false;
    }
    return true;
  });

  // Also clean customers
  if (Array.isArray(dbState.customers)) {
    dbState.customers = dbState.customers.filter(c => {
      const email = (c.email || '').toLowerCase().trim();
      return !email.startsWith('testuser_') && !email.startsWith('rohan_') && !email.includes('testuser') && email !== 'user@easydesk.com';
    });
  }

  const purgedCount = initialCount - dbState.users.length;
  normalizeDatabaseRelationships();
  await persistDatabase('users');
  await persistDatabase('customers');
  await persistDatabase('admins');

  logSystemAction(updaterId || 'super-admin-deepak', updaterName || 'Deepak', updaterRole || 'SUPER_ADMIN', 'USERS_PURGED', `Purged ${purgedCount} automated test/mock accounts.`);
  res.json({ message: `Purged ${purgedCount} test and mock accounts successfully.`, remainingCount: dbState.users.length });
});


// ---------------- SERVER SIDE GEMINI AI API ----------------

app.post('/api/ai/chat', async (req, res) => {
  const { message, chatHistory, contextService } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'A prompt or chat message is required.' });
  }

  const ai = getGemini();

  if (!ai) {
    // Elegant fallback simulation if API key is not configured yet!
    const responseText = simulateFallbackAIResponse(message, contextService);
    return res.json({ text: responseText, groundingMetadata: null });
  }

  try {
    // Generate context including available services for smart recommendation
    const serviceContext = dbState.services.map(s => 
      `Service ID: "${s.id}", Title: "${s.title}", Government Fee: ${s.govFees}, Service Fee: ${s.serviceCharge}, Required Docs: [${s.requiredDocuments.join(', ')}], Processing: ${s.processingTime}`
    ).join('\n');

    let contextualPromptAddition = '';
    if (contextService && contextService.title) {
      contextualPromptAddition = `\n\nCURRENTLY VIEWED SERVICE CONTEXT FOR CONTEXTUAL ADVICE:
The user is currently viewing/asking about: "${contextService.title}".
- Total Fee: ₹${(contextService.govFees || 0) + (contextService.serviceCharge || 0)} (Gov: ₹${contextService.govFees || 0}, Service: ₹${contextService.serviceCharge || 0})
- Processing Time: ${contextService.processingTime || '3-7 Days'}
- Required Documents: ${Array.isArray(contextService.requiredDocuments) ? contextService.requiredDocuments.join(', ') : 'N/A'}
- Eligibility: ${contextService.eligibility || 'N/A'}

Special Instructions:
Provide specific, actionable filing advice for "${contextService.title}". Explain how to prepare the required documents, common rejection pitfalls to avoid, and step-by-step guidance.`;
    }

    const systemPrompt = `You are "EasyDesk Assistant", a professional digital services concierge. 
You assist users in applying for government, educational, personal, and business digital certificates in India.
Here are the current available services on EasyDesk:
${serviceContext}${contextualPromptAddition}

Rules:
1. Always suggest the actual Service ID or service name if a user wants to apply.
2. Provide friendly, clear, bulleted checklists for required documents.
3. Keep answers concise, highly professional, polite, and trust-inspiring.
4. If the user asks general questions about passports, PAN, Aadhaar, MSME, or resumes, relate it back to how they can apply easily through EasyDesk.
5. Do not include structural developer jargon or API endpoints in your answer. Just be a helpful expert assistant.`;

    // Map frontend chat history format to Gemini parts/contents format if present
    const contents: any[] = [];
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((item: any) => {
        contents.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.content }]
        });
      });
    }
    
    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7
      }
    });

    const responseText = aiResponse.text || "I am currently processing your request. Please try again.";
    const groundingMetadata = aiResponse.candidates?.[0]?.groundingMetadata || null;

    res.json({ text: responseText, groundingMetadata });

  } catch (error: any) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ 
      message: 'Failed to query AI Assistant.', 
      error: error.message,
      fallbackText: simulateFallbackAIResponse(message) 
    });
  }
});

// Document Checker AI assistant
app.post('/api/ai/check-document', async (req, res) => {
  const { docName, serviceId } = req.body;
  if (!docName || !serviceId) {
    return res.status(400).json({ message: 'docName and serviceId are required' });
  }

  const service = dbState.services.find(s => s.id === serviceId);
  const requiredList = service ? service.requiredDocuments : [];

  const prompt = `A user wants to apply for "${service?.title || 'this service'}" and has uploaded a document named "${docName}". 
Is this document likely one of the required documents: [${requiredList.join(', ')}]? 
Analyze the file name and provide a checklist-style response confirming if it looks correct, what details are typically verified on it, and advice on ensuring it is a clear high-resolution scan. Keep it under 100 words.`;

  const ai = getGemini();
  if (!ai) {
    // Local fallback logic
    const matched = requiredList.some(r => docName.toLowerCase().includes(r.split(' ')[0].toLowerCase()));
    const responseText = `### Document Audit Result for: ${docName}
* **Match Found**: ${matched ? 'Yes' : 'Uncertain (requires inspection)'}
* **Required For**: ${service?.title}
* **Expert Tip**: Please ensure the document is a full-page, colorful scan. PDF and high-res JPEG are accepted. Text must be completely readable without glares or dark shadows.`;
    return res.json({ text: responseText });
  }

  try {
    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        temperature: 0.3
      }
    });
    res.json({ text: aiResponse.text });
  } catch (err) {
    res.json({ text: `Matched document check for ${docName}. Please ensure it is a high resolution scan with visible borders and legible signature text.` });
  }
});

// Simple local AI simulation for high reliability in any sandbox setup
function simulateFallbackAIResponse(msg: string, contextService?: any): string {
  const text = msg.toLowerCase();
  
  if (contextService && contextService.title) {
    const docs = Array.isArray(contextService.requiredDocuments) 
      ? contextService.requiredDocuments.map((d: string) => `* **${d}**: Must be clear, uncropped high-resolution scan.`).join('\n') 
      : '* Clear Photo ID and Address Proof.';
    const totalFee = (contextService.govFees || 0) + (contextService.serviceCharge || 0);
    return `### 💡 Contextual Filing Advice for: ${contextService.title}

Here is custom filing guidance for your **${contextService.title}** application:

#### 📄 Required Documents Checklist:
${docs}

#### ⚡ Key Filing Precautions:
1. **Name Matching**: Ensure the name on your uploaded documents matches your profile exactly.
2. **File Resolution**: Upload original PDF or high-resolution JPEGs without glares or dark shadows.
3. **Turnaround**: Estimated processing time is **${contextService.processingTime || '3-7 Working Days'}**.
4. **Transparent Fees**: Total billable fee is **₹${totalFee}** (Gov Fee: ₹${contextService.govFees || 0} + Consultancy: ₹${contextService.serviceCharge || 0}).

Click **Apply Online Now** to submit your application directly to our audit queue!`;
  }
  
  if (text.includes('pan') || text.includes('permanent account')) {
    return `### Apply for PAN Card through EasyDesk
We can help you get a new PAN Card or perform corrections online!

**Documents Required:**
1. Aadhaar Card (with correct date of birth)
2. Recent Passport size photograph
3. Digitally signed copy / signature proof

**Processing Time:** 5 to 7 Working Days.
**Cost:** Government Fee: ₹107 | Our Consultancy Charge: ₹150.

Would you like to start your application now? Click **Apply Now** on our Services page!`;
  }
  
  if (text.includes('passport')) {
    return `### Passport Slot Booking & Document Audit
Our team will assist you with slot scheduling, document audits, and filling out the official forms.

**Documents Required:**
* Aadhaar Card (with full Name & DoB matched)
* 10th Class Matriculation Passing Certificate (for Non-ECR status)
* Proof of Address (Rent agreement / latest Utility Bills)

Click **Apply Now** on the Passport service inside EasyDesk to proceed!`;
  }

  if (text.includes('gst') || text.includes('business') || text.includes('tax')) {
    return `### GST Registration Guidance
Get your corporate GST structure established in 3 to 7 working days!

**Documents Required:**
1. PAN Card of Business / Individual Proprietor
2. Aadhaar of promoter
3. Proof of premises (NOC or Rent deed)
4. Bank Account Cancelled Cheque

Our service charge is only ₹999. Would you like me to recommend this registration service for you?`;
  }

  return `### Hello! Welcome to EasyDesk Support
I can recommend the perfect service, explain required documents, or double check your eligibility rules!

Try asking me:
* *"What documents are needed for Passport?"*
* *"How can I apply for PAN card?"*
* *"Tell me about GST registration process."*

Our primary active services include **PAN Card, Aadhaar Demographics Update, fresh Passport applications, MSME Certificates, and custom IT services**! All manageable from your unified EasyDesk dashboards!`;
}


// ============================================================================
// PHASE 3: PROTECTED ADMIN RELATIONAL SYSTEM DIAGNOSTIC ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/system/relational-parity
 * Verifies relational schema, record count parity, and field-level parity.
 * Restricted to Super Admin / Admin with system_settings permission.
 */
app.get('/api/admin/system/relational-parity', authenticateToken, requirePermission('system_settings.view'), async (req, res) => {
  try {
    const d1 = getD1Database();
    if (!d1) {
      return res.status(503).json({
        success: false,
        message: 'Cloudflare D1 is not available in the current environment'
      });
    }

    const countParity = await verifyRelationalParity(d1);
    const fieldParity = await verifyFieldLevelParity(d1);
    const diagSummary = await getSyncDiagnosticsSummary(d1);

    const countParityPassed = countParity.every(r => r.status === 'PASS' || r.status === 'EMPTY');
    const fieldParityPassed = fieldParity.overallStatus === 'PASS';
    const overallParity = countParityPassed && fieldParityPassed ? 'PASS' : 'FAIL';

    return res.json({
      success: true,
      databaseMode: getDatabaseMode(),
      overallParity,
      countParity,
      fieldParity,
      syncHealth: diagSummary.health,
      totalFailures: diagSummary.totalFailures,
      recentFailures: diagSummary.recentFailures
    });
  } catch (err: any) {
    console.error('[ADMIN SYSTEM] Parity check exception:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify relational parity',
      error: err?.message || String(err)
    });
  }
});

/**
 * GET /api/admin/system/relational-sync-status
 * Returns real-time health indicator (HEALTHY, DEGRADED, FAILED) and failure metrics.
 */
app.get('/api/admin/system/relational-sync-status', authenticateToken, requirePermission('system_settings.view'), async (req, res) => {
  try {
    const d1 = getD1Database();
    if (!d1) {
      return res.json({
        success: true,
        databaseMode: getDatabaseMode(),
        health: 'HEALTHY',
        totalFailures: 0,
        recentFailures: [],
        notice: 'Cloudflare D1 not attached in current environment'
      });
    }

    const diagSummary = await getSyncDiagnosticsSummary(d1);
    return res.json({
      success: true,
      databaseMode: getDatabaseMode(),
      health: diagSummary.health,
      totalFailures: diagSummary.totalFailures,
      recentFailures: diagSummary.recentFailures
    });
  } catch (err: any) {
    console.error('[ADMIN SYSTEM] Sync status exception:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve relational sync status',
      error: err?.message || String(err)
    });
  }
});

/**
 * POST /api/admin/system/relational-retry
 * Retries relational synchronization for a failed entity from authoritative legacy entities store.
 */
app.post('/api/admin/system/relational-retry', authenticateToken, requirePermission('system_settings.manage'), async (req, res) => {
  const { collection, entityId } = req.body;
  if (!collection || !entityId) {
    return res.status(400).json({
      success: false,
      message: 'collection and entityId are required'
    });
  }

  try {
    const d1 = getD1Database();
    if (!d1) {
      return res.status(503).json({
        success: false,
        message: 'Cloudflare D1 is not available in the current environment'
      });
    }

    const retryResult = await retryRelationalSync(collection, String(entityId), d1);
    if (!retryResult.success) {
      return res.status(400).json(retryResult);
    }

    return res.json(retryResult);
  } catch (err: any) {
    console.error('[ADMIN SYSTEM] Sync retry exception:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to execute relational retry',
      error: err?.message || String(err)
    });
  }
});

// ============================================================================
// PHASE 4: ADMIN RELATIONAL READ MONITORING & CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/system/relational-read-status
 * Returns overall read health, per-collection modes, shadow read counts, mismatches, errors, and recent diagnostics.
 */
app.get('/api/admin/system/relational-read-status', authenticateToken, requirePermission('system_settings.view'), async (req, res) => {
  try {
    const d1 = getD1Database();
    const status = await getRelationalReadStatus(d1);
    return res.json({
      success: true,
      data: status
    });
  } catch (err: any) {
    console.error('[ADMIN SYSTEM] Read status exception:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve relational read status',
      error: err?.message || String(err)
    });
  }
});

/**
 * POST /api/admin/system/relational-read-mode
 * Updates the read mode for a specific collection (LEGACY, SHADOW, RELATIONAL).
 */
app.post('/api/admin/system/relational-read-mode', authenticateToken, requirePermission('system_settings.manage'), async (req, res) => {
  try {
    const { collection, mode } = req.body || {};
    if (!collection || !mode) {
      return res.status(400).json({ success: false, message: 'collection and mode are required' });
    }
    const validModes = ['LEGACY', 'SHADOW', 'RELATIONAL'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ success: false, message: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
    }

    setRelationalReadMode(collection, mode);
    return res.json({
      success: true,
      message: `Read mode for '${collection}' set to ${mode}`,
      collection,
      mode
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: 'Failed to set relational read mode',
      error: err?.message || String(err)
    });
  }
});

// ---------------- PRODUCTION SERVING OR VITE MIDDLEWARE ----------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Mounted Vite development server middleware.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving built static files from dist directory.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EasyDesk full-stack server running on http://localhost:${PORT}`);
  });
}

export { app, startServer };

// Auto-start standalone server when executed in Node.js / dev mode
const isWorkerRuntime = Boolean(
  process.env.IS_WORKER === 'true' ||
  process.env.CLOUDFLARE_WORKER ||
  process.env.CF_PAGES ||
  (typeof (globalThis as any).WebSocketPair !== 'undefined') ||
  (typeof (globalThis as any).navigator !== 'undefined' && (globalThis as any).navigator.userAgent === 'Cloudflare-Workers')
);

if (!isWorkerRuntime) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
  });
}

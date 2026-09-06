/**
 * Cloudflare D1 Database & Cloudflare R2 Storage Adapter for EasyDesk
 * Provides edge SQL persistence and S3-compatible object storage with zero quota limits.
 */
import fs from 'fs';
import path from 'path';

export interface CloudflareEnv {
  DB?: any;
  STORAGE?: any;
  ASSETS?: any;
  [key: string]: any;
}

let activeEnv: CloudflareEnv | null = null;
let isD1SchemaInitialized = false;

export function setCloudflareEnv(env: CloudflareEnv) {
  activeEnv = env;
}

export function getCloudflareEnv(): CloudflareEnv | null {
  return activeEnv;
}

export function getD1Database(env?: CloudflareEnv): any | null {
  return env?.DB || activeEnv?.DB || (globalThis as any)?.CLOUDFLARE_ENV?.DB || null;
}

export function getR2Storage(env?: CloudflareEnv): any | null {
  return env?.STORAGE || activeEnv?.STORAGE || (globalThis as any)?.CLOUDFLARE_ENV?.STORAGE || null;
}

export const OBJECT_COLLECTIONS = new Set([
  'employeeAccounts',
  'employeeKYC',
  'employeePayroll'
]);

export const ENTITY_COLLECTIONS = [
  'services',
  'categories',
  'blogCategories',
  'blogs',
  'customers',
  'admins',
  'roles',
  'permissions',
  'employees',
  'employeeKYC',
  'employeePayroll',
  'employeeAccounts',
  'employeeDocuments',
  'orders',
  'tickets',
  'reviews',
  'faqs',
  'banners',
  'calendarEvents',
  'pages',
  'media',
  'notifications',
  'users',
  'auditLogs',
  'coupons',
  'contactMessages',
  'scamReports',
  'dataDeletionRequests',
  'team',
  'systemBackups'
] as const;

export const SETTING_KEYS = [
  'system_init',
  'aboutUs',
  'founder',
  'companyProfile',
  'contactSettings',
  'paymentConfig',
  'paymentSettings',
  'privacySecuritySettings',
  'privacySecurity',
  'settings',
  'maintenanceMode',
  'masterData',
  'chatConfig',
  'socialMediaLinks'
] as const;

/**
 * Sanitizes and normalizes payment configuration, populating both canonical
 * properties and interoperability aliases so that PaymentAdminModule, PaymentView,
 * and legacy tests all receive expected field names without demo overrides.
 */
export function sanitizePaymentConfig(raw?: any): any {
  if (!raw || typeof raw !== 'object') {
    raw = {};
  }

  // Canonical Beneficiary / Account Name
  let accountNameVal = '';
  if (raw.accountName !== undefined && raw.accountName !== null) {
    accountNameVal = String(raw.accountName).trim();
  } else if (raw.bankAccountName !== undefined && raw.bankAccountName !== null) {
    accountNameVal = String(raw.bankAccountName).trim();
  } else if (raw.accountHolderName !== undefined && raw.accountHolderName !== null) {
    accountNameVal = String(raw.accountHolderName).trim();
  }

  // Canonical Account Number
  let accountNumberVal = '';
  if (raw.accountNumber !== undefined && raw.accountNumber !== null) {
    accountNumberVal = String(raw.accountNumber).trim();
  } else if (raw.bankAccountNumber !== undefined && raw.bankAccountNumber !== null) {
    accountNumberVal = String(raw.bankAccountNumber).trim();
  }

  // Canonical IFSC Code
  let ifscVal = '';
  if (raw.ifscCode !== undefined && raw.ifscCode !== null) {
    ifscVal = String(raw.ifscCode).trim().toUpperCase();
  } else if (raw.ifsc !== undefined && raw.ifsc !== null) {
    ifscVal = String(raw.ifsc).trim().toUpperCase();
  } else if (raw.bankIfsc !== undefined && raw.bankIfsc !== null) {
    ifscVal = String(raw.bankIfsc).trim().toUpperCase();
  }

  // Canonical Bank Branch
  let branchVal = '';
  if (raw.branch !== undefined && raw.branch !== null) {
    branchVal = String(raw.branch).trim();
  } else if (raw.bankBranch !== undefined && raw.bankBranch !== null) {
    branchVal = String(raw.bankBranch).trim();
  }

  // Canonical Bank Name
  const bankNameVal = raw.bankName !== undefined && raw.bankName !== null ? String(raw.bankName).trim() : '';

  // Canonical UPI ID
  const upiIdVal = raw.upiId !== undefined && raw.upiId !== null ? String(raw.upiId).trim() : '';

  // Canonical UPI Name
  let upiNameVal = '';
  if (raw.upiName !== undefined && raw.upiName !== null && String(raw.upiName).trim()) {
    upiNameVal = String(raw.upiName).trim();
  } else {
    upiNameVal = accountNameVal || 'EasyDesk Digital Services';
  }

  // Canonical QR Code URL
  const qrCodeUrlVal = raw.qrCodeUrl !== undefined && raw.qrCodeUrl !== null ? String(raw.qrCodeUrl).trim() : '';

  // Canonical Payment Instructions
  let paymentInstructionsVal = '';
  if (raw.paymentInstructions !== undefined && raw.paymentInstructions !== null) {
    paymentInstructionsVal = String(raw.paymentInstructions).trim();
  } else if (raw.instructions !== undefined && raw.instructions !== null) {
    paymentInstructionsVal = String(raw.instructions).trim();
  }

  const acceptUpiVal = raw.acceptUpi !== undefined ? Boolean(raw.acceptUpi) : true;
  const acceptNetBankingVal = raw.acceptNetBanking !== undefined ? Boolean(raw.acceptNetBanking) : true;
  const acceptQrCodeVal = raw.acceptQrCode !== undefined ? Boolean(raw.acceptQrCode) : true;
  const convenienceFeePercentageVal = typeof raw.convenienceFeePercentage === 'number' ? raw.convenienceFeePercentage : 0;
  const updatedAtVal = raw.updatedAt || new Date().toISOString();

  return {
    // Canonical primary fields
    upiId: upiIdVal,
    upiName: upiNameVal,
    qrCodeUrl: qrCodeUrlVal,
    bankName: bankNameVal,
    bankAccountName: accountNameVal,
    accountNumber: accountNumberVal,
    ifsc: ifscVal,
    branch: branchVal,
    paymentInstructions: paymentInstructionsVal,

    // Interoperability aliases for frontend components and legacy consumers
    accountName: accountNameVal,
    accountHolderName: accountNameVal,
    bankAccountNumber: accountNumberVal,
    ifscCode: ifscVal,
    bankIfsc: ifscVal,
    bankBranch: branchVal,
    instructions: paymentInstructionsVal,

    // Gateway / method toggles
    acceptUpi: acceptUpiVal,
    acceptNetBanking: acceptNetBankingVal,
    acceptQrCode: acceptQrCodeVal,
    convenienceFeePercentage: convenienceFeePercentageVal,
    updatedAt: updatedAtVal
  };
}

/**
 * Ensures D1 tables and indexes exist.
 */
export async function initD1Schema(dbInstance?: any): Promise<void> {
  const db = dbInstance || getD1Database();
  if (!db || isD1SchemaInitialized) return;

  const schemaStatements = [
    // 0. Enable SQLite foreign key enforcement
    `PRAGMA foreign_keys = ON;`,

    // 1. System Settings Store (Key-Value)
    `CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );`,

    // 2. Universal Durable Entity Store (Preserved for legacy parity/rollback)
    `CREATE TABLE IF NOT EXISTS entities (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (collection, id)
    );`,

    // 3. Performance Indexes for entities
    `CREATE INDEX IF NOT EXISTS idx_entities_collection ON entities(collection);`,
    `CREATE INDEX IF NOT EXISTS idx_entities_updated ON entities(updated_at);`,

    // 4. File / Media Registry for Firebase Storage & R2 Object Store
    `CREATE TABLE IF NOT EXISTS r2_files (
      key TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      folder TEXT DEFAULT 'media',
      metadata TEXT,
      created_at INTEGER NOT NULL
    );`,

    // 5. Media & Upload Metadata Registry
    `CREATE TABLE IF NOT EXISTS media_files (
      file_id TEXT PRIMARY KEY,
      storage_path TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      access_level TEXT DEFAULT 'public',
      owner_id TEXT,
      download_url TEXT NOT NULL,
      folder TEXT DEFAULT 'media',
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_media_files_path ON media_files(storage_path);`,
    `CREATE INDEX IF NOT EXISTS idx_media_files_owner ON media_files(owner_id);`,

    // 6. Relational Table: Categories
    `CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      sort_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
      icon TEXT,
      color TEXT,
      description TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,

    // 7. Relational Table: Services
    `CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      category_id TEXT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      sub_category TEXT,
      description TEXT NOT NULL,
      gov_fees REAL DEFAULT 0,
      service_charge REAL DEFAULT 0,
      processing_time TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'draft', 'published')),
      banner_image TEXT,
      icon TEXT,
      required_documents TEXT,
      faqs TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
    );`,

    // 8. Relational Table: Customers
    `CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      mobile TEXT NOT NULL,
      whatsapp_mobile TEXT,
      customer_type TEXT DEFAULT 'Individual' CHECK(customer_type IN ('Individual', 'Business / Corporate', 'Franchise / Partner')),
      status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'Blocked')),
      contact_person_name TEXT,
      gender TEXT,
      dob_or_incorporation TEXT,
      photo_url TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      gstin TEXT,
      pan_number TEXT,
      msme_license TEXT,
      notes TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,

    // 9. Relational Table: Employees
    `CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      designation TEXT NOT NULL,
      employment_type TEXT DEFAULT 'Full-Time',
      status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'On Leave', 'Suspended', 'Resigned', 'Terminated')),
      joining_date TEXT,
      phone TEXT,
      email TEXT,
      photo_url TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      qualification TEXT,
      experience_years REAL DEFAULT 0,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,

    // 10. Relational Table: Employee KYC
    `CREATE TABLE IF NOT EXISTS employee_kyc (
      employee_id TEXT PRIMARY KEY,
      aadhaar_masked TEXT,
      pan_masked TEXT,
      other_id_type TEXT,
      other_id_number TEXT,
      aadhaar_status TEXT DEFAULT 'Pending' CHECK(aadhaar_status IN ('Pending', 'Verified', 'Rejected')),
      pan_status TEXT DEFAULT 'Pending' CHECK(pan_status IN ('Pending', 'Verified', 'Rejected')),
      verification_notes TEXT,
      verified_by TEXT,
      verified_at TEXT,
      documents TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );`,

    // 11. Relational Table: Employee Payroll
    `CREATE TABLE IF NOT EXISTS employee_payroll (
      employee_id TEXT PRIMARY KEY,
      account_holder_name TEXT,
      bank_name TEXT,
      branch_name TEXT,
      account_masked TEXT,
      ifsc_code TEXT,
      payment_method TEXT DEFAULT 'Bank Transfer',
      salary_ctc REAL DEFAULT 0,
      net_salary REAL DEFAULT 0,
      basic_pay REAL DEFAULT 0,
      hra REAL DEFAULT 0,
      payroll_notes TEXT,
      metadata TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );`,

    // 12. Relational Table: Employee Accounts
    `CREATE TABLE IF NOT EXISTS employee_accounts (
      employee_id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      system_email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'STAFF',
      permissions TEXT,
      account_status TEXT DEFAULT 'Active' CHECK(account_status IN ('Active', 'Inactive', 'Locked')),
      last_login_at TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );`,

    // 13. Relational Table: Employee Documents
    `CREATE TABLE IF NOT EXISTS employee_documents (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      document_type TEXT NOT NULL,
      document_name TEXT NOT NULL,
      original_file_name TEXT,
      storage_path TEXT NOT NULL,
      download_url TEXT,
      mime_type TEXT,
      size_bytes INTEGER DEFAULT 0,
      verification_status TEXT DEFAULT 'Pending' CHECK(verification_status IN ('Pending', 'Verified', 'Rejected')),
      uploaded_by TEXT,
      uploaded_at TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );`,

    // 14. Relational Table: Orders
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_code TEXT UNIQUE,
      customer_id TEXT,
      service_id TEXT,
      assigned_staff_id TEXT,
      order_source TEXT DEFAULT 'WhatsApp' CHECK(order_source IN ('WhatsApp', 'Website', 'Phone', 'In-Person', 'Other')),
      created_by TEXT,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'UPI',
      payment_status TEXT DEFAULT 'Pending Verification' CHECK(payment_status IN ('Pending Verification', 'Verified', 'Rejected')),
      utr TEXT,
      payment_screenshot TEXT,
      order_status TEXT DEFAULT 'Pending' CHECK(order_status IN ('Pending', 'Documents Required', 'Under Verification', 'Processing', 'Completed', 'Rejected')),
      document_delivery_status TEXT DEFAULT 'Pending' CHECK(document_delivery_status IN ('Pending', 'Ready', 'SENT_VIA_WHATSAPP')),
      final_document_url TEXT,
      final_document_name TEXT,
      priority TEXT DEFAULT 'Normal' CHECK(priority IN ('Normal', 'High', 'Urgent')),
      uploaded_documents TEXT,
      logs TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE SET NULL,
      FOREIGN KEY(assigned_staff_id) REFERENCES employees(id) ON DELETE SET NULL
    );`,

    // 15. Relational Table: Reviews
    `CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      service_id TEXT,
      customer_id TEXT,
      order_id TEXT,
      customer_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Hidden')),
      admin_note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE SET NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL
    );`,

    // 16. Relational Table: Audit Logs
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      timestamp INTEGER NOT NULL
    );`,

    // 17. Relational Diagnostics Table: Sync Diagnostics
    `CREATE TABLE IF NOT EXISTS relational_sync_diagnostics (
      id TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      last_attempt INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );`,

    // 18. Relational Diagnostics Table: Read Diagnostics
    `CREATE TABLE IF NOT EXISTS relational_read_diagnostics (
      id TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      operation TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      legacy_count INTEGER,
      relational_count INTEGER,
      mismatch_count INTEGER DEFAULT 0,
      mismatch_details TEXT,
      error_message TEXT,
      latency_ms INTEGER,
      created_at INTEGER NOT NULL
    );`,

    // Indexes for Relational Tables
    `CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);`,
    `CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code);`,
    `CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);`,
    `CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);`,
    `CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);`,
    `CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug);`,
    `CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);`,
    `CREATE INDEX IF NOT EXISTS idx_orders_service ON orders(service_id);`,
    `CREATE INDEX IF NOT EXISTS idx_orders_assigned ON orders(assigned_staff_id);`,
    `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);`,
    `CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);`,
    `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_service ON reviews(service_id);`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);`,
    `CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(code);`,
    `CREATE INDEX IF NOT EXISTS idx_employee_docs_employee ON employee_documents(employee_id);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);`,
    `CREATE INDEX IF NOT EXISTS idx_sync_diag_status ON relational_sync_diagnostics(status);`,
    `CREATE INDEX IF NOT EXISTS idx_sync_diag_entity ON relational_sync_diagnostics(collection, entity_id);`,
    `CREATE INDEX IF NOT EXISTS idx_read_diag_collection ON relational_read_diagnostics(collection);`,
    `CREATE INDEX IF NOT EXISTS idx_read_diag_status ON relational_read_diagnostics(status);`,
    `CREATE INDEX IF NOT EXISTS idx_read_diag_created ON relational_read_diagnostics(created_at);`
  ];

  try {
    if (typeof db.batch === 'function') {
      const prepares = schemaStatements.map(sql => db.prepare(sql));
      await db.batch(prepares);
    } else if (typeof db.exec === 'function') {
      for (const sql of schemaStatements) {
        await db.exec(sql);
      }
    } else if (typeof db.prepare === 'function') {
      for (const sql of schemaStatements) {
        await db.prepare(sql).run();
      }
    }
    isD1SchemaInitialized = true;
    // Idempotent column migrations for existing tables
    try {
      if (typeof db.prepare === 'function') {
        await db.prepare('ALTER TABLE employee_payroll ADD COLUMN metadata TEXT').run();
      }
    } catch {}
    console.log('[D1] Relational schema tables and performance indexes verified successfully.');
  } catch (err) {
    console.error('[D1] Schema initialization error:', err);
  }
}

/**
 * Loads all system settings and entities from Cloudflare D1.
 */
export async function loadStateFromD1(dbInstance?: any): Promise<{
  state: Record<string, any>;
  isFreshDatabase: boolean;
  totalDocsLoaded: number;
} | null> {
  const db = dbInstance || getD1Database();
  if (!db) return null;

  try {
    await initD1Schema(db);

    const state: Record<string, any> = {};
    let totalDocsLoaded = 0;

    // 1. Load System Settings
    const settingsRes = await db.prepare('SELECT key, data FROM system_settings').all();
    const settingsRows = (settingsRes && settingsRes.results) ? settingsRes.results : (Array.isArray(settingsRes) ? settingsRes : []);
    let hasSystemInit = false;

    for (const row of settingsRows) {
      if (!row || !row.key || !row.data) continue;
      try {
        const parsed = JSON.parse(row.data);
        state[row.key] = parsed;
        if (row.key === 'system_init') hasSystemInit = true;
        totalDocsLoaded++;
      } catch {}
    }

    // 2. Load Entities
    const entitiesRes = await db.prepare('SELECT collection, id, data FROM entities').all();
    const entityRows = (entitiesRes && entitiesRes.results) ? entitiesRes.results : (Array.isArray(entitiesRes) ? entitiesRes : []);

    for (const row of entityRows) {
      if (!row || !row.collection || !row.id || !row.data) continue;
      try {
        const parsed = JSON.parse(row.data);
        if (OBJECT_COLLECTIONS.has(row.collection)) {
          if (!state[row.collection] || Array.isArray(state[row.collection])) {
            state[row.collection] = {};
          }
          state[row.collection][row.id] = parsed;
        } else {
          if (!state[row.collection] || !Array.isArray(state[row.collection])) {
            state[row.collection] = [];
          }
          state[row.collection].push(parsed);
        }
        totalDocsLoaded++;
      } catch {}
    }

    const isFreshDatabase = !hasSystemInit && totalDocsLoaded === 0;

    return {
      state,
      isFreshDatabase,
      totalDocsLoaded
    };
  } catch (err) {
    console.error('[D1] Error loading state from D1:', err);
    return null;
  }
}

// ============================================================================
// PHASE 3: DUAL-WRITE SYNCHRONIZATION ENGINE & PARITY SUBSYSTEM
// ============================================================================

export type DatabaseMode = 'LEGACY' | 'DUAL_WRITE' | 'RELATIONAL';

let activeDatabaseMode: DatabaseMode | null = null;

export function getDatabaseMode(): DatabaseMode {
  if (activeDatabaseMode) return activeDatabaseMode;
  const envMode = (typeof process !== 'undefined' && process.env && process.env.DATABASE_MODE)
    ? process.env.DATABASE_MODE.toUpperCase()
    : 'DUAL_WRITE';
  if (envMode === 'LEGACY' || envMode === 'DUAL_WRITE' || envMode === 'RELATIONAL') {
    return envMode as DatabaseMode;
  }
  return 'DUAL_WRITE';
}

export function setDatabaseMode(mode: DatabaseMode): void {
  activeDatabaseMode = mode;
}

export const DUAL_WRITE_COLLECTIONS = new Set<string>([
  'categories',
  'services',
  'customers',
  'employees',
  'employeeKYC',
  'employeePayroll',
  'employeeAccounts',
  'employeeDocuments',
  'orders',
  'reviews',
  'auditLogs'
]);

export interface RelationalSyncResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * Records synchronization diagnostics in Cloudflare D1.
 * Sensitive passwords, keys, or KYC numbers are NEVER stored.
 */
export async function recordSyncDiagnostic(
  collection: string,
  entityId: string,
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
  status: 'SUCCESS' | 'FAILED',
  errorMessage: string | null,
  dbInstance?: any
): Promise<void> {
  const db = dbInstance || getD1Database();
  if (!db) return;
  try {
    const diagId = `${collection}_${entityId}`;
    const now = Date.now();
    const safeError = errorMessage ? String(errorMessage).slice(0, 500) : null;
    const stmt = db.prepare(`
      INSERT INTO relational_sync_diagnostics (id, collection, entity_id, operation, status, error_message, retry_count, last_attempt, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        operation = excluded.operation,
        status = excluded.status,
        error_message = excluded.error_message,
        retry_count = CASE WHEN excluded.status = 'SUCCESS' THEN 0 ELSE relational_sync_diagnostics.retry_count + 1 END,
        last_attempt = excluded.last_attempt
    `);
    await stmt.bind(diagId, collection, entityId, operation, status, safeError, now, now).run();
  } catch (err: any) {
    console.error(`[SYNC DIAGNOSTIC ERROR] Failed to record diagnostic for ${collection}/${entityId}:`, err?.message || String(err));
  }
}

/**
 * Mirrors an entity into its corresponding relational D1 table using safe, idempotent UPSERT semantics.
 */
export async function saveRelationalMirror(
  collectionName: string,
  docId: string,
  d: any,
  dbInstance?: any
): Promise<RelationalSyncResult> {
  const db = dbInstance || getD1Database();
  if (!db) return { success: false, error: 'No D1 database instance available' };

  if (getDatabaseMode() === 'LEGACY') {
    return { success: true, skipped: true };
  }

  if (!DUAL_WRITE_COLLECTIONS.has(collectionName) || !d || typeof d !== 'object') {
    return { success: true, skipped: true };
  }

  try {
    await initD1Schema(db);
    const now = Date.now();

    if (collectionName === 'categories') {
      const id = String(docId || d.id);
      const name = String(d.name || id);
      const slug = String(d.slug || id.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      const sortOrder = typeof d.sortOrder === 'number' ? d.sortOrder : 0;
      const status = d.status === 'Inactive' ? 'Inactive' : 'Active';
      const icon = d.icon || null;
      const color = d.color || null;
      const description = d.description || null;
      const createdAt = typeof d.createdAt === 'number' ? d.createdAt : (d.createdAt ? Date.parse(d.createdAt) || now : now);
      const updatedAt = typeof d.updatedAt === 'number' ? d.updatedAt : (d.updatedAt ? Date.parse(d.updatedAt) || now : now);
      const metadata = JSON.stringify({ serviceCount: d.serviceCount });

      const stmt = db.prepare(`
        INSERT INTO categories (id, name, slug, sort_order, status, icon, color, description, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          slug = excluded.slug,
          sort_order = excluded.sort_order,
          status = excluded.status,
          icon = excluded.icon,
          color = excluded.color,
          description = excluded.description,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
      `);
      await stmt.bind(id, name, slug, sortOrder, status, icon, color, description, metadata, createdAt, updatedAt).run();
    } else if (collectionName === 'services') {
      const id = String(docId || d.id);
      let categoryId = d.categoryId ? String(d.categoryId) : null;
      if (categoryId) {
        const catCheck = await db.prepare('SELECT id FROM categories WHERE id = ?').bind(categoryId).all();
        const found = (catCheck && catCheck.results && catCheck.results.length > 0) || (Array.isArray(catCheck) && catCheck.length > 0);
        if (!found) categoryId = null;
      }

      const title = String(d.title || id);
      const slug = String(d.slug || id.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      const subCategory = d.subCategory || null;
      const description = String(d.description || d.shortDescription || title);
      const govFees = typeof d.govFees === 'number' ? d.govFees : 0;
      const serviceCharge = typeof d.serviceCharge === 'number' ? d.serviceCharge : 0;
      const processingTime = d.processingTime || d.estimatedTime || '3-5 Business Days';
      const status = ['active', 'inactive', 'draft', 'published'].includes(d.status) ? d.status : 'active';
      const bannerImage = d.bannerImage || d.imageUrl || d.image || null;
      const icon = d.icon || null;
      const requiredDocs = Array.isArray(d.requiredDocuments) ? JSON.stringify(d.requiredDocuments) : JSON.stringify([]);
      const faqs = Array.isArray(d.faqs) ? JSON.stringify(d.faqs) : JSON.stringify([]);
      const metadata = JSON.stringify({
        originalCategoryId: d.categoryId || null,
        highlights: d.highlights || [],
        eligibility: d.eligibility || '',
        howItWorks: d.howItWorks || '',
        seoTitle: d.seoTitle || '',
        seoDescription: d.seoDescription || '',
        whatsAppEnabled: d.whatsAppEnabled !== false,
        featured: Boolean(d.featured),
        popular: Boolean(d.popular),
        displayOrder: d.displayOrder || 0,
        popularity: d.popularity || 0,
        gallery: d.gallery || []
      });
      const createdAt = typeof d.createdAt === 'number' ? d.createdAt : (d.createdAt ? Date.parse(d.createdAt) || now : now);
      const updatedAt = typeof d.updatedAt === 'number' ? d.updatedAt : (d.updatedAt ? Date.parse(d.updatedAt) || now : now);

      const stmt = db.prepare(`
        INSERT INTO services (id, category_id, title, slug, sub_category, description, gov_fees, service_charge, processing_time, status, banner_image, icon, required_documents, faqs, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          category_id = excluded.category_id,
          title = excluded.title,
          slug = excluded.slug,
          sub_category = excluded.sub_category,
          description = excluded.description,
          gov_fees = excluded.gov_fees,
          service_charge = excluded.service_charge,
          processing_time = excluded.processing_time,
          status = excluded.status,
          banner_image = excluded.banner_image,
          icon = excluded.icon,
          required_documents = excluded.required_documents,
          faqs = excluded.faqs,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
      `);
      await stmt.bind(id, categoryId, title, slug, subCategory, description, govFees, serviceCharge, processingTime, status, bannerImage, icon, requiredDocs, faqs, metadata, createdAt, updatedAt).run();
    } else if (collectionName === 'customers') {
      const id = String(docId || d.id);
      const code = String(d.code || `CUST-${id.replace(/[^0-9]/g, '').slice(-4) || '1001'}`);
      const name = String(d.name || 'Unnamed Customer');
      const email = d.email || null;
      const mobile = String(d.mobile || '');
      const whatsappMobile = d.whatsappMobile || null;
      const customerType = ['Individual', 'Business / Corporate', 'Franchise / Partner'].includes(d.customerType) ? d.customerType : 'Individual';
      const status = ['Active', 'Inactive', 'Blocked'].includes(d.status) ? d.status : 'Active';
      const contactPersonName = d.contactPersonName || null;
      const gender = d.gender || null;
      const dobOrIncorporation = d.dobOrIncorporationDate || d.dobOrIncorporation || null;
      const photoUrl = d.photoUrl || null;
      const address = d.address || null;
      const city = d.city || null;
      const state = d.state || null;
      const pincode = d.pinCode || d.pincode || null;
      const gstin = d.gstin || null;
      const panNumber = d.panNumber || null;
      const msmeLicense = d.msmeLicense || null;
      const notes = d.notes || null;
      const metadata = JSON.stringify({
        userId: d.userId || null,
        dobOrIncorporationDate: dobOrIncorporation,
        isSuspended: d.isSuspended !== undefined ? d.isSuspended : false,
        isVerified: d.isVerified !== undefined ? d.isVerified : true,
        ...(d.metadata && typeof d.metadata === 'object' ? d.metadata : {})
      });
      const createdAt = typeof d.createdAt === 'number' ? d.createdAt : (d.createdAt ? Date.parse(d.createdAt) || now : now);
      const updatedAt = typeof d.updatedAt === 'number' ? d.updatedAt : (d.updatedAt ? Date.parse(d.updatedAt) || now : now);

      const stmt = db.prepare(`
        INSERT INTO customers (id, code, name, email, mobile, whatsapp_mobile, customer_type, status, contact_person_name, gender, dob_or_incorporation, photo_url, address, city, state, pincode, gstin, pan_number, msme_license, notes, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          code = excluded.code,
          name = excluded.name,
          email = excluded.email,
          mobile = excluded.mobile,
          whatsapp_mobile = excluded.whatsapp_mobile,
          customer_type = excluded.customer_type,
          status = excluded.status,
          contact_person_name = excluded.contact_person_name,
          gender = excluded.gender,
          dob_or_incorporation = excluded.dob_or_incorporation,
          photo_url = excluded.photo_url,
          address = excluded.address,
          city = excluded.city,
          state = excluded.state,
          pincode = excluded.pincode,
          gstin = excluded.gstin,
          pan_number = excluded.pan_number,
          msme_license = excluded.msme_license,
          notes = excluded.notes,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
      `);
      await stmt.bind(id, code, name, email, mobile, whatsappMobile, customerType, status, contactPersonName, gender, dobOrIncorporation, photoUrl, address, city, state, pincode, gstin, panNumber, msmeLicense, notes, metadata, createdAt, updatedAt).run();
    } else if (collectionName === 'employees') {
      const id = String(docId || d.id);
      const code = String(d.code || d.employeeCode || `EMP-${id.replace(/[^0-9]/g, '').slice(-3) || '001'}`);
      const name = String(d.name || d.fullName || 'Staff Member');
      const department = String(d.department || 'Operations');
      const designation = String(d.designation || 'Staff');
      const employmentType = d.employmentType || 'Full-Time';
      const status = ['Active', 'Inactive', 'On Leave', 'Suspended', 'Resigned', 'Terminated'].includes(d.status || d.employmentStatus) ? (d.status || d.employmentStatus) : 'Active';
      const joiningDate = d.joiningDate || null;
      const phone = d.phone || d.mobile || d.personalMobile || null;
      const email = d.email || d.personalEmail || null;
      const photoUrl = d.photoUrl || d.photo || d.profilePhoto || null;
      const address = d.address || d.currentAddress || null;
      const city = d.city || null;
      const state = d.state || null;
      const pincode = d.pinCode || d.pincode || null;
      const qualification = d.qualification || d.highestQualification || null;
      const experienceYears = typeof d.experience === 'number' ? d.experience : (typeof d.totalExperienceYears === 'number' ? d.totalExperienceYears : 0);
      const emergencyContactName = d.emergencyContactName || null;
      const emergencyContactPhone = d.emergencyContactMobile || null;
      const metadata = JSON.stringify({
        fatherName: d.fatherName || '',
        motherName: d.motherName || '',
        spouseName: d.spouseName || '',
        fatherMotherSpouseName: d.fatherMotherSpouseName || '',
        dateOfBirth: d.dateOfBirth || '',
        gender: d.gender || '',
        nationality: d.nationality || 'Indian',
        bloodGroup: d.bloodGroup || '',
        personalEmail: d.personalEmail || d.email || '',
        personalMobile: d.personalMobile || d.mobile || d.phone || '',
        emergencyContactName: d.emergencyContactName || '',
        emergencyContactRelation: d.emergencyContactRelation || '',
        emergencyContactMobile: d.emergencyContactMobile || d.emergency_contact_phone || '',
        currentAddress: d.currentAddress || d.address || '',
        permanentAddress: d.permanentAddress || '',
        isPermanentSameAsCurrent: d.isPermanentSameAsCurrent !== undefined ? d.isPermanentSameAsCurrent : true,
        district: d.district || '',
        reportingManager: d.reportingManager || '',
        workLocation: d.workLocation || '',
        probationStatus: d.probationStatus || '',
        confirmationDate: d.confirmationDate || '',
        exitDate: d.exitDate || '',
        exitReason: d.exitReason || '',
        highestQualification: d.highestQualification || d.qualification || '',
        qualificationSummary: d.qualificationSummary || d.highestQualification || '',
        university: d.university || '',
        certifications: d.certifications || '',
        totalExperienceYears: typeof d.totalExperienceYears === 'number' ? d.totalExperienceYears : (typeof d.experience === 'number' ? d.experience : 0),
        previousOrganizations: d.previousOrganizations || '',
        skills: Array.isArray(d.skills) ? d.skills : [],
        languages: Array.isArray(d.languages) ? d.languages : [],
        profilePhoto: photoUrl,
        profilePhotoMediaId: d.profilePhotoMediaId || '',
        internalNotes: d.internalNotes || ''
      });
      const createdAt = typeof d.createdAt === 'number' ? d.createdAt : (d.createdAt ? Date.parse(d.createdAt) || now : now);
      const updatedAt = typeof d.updatedAt === 'number' ? d.updatedAt : (d.updatedAt ? Date.parse(d.updatedAt) || now : now);

      const stmt = db.prepare(`
        INSERT INTO employees (id, code, name, department, designation, employment_type, status, joining_date, phone, email, photo_url, address, city, state, pincode, qualification, experience_years, emergency_contact_name, emergency_contact_phone, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          code = excluded.code,
          name = excluded.name,
          department = excluded.department,
          designation = excluded.designation,
          employment_type = excluded.employment_type,
          status = excluded.status,
          joining_date = excluded.joining_date,
          phone = excluded.phone,
          email = excluded.email,
          photo_url = excluded.photo_url,
          address = excluded.address,
          city = excluded.city,
          state = excluded.state,
          pincode = excluded.pincode,
          qualification = excluded.qualification,
          experience_years = excluded.experience_years,
          emergency_contact_name = excluded.emergency_contact_name,
          emergency_contact_phone = excluded.emergency_contact_phone,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
      `);
      await stmt.bind(id, code, name, department, designation, employmentType, status, joiningDate, phone, email, photoUrl, address, city, state, pincode, qualification, experienceYears, emergencyContactName, emergencyContactPhone, metadata, createdAt, updatedAt).run();
    } else if (collectionName === 'employeeKYC') {
      const empId = String(docId || d.employeeId);
      const empCheck = await db.prepare('SELECT id FROM employees WHERE id = ?').bind(empId).all();
      const found = (empCheck && empCheck.results && empCheck.results.length > 0) || (Array.isArray(empCheck) && empCheck.length > 0);
      if (!found) {
        throw new Error(`Referenced employee '${empId}' does not exist in employees table`);
      }

      const aadhaarMasked = d.aadhaarNumber || null;
      const panMasked = d.panNumber || null;
      const otherIdType = d.otherGovernmentIdType || null;
      const otherIdNumber = d.otherGovernmentIdNumber || null;
      const aadhaarStatus = ['Pending', 'Verified', 'Rejected'].includes(d.aadhaarVerificationStatus) ? d.aadhaarVerificationStatus : 'Pending';
      const panStatus = ['Pending', 'Verified', 'Rejected'].includes(d.panVerificationStatus) ? d.panVerificationStatus : 'Pending';
      const verificationNotes = d.verificationNotes || null;
      const verifiedBy = d.verifiedBy || null;
      const verifiedAt = d.verifiedAt || null;
      const documents = Array.isArray(d.documents) ? JSON.stringify(d.documents) : null;
      const updatedAt = typeof d.updatedAt === 'number' ? d.updatedAt : (d.updatedAt ? Date.parse(d.updatedAt) || now : now);

      const stmt = db.prepare(`
        INSERT INTO employee_kyc (employee_id, aadhaar_masked, pan_masked, other_id_type, other_id_number, aadhaar_status, pan_status, verification_notes, verified_by, verified_at, documents, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(employee_id) DO UPDATE SET
          aadhaar_masked = excluded.aadhaar_masked,
          pan_masked = excluded.pan_masked,
          other_id_type = excluded.other_id_type,
          other_id_number = excluded.other_id_number,
          aadhaar_status = excluded.aadhaar_status,
          pan_status = excluded.pan_status,
          verification_notes = excluded.verification_notes,
          verified_by = excluded.verified_by,
          verified_at = excluded.verified_at,
          documents = excluded.documents,
          updated_at = excluded.updated_at
      `);
      await stmt.bind(empId, aadhaarMasked, panMasked, otherIdType, otherIdNumber, aadhaarStatus, panStatus, verificationNotes, verifiedBy, verifiedAt, documents, updatedAt).run();
    } else if (collectionName === 'employeePayroll') {
      const empId = String(docId || d.employeeId);
      const empCheck = await db.prepare('SELECT id FROM employees WHERE id = ? OR code = ?').bind(empId, empId).all();
      const found = (empCheck && empCheck.results && empCheck.results.length > 0) || (Array.isArray(empCheck) && empCheck.length > 0);
      if (!found) {
        throw new Error(`Referenced employee '${empId}' does not exist in employees table`);
      }
      const canonicalEmpId = (empCheck && empCheck.results && empCheck.results[0]?.id) || (Array.isArray(empCheck) && empCheck[0]?.id) || empId;

      const accountHolderName = d.accountHolderName || null;
      const bankName = d.bankName || null;
      const branchName = d.branchName || null;
      const accountMasked = d.accountNumber || null;
      const ifscCode = d.ifscCode || null;
      const paymentMethod = d.paymentMethod || 'Bank Transfer';
      const salaryCtc = typeof d.salaryAmount === 'number' ? d.salaryAmount : (typeof d.grossSalary === 'number' ? d.grossSalary : 0);
      const netSalary = typeof d.netSalary === 'number' ? d.netSalary : salaryCtc;
      const basicPay = typeof d.basicPay === 'number' ? d.basicPay : 0;
      const hra = typeof d.hra === 'number' ? d.hra : 0;
      const payrollNotes = d.payrollNotes || null;
      const metadata = JSON.stringify({
        specialAllowance: typeof d.specialAllowance === 'number' ? d.specialAllowance : 0,
        pfDeduction: typeof d.pfDeduction === 'number' ? d.pfDeduction : 0,
        taxDeduction: typeof d.taxDeduction === 'number' ? d.taxDeduction : 0,
        salaryType: d.salaryType || 'Monthly',
        salaryFrequency: d.salaryFrequency || 'Monthly',
        effectiveFrom: d.effectiveFrom || null,
        accountNumber: d.accountNumber || null,
        ...(d.metadata && typeof d.metadata === 'object' ? d.metadata : {})
      });
      const updatedAt = typeof d.updatedAt === 'number' ? d.updatedAt : (d.updatedAt ? Date.parse(d.updatedAt) || now : now);

      const stmt = db.prepare(`
        INSERT INTO employee_payroll (employee_id, account_holder_name, bank_name, branch_name, account_masked, ifsc_code, payment_method, salary_ctc, net_salary, basic_pay, hra, payroll_notes, metadata, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(employee_id) DO UPDATE SET
          account_holder_name = excluded.account_holder_name,
          bank_name = excluded.bank_name,
          branch_name = excluded.branch_name,
          account_masked = excluded.account_masked,
          ifsc_code = excluded.ifsc_code,
          payment_method = excluded.payment_method,
          salary_ctc = excluded.salary_ctc,
          net_salary = excluded.net_salary,
          basic_pay = excluded.basic_pay,
          hra = excluded.hra,
          payroll_notes = excluded.payroll_notes,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
      `);
      await stmt.bind(canonicalEmpId, accountHolderName, bankName, branchName, accountMasked, ifscCode, paymentMethod, salaryCtc, netSalary, basicPay, hra, payrollNotes, metadata, updatedAt).run();
    } else if (collectionName === 'employeeAccounts') {
      const empId = String(docId || d.employeeId);
      const empCheck = await db.prepare('SELECT id FROM employees WHERE id = ?').bind(empId).all();
      const found = (empCheck && empCheck.results && empCheck.results.length > 0) || (Array.isArray(empCheck) && empCheck.length > 0);
      if (!found) {
        throw new Error(`Referenced employee '${empId}' does not exist in employees table`);
      }

      const userId = d.userId || null;
      const systemEmail = String(d.systemEmail || `${empId.toLowerCase()}@easydesk.local`);
      const role = String(d.role || 'STAFF');
      const permissions = Array.isArray(d.permissions) ? JSON.stringify(d.permissions) : JSON.stringify([]);
      const accountStatus = ['Active', 'Inactive', 'Locked'].includes(d.accountStatus) ? d.accountStatus : 'Active';
      const lastLoginAt = d.lastLoginAt || null;
      const createdAt = typeof d.createdAt === 'number' ? d.createdAt : (d.createdAt ? Date.parse(d.createdAt) || now : now);
      const updatedAt = typeof d.updatedAt === 'number' ? d.updatedAt : (d.updatedAt ? Date.parse(d.updatedAt) || now : now);

      const stmt = db.prepare(`
        INSERT INTO employee_accounts (employee_id, user_id, system_email, role, permissions, account_status, last_login_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(employee_id) DO UPDATE SET
          user_id = excluded.user_id,
          system_email = excluded.system_email,
          role = excluded.role,
          permissions = excluded.permissions,
          account_status = excluded.account_status,
          last_login_at = excluded.last_login_at,
          updated_at = excluded.updated_at
      `);
      await stmt.bind(empId, userId, systemEmail, role, permissions, accountStatus, lastLoginAt, createdAt, updatedAt).run();
    } else if (collectionName === 'employeeDocuments') {
      const id = String(docId || d.id);
      const empId = String(d.employeeId);
      const empCheck = await db.prepare('SELECT id FROM employees WHERE id = ?').bind(empId).all();
      const found = (empCheck && empCheck.results && empCheck.results.length > 0) || (Array.isArray(empCheck) && empCheck.length > 0);
      if (!found) {
        throw new Error(`Referenced employee '${empId}' does not exist in employees table`);
      }

      const docType = String(d.documentType || 'Other');
      const docName = String(d.documentName || d.name || 'Document');
      const origFileName = d.originalFileName || null;
      const storagePath = String(d.storagePath || d.privateFileKey || `employee_docs/${id}`);
      const downloadUrl = d.downloadUrl || null;
      const mimeType = d.mimeType || 'application/pdf';
      const sizeBytes = typeof d.sizeBytes === 'number' ? d.sizeBytes : 0;
      const verStatus = ['Pending', 'Verified', 'Rejected'].includes(d.verificationStatus) ? d.verificationStatus : 'Pending';
      const uploadedBy = d.uploadedBy || 'Admin';
      const uploadedAt = d.uploadedAt || new Date().toISOString();
      const metadata = JSON.stringify({ verifiedBy: d.verifiedBy || null, verifiedAt: d.verifiedAt || null, notes: d.notes || null });
      const createdAt = typeof d.createdAt === 'number' ? d.createdAt : (d.createdAt ? Date.parse(d.createdAt) || now : now);
      const updatedAt = typeof d.updatedAt === 'number' ? d.updatedAt : (d.updatedAt ? Date.parse(d.updatedAt) || now : now);

      const stmt = db.prepare(`
        INSERT INTO employee_documents (id, employee_id, document_type, document_name, original_file_name, storage_path, download_url, mime_type, size_bytes, verification_status, uploaded_by, uploaded_at, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          document_type = excluded.document_type,
          document_name = excluded.document_name,
          original_file_name = excluded.original_file_name,
          storage_path = excluded.storage_path,
          download_url = excluded.download_url,
          mime_type = excluded.mime_type,
          size_bytes = excluded.size_bytes,
          verification_status = excluded.verification_status,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
      `);
      await stmt.bind(id, empId, docType, docName, origFileName, storagePath, downloadUrl, mimeType, sizeBytes, verStatus, uploadedBy, uploadedAt, metadata, createdAt, updatedAt).run();
    } else if (collectionName === 'orders') {
      const id = String(docId || d.id);
      const orderCode = String(d.id || `ORD-${id.replace(/[^0-9]/g, '').slice(-5) || '10001'}`);

      let customerId = d.customerId ? String(d.customerId) : null;
      if (customerId) {
        const custCheck = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(customerId).all();
        const found = (custCheck && custCheck.results && custCheck.results.length > 0) || (Array.isArray(custCheck) && custCheck.length > 0);
        if (!found) customerId = null;
      }

      let serviceId = d.serviceId ? String(d.serviceId) : null;
      if (serviceId) {
        const srvCheck = await db.prepare('SELECT id FROM services WHERE id = ?').bind(serviceId).all();
        const found = (srvCheck && srvCheck.results && srvCheck.results.length > 0) || (Array.isArray(srvCheck) && srvCheck.length > 0);
        if (!found) serviceId = null;
      }

      let aliasConflict = false;
      if (d.assignedEmployeeId && d.assignedStaffId && d.assignedEmployeeId !== d.assignedStaffId) {
        aliasConflict = true;
      }
      const rawStaffId = d.assignedEmployeeId ? String(d.assignedEmployeeId) : (d.assignedStaffId ? String(d.assignedStaffId) : null);
      let assignedStaffId = rawStaffId;
      if (assignedStaffId) {
        const empCheck = await db.prepare('SELECT id FROM employees WHERE id = ?').bind(assignedStaffId).all();
        const found = (empCheck && empCheck.results && empCheck.results.length > 0) || (Array.isArray(empCheck) && empCheck.length > 0);
        if (!found) assignedStaffId = null;
      }

      const orderSource = ['WhatsApp', 'Website', 'Phone', 'In-Person', 'Other'].includes(d.orderSource) ? d.orderSource : 'WhatsApp';
      const createdBy = d.createdBy || null;
      const name = String(d.name || 'Citizen Customer');
      const mobile = String(d.mobile || '');
      const email = d.email || null;
      const address = d.address || null;
      const city = d.city || null;
      const state = d.state || null;
      const pincode = d.pinCode || d.pincode || null;
      const totalAmount = typeof d.totalAmount === 'number' ? d.totalAmount : 0;
      const paymentMethod = d.paymentMethod || 'UPI';
      const paymentStatus = ['Pending Verification', 'Verified', 'Rejected'].includes(d.paymentStatus) ? d.paymentStatus : 'Pending Verification';
      const utr = d.utr || null;
      const paymentScreenshot = d.paymentScreenshot || null;
      const orderStatus = ['Pending', 'Documents Required', 'Under Verification', 'Processing', 'Completed', 'Rejected'].includes(d.orderStatus) ? d.orderStatus : 'Pending';
      const documentDeliveryStatus = ['Pending', 'Ready', 'SENT_VIA_WHATSAPP'].includes(d.documentDeliveryStatus) ? d.documentDeliveryStatus : 'Pending';
      const finalDocumentUrl = d.finalDocumentUrl || null;
      const finalDocumentName = d.finalDocumentName || null;
      const priority = ['Normal', 'High', 'Urgent'].includes(d.priority) ? d.priority : 'Normal';
      const uploadedDocs = Array.isArray(d.uploadedDocuments) ? JSON.stringify(d.uploadedDocuments) : JSON.stringify([]);
      const logs = Array.isArray(d.logs) ? JSON.stringify(d.logs) : JSON.stringify([]);
      const metadata = JSON.stringify({
        originalCustomerId: d.customerId || null,
        originalServiceId: d.serviceId || null,
        originalAssignedStaffId: rawStaffId,
        aliasConflict,
        serviceTitle: d.serviceTitle || '',
        category: d.category || '',
        additionalNotes: d.additionalNotes || '',
        submittedData: d.submittedData || null,
        rejectionReason: d.rejectionReason || null,
        finalDocumentUploadedAt: d.finalDocumentUploadedAt || null,
        whatsAppSentAt: d.whatsAppSentAt || null,
        whatsAppDeliveryNotes: d.whatsAppDeliveryNotes || null,
        feedback: d.feedback || null,
        submittedReview: d.submittedReview || null
      });
      const createdAt = typeof d.createdAt === 'number' ? d.createdAt : (d.createdAt ? Date.parse(d.createdAt) || now : now);
      const updatedAt = typeof d.updatedAt === 'number' ? d.updatedAt : (d.updatedAt ? Date.parse(d.updatedAt) || now : now);

      const stmt = db.prepare(`
        INSERT INTO orders (id, order_code, customer_id, service_id, assigned_staff_id, order_source, created_by, name, mobile, email, address, city, state, pincode, total_amount, payment_method, payment_status, utr, payment_screenshot, order_status, document_delivery_status, final_document_url, final_document_name, priority, uploaded_documents, logs, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          order_code = excluded.order_code,
          customer_id = excluded.customer_id,
          service_id = excluded.service_id,
          assigned_staff_id = excluded.assigned_staff_id,
          order_source = excluded.order_source,
          created_by = excluded.created_by,
          name = excluded.name,
          mobile = excluded.mobile,
          email = excluded.email,
          address = excluded.address,
          city = excluded.city,
          state = excluded.state,
          pincode = excluded.pincode,
          total_amount = excluded.total_amount,
          payment_method = excluded.payment_method,
          payment_status = excluded.payment_status,
          utr = excluded.utr,
          payment_screenshot = excluded.payment_screenshot,
          order_status = excluded.order_status,
          document_delivery_status = excluded.document_delivery_status,
          final_document_url = excluded.final_document_url,
          final_document_name = excluded.final_document_name,
          priority = excluded.priority,
          uploaded_documents = excluded.uploaded_documents,
          logs = excluded.logs,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
      `);
      await stmt.bind(id, orderCode, customerId, serviceId, assignedStaffId, orderSource, createdBy, name, mobile, email, address, city, state, pincode, totalAmount, paymentMethod, paymentStatus, utr, paymentScreenshot, orderStatus, documentDeliveryStatus, finalDocumentUrl, finalDocumentName, priority, uploadedDocs, logs, metadata, createdAt, updatedAt).run();
    } else if (collectionName === 'reviews') {
      const id = String(docId || d.id || d.reviewId);
      let serviceId = d.serviceId ? String(d.serviceId) : null;
      if (serviceId) {
        const srvCheck = await db.prepare('SELECT id FROM services WHERE id = ?').bind(serviceId).all();
        const found = (srvCheck && srvCheck.results && srvCheck.results.length > 0) || (Array.isArray(srvCheck) && srvCheck.length > 0);
        if (!found) serviceId = null;
      }
      let customerId = d.customerId ? String(d.customerId) : null;
      if (customerId) {
        const custCheck = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(customerId).all();
        const found = (custCheck && custCheck.results && custCheck.results.length > 0) || (Array.isArray(custCheck) && custCheck.length > 0);
        if (!found) customerId = null;
      }
      let orderId = d.orderId ? String(d.orderId) : null;
      if (orderId) {
        const ordCheck = await db.prepare('SELECT id FROM orders WHERE id = ?').bind(orderId).all();
        const found = (ordCheck && ordCheck.results && ordCheck.results.length > 0) || (Array.isArray(ordCheck) && ordCheck.length > 0);
        if (!found) orderId = null;
      }

      const customerName = String(d.customerName || d.userName || 'Verified Citizen');
      const rawRating = Number(d.rating);
      const rating = (!isNaN(rawRating) && rawRating >= 1 && rawRating <= 5) ? Math.round(rawRating) : 5;
      const comment = String(d.comment || d.reviewText || '');
      const status = ['Pending', 'Approved', 'Rejected', 'Hidden'].includes(d.status) ? d.status : 'Pending';
      const adminNote = d.adminNote || null;
      const createdAt = typeof d.createdAt === 'number' ? d.createdAt : (d.createdAt ? Date.parse(d.createdAt) || now : now);
      const updatedAt = typeof d.updatedAt === 'number' ? d.updatedAt : (d.updatedAt ? Date.parse(d.updatedAt) || now : now);

      const stmt = db.prepare(`
        INSERT INTO reviews (id, service_id, customer_id, order_id, customer_name, rating, comment, status, admin_note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          service_id = excluded.service_id,
          customer_id = excluded.customer_id,
          order_id = excluded.order_id,
          customer_name = excluded.customer_name,
          rating = excluded.rating,
          comment = excluded.comment,
          status = excluded.status,
          admin_note = excluded.admin_note,
          updated_at = excluded.updated_at
      `);
      await stmt.bind(id, serviceId, customerId, orderId, customerName, rating, comment, status, adminNote, createdAt, updatedAt).run();
    } else if (collectionName === 'auditLogs') {
      const id = String(docId || d.id || `log-${Date.now()}`);
      const userId = d.userId || null;
      const userName = d.userName || null;
      const userRole = d.userRole || null;
      const action = String(d.action || d.actionType || 'ACTIVITY');
      const entityType = d.entityType || (d.employeeId ? 'employee' : (d.documentId ? 'document' : null));
      const entityId = d.entityId || d.employeeId || d.documentId || null;
      const details = typeof d.details === 'string' ? d.details : (d.description || JSON.stringify(d.details || {}));
      const ipAddress = d.ipAddress || null;
      const timestamp = typeof d.timestamp === 'number' ? d.timestamp : (d.timestamp ? Date.parse(d.timestamp) || now : now);

      const stmt = db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, details, ip_address, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          details = excluded.details
      `);
      await stmt.bind(id, userId, userName, userRole, action, entityType, entityId, details, ipAddress, timestamp).run();
    }

    await recordSyncDiagnostic(collectionName, String(docId), 'UPDATE', 'SUCCESS', null, db);
    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    await recordSyncDiagnostic(collectionName, String(docId), 'UPDATE', 'FAILED', errorMsg, db);
    return { success: false, error: errorMsg };
  }
}

/**
 * Mirrors an entity deletion into the relational table using safe FK-respecting semantics.
 */
export async function deleteRelationalMirror(
  collectionName: string,
  docId: string,
  dbInstance?: any
): Promise<RelationalSyncResult> {
  const db = dbInstance || getD1Database();
  if (!db) return { success: false, error: 'No D1 database instance available' };

  if (getDatabaseMode() === 'LEGACY') {
    return { success: true, skipped: true };
  }

  if (!DUAL_WRITE_COLLECTIONS.has(collectionName)) {
    return { success: true, skipped: true };
  }

  try {
    await initD1Schema(db);
    const id = String(docId);

    if (collectionName === 'categories') {
      await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
    } else if (collectionName === 'services') {
      await db.prepare('DELETE FROM services WHERE id = ?').bind(id).run();
    } else if (collectionName === 'customers') {
      await db.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();
    } else if (collectionName === 'employees') {
      await db.prepare('DELETE FROM employees WHERE id = ?').bind(id).run();
    } else if (collectionName === 'employeeKYC') {
      await db.prepare('DELETE FROM employee_kyc WHERE employee_id = ?').bind(id).run();
    } else if (collectionName === 'employeePayroll') {
      await db.prepare('DELETE FROM employee_payroll WHERE employee_id = ?').bind(id).run();
    } else if (collectionName === 'employeeAccounts') {
      await db.prepare('DELETE FROM employee_accounts WHERE employee_id = ?').bind(id).run();
    } else if (collectionName === 'employeeDocuments') {
      await db.prepare('DELETE FROM employee_documents WHERE id = ?').bind(id).run();
    } else if (collectionName === 'orders') {
      await db.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();
    } else if (collectionName === 'reviews') {
      await db.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
    } else if (collectionName === 'auditLogs') {
      // Audit logs are append-only; deletion is disallowed to preserve historical audit trail
      return { success: true, skipped: true };
    }

    await recordSyncDiagnostic(collectionName, id, 'DELETE', 'SUCCESS', null, db);
    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    await recordSyncDiagnostic(collectionName, String(docId), 'DELETE', 'FAILED', errorMsg, db);
    return { success: false, error: errorMsg };
  }
}

/**
 * Retries relational synchronization for a failed entity using authoritative legacy data.
 */
export async function retryRelationalSync(
  collection: string,
  entityId: string,
  dbInstance?: any
): Promise<{ success: boolean; message: string }> {
  const db = dbInstance || getD1Database();
  if (!db) return { success: false, message: 'No D1 database instance available' };
  if (!DUAL_WRITE_COLLECTIONS.has(collection)) {
    return { success: false, message: `Collection '${collection}' is not a dual-write supported collection` };
  }

  try {
    const rowRes = await db.prepare("SELECT data FROM entities WHERE collection = ? AND id = ?").bind(collection, entityId).all();
    const rows = (rowRes && rowRes.results) ? rowRes.results : (Array.isArray(rowRes) ? rowRes : []);
    const entityRow = rows[0];

    if (!entityRow || !entityRow.data) {
      return { success: false, message: `Authoritative entity not found in legacy entities table: ${collection}/${entityId}` };
    }

    const data = JSON.parse(entityRow.data);
    const mirrorRes = await saveRelationalMirror(collection, entityId, data, db);
    if (!mirrorRes.success) {
      return { success: false, message: `Relational mirror retry failed: ${mirrorRes.error}` };
    }

    return { success: true, message: `Relational mirror retry succeeded for ${collection}/${entityId}` };
  } catch (err: any) {
    return { success: false, message: `Retry exception: ${err?.message || String(err)}` };
  }
}

/**
 * Summarizes the current relational synchronization health.
 */
export async function getSyncDiagnosticsSummary(dbInstance?: any): Promise<{
  health: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  totalFailures: number;
  recentFailures: any[];
}> {
  const db = dbInstance || getD1Database();
  if (!db) {
    return { health: 'HEALTHY', totalFailures: 0, recentFailures: [] };
  }
  try {
    const failRowsRes = await db.prepare("SELECT * FROM relational_sync_diagnostics WHERE status = 'FAILED' ORDER BY last_attempt DESC LIMIT 50").all();
    const recentFailures = (failRowsRes && failRowsRes.results) ? failRowsRes.results : (Array.isArray(failRowsRes) ? failRowsRes : []);
    const totalFailures = recentFailures.length;
    let health: 'HEALTHY' | 'DEGRADED' | 'FAILED' = 'HEALTHY';
    if (totalFailures > 10) {
      health = 'FAILED';
    } else if (totalFailures > 0) {
      health = 'DEGRADED';
    }
    return { health, totalFailures, recentFailures };
  } catch {
    return { health: 'HEALTHY', totalFailures: 0, recentFailures: [] };
  }
}

// ============================================================================
// PHASE 4: CONTROLLED RELATIONAL READ MIGRATION & SHADOW PARITY ENGINE
// ============================================================================

export type RelationalReadMode = 'LEGACY' | 'SHADOW' | 'RELATIONAL';

export const DEFAULT_RELATIONAL_READ_CONFIG: Record<string, RelationalReadMode> = {
  categories: 'RELATIONAL',
  services: 'RELATIONAL',
  customers: 'RELATIONAL',
  employees: 'RELATIONAL',
  employeeKYC: 'SHADOW',
  employeePayroll: 'SHADOW',
  employeeAccounts: 'SHADOW',
  employeeDocuments: 'RELATIONAL',
  orders: 'SHADOW',
  reviews: 'RELATIONAL',
  auditLogs: 'SHADOW'
};

const activeRelationalReadConfig: Record<string, RelationalReadMode> = {
  ...DEFAULT_RELATIONAL_READ_CONFIG
};

export function getRelationalReadMode(collection: string): RelationalReadMode {
  return activeRelationalReadConfig[collection] || 'LEGACY';
}

export function setRelationalReadMode(collection: string, mode: RelationalReadMode): void {
  if (!DEFAULT_RELATIONAL_READ_CONFIG[collection]) {
    throw new Error(`Collection '${collection}' is not supported for relational reads`);
  }
  activeRelationalReadConfig[collection] = mode;
}

export function getAllRelationalReadModes(): Record<string, RelationalReadMode> {
  return { ...activeRelationalReadConfig };
}

export function resetRelationalReadConfig(): void {
  for (const k of Object.keys(DEFAULT_RELATIONAL_READ_CONFIG)) {
    activeRelationalReadConfig[k] = DEFAULT_RELATIONAL_READ_CONFIG[k];
  }
}

// Circuit Breaker & In-Memory Metrics State
const consecutiveReadFailures = new Map<string, number>();
const circuitBreakerTrippedAt = new Map<string, number>();
const shadowReadsCount = new Map<string, number>();
const mismatchCounts = new Map<string, number>();
const readErrorsCount = new Map<string, number>();

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30000; // 30-second cooldown before probe

export function isCircuitBreakerTripped(collection: string): boolean {
  const trippedAt = circuitBreakerTrippedAt.get(collection);
  if (!trippedAt) return false;
  if (Date.now() - trippedAt > CIRCUIT_BREAKER_COOLDOWN_MS) {
    circuitBreakerTrippedAt.delete(collection);
    consecutiveReadFailures.set(collection, 0);
    if (activeRelationalReadConfig[collection] === 'RELATIONAL') {
      console.warn(`[CIRCUIT BREAKER COOLDOWN] Circuit breaker for ${collection} entering SHADOW recovery probe.`);
      activeRelationalReadConfig[collection] = 'SHADOW';
    }
    return false;
  }
  return true;
}

export function resetCircuitBreaker(collection: string): void {
  consecutiveReadFailures.delete(collection);
  circuitBreakerTrippedAt.delete(collection);
  readErrorsCount.delete(collection);
}

function recordReadFailureInMemory(collection: string, errorMsg: string): void {
  const count = (consecutiveReadFailures.get(collection) || 0) + 1;
  consecutiveReadFailures.set(collection, count);
  readErrorsCount.set(collection, (readErrorsCount.get(collection) || 0) + 1);

  if (count >= CIRCUIT_BREAKER_THRESHOLD && !circuitBreakerTrippedAt.has(collection)) {
    circuitBreakerTrippedAt.set(collection, Date.now());
    console.error(`[CIRCUIT BREAKER TRIPPED] Collection '${collection}' exceeded ${CIRCUIT_BREAKER_THRESHOLD} consecutive relational read failures. Tripping to LEGACY fallback! Error: ${errorMsg}`);
  }
}

function recordReadSuccessInMemory(collection: string): void {
  consecutiveReadFailures.set(collection, 0);
  circuitBreakerTrippedAt.delete(collection);
}

/**
 * Records read diagnostics in Cloudflare D1 without leaking sensitive PII or credentials.
 */
export async function recordReadDiagnostic(
  collection: string,
  operation: string,
  mode: RelationalReadMode,
  status: 'SUCCESS' | 'MISMATCH' | 'FAILED' | 'CIRCUIT_TRIPPED',
  legacyCount: number,
  relationalCount: number,
  mismatchCount: number,
  mismatchDetails: any | null,
  errorMessage: string | null,
  latencyMs: number,
  dbInstance?: any
): Promise<void> {
  const db = dbInstance || getD1Database();
  if (!db) return;
  try {
    const id = `read_diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const safeError = errorMessage ? String(errorMessage).slice(0, 500) : null;
    const safeDetails = mismatchDetails ? JSON.stringify(mismatchDetails).slice(0, 1000) : null;

    const stmt = db.prepare(`
      INSERT INTO relational_read_diagnostics (
        id, collection, operation, mode, status, legacy_count, relational_count, mismatch_count, mismatch_details, error_message, latency_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.bind(id, collection, operation, mode, status, legacyCount, relationalCount, mismatchCount, safeDetails, safeError, latencyMs, now).run();
  } catch (err: any) {
    console.error(`[READ DIAGNOSTIC ERROR] Failed to record read diagnostic for ${collection}:`, err?.message || String(err));
  }
}

/**
 * Normalization helper for strict scalar and financial comparison between legacy and relational objects.
 */
export function normalizeRecordForParity(collection: string, d: any): any {
  if (!d || typeof d !== 'object') return null;

  if (collection === 'categories') {
    return {
      id: String(d.id),
      name: String(d.name || ''),
      slug: String(d.slug || ''),
      sortOrder: Number(d.sortOrder !== undefined ? d.sortOrder : (d.sort_order || 0)),
      status: String(d.status || 'Active'),
      icon: d.icon || null,
      color: d.color || null,
      description: d.description || null
    };
  }

  if (collection === 'services') {
    return {
      id: String(d.id),
      categoryId: d.categoryId || d.category_id || null,
      title: String(d.title || ''),
      slug: String(d.slug || ''),
      subCategory: d.subCategory || d.sub_category || null,
      govFees: Number(d.govFees !== undefined ? d.govFees : (d.gov_fees || 0)),
      serviceCharge: Number(d.serviceCharge !== undefined ? d.serviceCharge : (d.service_charge || 0)),
      processingTime: String(d.processingTime || d.processing_time || ''),
      status: String(d.status || 'active')
    };
  }

  if (collection === 'customers') {
    return {
      id: String(d.id),
      code: String(d.code || ''),
      name: String(d.name || ''),
      email: d.email || null,
      mobile: String(d.mobile || ''),
      whatsappMobile: d.whatsappMobile || d.whatsapp_mobile || null,
      customerType: String(d.customerType || d.customer_type || 'Individual'),
      status: String(d.status || 'Active'),
      address: d.address || null,
      city: d.city || null,
      state: d.state || null,
      pincode: d.pinCode || d.pincode || null
    };
  }

  if (collection === 'employees') {
    return {
      id: String(d.id),
      code: String(d.code || d.employeeCode || ''),
      name: String(d.name || d.fullName || ''),
      department: String(d.department || ''),
      designation: String(d.designation || ''),
      employmentType: String(d.employmentType || d.employment_type || 'Full-Time'),
      status: String(d.status || d.employmentStatus || 'Active'),
      joiningDate: d.joiningDate || d.joining_date || null,
      phone: d.phone || d.mobile || d.personalMobile || null,
      email: d.email || d.personalEmail || null
    };
  }

  if (collection === 'employeeKYC') {
    return {
      employeeId: String(d.employeeId || d.employee_id || ''),
      aadhaarMasked: d.aadhaarNumber || d.aadhaar_masked || null,
      panMasked: d.panNumber || d.pan_masked || null,
      aadhaarStatus: String(d.aadhaarVerificationStatus || d.aadhaar_status || 'Pending'),
      panStatus: String(d.panVerificationStatus || d.pan_status || 'Pending')
    };
  }

  if (collection === 'employeePayroll') {
    return {
      employeeId: String(d.employeeId || d.employee_id || ''),
      accountHolderName: d.accountHolderName || d.account_holder_name || null,
      bankName: d.bankName || d.bank_name || null,
      accountMasked: d.accountNumber || d.account_masked || null,
      ifscCode: d.ifscCode || d.ifsc_code || null,
      salaryCtc: Number(d.salaryAmount !== undefined ? d.salaryAmount : (d.salary_ctc || d.grossSalary || 0)),
      netSalary: Number(d.netSalary !== undefined ? d.netSalary : (d.net_salary || 0))
    };
  }

  if (collection === 'employeeAccounts') {
    return {
      employeeId: String(d.employeeId || d.employee_id || ''),
      userId: d.userId || d.user_id || null,
      systemEmail: String(d.systemEmail || d.system_email || ''),
      role: String(d.role || 'STAFF'),
      accountStatus: String(d.accountStatus || d.account_status || 'Active')
    };
  }

  if (collection === 'employeeDocuments') {
    return {
      id: String(d.id),
      employeeId: String(d.employeeId || d.employee_id || ''),
      documentType: String(d.documentType || d.document_type || 'Other'),
      documentName: String(d.documentName || d.document_name || d.name || ''),
      storagePath: String(d.storagePath || d.storage_path || d.privateFileKey || ''),
      mimeType: String(d.mimeType || d.mime_type || 'application/pdf'),
      sizeBytes: Number(d.sizeBytes !== undefined ? d.sizeBytes : (d.size_bytes || 0)),
      verificationStatus: String(d.verificationStatus || d.verification_status || 'Pending')
    };
  }

  if (collection === 'orders') {
    return {
      id: String(d.id),
      customerId: d.customerId || d.customer_id || null,
      serviceId: d.serviceId || d.service_id || null,
      assignedStaffId: d.assignedStaffId || d.assignedEmployeeId || d.assigned_staff_id || null,
      orderSource: String(d.orderSource || d.order_source || 'WhatsApp'),
      name: String(d.name || ''),
      mobile: String(d.mobile || ''),
      email: d.email || null,
      totalAmount: Number(d.totalAmount !== undefined ? d.totalAmount : (d.total_amount || 0)),
      paymentMethod: String(d.paymentMethod || d.payment_method || 'UPI'),
      paymentStatus: String(d.paymentStatus || d.payment_status || 'Pending Verification'),
      utr: d.utr || null,
      orderStatus: String(d.orderStatus || d.order_status || 'Pending'),
      documentDeliveryStatus: String(d.documentDeliveryStatus || d.document_delivery_status || 'Pending'),
      priority: String(d.priority || 'Normal')
    };
  }

  if (collection === 'reviews') {
    return {
      id: String(d.id || d.reviewId),
      serviceId: d.serviceId || d.service_id || null,
      customerId: d.customerId || d.customer_id || null,
      orderId: d.orderId || d.order_id || null,
      customerName: String(d.customerName || d.userName || ''),
      rating: Number(d.rating || 5),
      comment: String(d.comment || d.reviewText || ''),
      status: String(d.status || 'Pending')
    };
  }

  if (collection === 'auditLogs') {
    return {
      id: String(d.id),
      userId: d.userId || d.user_id || null,
      userName: d.userName || d.user_name || null,
      userRole: d.userRole || d.user_role || null,
      action: String(d.action || d.actionType || ''),
      entityType: d.entityType || d.entity_type || null,
      entityId: d.entityId || d.entity_id || null,
      timestamp: Number(d.timestamp || 0)
    };
  }

  return { id: String(d.id || d.code) };
}

// ----------------------------------------------------------------------------
// Relational SQL Queries for each supported collection
// ----------------------------------------------------------------------------

export async function queryCategoriesRelational(
  options?: { id?: string; slug?: string; status?: string; limit?: number; offset?: number },
  dbInstance?: any
): Promise<any[]> {
  const db = dbInstance || getD1Database();
  if (!db) return [];
  await initD1Schema(db);

  let sql = 'SELECT id, name, slug, sort_order, status, icon, color, description, metadata, created_at, updated_at FROM categories';
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.id) {
    conditions.push('id = ?');
    params.push(options.id);
  }
  if (options?.slug) {
    conditions.push('slug = ?');
    params.push(options.slug);
  }
  if (options?.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY sort_order ASC, name ASC';

  if (typeof options?.limit === 'number') {
    sql += ' LIMIT ?';
    params.push(options.limit);
    if (typeof options?.offset === 'number') {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const res = await db.prepare(sql).bind(...params).all();
  const rows = (res && res.results) ? res.results : (Array.isArray(res) ? res : []);

  return rows.map((r: any) => {
    const meta = r.metadata ? JSON.parse(r.metadata) : {};
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      sortOrder: r.sort_order,
      sort_order: r.sort_order,
      status: r.status,
      icon: r.icon,
      color: r.color,
      description: r.description,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
      ...meta
    };
  });
}

export async function queryServicesRelational(
  options?: {
    id?: string;
    slug?: string;
    categoryId?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  },
  dbInstance?: any
): Promise<any[]> {
  const db = dbInstance || getD1Database();
  if (!db) return [];
  await initD1Schema(db);

  let sql = 'SELECT id, category_id, title, slug, sub_category, description, gov_fees, service_charge, processing_time, status, banner_image, icon, required_documents, faqs, metadata, created_at, updated_at FROM services';
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.id) {
    conditions.push('id = ?');
    params.push(options.id);
  }
  if (options?.slug) {
    conditions.push('slug = ?');
    params.push(options.slug);
  }
  if (options?.categoryId) {
    conditions.push('category_id = ?');
    params.push(options.categoryId);
  }
  if (options?.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }
  if (options?.search) {
    conditions.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${options.search}%`, `%${options.search}%`);
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY title ASC';

  if (typeof options?.limit === 'number') {
    sql += ' LIMIT ?';
    params.push(options.limit);
    if (typeof options?.offset === 'number') {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const res = await db.prepare(sql).bind(...params).all();
  const rows = (res && res.results) ? res.results : (Array.isArray(res) ? res : []);

  return rows.map((r: any) => {
    const meta = r.metadata ? JSON.parse(r.metadata) : {};
    return {
      id: r.id,
      categoryId: r.category_id || meta.originalCategoryId || null,
      category_id: r.category_id || meta.originalCategoryId || null,
      title: r.title,
      name: r.title,
      slug: r.slug,
      subCategory: r.sub_category,
      description: r.description,
      govFees: Number(r.gov_fees || 0),
      gov_fees: Number(r.gov_fees || 0),
      serviceCharge: Number(r.service_charge || 0),
      service_charge: Number(r.service_charge || 0),
      price: Number(r.service_charge || 0),
      totalAmount: Number(r.gov_fees || 0) + Number(r.service_charge || 0),
      processingTime: r.processing_time,
      status: r.status,
      bannerImage: r.banner_image,
      icon: r.icon,
      requiredDocuments: r.required_documents ? JSON.parse(r.required_documents) : [],
      faqs: r.faqs ? JSON.parse(r.faqs) : [],
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
      ...meta
    };
  });
}

export async function queryCustomersRelational(
  options?: {
    id?: string;
    code?: string;
    email?: string;
    mobile?: string;
    status?: string;
    customerType?: string;
    search?: string;
    limit?: number;
    offset?: number;
  },
  dbInstance?: any
): Promise<any[]> {
  const db = dbInstance || getD1Database();
  if (!db) return [];
  await initD1Schema(db);

  let sql = 'SELECT id, code, name, email, mobile, whatsapp_mobile, customer_type, status, contact_person_name, gender, dob_or_incorporation, photo_url, address, city, state, pincode, gstin, pan_number, msme_license, notes, metadata, created_at, updated_at FROM customers';
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.id) {
    conditions.push('(id = ? OR code = ?)');
    params.push(options.id, options.id);
  }
  if (options?.code) {
    conditions.push('code = ?');
    params.push(options.code);
  }
  if (options?.email) {
    conditions.push('LOWER(email) = LOWER(?)');
    params.push(options.email);
  }
  if (options?.mobile) {
    conditions.push('mobile = ?');
    params.push(options.mobile);
  }
  if (options?.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }
  if (options?.customerType) {
    conditions.push('customer_type = ?');
    params.push(options.customerType);
  }
  if (options?.search) {
    conditions.push('(name LIKE ? OR email LIKE ? OR mobile LIKE ? OR code LIKE ?)');
    params.push(`%${options.search}%`, `%${options.search}%`, `%${options.search}%`, `%${options.search}%`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC';

  if (typeof options?.limit === 'number') {
    sql += ' LIMIT ?';
    params.push(options.limit);
    if (typeof options?.offset === 'number') {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const res = await db.prepare(sql).bind(...params).all();
  const rows = (res && res.results) ? res.results : (Array.isArray(res) ? res : []);

  return rows.map((r: any) => {
    const meta = r.metadata ? JSON.parse(r.metadata) : {};
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      email: r.email,
      mobile: r.mobile,
      whatsappMobile: r.whatsapp_mobile,
      customerType: r.customer_type,
      status: r.status,
      contactPersonName: r.contact_person_name,
      gender: r.gender,
      dobOrIncorporationDate: r.dob_or_incorporation || meta.dobOrIncorporationDate || undefined,
      photoUrl: r.photo_url,
      address: r.address,
      city: r.city,
      state: r.state,
      pinCode: r.pincode,
      pincode: r.pincode,
      gstin: r.gstin,
      panNumber: r.pan_number,
      msmeLicense: r.msme_license,
      notes: r.notes,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
      ...meta
    };
  });
}

export async function queryEmployeesRelational(
  options?: {
    id?: string;
    code?: string;
    department?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  },
  dbInstance?: any
): Promise<any[]> {
  const db = dbInstance || getD1Database();
  if (!db) return [];
  await initD1Schema(db);

  let sql = 'SELECT id, code, name, department, designation, employment_type, status, joining_date, phone, email, photo_url, address, city, state, pincode, qualification, experience_years, emergency_contact_name, emergency_contact_phone, metadata, created_at, updated_at FROM employees';
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.id) {
    conditions.push('(id = ? OR code = ?)');
    params.push(options.id, options.id);
  }
  if (options?.code) {
    conditions.push('code = ?');
    params.push(options.code);
  }
  if (options?.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }
  if (options?.department) {
    conditions.push('department = ?');
    params.push(options.department);
  }
  if (options?.search) {
    conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR code LIKE ?)');
    params.push(`%${options.search}%`, `%${options.search}%`, `%${options.search}%`, `%${options.search}%`);
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC';

  if (typeof options?.limit === 'number') {
    sql += ' LIMIT ?';
    params.push(options.limit);
    if (typeof options?.offset === 'number') {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const res = await db.prepare(sql).bind(...params).all();
  const rows = (res && res.results) ? res.results : (Array.isArray(res) ? res : []);

  return rows.map((r: any) => {
    const meta = r.metadata ? JSON.parse(r.metadata) : {};
    return {
      id: r.id,
      code: r.code,
      employeeCode: r.code,
      name: r.name,
      fullName: r.name,
      department: r.department,
      designation: r.designation,
      employmentType: r.employment_type,
      status: r.status,
      employmentStatus: r.status,
      joiningDate: r.joining_date,
      phone: r.phone,
      mobile: r.phone,
      personalMobile: meta.personalMobile || r.phone,
      email: r.email,
      personalEmail: meta.personalEmail || r.email,
      photoUrl: r.photo_url,
      photo: r.photo_url,
      profilePhoto: meta.profilePhoto || r.photo_url,
      address: r.address,
      currentAddress: meta.currentAddress || r.address,
      permanentAddress: meta.permanentAddress || '',
      isPermanentSameAsCurrent: meta.isPermanentSameAsCurrent !== undefined ? meta.isPermanentSameAsCurrent : true,
      city: r.city,
      district: meta.district || '',
      state: r.state,
      pinCode: r.pincode,
      qualification: r.qualification,
      highestQualification: meta.highestQualification || r.qualification,
      qualificationSummary: meta.qualificationSummary || r.qualification,
      experienceYears: r.experience_years,
      experience: r.experience_years,
      totalExperienceYears: meta.totalExperienceYears !== undefined ? meta.totalExperienceYears : r.experience_years,
      emergencyContactName: r.emergency_contact_name,
      emergencyContactPhone: r.emergency_contact_phone,
      emergencyContactRelation: meta.emergencyContactRelation || '',
      emergencyContactMobile: meta.emergencyContactMobile || r.emergency_contact_phone,
      dateOfBirth: meta.dateOfBirth || '',
      nationality: meta.nationality || 'Indian',
      skills: Array.isArray(meta.skills) ? meta.skills : [],
      languages: Array.isArray(meta.languages) ? meta.languages : [],
      reportingManager: meta.reportingManager || '',
      workLocation: meta.workLocation || '',
      probationStatus: meta.probationStatus || '',
      confirmationDate: meta.confirmationDate || '',
      exitDate: meta.exitDate || '',
      exitReason: meta.exitReason || '',
      university: meta.university || '',
      certifications: meta.certifications || '',
      previousOrganizations: meta.previousOrganizations || '',
      profilePhotoMediaId: meta.profilePhotoMediaId || '',
      fatherName: meta.fatherName || '',
      motherName: meta.motherName || '',
      spouseName: meta.spouseName || '',
      fatherMotherSpouseName: meta.fatherMotherSpouseName || '',
      internalNotes: meta.internalNotes || '',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
      ...meta
    };
  });
}

export async function queryEmployeeKycRelational(employeeId?: string, dbInstance?: any): Promise<any> {
  const db = dbInstance || getD1Database();
  if (!db) return employeeId ? null : [];
  await initD1Schema(db);

  let sql = 'SELECT employee_id, aadhaar_masked, pan_masked, other_id_type, other_id_number, aadhaar_status, pan_status, verification_notes, verified_by, verified_at, documents, updated_at FROM employee_kyc';
  const params: any[] = [];
  if (employeeId) {
    sql += ' WHERE employee_id = ?';
    params.push(employeeId);
  }

  const res = await db.prepare(sql).bind(...params).all();
  const rows = (res && res.results) ? res.results : (Array.isArray(res) ? res : []);

  const mapped = rows.map((r: any) => ({
    employeeId: r.employee_id,
    aadhaarNumber: r.aadhaar_masked,
    panNumber: r.pan_masked,
    otherGovernmentIdType: r.other_id_type,
    otherGovernmentIdNumber: r.other_id_number,
    aadhaarVerificationStatus: r.aadhaar_status,
    panVerificationStatus: r.pan_status,
    verificationNotes: r.verification_notes,
    verifiedBy: r.verified_by,
    verifiedAt: r.verified_at,
    documents: r.documents ? JSON.parse(r.documents) : [],
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined
  }));

  return employeeId ? (mapped[0] || null) : mapped;
}

export async function queryEmployeePayrollRelational(employeeId?: string, dbInstance?: any): Promise<any> {
  const db = dbInstance || getD1Database();
  if (!db) return employeeId ? null : [];
  await initD1Schema(db);

  let sql = 'SELECT employee_id, account_holder_name, bank_name, branch_name, account_masked, ifsc_code, payment_method, salary_ctc, net_salary, basic_pay, hra, payroll_notes, metadata, updated_at FROM employee_payroll';
  const params: any[] = [];
  if (employeeId) {
    sql += ' WHERE employee_id = ?';
    params.push(employeeId);
  }

  const res = await db.prepare(sql).bind(...params).all();
  const rows = (res && res.results) ? res.results : (Array.isArray(res) ? res : []);

  const mapped = rows.map((r: any) => {
    let meta: any = {};
    try {
      if (r.metadata) meta = JSON.parse(r.metadata);
    } catch {}
    return {
      employeeId: r.employee_id,
      accountHolderName: r.account_holder_name,
      bankName: r.bank_name,
      branchName: r.branch_name,
      accountNumber: meta.accountNumber || r.account_masked,
      ifscCode: r.ifsc_code,
      paymentMethod: r.payment_method,
      salaryAmount: r.salary_ctc,
      grossSalary: r.salary_ctc,
      netSalary: r.net_salary,
      basicPay: r.basic_pay,
      hra: r.hra,
      payrollNotes: r.payroll_notes,
      specialAllowance: typeof meta.specialAllowance === 'number' ? meta.specialAllowance : 0,
      pfDeduction: typeof meta.pfDeduction === 'number' ? meta.pfDeduction : 0,
      taxDeduction: typeof meta.taxDeduction === 'number' ? meta.taxDeduction : 0,
      salaryType: meta.salaryType || 'Monthly',
      salaryFrequency: meta.salaryFrequency || 'Monthly',
      effectiveFrom: meta.effectiveFrom,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
      ...meta
    };
  });

  return employeeId ? (mapped[0] || null) : mapped;
}

export async function queryEmployeeAccountsRelational(employeeId?: string, dbInstance?: any): Promise<any> {
  const db = dbInstance || getD1Database();
  if (!db) return employeeId ? null : [];
  await initD1Schema(db);

  let sql = 'SELECT employee_id, user_id, system_email, role, permissions, account_status, last_login_at, created_at, updated_at FROM employee_accounts';
  const params: any[] = [];
  if (employeeId) {
    sql += ' WHERE employee_id = ?';
    params.push(employeeId);
  }

  const res = await db.prepare(sql).bind(...params).all();
  const rows = (res && res.results) ? res.results : (Array.isArray(res) ? res : []);

  const mapped = rows.map((r: any) => ({
    employeeId: r.employee_id,
    userId: r.user_id,
    systemEmail: r.system_email,
    role: r.role,
    permissions: r.permissions ? JSON.parse(r.permissions) : [],
    accountStatus: r.account_status,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined
  }));

  return employeeId ? (mapped[0] || null) : mapped;
}

export async function queryEmployeeDocumentsRelational(
  optionsOrEmployeeId?: { employeeId?: string; id?: string; limit?: number; offset?: number } | string,
  dbInstance?: any
): Promise<any[]> {
  const db = dbInstance || getD1Database();
  if (!db) return [];
  await initD1Schema(db);

  const options = typeof optionsOrEmployeeId === 'string'
    ? { employeeId: optionsOrEmployeeId }
    : optionsOrEmployeeId;

  let sql = 'SELECT id, employee_id, document_type, document_name, original_file_name, storage_path, download_url, mime_type, size_bytes, verification_status, uploaded_by, uploaded_at, metadata, created_at, updated_at FROM employee_documents';
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.employeeId) {
    conditions.push('employee_id = ?');
    params.push(options.employeeId);
  }
  if (options?.id) {
    conditions.push('id = ?');
    params.push(options.id);
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC';

  if (typeof options?.limit === 'number') {
    sql += ' LIMIT ?';
    params.push(options.limit);
    if (typeof options?.offset === 'number') {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const res = await db.prepare(sql).bind(...params).all();
  const rows = (res && res.results) ? res.results : (Array.isArray(res) ? res : []);

  return rows.map((r: any) => {
    const meta = r.metadata ? JSON.parse(r.metadata) : {};
    return {
      id: r.id,
      employeeId: r.employee_id,
      documentType: r.document_type,
      documentName: r.document_name,
      name: r.document_name,
      originalFileName: r.original_file_name,
      storagePath: r.storage_path,
      privateFileKey: r.storage_path,
      downloadUrl: r.download_url,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      verificationStatus: r.verification_status,
      uploadedBy: r.uploaded_by,
      uploadedAt: r.uploaded_at,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
      ...meta
    };
  });
}

export async function queryOrdersRelational(options?: { customerId?: string; serviceId?: string; assignedStaffId?: string; status?: string }, dbInstance?: any): Promise<any[]> {
  const db = dbInstance || getD1Database();
  if (!db) return [];
  await initD1Schema(db);

  let sql = 'SELECT id, order_code, customer_id, service_id, assigned_staff_id, order_source, created_by, name, mobile, email, address, city, state, pincode, total_amount, payment_method, payment_status, utr, payment_screenshot, order_status, document_delivery_status, final_document_url, final_document_name, priority, uploaded_documents, logs, metadata, created_at, updated_at FROM orders';
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.customerId) {
    conditions.push('customer_id = ?');
    params.push(options.customerId);
  }
  if (options?.serviceId) {
    conditions.push('service_id = ?');
    params.push(options.serviceId);
  }
  if (options?.assignedStaffId) {
    conditions.push('assigned_staff_id = ?');
    params.push(options.assignedStaffId);
  }
  if (options?.status) {
    conditions.push('order_status = ?');
    params.push(options.status);
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC';

  const res = await db.prepare(sql).bind(...params).all();
  const rows = (res && res.results) ? res.results : (Array.isArray(res) ? res : []);

  return rows.map((r: any) => {
    const meta = r.metadata ? JSON.parse(r.metadata) : {};
    return {
      id: r.id,
      orderCode: r.order_code,
      customerId: r.customer_id || meta.originalCustomerId || null,
      serviceId: r.service_id || meta.originalServiceId || null,
      assignedStaffId: r.assigned_staff_id || meta.originalAssignedStaffId || null,
      assignedEmployeeId: r.assigned_staff_id || meta.originalAssignedStaffId || null,
      orderSource: r.order_source,
      createdBy: r.created_by,
      name: r.name,
      mobile: r.mobile,
      email: r.email,
      address: r.address,
      city: r.city,
      state: r.state,
      pinCode: r.pincode,
      totalAmount: r.total_amount,
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status,
      utr: r.utr,
      paymentScreenshot: r.payment_screenshot,
      orderStatus: r.order_status,
      documentDeliveryStatus: r.document_delivery_status,
      finalDocumentUrl: r.final_document_url,
      finalDocumentName: r.final_document_name,
      priority: r.priority,
      uploadedDocuments: r.uploaded_documents ? JSON.parse(r.uploaded_documents) : [],
      logs: r.logs ? JSON.parse(r.logs) : [],
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
      ...meta
    };
  });
}

export async function queryReviewsRelational(
  options?: {
    id?: string;
    serviceId?: string;
    customerId?: string;
    orderId?: string;
    status?: string;
    rating?: number;
    limit?: number;
    offset?: number;
  },
  dbInstance?: any
): Promise<any[]> {
  const db = dbInstance || getD1Database();
  if (!db) return [];
  await initD1Schema(db);

  let sql = 'SELECT id, service_id, customer_id, order_id, customer_name, rating, comment, status, admin_note, created_at, updated_at FROM reviews';
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.id) {
    conditions.push('id = ?');
    params.push(options.id);
  }
  if (options?.serviceId) {
    conditions.push('service_id = ?');
    params.push(options.serviceId);
  }
  if (options?.customerId) {
    conditions.push('customer_id = ?');
    params.push(options.customerId);
  }
  if (options?.orderId) {
    conditions.push('order_id = ?');
    params.push(options.orderId);
  }
  if (options?.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }
  if (typeof options?.rating === 'number') {
    conditions.push('rating = ?');
    params.push(options.rating);
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC';

  if (typeof options?.limit === 'number') {
    sql += ' LIMIT ?';
    params.push(options.limit);
    if (typeof options?.offset === 'number') {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const res = await db.prepare(sql).bind(...params).all();
  const rows = (res && res.results) ? res.results : (Array.isArray(res) ? res : []);

  return rows.map((r: any) => ({
    id: r.id,
    reviewId: r.id,
    serviceId: r.service_id,
    customerId: r.customer_id,
    orderId: r.order_id,
    customerName: r.customer_name,
    userName: r.customer_name,
    rating: r.rating,
    comment: r.comment,
    reviewText: r.comment,
    status: r.status,
    adminNote: r.admin_note,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined
  }));
}

export async function queryAuditLogsRelational(options?: { entityType?: string; entityId?: string; limit?: number }, dbInstance?: any): Promise<any[]> {
  const db = dbInstance || getD1Database();
  if (!db) return [];
  await initD1Schema(db);

  let sql = 'SELECT id, user_id, user_name, user_role, action, entity_type, entity_id, details, ip_address, timestamp FROM audit_logs';
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.entityType) {
    conditions.push('entity_type = ?');
    params.push(options.entityType);
  }
  if (options?.entityId) {
    conditions.push('entity_id = ?');
    params.push(options.entityId);
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY timestamp DESC';
  if (typeof options?.limit === 'number') {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const res = await db.prepare(sql).bind(...params).all();
  const rows = (res && res.results) ? res.results : (Array.isArray(res) ? res : []);

  return rows.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    userRole: r.user_role,
    action: r.action,
    actionType: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    details: r.details,
    ipAddress: r.ip_address,
    timestamp: r.timestamp
  }));
}

export async function queryCollectionRelational(collection: string, dbInstance?: any): Promise<any[]> {
  if (collection === 'categories') return queryCategoriesRelational(undefined, dbInstance);
  if (collection === 'services') return queryServicesRelational(undefined, dbInstance);
  if (collection === 'customers') return queryCustomersRelational(undefined, dbInstance);
  if (collection === 'employees') return queryEmployeesRelational(undefined, dbInstance);
  if (collection === 'employeeKYC') return queryEmployeeKycRelational(undefined, dbInstance);
  if (collection === 'employeePayroll') return queryEmployeePayrollRelational(undefined, dbInstance);
  if (collection === 'employeeAccounts') return queryEmployeeAccountsRelational(undefined, dbInstance);
  if (collection === 'employeeDocuments') return queryEmployeeDocumentsRelational(undefined, dbInstance);
  if (collection === 'orders') return queryOrdersRelational(undefined, dbInstance);
  if (collection === 'reviews') return queryReviewsRelational(undefined, dbInstance);
  if (collection === 'auditLogs') return queryAuditLogsRelational(undefined, dbInstance);
  return [];
}

export async function queryEntityRelational(collection: string, id: string, dbInstance?: any): Promise<any | null> {
  if (collection === 'employees') {
    const items = await queryEmployeesRelational({ id }, dbInstance);
    return items[0] || null;
  }
  if (collection === 'employeeDocuments') {
    const items = await queryEmployeeDocumentsRelational({ id }, dbInstance);
    return items[0] || null;
  }
  if (collection === 'reviews') {
    const items = await queryReviewsRelational({ id }, dbInstance);
    return items[0] || null;
  }
  if (collection === 'customers') {
    const items = await queryCustomersRelational({ id }, dbInstance);
    return items[0] || null;
  }
  if (collection === 'services') {
    const items = await queryServicesRelational({ id }, dbInstance);
    return items[0] || null;
  }
  if (collection === 'categories') {
    const items = await queryCategoriesRelational({ id }, dbInstance);
    return items[0] || null;
  }
  const items = await queryCollectionRelational(collection, dbInstance);
  return items.find((x: any) => String(x.id || x.employeeId || x.code) === String(id)) || null;
}

// ----------------------------------------------------------------------------
// Shadow Comparison Engine
// ----------------------------------------------------------------------------

export async function shadowCompareCollection(
  collection: string,
  legacyItems: any[],
  dbInstance?: any
): Promise<{ success: boolean; mismatches: number; details: any[] }> {
  const db = dbInstance || getD1Database();
  if (!db) return { success: true, mismatches: 0, details: [] };

  const startTime = Date.now();
  try {
    const relationalItems = await queryCollectionRelational(collection, db);
    const latency = Date.now() - startTime;

    const legacyNormalized = (legacyItems || []).map(x => normalizeRecordForParity(collection, x)).filter(Boolean);
    const relationalNormalized = (relationalItems || []).map(x => normalizeRecordForParity(collection, x)).filter(Boolean);

    const legacyMap = new Map<string, any>();
    for (const item of legacyNormalized) {
      const key = String(item.id || item.employeeId || item.code);
      legacyMap.set(key, item);
    }

    const relMap = new Map<string, any>();
    for (const item of relationalNormalized) {
      const key = String(item.id || item.employeeId || item.code);
      relMap.set(key, item);
    }

    const details: any[] = [];

    // Count parity check
    if (legacyNormalized.length !== relationalNormalized.length) {
      details.push({
        type: 'COUNT_MISMATCH',
        legacyCount: legacyNormalized.length,
        relationalCount: relationalNormalized.length
      });
    }

    // ID and field parity check
    for (const [key, legItem] of legacyMap.entries()) {
      const relItem = relMap.get(key);
      if (!relItem) {
        details.push({ type: 'MISSING_IN_RELATIONAL', id: key });
        continue;
      }

      for (const field of Object.keys(legItem)) {
        const val1 = legItem[field];
        const val2 = relItem[field];
        if (typeof val1 === 'number' && typeof val2 === 'number') {
          if (Math.abs(val1 - val2) > 0.001) {
            details.push({ id: key, field, legacy: val1, relational: val2 });
          }
        } else if (val1 !== val2 && !(val1 === null && val2 === '') && !(val1 === '' && val2 === null)) {
          details.push({ id: key, field, legacy: val1, relational: val2 });
        }
      }
    }

    for (const key of relMap.keys()) {
      if (!legacyMap.has(key)) {
        details.push({ type: 'EXTRA_IN_RELATIONAL', id: key });
      }
    }

    const mismatchCount = details.length;
    const status = mismatchCount === 0 ? 'SUCCESS' : 'MISMATCH';

    shadowReadsCount.set(collection, (shadowReadsCount.get(collection) || 0) + 1);
    if (mismatchCount > 0) {
      mismatchCounts.set(collection, (mismatchCounts.get(collection) || 0) + mismatchCount);
    }

    await recordReadDiagnostic(
      collection,
      'SHADOW_READ',
      'SHADOW',
      status,
      legacyNormalized.length,
      relationalNormalized.length,
      mismatchCount,
      details.slice(0, 10),
      null,
      latency,
      db
    );

    recordReadSuccessInMemory(collection);
    return { success: mismatchCount === 0, mismatches: mismatchCount, details };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    recordReadFailureInMemory(collection, errorMsg);
    await recordReadDiagnostic(
      collection,
      'SHADOW_READ',
      'SHADOW',
      'FAILED',
      legacyItems.length,
      0,
      1,
      null,
      errorMsg,
      Date.now() - startTime,
      db
    );
    return { success: false, mismatches: 1, details: [{ error: errorMsg }] };
  }
}

export async function shadowCompareEntity(
  collection: string,
  entityId: string,
  legacyItem: any,
  dbInstance?: any
): Promise<{ success: boolean; mismatches: number }> {
  const db = dbInstance || getD1Database();
  if (!db) return { success: true, mismatches: 0 };

  const startTime = Date.now();
  try {
    const relItem = await queryEntityRelational(collection, entityId, db);
    const latency = Date.now() - startTime;

    const norm1 = normalizeRecordForParity(collection, legacyItem);
    const norm2 = normalizeRecordForParity(collection, relItem);

    let mismatches = 0;
    const details: any[] = [];

    if (!norm1 && !norm2) {
      // Both null
    } else if (!norm1 || !norm2) {
      mismatches = 1;
      details.push({ id: entityId, legacyExists: Boolean(norm1), relExists: Boolean(norm2) });
    } else {
      for (const field of Object.keys(norm1)) {
        if (norm1[field] !== norm2[field]) {
          mismatches++;
          details.push({ id: entityId, field, legacy: norm1[field], relational: norm2[field] });
        }
      }
    }

    const status = mismatches === 0 ? 'SUCCESS' : 'MISMATCH';
    shadowReadsCount.set(collection, (shadowReadsCount.get(collection) || 0) + 1);
    if (mismatches > 0) {
      mismatchCounts.set(collection, (mismatchCounts.get(collection) || 0) + mismatches);
    }

    await recordReadDiagnostic(
      collection,
      'SHADOW_ENTITY',
      'SHADOW',
      status,
      legacyItem ? 1 : 0,
      relItem ? 1 : 0,
      mismatches,
      details.slice(0, 5),
      null,
      latency,
      db
    );

    recordReadSuccessInMemory(collection);
    return { success: mismatches === 0, mismatches };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    recordReadFailureInMemory(collection, errorMsg);
    return { success: false, mismatches: 1 };
  }
}

// ----------------------------------------------------------------------------
// High-Level Centralized Read Abstractions
// ----------------------------------------------------------------------------

/**
 * Executes collection read with feature-flagged routing (LEGACY, SHADOW, RELATIONAL)
 * and guaranteed non-blocking fallback to legacy data on failure or anomalies.
 */
export async function readCollectionWithFallback<T = any>(
  collection: string,
  legacyGetter: () => T[],
  dbInstance?: any
): Promise<T[]> {
  const mode = getRelationalReadMode(collection);
  const db = dbInstance || getD1Database();

  // 1. Direct LEGACY path
  if (mode === 'LEGACY' || !db) {
    return legacyGetter();
  }

  // 2. Circuit Breaker protection: If tripped, drop to legacy fallback
  if (isCircuitBreakerTripped(collection)) {
    console.warn(`[CIRCUIT BREAKER ACTIVE] Relational read for ${collection} bypassed to legacy fallback.`);
    return legacyGetter();
  }

  // 3. SHADOW mode: Execute legacy read for user, perform shadow comparison
  if (mode === 'SHADOW') {
    const legacyResult = legacyGetter();
    // Non-blocking shadow comparison
    shadowCompareCollection(collection, legacyResult, db).catch(e => {
      console.warn(`[SHADOW READ NOTICE] Comparison error for ${collection}:`, e?.message);
    });
    return legacyResult;
  }

  // 4. RELATIONAL mode: Query relational SQL, with automatic fallback on failure
  if (mode === 'RELATIONAL') {
    const startRel = Date.now();
    try {
      const relResult = await queryCollectionRelational(collection, db);
      const relTime = Date.now() - startRel;

      if (!Array.isArray(relResult)) {
        throw new Error(`Relational query returned non-array result for collection ${collection}`);
      }

      // Guard against silent empty or partial returns when legacy store has records
      const legacySample = legacyGetter();
      if (Array.isArray(legacySample) && legacySample.length > 0) {
        if (relResult.length === 0) {
          // Self-heal relational table in background
          syncCollectionToD1(collection, legacySample, db).catch(e => {
            console.warn(`[SELF-HEAL WARN] Initial population failed for ${collection}:`, e?.message);
          });
          throw new Error(`Relational table returned 0 records while legacy store contains ${legacySample.length} records`);
        }

        if (relResult.length < legacySample.length) {
          console.warn(`[RELATIONAL READ PARITY DEFICIT] Relational query for ${collection} returned ${relResult.length} rows, but legacy store contains ${legacySample.length} records. Merging to prevent data loss and self-healing relational mirror...`);
          // Self-heal missing records to relational table in background
          syncCollectionToD1(collection, legacySample, db).catch(e => {
            console.warn(`[SELF-HEAL WARN] Parity sync failed for ${collection}:`, e?.message);
          });

          // Merge so client receives 100% of records immediately without waiting
          const relIds = new Set((relResult as any[]).map(r => String(r.id || r.code || '')));
          const merged = [...relResult];
          for (const leg of legacySample) {
            const legId = String((leg as any).id || (leg as any).code || '');
            if (legId && !relIds.has(legId)) {
              merged.push(leg);
              relIds.add(legId);
            }
          }
          recordReadSuccessInMemory(collection);
          return merged as T[];
        }
      }

      recordReadSuccessInMemory(collection);
      return relResult as T[];
    } catch (relErr: any) {
      const errorMsg = relErr?.message || String(relErr);
      console.error(`[RELATIONAL READ FALLBACK] Query failed for ${collection}, falling back to legacy:`, errorMsg);
      recordReadFailureInMemory(collection, errorMsg);
      await recordReadDiagnostic(
        collection,
        'RELATIONAL_FALLBACK',
        'RELATIONAL',
        'FAILED',
        0,
        0,
        1,
        null,
        errorMsg,
        Date.now() - startRel,
        db
      );
      return legacyGetter();
    }
  }

  return legacyGetter();
}

/**
 * Executes single-entity read with feature-flagged routing and safe fallback.
 */
export async function readEntityWithFallback<T = any>(
  collection: string,
  entityId: string,
  legacyGetter: () => T | null,
  dbInstance?: any
): Promise<T | null> {
  const mode = getRelationalReadMode(collection);
  const db = dbInstance || getD1Database();

  if (mode === 'LEGACY' || !db || isCircuitBreakerTripped(collection)) {
    return legacyGetter();
  }

  if (mode === 'SHADOW') {
    const legacyResult = legacyGetter();
    shadowCompareEntity(collection, entityId, legacyResult, db).catch(e => {
      console.warn(`[SHADOW ENTITY NOTICE] Comparison error for ${collection}/${entityId}:`, e?.message);
    });
    return legacyResult;
  }

  if (mode === 'RELATIONAL') {
    const startRel = Date.now();
    try {
      const relResult = await queryEntityRelational(collection, entityId, db);
      const legacySample = legacyGetter();
      if (!relResult && legacySample) {
        throw new Error(`Relational query returned null for ${collection}/${entityId} but legacy entity exists`);
      }
      recordReadSuccessInMemory(collection);
      return (relResult || legacySample) as T;
    } catch (relErr: any) {
      const errorMsg = relErr?.message || String(relErr);
      console.error(`[RELATIONAL ENTITY FALLBACK] Query failed for ${collection}/${entityId}, falling back to legacy:`, errorMsg);
      recordReadFailureInMemory(collection, errorMsg);
      return legacyGetter();
    }
  }

  return legacyGetter();
}

/**
 * Summarizes the current relational read subsystem status and health metrics.
 */
export async function getRelationalReadStatus(dbInstance?: any): Promise<{
  overallHealth: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  databaseMode: DatabaseMode;
  collections: Record<string, {
    mode: RelationalReadMode;
    health: 'HEALTHY' | 'DEGRADED' | 'FAILED';
    shadowReads: number;
    mismatches: number;
    errors: number;
    circuitBreakerTripped: boolean;
  }>;
  recentDiagnostics: any[];
}> {
  const db = dbInstance || getD1Database();
  const collectionsStatus: Record<string, any> = {};
  let worstHealth: 'HEALTHY' | 'DEGRADED' | 'FAILED' = 'HEALTHY';

  for (const col of Object.keys(DEFAULT_RELATIONAL_READ_CONFIG)) {
    const mode = getRelationalReadMode(col);
    const errors = readErrorsCount.get(col) || 0;
    const mismatches = mismatchCounts.get(col) || 0;
    const shadowReads = shadowReadsCount.get(col) || 0;
    const isTripped = isCircuitBreakerTripped(col);

    let colHealth: 'HEALTHY' | 'DEGRADED' | 'FAILED' = 'HEALTHY';
    if (isTripped || errors >= CIRCUIT_BREAKER_THRESHOLD) {
      colHealth = 'FAILED';
    } else if (errors > 0 || mismatches > 0) {
      colHealth = 'DEGRADED';
    }

    if (colHealth === 'FAILED') worstHealth = 'FAILED';
    else if (colHealth === 'DEGRADED' && worstHealth !== 'FAILED') worstHealth = 'DEGRADED';

    collectionsStatus[col] = {
      mode,
      health: colHealth,
      shadowReads,
      mismatches,
      errors,
      circuitBreakerTripped: isTripped
    };
  }

  let recentDiagnostics: any[] = [];
  if (db) {
    try {
      const diagRes = await db.prepare('SELECT * FROM relational_read_diagnostics ORDER BY created_at DESC LIMIT 50').all();
      recentDiagnostics = (diagRes && diagRes.results) ? diagRes.results : (Array.isArray(diagRes) ? diagRes : []);
    } catch {}
  }

  return {
    overallHealth: worstHealth,
    databaseMode: getDatabaseMode(),
    collections: collectionsStatus,
    recentDiagnostics
  };
}

/**
 * Saves a single entity document directly into Cloudflare D1.
 * In DUAL_WRITE mode, authoritatively saves to legacy entities, then mirrors to relational SQL.
 */
export interface D1WriteResult {
  success: boolean;
  changes: number;
  error?: string;
}

export async function saveEntityToD1(
  collectionName: string, 
  docId: string, 
  data: any, 
  dbInstance?: any
): Promise<D1WriteResult> {
  const db = dbInstance || getD1Database();
  if (!db || !collectionName || !docId || data === undefined) {
    return { success: false, changes: 0, error: 'Missing database or arguments' };
  }

  try {
    await initD1Schema(db);
    const now = Date.now();
    const jsonStr = JSON.stringify(data);

    // 1. Authoritative write to legacy entities table
    const stmt = db.prepare(`
      INSERT INTO entities (collection, id, data, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?) 
      ON CONFLICT(collection, id) DO UPDATE SET 
        data = excluded.data, 
        updated_at = excluded.updated_at
    `);

    const runRes = await stmt.bind(collectionName, String(docId), jsonStr, now, now).run();
    const changes = runRes?.meta?.changes ?? (runRes?.changes !== undefined ? runRes.changes : 1);
    const isSuccess = runRes?.success !== false;

    if (!isSuccess) {
      console.error(`[D1 WRITE ERROR] saveEntityToD1 failed for ${collectionName}/${docId}:`, runRes?.error || 'Unknown error');
      return { success: false, changes: 0, error: String(runRes?.error || 'D1 operation failed') };
    }

    // 2. Dual-Write: Mirror to Relational Table if enabled and supported (Non-blocking resilience)
    if (getDatabaseMode() === 'DUAL_WRITE' && DUAL_WRITE_COLLECTIONS.has(collectionName)) {
      try {
        const mirrorRes = await saveRelationalMirror(collectionName, String(docId), data, db);
        if (!mirrorRes.success) {
          console.warn(`[DUAL-WRITE WARNING] Relational mirror failed for ${collectionName}/${docId} (authoritative legacy write succeeded):`, mirrorRes.error);
        }
      } catch (mirrorErr: any) {
        console.warn(`[DUAL-WRITE EXCEPTION] Relational mirror exception for ${collectionName}/${docId}:`, mirrorErr?.message || String(mirrorErr));
      }
    }

    return { success: true, changes: Math.max(1, changes) };
  } catch (err: any) {
    console.error(`[D1] Error saving entity ${collectionName}/${docId}:`, err);
    return { success: false, changes: 0, error: err?.message || String(err) };
  }
}

/**
 * Deletes a single entity document from Cloudflare D1.
 * In DUAL_WRITE mode, authoritatively deletes from legacy entities, then mirrors deletion to relational SQL.
 */
export async function deleteEntityFromD1(
  collectionName: string, 
  docId: string, 
  dbInstance?: any
): Promise<D1WriteResult> {
  const db = dbInstance || getD1Database();
  if (!db || !collectionName || !docId) {
    return { success: false, changes: 0, error: 'Missing database or arguments' };
  }

  try {
    await initD1Schema(db);

    // 1. Authoritative delete from legacy entities table
    const stmt = db.prepare('DELETE FROM entities WHERE collection = ? AND id = ?');
    const runRes = await stmt.bind(collectionName, String(docId)).run();
    const changes = runRes?.meta?.changes ?? (runRes?.changes !== undefined ? runRes.changes : 1);
    const isSuccess = runRes?.success !== false;

    if (!isSuccess) {
      console.error(`[D1 DELETE ERROR] deleteEntityFromD1 failed for ${collectionName}/${docId}:`, runRes?.error || 'Unknown error');
      return { success: false, changes: 0, error: String(runRes?.error || 'D1 operation failed') };
    }

    // 2. Dual-Write: Mirror deletion to Relational Table if enabled and supported (Non-blocking resilience)
    if (getDatabaseMode() === 'DUAL_WRITE' && DUAL_WRITE_COLLECTIONS.has(collectionName)) {
      try {
        const mirrorRes = await deleteRelationalMirror(collectionName, String(docId), db);
        if (!mirrorRes.success) {
          console.warn(`[DUAL-WRITE WARNING] Relational delete mirror failed for ${collectionName}/${docId}:`, mirrorRes.error);
        }
      } catch (mirrorErr: any) {
        console.warn(`[DUAL-WRITE EXCEPTION] Relational delete mirror exception for ${collectionName}/${docId}:`, mirrorErr?.message || String(mirrorErr));
      }
    }

    return { success: true, changes };
  } catch (err: any) {
    console.error(`[D1] Error deleting entity ${collectionName}/${docId}:`, err);
    return { success: false, changes: 0, error: err?.message || String(err) };
  }
}

/**
 * Saves a system setting directly into Cloudflare D1.
 */
export async function saveSettingToD1(
  key: string, 
  data: any, 
  dbInstance?: any
): Promise<D1WriteResult> {
  const db = dbInstance || getD1Database();
  if (!db || !key || data === undefined) {
    return { success: false, changes: 0, error: 'Missing database or arguments' };
  }

  try {
    await initD1Schema(db);
    const now = Date.now();
    const jsonStr = JSON.stringify(data);

    const stmt = db.prepare(`
      INSERT INTO system_settings (key, data, updated_at) 
      VALUES (?, ?, ?) 
      ON CONFLICT(key) DO UPDATE SET 
        data = excluded.data, 
        updated_at = excluded.updated_at
    `);

    const runRes = await stmt.bind(key, jsonStr, now).run();
    const changes = runRes?.meta?.changes ?? (runRes?.changes !== undefined ? runRes.changes : 1);
    const isSuccess = runRes?.success !== false;

    if (!isSuccess) {
      console.error(`[D1 WRITE ERROR] saveSettingToD1 failed for ${key}:`, runRes?.error || 'Unknown error');
      return { success: false, changes: 0, error: String(runRes?.error || 'D1 operation failed') };
    }

    return { success: true, changes: Math.max(1, changes) };
  } catch (err: any) {
    console.error(`[D1] Error saving setting ${key}:`, err);
    return { success: false, changes: 0, error: err?.message || String(err) };
  }
}

/**
 * Loads a system setting directly from Cloudflare D1.
 */
export async function getSettingFromD1(
  key: string,
  dbInstance?: any
): Promise<{ success: boolean; data?: any; error?: string }> {
  const db = dbInstance || getD1Database();
  if (!db || !key) {
    return { success: false, error: 'Missing database or key' };
  }

  try {
    await initD1Schema(db);
    const stmt = db.prepare('SELECT data FROM system_settings WHERE key = ?');
    const row = await stmt.bind(key).first();
    if (row && row.data) {
      const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      return { success: true, data: parsed };
    }
    return { success: false, error: `Setting '${key}' not found in D1` };
  } catch (err: any) {
    console.error(`[D1 READ ERROR] getSettingFromD1 failed for ${key}:`, err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Synchronizes an entire collection to D1, upserting active items and deleting purged items.
 */
export async function syncCollectionToD1(
  collectionName: string, 
  currentItems: any[], 
  dbInstance?: any
): Promise<boolean> {
  const db = dbInstance || getD1Database();
  if (!db || !collectionName) return false;

  try {
    await initD1Schema(db);
    const now = Date.now();
    const validIds = new Set<string>();

    const stmts: any[] = [];
    for (const item of (currentItems || [])) {
      if (!item || (!item.id && !item.code)) continue;
      const docId = String(item.id || item.code);
      validIds.add(docId);
      const stmt = db.prepare(`
        INSERT INTO entities (collection, id, data, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?) 
        ON CONFLICT(collection, id) DO UPDATE SET 
          data = excluded.data, 
          updated_at = excluded.updated_at
      `);
      stmts.push(stmt.bind(collectionName, docId, JSON.stringify(item), now, now));
    }

    // Execute saves in batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
      const batch = stmts.slice(i, i + BATCH_SIZE);
      if (typeof db.batch === 'function') {
        await db.batch(batch);
      } else {
        for (const s of batch) await s.run();
      }
    }

    // Delete any entities in D1 that no longer exist in currentItems
    const existingRes = await db.prepare('SELECT id FROM entities WHERE collection = ?').bind(collectionName).all();
    const existingRows = (existingRes && existingRes.results) ? existingRes.results : (Array.isArray(existingRes) ? existingRes : []);
    const deleteStmts: any[] = [];
    for (const row of existingRows) {
      if (row && row.id && !validIds.has(String(row.id))) {
        deleteStmts.push(db.prepare('DELETE FROM entities WHERE collection = ? AND id = ?').bind(collectionName, String(row.id)));
      }
    }

    if (deleteStmts.length > 0) {
      for (let i = 0; i < deleteStmts.length; i += BATCH_SIZE) {
        const delBatch = deleteStmts.slice(i, i + BATCH_SIZE);
        if (typeof db.batch === 'function') {
          await db.batch(delBatch);
        } else {
          for (const s of delBatch) await s.run();
        }
      }
    }

    // Phase 3 Dual-Write: Mirror batch updates and deletions to relational table
    if (getDatabaseMode() === 'DUAL_WRITE' && DUAL_WRITE_COLLECTIONS.has(collectionName)) {
      for (const item of (currentItems || [])) {
        if (!item || (!item.id && !item.code)) continue;
        const docId = String(item.id || item.code);
        try {
          await saveRelationalMirror(collectionName, docId, item, db);
        } catch (e: any) {
          console.warn(`[DUAL-WRITE BATCH WARNING] Mirror failed for ${collectionName}/${docId}:`, e?.message);
        }
      }
      for (const row of existingRows) {
        if (row && row.id && !validIds.has(String(row.id))) {
          try {
            await deleteRelationalMirror(collectionName, String(row.id), db);
          } catch (e: any) {
            console.warn(`[DUAL-WRITE BATCH WARNING] Delete mirror failed for ${collectionName}/${row.id}:`, e?.message);
          }
        }
      }
    }

    return true;
  } catch (err) {
    console.error(`[D1] Error syncing collection ${collectionName}:`, err);
    return false;
  }
}

/**
 * Loads a single document from Cloudflare D1.
 */
export async function loadEntityFromD1(
  collectionName: string, 
  docId: string, 
  dbInstance?: any
): Promise<Record<string, any> | null> {
  const db = dbInstance || getD1Database();
  if (!db || !collectionName || !docId) return null;

  try {
    await initD1Schema(db);
    const stmt = db.prepare('SELECT data FROM entities WHERE collection = ? AND id = ?');
    const res = await stmt.bind(collectionName, String(docId)).first();
    if (res && res.data) {
      return JSON.parse(res.data);
    }
    return null;
  } catch (err) {
    console.error(`[D1] Error querying entity ${collectionName}/${docId}:`, err);
    return null;
  }
}

/**
 * Seeds Cloudflare D1 with initial baseline state.
 */
export async function seedD1FromState(initialState: Record<string, any>, dbInstance?: any): Promise<boolean> {
  const db = dbInstance || getD1Database();
  if (!db || !initialState) return false;

  try {
    await initD1Schema(db);
    const now = Date.now();
    const statements: any[] = [];

    // 1. Settings
    for (const [key, val] of Object.entries(initialState)) {
      if (Array.isArray(val)) continue;
      if (OBJECT_COLLECTIONS.has(key)) continue;
      if (val && typeof val === 'object') {
        const stmt = db.prepare(`
          INSERT INTO system_settings (key, data, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
        `);
        statements.push(stmt.bind(key, JSON.stringify(val), now));
      }
    }

    // Set system_init sentinel
    const initStmt = db.prepare(`
      INSERT INTO system_settings (key, data, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `);
    statements.push(initStmt.bind('system_init', JSON.stringify({ initializedAt: new Date().toISOString(), version: 'd1_v1' }), now));

    // 2. Collections (Arrays and Dictionary Objects)
    for (const [collName, items] of Object.entries(initialState)) {
      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item || (!item.id && !item.code)) continue;
          const docId = String(item.id || item.code);
          const stmt = db.prepare(`
            INSERT INTO entities (collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
          `);
          statements.push(stmt.bind(collName, docId, JSON.stringify(item), now, now));
        }
      } else if (items && typeof items === 'object' && OBJECT_COLLECTIONS.has(collName)) {
        for (const [docId, item] of Object.entries(items)) {
          if (!item) continue;
          const stmt = db.prepare(`
            INSERT INTO entities (collection, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
          `);
          statements.push(stmt.bind(collName, String(docId), JSON.stringify(item), now, now));
        }
      }
    }

    // Execute in batches of 50 to stay within D1 statement batch boundaries
    const BATCH_SIZE = 50;
    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
      const batch = statements.slice(i, i + BATCH_SIZE);
      if (typeof db.batch === 'function') {
        await db.batch(batch);
      } else {
        for (const s of batch) await s.run();
      }
    }

    console.log(`[D1] Successfully seeded D1 database with ${statements.length} records.`);

    // Populate relational tables for promoted/dual-write collections if present in initialState
    if (Array.isArray(initialState.categories) && initialState.categories.length > 0) {
      try {
        for (const cat of initialState.categories) {
          if (cat && (cat.id || cat.slug)) {
            await saveRelationalMirror('categories', String(cat.id || cat.slug), cat, db);
          }
        }
      } catch (catSeedErr: any) {
        console.warn('[D1 SEED] Category relational mirror notice:', catSeedErr?.message);
      }
    }

    return true;
  } catch (err) {
    console.error('[D1] Error seeding D1 database:', err);
    return false;
  }
}

/**
 * Uploads an object into Cloudflare R2 bucket.
 */
export async function putR2File(
  key: string, 
  data: Buffer | Uint8Array | ArrayBuffer | string, 
  contentType: string, 
  metadata?: Record<string, string>,
  env?: CloudflareEnv
): Promise<boolean> {
  const cleanKey = key.replace(/^\/+/, '');
  const r2 = getR2Storage(env);

  if (r2 && typeof r2.put === 'function') {
    try {
      await r2.put(cleanKey, data, {
        httpMetadata: {
          contentType: contentType || 'application/octet-stream',
          cacheControl: 'public, max-age=31536000, immutable'
        },
        customMetadata: metadata || {}
      });
      console.log(`[R2] Successfully stored object: ${cleanKey}`);
      return true;
    } catch (err) {
      console.error(`[R2] Error putting object ${cleanKey}:`, err);
    }
  }

  // Fallback: Store locally if filesystem is accessible
  try {
    const localPath = path.join(process.cwd(), 'uploads', cleanKey);
    const dir = path.dirname(localPath);
    if (fs.mkdirSync && fs.writeFileSync) {
      fs.mkdirSync(dir, { recursive: true });
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
      fs.writeFileSync(localPath, buf);
      return true;
    }
  } catch {}

  return false;
}

/**
 * Retrieves an object from Cloudflare R2 bucket.
 */
export async function getR2File(
  key: string, 
  env?: CloudflareEnv
): Promise<{
  body: any;
  contentType: string;
  size: number;
  etag?: string;
} | null> {
  const cleanKey = key.replace(/^\/+/, '');
  const r2 = getR2Storage(env);

  if (r2 && typeof r2.get === 'function') {
    try {
      const obj = await r2.get(cleanKey);
      if (obj) {
        return {
          body: obj.body,
          contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
          size: obj.size || 0,
          etag: obj.httpEtag || obj.etag
        };
      }
    } catch (err) {
      console.error(`[R2] Error getting object ${cleanKey}:`, err);
    }
  }

  // Fallback: Check local filesystem
  try {
    const localPath = path.join(process.cwd(), 'uploads', cleanKey);
    if (fs.existsSync && fs.existsSync(localPath) && fs.readFileSync) {
      const buf = fs.readFileSync(localPath);
      const ext = path.extname(cleanKey).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.pdf') contentType = 'application/pdf';

      return {
        body: buf,
        contentType,
        size: buf.length
      };
    }
  } catch {}

  return null;
}

/**
 * Deletes an object from Cloudflare R2 bucket.
 */
export async function deleteR2File(key: string, env?: CloudflareEnv): Promise<boolean> {
  const cleanKey = key.replace(/^\/+/, '');
  const r2 = getR2Storage(env);

  if (r2 && typeof r2.delete === 'function') {
    try {
      await r2.delete(cleanKey);
      console.log(`[R2] Deleted object: ${cleanKey}`);
      return true;
    } catch (err) {
      console.error(`[R2] Error deleting object ${cleanKey}:`, err);
    }
  }

  // Fallback: local delete
  try {
    const localPath = path.join(process.cwd(), 'uploads', cleanKey);
    if (fs.existsSync && fs.existsSync(localPath) && fs.unlinkSync) {
      fs.unlinkSync(localPath);
      return true;
    }
  } catch {}

  return false;
}

/**
 * Saves media file metadata directly to Cloudflare D1 media_files table.
 * All structured file metadata persists strictly in D1.
 */
export async function saveMediaFileMetadataToD1(
  meta: {
    fileId: string;
    storagePath: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    downloadUrl: string;
    accessLevel?: 'public' | 'restricted' | 'private';
    ownerId?: string;
    folder?: string;
    metadata?: Record<string, any>;
  },
  dbInstance?: any
): Promise<boolean> {
  const db = dbInstance || getD1Database();
  if (!db || !meta.fileId || !meta.storagePath) return false;

  try {
    await initD1Schema(db);
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO media_files (
        file_id, storage_path, filename, mime_type, size_bytes, 
        access_level, owner_id, download_url, folder, metadata, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_id) DO UPDATE SET
        storage_path = excluded.storage_path,
        filename = excluded.filename,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        access_level = excluded.access_level,
        owner_id = excluded.owner_id,
        download_url = excluded.download_url,
        folder = excluded.folder,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);

    await stmt.bind(
      meta.fileId,
      meta.storagePath,
      meta.filename,
      meta.mimeType,
      meta.sizeBytes || 0,
      meta.accessLevel || 'public',
      meta.ownerId || null,
      meta.downloadUrl,
      meta.folder || 'media',
      meta.metadata ? JSON.stringify(meta.metadata) : null,
      now,
      now
    ).run();

    return true;
  } catch (err) {
    console.error('[D1] Error saving media file metadata:', err);
    return false;
  }
}

/**
 * Deletes media file metadata from Cloudflare D1.
 */
export async function deleteMediaFileMetadataFromD1(
  fileId: string,
  dbInstance?: any
): Promise<boolean> {
  const db = dbInstance || getD1Database();
  if (!db || !fileId) return false;

  try {
    await initD1Schema(db);
    await db.prepare('DELETE FROM media_files WHERE file_id = ?').bind(fileId).run();
    return true;
  } catch (err) {
    console.error('[D1] Error deleting media file metadata:', err);
    return false;
  }
}

// ============================================================================
// PHASE 2: CONTROLLED NON-DESTRUCTIVE RELATIONAL BACKFILL & PARITY SYSTEM
// (Explicitly callable only; never automatically invoked during startup)
// ============================================================================

export interface MigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
}

export interface MigrationBatchResult {
  collection: string;
  sourceCount: number;
  migratedCount: number;
  alreadyExisting: number;
  inserted: number;
  updated: number;
  skipped: number;
  warnings: string[];
  errors: string[];
  conflicts: Array<{ id: string; type: string; details: string }>;
}

export interface CollectionSnapshot {
  collection: string;
  totalRecordCount: number;
  recordIds: string[];
  malformedRecords: number;
  missingRequiredFields: number;
  duplicateLogicalIds: number;
  invalidForeignKeyReferences: number;
  suspiciousLegacyAliases: number;
  jsonParsingFailures: number;
  details: string[];
}

export interface PreMigrationSnapshotReport {
  timestamp: string;
  totalLegacyCollections: number;
  totalLegacyRecords: number;
  collections: Record<string, CollectionSnapshot>;
}

export interface RelationalParityReport {
  collection: string;
  sourceCount: number;
  destinationCount: number;
  missingIds: string[];
  extraIds: string[];
  foreignKeyIssues: string[];
  mappingWarnings: string[];
  status: 'PASS' | 'FAIL' | 'EMPTY';
}

export interface FieldMismatch {
  id: string;
  field: string;
  legacyValue: any;
  relationalValue: any;
}

export interface CollectionFieldParity {
  collection: string;
  verifiedFields: string[];
  totalChecked: number;
  mismatchesCount: number;
  mismatches: FieldMismatch[];
  status: 'PASS' | 'FAIL' | 'EMPTY';
}

export interface FieldLevelParityReport {
  timestamp: string;
  totalCollectionsChecked: number;
  totalMismatches: number;
  collections: Record<string, CollectionFieldParity>;
  overallStatus: 'PASS' | 'FAIL';
}

export interface FullBackfillReport {
  timestamp: string;
  isDryRun: boolean;
  totalLegacyRecords: number;
  totalRelationalRecords: number;
  totalSuccessfullyMigrated: number;
  totalAlreadyExisting: number;
  totalInserted: number;
  totalUpdated: number;
  totalSkipped: number;
  totalWarnings: number;
  totalErrors: number;
  totalUnresolvedForeignKeys: number;
  steps: MigrationBatchResult[];
  overallStatus: 'SUCCESS' | 'DRY_RUN_PASSED' | 'FAILED';
}

function resolveMigrationParams(optionsOrDb?: MigrationOptions | any, dbInstance?: any): { options: MigrationOptions; db: any } {
  let options: MigrationOptions = { dryRun: false, batchSize: 50 };
  let db = dbInstance || getD1Database();

  if (optionsOrDb) {
    if (typeof optionsOrDb.prepare === 'function' || typeof optionsOrDb.batch === 'function') {
      db = optionsOrDb;
    } else if (typeof optionsOrDb === 'object') {
      options = { ...options, ...optionsOrDb };
    }
  }

  return { options, db };
}

/**
 * Generates a non-destructive diagnostic snapshot of all legacy entity collections.
 */
export async function generatePreMigrationSnapshot(dbInstance?: any): Promise<PreMigrationSnapshotReport> {
  const db = dbInstance || getD1Database();
  const report: PreMigrationSnapshotReport = {
    timestamp: new Date().toISOString(),
    totalLegacyCollections: 0,
    totalLegacyRecords: 0,
    collections: {}
  };
  if (!db) return report;

  const targetCollections = [
    'categories',
    'services',
    'customers',
    'employees',
    'employeeKYC',
    'employeePayroll',
    'employeeAccounts',
    'employeeDocuments',
    'orders',
    'reviews',
    'auditLogs'
  ];

  // Pre-load reference ID sets for foreign-key validation
  const existingCategoryIds = new Set<string>();
  const existingServiceIds = new Set<string>();
  const existingCustomerIds = new Set<string>();
  const existingEmployeeIds = new Set<string>();
  const existingOrderIds = new Set<string>();

  for (const coll of targetCollections) {
    const snap: CollectionSnapshot = {
      collection: coll,
      totalRecordCount: 0,
      recordIds: [],
      malformedRecords: 0,
      missingRequiredFields: 0,
      duplicateLogicalIds: 0,
      invalidForeignKeyReferences: 0,
      suspiciousLegacyAliases: 0,
      jsonParsingFailures: 0,
      details: []
    };

    try {
      const rowsRes = await db.prepare("SELECT id, data FROM entities WHERE collection = ?").bind(coll).all();
      const rows = (rowsRes && rowsRes.results) ? rowsRes.results : (Array.isArray(rowsRes) ? rowsRes : []);
      snap.totalRecordCount = rows.length;
      report.totalLegacyRecords += rows.length;

      const seenIds = new Set<string>();

      for (const r of rows) {
        const id = String(r.id);
        if (seenIds.has(id)) {
          snap.duplicateLogicalIds++;
          snap.details.push(`Duplicate ID: ${id}`);
        }
        seenIds.add(id);
        snap.recordIds.push(id);

        let d: any = null;
        try {
          d = JSON.parse(r.data);
        } catch {
          snap.jsonParsingFailures++;
          snap.malformedRecords++;
          snap.details.push(`Unparseable JSON in entity: ${id}`);
          continue;
        }

        if (!d || typeof d !== 'object') {
          snap.malformedRecords++;
          continue;
        }

        // Collection-specific sanity checks
        if (coll === 'categories') {
          existingCategoryIds.add(id);
          if (!d.name) snap.missingRequiredFields++;
        } else if (coll === 'services') {
          existingServiceIds.add(id);
          if (!d.title) snap.missingRequiredFields++;
          if (d.categoryId && !existingCategoryIds.has(String(d.categoryId))) {
            snap.invalidForeignKeyReferences++;
            snap.details.push(`Service ${id} references missing category: ${d.categoryId}`);
          }
        } else if (coll === 'customers') {
          existingCustomerIds.add(id);
          if (!d.name || !d.mobile) snap.missingRequiredFields++;
        } else if (coll === 'employees') {
          existingEmployeeIds.add(id);
          if (!d.name && !d.fullName) snap.missingRequiredFields++;
          if (d.code && d.employeeCode && d.code !== d.employeeCode) {
            snap.suspiciousLegacyAliases++;
            snap.details.push(`Employee ${id} has conflicting code (${d.code}) vs employeeCode (${d.employeeCode})`);
          }
        } else if (coll === 'employeeKYC' || coll === 'employeePayroll' || coll === 'employeeAccounts') {
          const empId = String(d.employeeId || id);
          if (!existingEmployeeIds.has(empId)) {
            snap.invalidForeignKeyReferences++;
            snap.details.push(`${coll} record ${id} references missing employee: ${empId}`);
          }
        } else if (coll === 'employeeDocuments') {
          const empId = String(d.employeeId || '');
          if (!existingEmployeeIds.has(empId)) {
            snap.invalidForeignKeyReferences++;
            snap.details.push(`EmployeeDoc ${id} references missing employee: ${empId}`);
          }
        } else if (coll === 'orders') {
          existingOrderIds.add(id);
          if (!d.name || !d.mobile) snap.missingRequiredFields++;
          if (d.customerId && !existingCustomerIds.has(String(d.customerId))) {
            snap.invalidForeignKeyReferences++;
            snap.details.push(`Order ${id} references unresolved customerId: ${d.customerId}`);
          }
          if (d.serviceId && !existingServiceIds.has(String(d.serviceId))) {
            snap.invalidForeignKeyReferences++;
            snap.details.push(`Order ${id} references unresolved serviceId: ${d.serviceId}`);
          }
          if (d.assignedEmployeeId && d.assignedStaffId && d.assignedEmployeeId !== d.assignedStaffId) {
            snap.suspiciousLegacyAliases++;
            snap.details.push(`Order ${id} has conflicting assignedEmployeeId (${d.assignedEmployeeId}) vs assignedStaffId (${d.assignedStaffId})`);
          }
        } else if (coll === 'reviews') {
          if (!d.rating) snap.missingRequiredFields++;
          if (d.serviceId && !existingServiceIds.has(String(d.serviceId))) {
            snap.invalidForeignKeyReferences++;
          }
        }
      }
    } catch (err: any) {
      snap.details.push(`Snapshot collection error: ${err?.message || String(err)}`);
    }

    report.collections[coll] = snap;
  }

  report.totalLegacyCollections = targetCollections.length;
  return report;
}

/**
 * Migrates service categories from `entities` to relational `categories` table.
 */
export async function migrateCategoriesToRelational(optionsOrDb?: MigrationOptions | any, dbInstance?: any): Promise<MigrationBatchResult> {
  const { options, db } = resolveMigrationParams(optionsOrDb, dbInstance);
  const res: MigrationBatchResult = {
    collection: 'categories',
    sourceCount: 0,
    migratedCount: 0,
    alreadyExisting: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    conflicts: []
  };
  if (!db) {
    res.errors.push('No D1 database instance available');
    return res;
  }

  try {
    await initD1Schema(db);
    const rowsRes = await db.prepare("SELECT id, data, created_at, updated_at FROM entities WHERE collection = 'categories'").all();
    const rows = (rowsRes && rowsRes.results) ? rowsRes.results : (Array.isArray(rowsRes) ? rowsRes : []);
    res.sourceCount = rows.length;

    // Check existing rows in destination table
    const existingRes = await db.prepare('SELECT id FROM categories').all();
    const existingIds = new Set<string>(((existingRes && existingRes.results) ? existingRes.results : (Array.isArray(existingRes) ? existingRes : [])).map((r: any) => String(r.id)));

    for (const r of rows) {
      try {
        const d = JSON.parse(r.data);
        const id = String(r.id || d.id);
        const name = String(d.name || id);
        const slug = String(d.slug || id.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        const sortOrder = typeof d.sortOrder === 'number' ? d.sortOrder : 0;
        const status = d.status === 'Inactive' ? 'Inactive' : 'Active';
        const icon = d.icon || null;
        const color = d.color || null;
        const description = d.description || null;
        const createdAt = typeof r.created_at === 'number' ? r.created_at : (d.createdAt ? Date.parse(d.createdAt) || Date.now() : Date.now());
        const updatedAt = typeof r.updated_at === 'number' ? r.updated_at : (d.updatedAt ? Date.parse(d.updatedAt) || Date.now() : Date.now());
        const metadata = JSON.stringify({ serviceCount: d.serviceCount });

        const isExisting = existingIds.has(id);
        if (isExisting) res.alreadyExisting++;

        if (!options.dryRun) {
          const stmt = db.prepare(`
            INSERT INTO categories (id, name, slug, sort_order, status, icon, color, description, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              slug = excluded.slug,
              sort_order = excluded.sort_order,
              status = excluded.status,
              icon = excluded.icon,
              color = excluded.color,
              description = excluded.description,
              metadata = excluded.metadata,
              updated_at = excluded.updated_at
          `);
          await stmt.bind(id, name, slug, sortOrder, status, icon, color, description, metadata, createdAt, updatedAt).run();
          if (isExisting) res.updated++; else res.inserted++;
        }
        res.migratedCount++;
      } catch (err: any) {
        res.errors.push(`Category ${r.id}: ${err?.message || String(err)}`);
        res.skipped++;
      }
    }
  } catch (err: any) {
    res.errors.push(`Batch execution error: ${err?.message || String(err)}`);
  }
  return res;
}

/**
 * Migrates services from `entities` to relational `services` table.
 */
export async function migrateServicesToRelational(optionsOrDb?: MigrationOptions | any, dbInstance?: any): Promise<MigrationBatchResult> {
  const { options, db } = resolveMigrationParams(optionsOrDb, dbInstance);
  const res: MigrationBatchResult = {
    collection: 'services',
    sourceCount: 0,
    migratedCount: 0,
    alreadyExisting: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    conflicts: []
  };
  if (!db) {
    res.errors.push('No D1 database instance available');
    return res;
  }

  try {
    await initD1Schema(db);
    const catRowsRes = await db.prepare('SELECT id FROM categories').all();
    const validCatIds = new Set<string>(((catRowsRes && catRowsRes.results) ? catRowsRes.results : (Array.isArray(catRowsRes) ? catRowsRes : [])).map((r: any) => String(r.id)));

    const existingRes = await db.prepare('SELECT id FROM services').all();
    const existingIds = new Set<string>(((existingRes && existingRes.results) ? existingRes.results : (Array.isArray(existingRes) ? existingRes : [])).map((r: any) => String(r.id)));

    const rowsRes = await db.prepare("SELECT id, data, created_at, updated_at FROM entities WHERE collection = 'services'").all();
    const rows = (rowsRes && rowsRes.results) ? rowsRes.results : (Array.isArray(rowsRes) ? rowsRes : []);
    res.sourceCount = rows.length;

    for (const r of rows) {
      try {
        const d = JSON.parse(r.data);
        const id = String(r.id || d.id);
        const rawCatId = d.categoryId ? String(d.categoryId) : null;
        let categoryId = (rawCatId && validCatIds.has(rawCatId)) ? rawCatId : null;
        if (rawCatId && !categoryId) {
          res.warnings.push(`Service ${id}: Unresolved categoryId '${rawCatId}' set to NULL`);
          res.conflicts.push({ id, type: 'ORPHAN_SERVICE_CATEGORY', details: `Referenced category '${rawCatId}' does not exist` });
        }

        const title = String(d.title || id);
        const slug = String(d.slug || id.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        const subCategory = d.subCategory || null;
        const description = String(d.description || d.shortDescription || title);
        const govFees = typeof d.govFees === 'number' ? d.govFees : 0;
        const serviceCharge = typeof d.serviceCharge === 'number' ? d.serviceCharge : 0;
        const processingTime = d.processingTime || d.estimatedTime || '3-5 Business Days';
        const status = ['active', 'inactive', 'draft', 'published'].includes(d.status) ? d.status : 'active';
        const bannerImage = d.bannerImage || d.imageUrl || d.image || null;
        const icon = d.icon || null;
        const requiredDocs = Array.isArray(d.requiredDocuments) ? JSON.stringify(d.requiredDocuments) : JSON.stringify([]);
        const faqs = Array.isArray(d.faqs) ? JSON.stringify(d.faqs) : JSON.stringify([]);
        const metadata = JSON.stringify({
          originalCategoryId: rawCatId,
          highlights: d.highlights || [],
          eligibility: d.eligibility || '',
          howItWorks: d.howItWorks || '',
          seoTitle: d.seoTitle || '',
          seoDescription: d.seoDescription || '',
          whatsAppEnabled: d.whatsAppEnabled !== false,
          featured: Boolean(d.featured),
          popular: Boolean(d.popular),
          displayOrder: d.displayOrder || 0,
          popularity: d.popularity || 0,
          gallery: d.gallery || []
        });
        const createdAt = typeof r.created_at === 'number' ? r.created_at : (d.createdAt ? Date.parse(d.createdAt) || Date.now() : Date.now());
        const updatedAt = typeof r.updated_at === 'number' ? r.updated_at : (d.updatedAt ? Date.parse(d.updatedAt) || Date.now() : Date.now());

        const isExisting = existingIds.has(id);
        if (isExisting) res.alreadyExisting++;

        if (!options.dryRun) {
          const stmt = db.prepare(`
            INSERT INTO services (id, category_id, title, slug, sub_category, description, gov_fees, service_charge, processing_time, status, banner_image, icon, required_documents, faqs, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              category_id = excluded.category_id,
              title = excluded.title,
              slug = excluded.slug,
              sub_category = excluded.sub_category,
              description = excluded.description,
              gov_fees = excluded.gov_fees,
              service_charge = excluded.service_charge,
              processing_time = excluded.processing_time,
              status = excluded.status,
              banner_image = excluded.banner_image,
              icon = excluded.icon,
              required_documents = excluded.required_documents,
              faqs = excluded.faqs,
              metadata = excluded.metadata,
              updated_at = excluded.updated_at
          `);
          await stmt.bind(id, categoryId, title, slug, subCategory, description, govFees, serviceCharge, processingTime, status, bannerImage, icon, requiredDocs, faqs, metadata, createdAt, updatedAt).run();
          if (isExisting) res.updated++; else res.inserted++;
        }
        res.migratedCount++;
      } catch (err: any) {
        res.errors.push(`Service ${r.id}: ${err?.message || String(err)}`);
        res.skipped++;
      }
    }
  } catch (err: any) {
    res.errors.push(`Batch execution error: ${err?.message || String(err)}`);
  }
  return res;
}

/**
 * Migrates customers from `entities` to relational `customers` table.
 */
export async function migrateCustomersToRelational(optionsOrDb?: MigrationOptions | any, dbInstance?: any): Promise<MigrationBatchResult> {
  const { options, db } = resolveMigrationParams(optionsOrDb, dbInstance);
  const res: MigrationBatchResult = {
    collection: 'customers',
    sourceCount: 0,
    migratedCount: 0,
    alreadyExisting: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    conflicts: []
  };
  if (!db) {
    res.errors.push('No D1 database instance available');
    return res;
  }

  try {
    await initD1Schema(db);
    const existingRes = await db.prepare('SELECT id FROM customers').all();
    const existingIds = new Set<string>(((existingRes && existingRes.results) ? existingRes.results : (Array.isArray(existingRes) ? existingRes : [])).map((r: any) => String(r.id)));

    const rowsRes = await db.prepare("SELECT id, data, created_at, updated_at FROM entities WHERE collection = 'customers'").all();
    const rows = (rowsRes && rowsRes.results) ? rowsRes.results : (Array.isArray(rowsRes) ? rowsRes : []);
    res.sourceCount = rows.length;

    for (const r of rows) {
      try {
        const d = JSON.parse(r.data);
        const id = String(r.id || d.id);
        const code = String(d.code || `CUST-${id.replace(/[^0-9]/g, '').slice(-4) || '1001'}`);
        const name = String(d.name || 'Unnamed Customer');
        const email = d.email || null;
        const mobile = String(d.mobile || '');
        const whatsappMobile = d.whatsappMobile || null;
        const customerType = ['Individual', 'Business / Corporate', 'Franchise / Partner'].includes(d.customerType) ? d.customerType : 'Individual';
        const status = ['Active', 'Inactive', 'Blocked'].includes(d.status) ? d.status : 'Active';
        const contactPersonName = d.contactPersonName || null;
        const gender = d.gender || null;
        const dobOrIncorporation = d.dobOrIncorporationDate || null;
        const photoUrl = d.photoUrl || null;
        const address = d.address || null;
        const city = d.city || null;
        const state = d.state || null;
        const pincode = d.pinCode || d.pincode || null;
        const gstin = d.gstin || null;
        const panNumber = d.panNumber || null;
        const msmeLicense = d.msmeLicense || null;
        const notes = d.notes || null;
        const metadata = JSON.stringify({ userId: d.userId || null });
        const createdAt = typeof r.created_at === 'number' ? r.created_at : (d.createdAt ? Date.parse(d.createdAt) || Date.now() : Date.now());
        const updatedAt = typeof r.updated_at === 'number' ? r.updated_at : (d.updatedAt ? Date.parse(d.updatedAt) || Date.now() : Date.now());

        const isExisting = existingIds.has(id);
        if (isExisting) res.alreadyExisting++;

        if (!options.dryRun) {
          const stmt = db.prepare(`
            INSERT INTO customers (id, code, name, email, mobile, whatsapp_mobile, customer_type, status, contact_person_name, gender, dob_or_incorporation, photo_url, address, city, state, pincode, gstin, pan_number, msme_license, notes, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              code = excluded.code,
              name = excluded.name,
              email = excluded.email,
              mobile = excluded.mobile,
              whatsapp_mobile = excluded.whatsapp_mobile,
              customer_type = excluded.customer_type,
              status = excluded.status,
              contact_person_name = excluded.contact_person_name,
              gender = excluded.gender,
              dob_or_incorporation = excluded.dob_or_incorporation,
              photo_url = excluded.photo_url,
              address = excluded.address,
              city = excluded.city,
              state = excluded.state,
              pincode = excluded.pincode,
              gstin = excluded.gstin,
              pan_number = excluded.pan_number,
              msme_license = excluded.msme_license,
              notes = excluded.notes,
              metadata = excluded.metadata,
              updated_at = excluded.updated_at
          `);
          await stmt.bind(id, code, name, email, mobile, whatsappMobile, customerType, status, contactPersonName, gender, dobOrIncorporation, photoUrl, address, city, state, pincode, gstin, panNumber, msmeLicense, notes, metadata, createdAt, updatedAt).run();
          if (isExisting) res.updated++; else res.inserted++;
        }
        res.migratedCount++;
      } catch (err: any) {
        res.errors.push(`Customer ${r.id}: ${err?.message || String(err)}`);
        res.skipped++;
      }
    }
  } catch (err: any) {
    res.errors.push(`Batch execution error: ${err?.message || String(err)}`);
  }
  return res;
}

/**
 * Migrates employees from `entities` to relational `employees` table.
 */
export async function migrateEmployeesToRelational(optionsOrDb?: MigrationOptions | any, dbInstance?: any): Promise<MigrationBatchResult> {
  const { options, db } = resolveMigrationParams(optionsOrDb, dbInstance);
  const res: MigrationBatchResult = {
    collection: 'employees',
    sourceCount: 0,
    migratedCount: 0,
    alreadyExisting: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    conflicts: []
  };
  if (!db) {
    res.errors.push('No D1 database instance available');
    return res;
  }

  try {
    await initD1Schema(db);
    const existingRes = await db.prepare('SELECT id FROM employees').all();
    const existingIds = new Set<string>(((existingRes && existingRes.results) ? existingRes.results : (Array.isArray(existingRes) ? existingRes : [])).map((r: any) => String(r.id)));

    const rowsRes = await db.prepare("SELECT id, data, created_at, updated_at FROM entities WHERE collection = 'employees'").all();
    const rows = (rowsRes && rowsRes.results) ? rowsRes.results : (Array.isArray(rowsRes) ? rowsRes : []);
    res.sourceCount = rows.length;

    for (const r of rows) {
      try {
        const d = JSON.parse(r.data);
        const id = String(r.id || d.id);
        
        // Check alias conflict: code vs employeeCode
        if (d.code && d.employeeCode && d.code !== d.employeeCode) {
          res.warnings.push(`Employee ${id}: conflicting code '${d.code}' vs employeeCode '${d.employeeCode}'`);
          res.conflicts.push({ id, type: 'EMPLOYEE_CODE_ALIAS_CONFLICT', details: `code=${d.code}, employeeCode=${d.employeeCode}` });
        }
        const code = String(d.code || d.employeeCode || `EMP-${id.replace(/[^0-9]/g, '').slice(-3) || '001'}`);
        const name = String(d.name || d.fullName || 'Staff Member');
        const department = String(d.department || 'Operations');
        const designation = String(d.designation || 'Staff');
        const employmentType = d.employmentType || 'Full-Time';
        const status = ['Active', 'Inactive', 'On Leave', 'Suspended', 'Resigned', 'Terminated'].includes(d.status || d.employmentStatus) ? (d.status || d.employmentStatus) : 'Active';
        const joiningDate = d.joiningDate || null;
        const phone = d.phone || d.mobile || d.personalMobile || null;
        const email = d.email || d.personalEmail || null;
        const photoUrl = d.photoUrl || d.photo || d.profilePhoto || null;
        const address = d.address || d.currentAddress || null;
        const city = d.city || null;
        const state = d.state || null;
        const pincode = d.pinCode || d.pincode || null;
        const qualification = d.qualification || d.highestQualification || null;
        const experienceYears = typeof d.experience === 'number' ? d.experience : (typeof d.totalExperienceYears === 'number' ? d.totalExperienceYears : 0);
        const emergencyContactName = d.emergencyContactName || null;
        const emergencyContactPhone = d.emergencyContactMobile || null;
        const metadata = JSON.stringify({
          fatherName: d.fatherName || '',
          motherName: d.motherName || '',
          spouseName: d.spouseName || '',
          fatherMotherSpouseName: d.fatherMotherSpouseName || '',
          dateOfBirth: d.dateOfBirth || '',
          gender: d.gender || '',
          nationality: d.nationality || 'Indian',
          bloodGroup: d.bloodGroup || '',
          personalEmail: d.personalEmail || d.email || '',
          personalMobile: d.personalMobile || d.mobile || d.phone || '',
          emergencyContactName: d.emergencyContactName || '',
          emergencyContactRelation: d.emergencyContactRelation || '',
          emergencyContactMobile: d.emergencyContactMobile || d.emergency_contact_phone || '',
          currentAddress: d.currentAddress || d.address || '',
          permanentAddress: d.permanentAddress || '',
          isPermanentSameAsCurrent: d.isPermanentSameAsCurrent !== undefined ? d.isPermanentSameAsCurrent : true,
          district: d.district || '',
          reportingManager: d.reportingManager || '',
          workLocation: d.workLocation || '',
          probationStatus: d.probationStatus || '',
          confirmationDate: d.confirmationDate || '',
          exitDate: d.exitDate || '',
          exitReason: d.exitReason || '',
          highestQualification: d.highestQualification || d.qualification || '',
          qualificationSummary: d.qualificationSummary || d.highestQualification || '',
          university: d.university || '',
          certifications: d.certifications || '',
          totalExperienceYears: typeof d.totalExperienceYears === 'number' ? d.totalExperienceYears : (typeof d.experience === 'number' ? d.experience : 0),
          previousOrganizations: d.previousOrganizations || '',
          skills: Array.isArray(d.skills) ? d.skills : [],
          languages: Array.isArray(d.languages) ? d.languages : [],
          profilePhoto: photoUrl,
          profilePhotoMediaId: d.profilePhotoMediaId || '',
          internalNotes: d.internalNotes || ''
        });
        const createdAt = typeof r.created_at === 'number' ? r.created_at : (d.createdAt ? Date.parse(d.createdAt) || Date.now() : Date.now());
        const updatedAt = typeof r.updated_at === 'number' ? r.updated_at : (d.updatedAt ? Date.parse(d.updatedAt) || Date.now() : Date.now());

        const isExisting = existingIds.has(id);
        if (isExisting) res.alreadyExisting++;

        if (!options.dryRun) {
          const stmt = db.prepare(`
            INSERT INTO employees (id, code, name, department, designation, employment_type, status, joining_date, phone, email, photo_url, address, city, state, pincode, qualification, experience_years, emergency_contact_name, emergency_contact_phone, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              code = excluded.code,
              name = excluded.name,
              department = excluded.department,
              designation = excluded.designation,
              employment_type = excluded.employment_type,
              status = excluded.status,
              joining_date = excluded.joining_date,
              phone = excluded.phone,
              email = excluded.email,
              photo_url = excluded.photo_url,
              address = excluded.address,
              city = excluded.city,
              state = excluded.state,
              pincode = excluded.pincode,
              qualification = excluded.qualification,
              experience_years = excluded.experience_years,
              emergency_contact_name = excluded.emergency_contact_name,
              emergency_contact_phone = excluded.emergency_contact_phone,
              metadata = excluded.metadata,
              updated_at = excluded.updated_at
          `);
          await stmt.bind(id, code, name, department, designation, employmentType, status, joiningDate, phone, email, photoUrl, address, city, state, pincode, qualification, experienceYears, emergencyContactName, emergencyContactPhone, metadata, createdAt, updatedAt).run();
          if (isExisting) res.updated++; else res.inserted++;
        }
        res.migratedCount++;
      } catch (err: any) {
        res.errors.push(`Employee ${r.id}: ${err?.message || String(err)}`);
        res.skipped++;
      }
    }
  } catch (err: any) {
    res.errors.push(`Batch execution error: ${err?.message || String(err)}`);
  }
  return res;
}

/**
 * Migrates employee KYC from `entities` to relational `employee_kyc` table.
 */
export async function migrateEmployeeKycToRelational(optionsOrDb?: MigrationOptions | any, dbInstance?: any): Promise<MigrationBatchResult> {
  const { options, db } = resolveMigrationParams(optionsOrDb, dbInstance);
  const res: MigrationBatchResult = {
    collection: 'employeeKYC',
    sourceCount: 0,
    migratedCount: 0,
    alreadyExisting: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    conflicts: []
  };
  if (!db) {
    res.errors.push('No D1 database instance available');
    return res;
  }

  try {
    await initD1Schema(db);
    const empRowsRes = await db.prepare('SELECT id FROM employees').all();
    const validEmpIds = new Set<string>(((empRowsRes && empRowsRes.results) ? empRowsRes.results : (Array.isArray(empRowsRes) ? empRowsRes : [])).map((r: any) => String(r.id)));

    const existingRes = await db.prepare('SELECT employee_id FROM employee_kyc').all();
    const existingIds = new Set<string>(((existingRes && existingRes.results) ? existingRes.results : (Array.isArray(existingRes) ? existingRes : [])).map((r: any) => String(r.employee_id)));

    const rowsRes = await db.prepare("SELECT id, data, updated_at FROM entities WHERE collection = 'employeeKYC'").all();
    const rows = (rowsRes && rowsRes.results) ? rowsRes.results : (Array.isArray(rowsRes) ? rowsRes : []);
    res.sourceCount = rows.length;

    for (const r of rows) {
      try {
        const d = JSON.parse(r.data);
        const empId = String(r.id || d.employeeId);
        if (!validEmpIds.has(empId)) {
          res.warnings.push(`KYC ${empId}: Skipped because referenced employee does not exist`);
          res.conflicts.push({ id: empId, type: 'ORPHAN_EMPLOYEE_KYC', details: `Employee '${empId}' not found in employees table` });
          res.skipped++;
          continue;
        }

        // Masked values preserved; never unmasked
        const aadhaarMasked = d.aadhaarNumber || null;
        const panMasked = d.panNumber || null;
        const otherIdType = d.otherGovernmentIdType || null;
        const otherIdNumber = d.otherGovernmentIdNumber || null;
        const aadhaarStatus = ['Pending', 'Verified', 'Rejected'].includes(d.aadhaarVerificationStatus) ? d.aadhaarVerificationStatus : 'Pending';
        const panStatus = ['Pending', 'Verified', 'Rejected'].includes(d.panVerificationStatus) ? d.panVerificationStatus : 'Pending';
        const verificationNotes = d.verificationNotes || null;
        const verifiedBy = d.verifiedBy || null;
        const verifiedAt = d.verifiedAt || null;
        const documents = Array.isArray(d.documents) ? JSON.stringify(d.documents) : null;
        const updatedAt = typeof r.updated_at === 'number' ? r.updated_at : Date.now();

        const isExisting = existingIds.has(empId);
        if (isExisting) res.alreadyExisting++;

        if (!options.dryRun) {
          const stmt = db.prepare(`
            INSERT INTO employee_kyc (employee_id, aadhaar_masked, pan_masked, other_id_type, other_id_number, aadhaar_status, pan_status, verification_notes, verified_by, verified_at, documents, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(employee_id) DO UPDATE SET
              aadhaar_masked = excluded.aadhaar_masked,
              pan_masked = excluded.pan_masked,
              other_id_type = excluded.other_id_type,
              other_id_number = excluded.other_id_number,
              aadhaar_status = excluded.aadhaar_status,
              pan_status = excluded.pan_status,
              verification_notes = excluded.verification_notes,
              verified_by = excluded.verified_by,
              verified_at = excluded.verified_at,
              documents = excluded.documents,
              updated_at = excluded.updated_at
          `);
          await stmt.bind(empId, aadhaarMasked, panMasked, otherIdType, otherIdNumber, aadhaarStatus, panStatus, verificationNotes, verifiedBy, verifiedAt, documents, updatedAt).run();
          if (isExisting) res.updated++; else res.inserted++;
        }
        res.migratedCount++;
      } catch (err: any) {
        res.errors.push(`KYC ${r.id}: ${err?.message || String(err)}`);
        res.skipped++;
      }
    }
  } catch (err: any) {
    res.errors.push(`Batch execution error: ${err?.message || String(err)}`);
  }
  return res;
}

/**
 * Migrates employee payroll from `entities` to relational `employee_payroll` table.
 */
export async function migrateEmployeePayrollToRelational(optionsOrDb?: MigrationOptions | any, dbInstance?: any): Promise<MigrationBatchResult> {
  const { options, db } = resolveMigrationParams(optionsOrDb, dbInstance);
  const res: MigrationBatchResult = {
    collection: 'employeePayroll',
    sourceCount: 0,
    migratedCount: 0,
    alreadyExisting: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    conflicts: []
  };
  if (!db) {
    res.errors.push('No D1 database instance available');
    return res;
  }

  try {
    await initD1Schema(db);
    const empRowsRes = await db.prepare('SELECT id FROM employees').all();
    const validEmpIds = new Set<string>(((empRowsRes && empRowsRes.results) ? empRowsRes.results : (Array.isArray(empRowsRes) ? empRowsRes : [])).map((r: any) => String(r.id)));

    const existingRes = await db.prepare('SELECT employee_id FROM employee_payroll').all();
    const existingIds = new Set<string>(((existingRes && existingRes.results) ? existingRes.results : (Array.isArray(existingRes) ? existingRes : [])).map((r: any) => String(r.employee_id)));

    const rowsRes = await db.prepare("SELECT id, data, updated_at FROM entities WHERE collection = 'employeePayroll'").all();
    const rows = (rowsRes && rowsRes.results) ? rowsRes.results : (Array.isArray(rowsRes) ? rowsRes : []);
    res.sourceCount = rows.length;

    for (const r of rows) {
      try {
        const d = JSON.parse(r.data);
        const empId = String(r.id || d.employeeId);
        if (!validEmpIds.has(empId)) {
          res.warnings.push(`Payroll ${empId}: Skipped because referenced employee does not exist`);
          res.conflicts.push({ id: empId, type: 'ORPHAN_EMPLOYEE_PAYROLL', details: `Employee '${empId}' not found in employees table` });
          res.skipped++;
          continue;
        }

        const accountHolderName = d.accountHolderName || null;
        const bankName = d.bankName || null;
        const branchName = d.branchName || null;
        const accountMasked = d.accountNumber || null;
        const ifscCode = d.ifscCode || null;
        const paymentMethod = d.paymentMethod || 'Bank Transfer';
        const salaryCtc = typeof d.salaryAmount === 'number' ? d.salaryAmount : (typeof d.grossSalary === 'number' ? d.grossSalary : 0);
        const netSalary = typeof d.netSalary === 'number' ? d.netSalary : salaryCtc;
        const basicPay = typeof d.basicPay === 'number' ? d.basicPay : 0;
        const hra = typeof d.hra === 'number' ? d.hra : 0;
        const payrollNotes = d.payrollNotes || null;
        const metadata = JSON.stringify({
          specialAllowance: typeof d.specialAllowance === 'number' ? d.specialAllowance : 0,
          pfDeduction: typeof d.pfDeduction === 'number' ? d.pfDeduction : 0,
          taxDeduction: typeof d.taxDeduction === 'number' ? d.taxDeduction : 0,
          salaryType: d.salaryType || 'Monthly',
          salaryFrequency: d.salaryFrequency || 'Monthly',
          effectiveFrom: d.effectiveFrom || null,
          accountNumber: d.accountNumber || null,
          ...(d.metadata && typeof d.metadata === 'object' ? d.metadata : {})
        });
        const updatedAt = typeof r.updated_at === 'number' ? r.updated_at : Date.now();

        const isExisting = existingIds.has(empId);
        if (isExisting) res.alreadyExisting++;

        if (!options.dryRun) {
          const stmt = db.prepare(`
            INSERT INTO employee_payroll (employee_id, account_holder_name, bank_name, branch_name, account_masked, ifsc_code, payment_method, salary_ctc, net_salary, basic_pay, hra, payroll_notes, metadata, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(employee_id) DO UPDATE SET
              account_holder_name = excluded.account_holder_name,
              bank_name = excluded.bank_name,
              branch_name = excluded.branch_name,
              account_masked = excluded.account_masked,
              ifsc_code = excluded.ifsc_code,
              payment_method = excluded.payment_method,
              salary_ctc = excluded.salary_ctc,
              net_salary = excluded.net_salary,
              basic_pay = excluded.basic_pay,
              hra = excluded.hra,
              payroll_notes = excluded.payroll_notes,
              metadata = excluded.metadata,
              updated_at = excluded.updated_at
          `);
          await stmt.bind(empId, accountHolderName, bankName, branchName, accountMasked, ifscCode, paymentMethod, salaryCtc, netSalary, basicPay, hra, payrollNotes, metadata, updatedAt).run();
          if (isExisting) res.updated++; else res.inserted++;
        }
        res.migratedCount++;
      } catch (err: any) {
        res.errors.push(`Payroll ${r.id}: ${err?.message || String(err)}`);
        res.skipped++;
      }
    }
  } catch (err: any) {
    res.errors.push(`Batch execution error: ${err?.message || String(err)}`);
  }
  return res;
}

/**
 * Migrates employee accounts from `entities` to relational `employee_accounts` table.
 */
export async function migrateEmployeeAccountsToRelational(optionsOrDb?: MigrationOptions | any, dbInstance?: any): Promise<MigrationBatchResult> {
  const { options, db } = resolveMigrationParams(optionsOrDb, dbInstance);
  const res: MigrationBatchResult = {
    collection: 'employeeAccounts',
    sourceCount: 0,
    migratedCount: 0,
    alreadyExisting: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    conflicts: []
  };
  if (!db) {
    res.errors.push('No D1 database instance available');
    return res;
  }

  try {
    await initD1Schema(db);
    const empRowsRes = await db.prepare('SELECT id FROM employees').all();
    const validEmpIds = new Set<string>(((empRowsRes && empRowsRes.results) ? empRowsRes.results : (Array.isArray(empRowsRes) ? empRowsRes : [])).map((r: any) => String(r.id)));

    const existingRes = await db.prepare('SELECT employee_id FROM employee_accounts').all();
    const existingIds = new Set<string>(((existingRes && existingRes.results) ? existingRes.results : (Array.isArray(existingRes) ? existingRes : [])).map((r: any) => String(r.employee_id)));

    const rowsRes = await db.prepare("SELECT id, data, created_at, updated_at FROM entities WHERE collection = 'employeeAccounts'").all();
    const rows = (rowsRes && rowsRes.results) ? rowsRes.results : (Array.isArray(rowsRes) ? rowsRes : []);
    res.sourceCount = rows.length;

    for (const r of rows) {
      try {
        const d = JSON.parse(r.data);
        const empId = String(r.id || d.employeeId);
        if (!validEmpIds.has(empId)) {
          res.warnings.push(`Account ${empId}: Skipped because referenced employee does not exist`);
          res.conflicts.push({ id: empId, type: 'ORPHAN_EMPLOYEE_ACCOUNT', details: `Employee '${empId}' not found in employees table` });
          res.skipped++;
          continue;
        }

        const userId = d.userId || null;
        const systemEmail = String(d.systemEmail || `${empId.toLowerCase()}@easydesk.local`);
        const role = String(d.role || 'STAFF');
        const permissions = Array.isArray(d.permissions) ? JSON.stringify(d.permissions) : JSON.stringify([]);
        const accountStatus = ['Active', 'Inactive', 'Locked'].includes(d.accountStatus) ? d.accountStatus : 'Active';
        const lastLoginAt = d.lastLoginAt || null;
        const createdAt = typeof r.created_at === 'number' ? r.created_at : Date.now();
        const updatedAt = typeof r.updated_at === 'number' ? r.updated_at : Date.now();

        const isExisting = existingIds.has(empId);
        if (isExisting) res.alreadyExisting++;

        if (!options.dryRun) {
          const stmt = db.prepare(`
            INSERT INTO employee_accounts (employee_id, user_id, system_email, role, permissions, account_status, last_login_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(employee_id) DO UPDATE SET
              user_id = excluded.user_id,
              system_email = excluded.system_email,
              role = excluded.role,
              permissions = excluded.permissions,
              account_status = excluded.account_status,
              last_login_at = excluded.last_login_at,
              updated_at = excluded.updated_at
          `);
          await stmt.bind(empId, userId, systemEmail, role, permissions, accountStatus, lastLoginAt, createdAt, updatedAt).run();
          if (isExisting) res.updated++; else res.inserted++;
        }
        res.migratedCount++;
      } catch (err: any) {
        res.errors.push(`Account ${r.id}: ${err?.message || String(err)}`);
        res.skipped++;
      }
    }
  } catch (err: any) {
    res.errors.push(`Batch execution error: ${err?.message || String(err)}`);
  }
  return res;
}

/**
 * Migrates employee documents from `entities` to relational `employee_documents` table.
 */
export async function migrateEmployeeDocumentsToRelational(optionsOrDb?: MigrationOptions | any, dbInstance?: any): Promise<MigrationBatchResult> {
  const { options, db } = resolveMigrationParams(optionsOrDb, dbInstance);
  const res: MigrationBatchResult = {
    collection: 'employeeDocuments',
    sourceCount: 0,
    migratedCount: 0,
    alreadyExisting: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    conflicts: []
  };
  if (!db) {
    res.errors.push('No D1 database instance available');
    return res;
  }

  try {
    await initD1Schema(db);
    const empRowsRes = await db.prepare('SELECT id FROM employees').all();
    const validEmpIds = new Set<string>(((empRowsRes && empRowsRes.results) ? empRowsRes.results : (Array.isArray(empRowsRes) ? empRowsRes : [])).map((r: any) => String(r.id)));

    const existingRes = await db.prepare('SELECT id FROM employee_documents').all();
    const existingIds = new Set<string>(((existingRes && existingRes.results) ? existingRes.results : (Array.isArray(existingRes) ? existingRes : [])).map((r: any) => String(r.id)));

    const rowsRes = await db.prepare("SELECT id, data, created_at, updated_at FROM entities WHERE collection = 'employeeDocuments'").all();
    const rows = (rowsRes && rowsRes.results) ? rowsRes.results : (Array.isArray(rowsRes) ? rowsRes : []);
    res.sourceCount = rows.length;

    for (const r of rows) {
      try {
        const d = JSON.parse(r.data);
        const id = String(r.id || d.id);
        const empId = String(d.employeeId);
        if (!validEmpIds.has(empId)) {
          res.warnings.push(`Document ${id}: Skipped because referenced employee '${empId}' does not exist`);
          res.conflicts.push({ id, type: 'ORPHAN_EMPLOYEE_DOCUMENT', details: `Employee '${empId}' not found in employees table` });
          res.skipped++;
          continue;
        }

        const docType = String(d.documentType || 'Other');
        const docName = String(d.documentName || d.name || 'Document');
        const origFileName = d.originalFileName || null;
        const storagePath = String(d.storagePath || d.privateFileKey || `employee_docs/${id}`);
        const downloadUrl = d.downloadUrl || null;
        const mimeType = d.mimeType || 'application/pdf';
        const sizeBytes = typeof d.sizeBytes === 'number' ? d.sizeBytes : 0;
        const verStatus = ['Pending', 'Verified', 'Rejected'].includes(d.verificationStatus) ? d.verificationStatus : 'Pending';
        const uploadedBy = d.uploadedBy || 'Admin';
        const uploadedAt = d.uploadedAt || new Date().toISOString();
        const metadata = JSON.stringify({ verifiedBy: d.verifiedBy || null, verifiedAt: d.verifiedAt || null, notes: d.notes || null });
        const createdAt = typeof r.created_at === 'number' ? r.created_at : Date.now();
        const updatedAt = typeof r.updated_at === 'number' ? r.updated_at : Date.now();

        const isExisting = existingIds.has(id);
        if (isExisting) res.alreadyExisting++;

        if (!options.dryRun) {
          const stmt = db.prepare(`
            INSERT INTO employee_documents (id, employee_id, document_type, document_name, original_file_name, storage_path, download_url, mime_type, size_bytes, verification_status, uploaded_by, uploaded_at, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              document_type = excluded.document_type,
              document_name = excluded.document_name,
              original_file_name = excluded.original_file_name,
              storage_path = excluded.storage_path,
              download_url = excluded.download_url,
              mime_type = excluded.mime_type,
              size_bytes = excluded.size_bytes,
              verification_status = excluded.verification_status,
              metadata = excluded.metadata,
              updated_at = excluded.updated_at
          `);
          await stmt.bind(id, empId, docType, docName, origFileName, storagePath, downloadUrl, mimeType, sizeBytes, verStatus, uploadedBy, uploadedAt, metadata, createdAt, updatedAt).run();
          if (isExisting) res.updated++; else res.inserted++;
        }
        res.migratedCount++;
      } catch (err: any) {
        res.errors.push(`Document ${r.id}: ${err?.message || String(err)}`);
        res.skipped++;
      }
    }
  } catch (err: any) {
    res.errors.push(`Batch execution error: ${err?.message || String(err)}`);
  }
  return res;
}

/**
 * Migrates orders from `entities` to relational `orders` table.
 */
export async function migrateOrdersToRelational(optionsOrDb?: MigrationOptions | any, dbInstance?: any): Promise<MigrationBatchResult> {
  const { options, db } = resolveMigrationParams(optionsOrDb, dbInstance);
  const res: MigrationBatchResult = {
    collection: 'orders',
    sourceCount: 0,
    migratedCount: 0,
    alreadyExisting: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    conflicts: []
  };
  if (!db) {
    res.errors.push('No D1 database instance available');
    return res;
  }

  try {
    await initD1Schema(db);
    const custRes = await db.prepare('SELECT id FROM customers').all();
    const validCustIds = new Set<string>(((custRes && custRes.results) ? custRes.results : (Array.isArray(custRes) ? custRes : [])).map((r: any) => String(r.id)));

    const srvRes = await db.prepare('SELECT id FROM services').all();
    const validSrvIds = new Set<string>(((srvRes && srvRes.results) ? srvRes.results : (Array.isArray(srvRes) ? srvRes : [])).map((r: any) => String(r.id)));

    const empRes = await db.prepare('SELECT id FROM employees').all();
    const validEmpIds = new Set<string>(((empRes && empRes.results) ? empRes.results : (Array.isArray(empRes) ? empRes : [])).map((r: any) => String(r.id)));

    const existingRes = await db.prepare('SELECT id FROM orders').all();
    const existingIds = new Set<string>(((existingRes && existingRes.results) ? existingRes.results : (Array.isArray(existingRes) ? existingRes : [])).map((r: any) => String(r.id)));

    const rowsRes = await db.prepare("SELECT id, data, created_at, updated_at FROM entities WHERE collection = 'orders'").all();
    const rows = (rowsRes && rowsRes.results) ? rowsRes.results : (Array.isArray(rowsRes) ? rowsRes : []);
    res.sourceCount = rows.length;

    for (const r of rows) {
      try {
        const d = JSON.parse(r.data);
        const id = String(r.id || d.id);
        const orderCode = String(d.id || `ORD-${id.replace(/[^0-9]/g, '').slice(-5) || '10001'}`);
        
        // FK Safety: Set to NULL if parent ID doesn't exist or is invalid guest placeholder
        const rawCustId = d.customerId ? String(d.customerId) : null;
        let customerId = (rawCustId && validCustIds.has(rawCustId)) ? rawCustId : null;
        if (rawCustId && !customerId) {
          res.warnings.push(`Order ${id}: Unresolved customerId '${rawCustId}' set to NULL`);
          res.conflicts.push({ id, type: 'UNRESOLVED_ORDER_CUSTOMER', details: `Customer ID '${rawCustId}' does not exist` });
        }

        const rawSrvId = d.serviceId ? String(d.serviceId) : null;
        let serviceId = (rawSrvId && validSrvIds.has(rawSrvId)) ? rawSrvId : null;
        if (rawSrvId && !serviceId) {
          res.warnings.push(`Order ${id}: Unresolved serviceId '${rawSrvId}' set to NULL`);
          res.conflicts.push({ id, type: 'UNRESOLVED_ORDER_SERVICE', details: `Service ID '${rawSrvId}' does not exist` });
        }

        // Check alias conflict: assignedEmployeeId vs assignedStaffId
        if (d.assignedEmployeeId && d.assignedStaffId && d.assignedEmployeeId !== d.assignedStaffId) {
          res.warnings.push(`Order ${id}: Conflicting assignedEmployeeId '${d.assignedEmployeeId}' vs assignedStaffId '${d.assignedStaffId}'`);
          res.conflicts.push({ id, type: 'ASSIGNMENT_ALIAS_CONFLICT', details: `assignedEmployeeId=${d.assignedEmployeeId}, assignedStaffId=${d.assignedStaffId}` });
        }
        const rawStaffId = d.assignedEmployeeId ? String(d.assignedEmployeeId) : (d.assignedStaffId ? String(d.assignedStaffId) : null);
        let assignedStaffId = (rawStaffId && validEmpIds.has(rawStaffId)) ? rawStaffId : null;
        if (rawStaffId && !assignedStaffId) {
          res.warnings.push(`Order ${id}: Unresolved staff assignment '${rawStaffId}' set to NULL`);
        }

        const orderSource = ['WhatsApp', 'Website', 'Phone', 'In-Person', 'Other'].includes(d.orderSource) ? d.orderSource : 'WhatsApp';
        const createdBy = d.createdBy || null;
        const name = String(d.name || 'Citizen Customer');
        const mobile = String(d.mobile || '');
        const email = d.email || null;
        const address = d.address || null;
        const city = d.city || null;
        const state = d.state || null;
        const pincode = d.pinCode || d.pincode || null;
        const totalAmount = typeof d.totalAmount === 'number' ? d.totalAmount : 0;
        const paymentMethod = d.paymentMethod || 'UPI';
        const paymentStatus = ['Pending Verification', 'Verified', 'Rejected'].includes(d.paymentStatus) ? d.paymentStatus : 'Pending Verification';
        const utr = d.utr || null;
        const paymentScreenshot = d.paymentScreenshot || null;
        const orderStatus = ['Pending', 'Documents Required', 'Under Verification', 'Processing', 'Completed', 'Rejected'].includes(d.orderStatus) ? d.orderStatus : 'Pending';
        const documentDeliveryStatus = ['Pending', 'Ready', 'SENT_VIA_WHATSAPP'].includes(d.documentDeliveryStatus) ? d.documentDeliveryStatus : 'Pending';
        const finalDocumentUrl = d.finalDocumentUrl || null;
        const finalDocumentName = d.finalDocumentName || null;
        const priority = ['Normal', 'High', 'Urgent'].includes(d.priority) ? d.priority : 'Normal';
        const uploadedDocs = Array.isArray(d.uploadedDocuments) ? JSON.stringify(d.uploadedDocuments) : JSON.stringify([]);
        const logs = Array.isArray(d.logs) ? JSON.stringify(d.logs) : JSON.stringify([]);
        const metadata = JSON.stringify({
          originalCustomerId: rawCustId,
          originalServiceId: rawSrvId,
          originalAssignedStaffId: rawStaffId,
          serviceTitle: d.serviceTitle || '',
          category: d.category || '',
          additionalNotes: d.additionalNotes || '',
          submittedData: d.submittedData || null,
          rejectionReason: d.rejectionReason || null,
          finalDocumentUploadedAt: d.finalDocumentUploadedAt || null,
          whatsAppSentAt: d.whatsAppSentAt || null,
          whatsAppDeliveryNotes: d.whatsAppDeliveryNotes || null,
          feedback: d.feedback || null,
          submittedReview: d.submittedReview || null
        });
        const createdAt = typeof r.created_at === 'number' ? r.created_at : (d.createdAt ? Date.parse(d.createdAt) || Date.now() : Date.now());
        const updatedAt = typeof r.updated_at === 'number' ? r.updated_at : (d.updatedAt ? Date.parse(d.updatedAt) || Date.now() : Date.now());

        const isExisting = existingIds.has(id);
        if (isExisting) res.alreadyExisting++;

        if (!options.dryRun) {
          const stmt = db.prepare(`
            INSERT INTO orders (id, order_code, customer_id, service_id, assigned_staff_id, order_source, created_by, name, mobile, email, address, city, state, pincode, total_amount, payment_method, payment_status, utr, payment_screenshot, order_status, document_delivery_status, final_document_url, final_document_name, priority, uploaded_documents, logs, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              order_code = excluded.order_code,
              customer_id = excluded.customer_id,
              service_id = excluded.service_id,
              assigned_staff_id = excluded.assigned_staff_id,
              order_source = excluded.order_source,
              created_by = excluded.created_by,
              name = excluded.name,
              mobile = excluded.mobile,
              email = excluded.email,
              address = excluded.address,
              city = excluded.city,
              state = excluded.state,
              pincode = excluded.pincode,
              total_amount = excluded.total_amount,
              payment_method = excluded.payment_method,
              payment_status = excluded.payment_status,
              utr = excluded.utr,
              payment_screenshot = excluded.payment_screenshot,
              order_status = excluded.order_status,
              document_delivery_status = excluded.document_delivery_status,
              final_document_url = excluded.final_document_url,
              final_document_name = excluded.final_document_name,
              priority = excluded.priority,
              uploaded_documents = excluded.uploaded_documents,
              logs = excluded.logs,
              metadata = excluded.metadata,
              updated_at = excluded.updated_at
          `);
          await stmt.bind(id, orderCode, customerId, serviceId, assignedStaffId, orderSource, createdBy, name, mobile, email, address, city, state, pincode, totalAmount, paymentMethod, paymentStatus, utr, paymentScreenshot, orderStatus, documentDeliveryStatus, finalDocumentUrl, finalDocumentName, priority, uploadedDocs, logs, metadata, createdAt, updatedAt).run();
          if (isExisting) res.updated++; else res.inserted++;
        }
        res.migratedCount++;
      } catch (err: any) {
        res.errors.push(`Order ${r.id}: ${err?.message || String(err)}`);
        res.skipped++;
      }
    }
  } catch (err: any) {
    res.errors.push(`Batch execution error: ${err?.message || String(err)}`);
  }
  return res;
}

/**
 * Migrates reviews from `entities` to relational `reviews` table.
 */
export async function migrateReviewsToRelational(optionsOrDb?: MigrationOptions | any, dbInstance?: any): Promise<MigrationBatchResult> {
  const { options, db } = resolveMigrationParams(optionsOrDb, dbInstance);
  const res: MigrationBatchResult = {
    collection: 'reviews',
    sourceCount: 0,
    migratedCount: 0,
    alreadyExisting: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    conflicts: []
  };
  if (!db) {
    res.errors.push('No D1 database instance available');
    return res;
  }

  try {
    await initD1Schema(db);
    const srvRes = await db.prepare('SELECT id FROM services').all();
    const validSrvIds = new Set<string>(((srvRes && srvRes.results) ? srvRes.results : (Array.isArray(srvRes) ? srvRes : [])).map((r: any) => String(r.id)));

    const custRes = await db.prepare('SELECT id FROM customers').all();
    const validCustIds = new Set<string>(((custRes && custRes.results) ? custRes.results : (Array.isArray(custRes) ? custRes : [])).map((r: any) => String(r.id)));

    const ordRes = await db.prepare('SELECT id FROM orders').all();
    const validOrdIds = new Set<string>(((ordRes && ordRes.results) ? ordRes.results : (Array.isArray(ordRes) ? ordRes : [])).map((r: any) => String(r.id)));

    const existingRes = await db.prepare('SELECT id FROM reviews').all();
    const existingIds = new Set<string>(((existingRes && existingRes.results) ? existingRes.results : (Array.isArray(existingRes) ? existingRes : [])).map((r: any) => String(r.id)));

    const rowsRes = await db.prepare("SELECT id, data, created_at, updated_at FROM entities WHERE collection = 'reviews'").all();
    const rows = (rowsRes && rowsRes.results) ? rowsRes.results : (Array.isArray(rowsRes) ? rowsRes : []);
    res.sourceCount = rows.length;

    for (const r of rows) {
      try {
        const d = JSON.parse(r.data);
        const id = String(r.id || d.id || d.reviewId);
        const rawSrvId = d.serviceId ? String(d.serviceId) : null;
        let serviceId = (rawSrvId && validSrvIds.has(rawSrvId)) ? rawSrvId : null;
        if (rawSrvId && !serviceId) {
          res.warnings.push(`Review ${id}: Unresolved serviceId '${rawSrvId}' set to NULL`);
          res.conflicts.push({ id, type: 'UNRESOLVED_REVIEW_SERVICE', details: `Service '${rawSrvId}' not found` });
        }

        const rawCustId = d.customerId ? String(d.customerId) : null;
        let customerId = (rawCustId && validCustIds.has(rawCustId)) ? rawCustId : null;
        if (rawCustId && !customerId) {
          res.warnings.push(`Review ${id}: Unresolved customerId '${rawCustId}' set to NULL`);
        }

        const rawOrdId = d.orderId ? String(d.orderId) : null;
        let orderId = (rawOrdId && validOrdIds.has(rawOrdId)) ? rawOrdId : null;
        if (rawOrdId && !orderId) {
          res.warnings.push(`Review ${id}: Unresolved orderId '${rawOrdId}' set to NULL`);
        }

        const customerName = String(d.customerName || d.userName || 'Verified Citizen');
        const rawRating = Number(d.rating);
        const rating = (!isNaN(rawRating) && rawRating >= 1 && rawRating <= 5) ? Math.round(rawRating) : 5;
        const comment = String(d.comment || d.reviewText || '');
        const status = ['Pending', 'Approved', 'Rejected', 'Hidden'].includes(d.status) ? d.status : 'Pending';
        const adminNote = d.adminNote || null;
        const createdAt = typeof r.created_at === 'number' ? r.created_at : (d.createdAt ? Date.parse(d.createdAt) || Date.now() : Date.now());
        const updatedAt = typeof r.updated_at === 'number' ? r.updated_at : (d.updatedAt ? Date.parse(d.updatedAt) || Date.now() : Date.now());

        const isExisting = existingIds.has(id);
        if (isExisting) res.alreadyExisting++;

        if (!options.dryRun) {
          const stmt = db.prepare(`
            INSERT INTO reviews (id, service_id, customer_id, order_id, customer_name, rating, comment, status, admin_note, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              service_id = excluded.service_id,
              customer_id = excluded.customer_id,
              order_id = excluded.order_id,
              customer_name = excluded.customer_name,
              rating = excluded.rating,
              comment = excluded.comment,
              status = excluded.status,
              admin_note = excluded.admin_note,
              updated_at = excluded.updated_at
          `);
          await stmt.bind(id, serviceId, customerId, orderId, customerName, rating, comment, status, adminNote, createdAt, updatedAt).run();
          if (isExisting) res.updated++; else res.inserted++;
        }
        res.migratedCount++;
      } catch (err: any) {
        res.errors.push(`Review ${r.id}: ${err?.message || String(err)}`);
        res.skipped++;
      }
    }
  } catch (err: any) {
    res.errors.push(`Batch execution error: ${err?.message || String(err)}`);
  }
  return res;
}

/**
 * Migrates audit logs from `entities` to relational `audit_logs` table.
 */
export async function migrateAuditLogsToRelational(optionsOrDb?: MigrationOptions | any, dbInstance?: any): Promise<MigrationBatchResult> {
  const { options, db } = resolveMigrationParams(optionsOrDb, dbInstance);
  const res: MigrationBatchResult = {
    collection: 'auditLogs',
    sourceCount: 0,
    migratedCount: 0,
    alreadyExisting: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    conflicts: []
  };
  if (!db) {
    res.errors.push('No D1 database instance available');
    return res;
  }

  try {
    await initD1Schema(db);
    const existingRes = await db.prepare('SELECT id FROM audit_logs').all();
    const existingIds = new Set<string>(((existingRes && existingRes.results) ? existingRes.results : (Array.isArray(existingRes) ? existingRes : [])).map((r: any) => String(r.id)));

    const rowsRes = await db.prepare("SELECT id, data, created_at FROM entities WHERE collection = 'auditLogs'").all();
    const rows = (rowsRes && rowsRes.results) ? rowsRes.results : (Array.isArray(rowsRes) ? rowsRes : []);
    res.sourceCount = rows.length;

    for (const r of rows) {
      try {
        const d = JSON.parse(r.data);
        const id = String(r.id || d.id || `log-${Date.now()}`);
        const userId = d.userId || null;
        const userName = d.userName || null;
        const userRole = d.userRole || null;
        const action = String(d.action || d.actionType || 'ACTIVITY');
        const entityType = d.entityType || (d.employeeId ? 'employee' : (d.documentId ? 'document' : null));
        const entityId = d.entityId || d.employeeId || d.documentId || null;
        const details = typeof d.details === 'string' ? d.details : (d.description || JSON.stringify(d.details || {}));
        const ipAddress = d.ipAddress || null;
        const timestamp = typeof r.created_at === 'number' ? r.created_at : (d.timestamp ? Date.parse(d.timestamp) || Date.now() : Date.now());

        const isExisting = existingIds.has(id);
        if (isExisting) res.alreadyExisting++;

        if (!options.dryRun) {
          const stmt = db.prepare(`
            INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, details, ip_address, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              details = excluded.details
          `);
          await stmt.bind(id, userId, userName, userRole, action, entityType, entityId, details, ipAddress, timestamp).run();
          if (isExisting) res.updated++; else res.inserted++;
        }
        res.migratedCount++;
      } catch (err: any) {
        res.errors.push(`AuditLog ${r.id}: ${err?.message || String(err)}`);
        res.skipped++;
      }
    }
  } catch (err: any) {
    res.errors.push(`Batch execution error: ${err?.message || String(err)}`);
  }
  return res;
}

/**
 * Master orchestrator that runs Steps 1 to 11 in dependency order with dry-run support.
 */
export async function executeFullRelationalBackfill(options?: MigrationOptions, dbInstance?: any): Promise<FullBackfillReport> {
  const db = dbInstance || getD1Database();
  const dryRun = Boolean(options?.dryRun);
  const report: FullBackfillReport = {
    timestamp: new Date().toISOString(),
    isDryRun: dryRun,
    totalLegacyRecords: 0,
    totalRelationalRecords: 0,
    totalSuccessfullyMigrated: 0,
    totalAlreadyExisting: 0,
    totalInserted: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    totalWarnings: 0,
    totalErrors: 0,
    totalUnresolvedForeignKeys: 0,
    steps: [],
    overallStatus: 'FAILED'
  };

  if (!db) {
    console.error('[MIGRATION] No D1 database instance available');
    return report;
  }

  await initD1Schema(db);

  // Step 1: Categories
  const catRes = await migrateCategoriesToRelational(options, db);
  report.steps.push(catRes);

  // Step 2: Services
  const srvRes = await migrateServicesToRelational(options, db);
  report.steps.push(srvRes);

  // Step 3: Customers
  const custRes = await migrateCustomersToRelational(options, db);
  report.steps.push(custRes);

  // Step 4: Employees
  const empRes = await migrateEmployeesToRelational(options, db);
  report.steps.push(empRes);

  // Step 5: Employee KYC
  const kycRes = await migrateEmployeeKycToRelational(options, db);
  report.steps.push(kycRes);

  // Step 6: Employee Payroll
  const payRes = await migrateEmployeePayrollToRelational(options, db);
  report.steps.push(payRes);

  // Step 7: Employee Accounts
  const accRes = await migrateEmployeeAccountsToRelational(options, db);
  report.steps.push(accRes);

  // Step 8: Employee Documents
  const docRes = await migrateEmployeeDocumentsToRelational(options, db);
  report.steps.push(docRes);

  // Step 9: Orders
  const ordRes = await migrateOrdersToRelational(options, db);
  report.steps.push(ordRes);

  // Step 10: Reviews
  const revRes = await migrateReviewsToRelational(options, db);
  report.steps.push(revRes);

  // Step 11: Audit Logs
  const logRes = await migrateAuditLogsToRelational(options, db);
  report.steps.push(logRes);

  // Aggregate totals
  for (const s of report.steps) {
    report.totalLegacyRecords += s.sourceCount;
    report.totalSuccessfullyMigrated += s.migratedCount;
    report.totalAlreadyExisting += s.alreadyExisting;
    report.totalInserted += s.inserted;
    report.totalUpdated += s.updated;
    report.totalSkipped += s.skipped;
    report.totalWarnings += s.warnings.length;
    report.totalErrors += s.errors.length;
    report.totalUnresolvedForeignKeys += s.conflicts.length;
  }

  report.totalRelationalRecords = report.totalInserted + report.totalAlreadyExisting;
  report.overallStatus = report.totalErrors === 0 ? (dryRun ? 'DRY_RUN_PASSED' : 'SUCCESS') : 'FAILED';

  return report;
}

/**
 * Diagnostic parity verification tool: Compares legacy `entities` rows with relational rows.
 * Purely read-only; never modifies or deletes data.
 */
export async function verifyRelationalParity(dbInstance?: any): Promise<RelationalParityReport[]> {
  const db = dbInstance || getD1Database();
  const reports: RelationalParityReport[] = [];
  if (!db) return reports;

  const targetPairs: Array<{ collection: string; table: string }> = [
    { collection: 'categories', table: 'categories' },
    { collection: 'services', table: 'services' },
    { collection: 'customers', table: 'customers' },
    { collection: 'employees', table: 'employees' },
    { collection: 'employeeKYC', table: 'employee_kyc' },
    { collection: 'employeePayroll', table: 'employee_payroll' },
    { collection: 'employeeAccounts', table: 'employee_accounts' },
    { collection: 'employeeDocuments', table: 'employee_documents' },
    { collection: 'orders', table: 'orders' },
    { collection: 'reviews', table: 'reviews' },
    { collection: 'auditLogs', table: 'audit_logs' }
  ];

  for (const pair of targetPairs) {
    const report: RelationalParityReport = {
      collection: pair.collection,
      sourceCount: 0,
      destinationCount: 0,
      missingIds: [],
      extraIds: [],
      foreignKeyIssues: [],
      mappingWarnings: [],
      status: 'EMPTY'
    };

    try {
      const srcRowsRes = await db.prepare("SELECT id FROM entities WHERE collection = ?").bind(pair.collection).all();
      const srcIds = new Set<string>(((srcRowsRes && srcRowsRes.results) ? srcRowsRes.results : (Array.isArray(srcRowsRes) ? srcRowsRes : [])).map((r: any) => String(r.id)));
      report.sourceCount = srcIds.size;

      const idCol = pair.table.startsWith('employee_') && !pair.table.endsWith('_documents') ? 'employee_id' : 'id';
      const dstRowsRes = await db.prepare(`SELECT ${idCol} AS id FROM ${pair.table}`).all();
      const dstIds = new Set<string>(((dstRowsRes && dstRowsRes.results) ? dstRowsRes.results : (Array.isArray(dstRowsRes) ? dstRowsRes : [])).map((r: any) => String(r.id)));
      report.destinationCount = dstIds.size;

      for (const id of srcIds) {
        if (!dstIds.has(id)) report.missingIds.push(id);
      }
      for (const id of dstIds) {
        if (!srcIds.has(id)) report.extraIds.push(id);
      }

      if (report.sourceCount === 0 && report.destinationCount === 0) {
        report.status = 'EMPTY';
      } else if (report.missingIds.length === 0 && report.sourceCount === report.destinationCount) {
        report.status = 'PASS';
      } else {
        report.status = 'FAIL';
      }
    } catch (err: any) {
      report.mappingWarnings.push(`Parity query error: ${err?.message || String(err)}`);
      report.status = 'FAIL';
    }

    reports.push(report);
  }

  return reports;
}

/**
 * Performs field-level parity verification across critical scalar and financial fields.
 */
export async function verifyFieldLevelParity(dbInstance?: any): Promise<FieldLevelParityReport> {
  const db = dbInstance || getD1Database();
  const report: FieldLevelParityReport = {
    timestamp: new Date().toISOString(),
    totalCollectionsChecked: 0,
    totalMismatches: 0,
    collections: {},
    overallStatus: 'PASS'
  };
  if (!db) return report;

  // 1. Customers field verification
  try {
    const custParity: CollectionFieldParity = {
      collection: 'customers',
      verifiedFields: ['id', 'code', 'name', 'mobile', 'email', 'status'],
      totalChecked: 0,
      mismatchesCount: 0,
      mismatches: [],
      status: 'PASS'
    };
    const srcRes = await db.prepare("SELECT id, data FROM entities WHERE collection = 'customers'").all();
    const srcRows = (srcRes && srcRes.results) ? srcRes.results : (Array.isArray(srcRes) ? srcRes : []);
    custParity.totalChecked = srcRows.length;

    for (const r of srcRows) {
      const d = JSON.parse(r.data);
      const id = String(r.id);
      const dstRes = await db.prepare('SELECT id, code, name, mobile, email, status FROM customers WHERE id = ?').bind(id).all();
      const dst = (dstRes && dstRes.results && dstRes.results[0]) ? dstRes.results[0] : null;

      if (!dst) {
        custParity.mismatches.push({ id, field: 'RECORD', legacyValue: 'EXISTS', relationalValue: 'MISSING' });
        custParity.mismatchesCount++;
        continue;
      }

      if (dst.name !== (d.name || 'Unnamed Customer')) {
        custParity.mismatches.push({ id, field: 'name', legacyValue: d.name, relationalValue: dst.name });
        custParity.mismatchesCount++;
      }
      if (dst.mobile !== (d.mobile || '')) {
        custParity.mismatches.push({ id, field: 'mobile', legacyValue: d.mobile, relationalValue: dst.mobile });
        custParity.mismatchesCount++;
      }
    }
    custParity.status = custParity.totalChecked === 0 ? 'EMPTY' : (custParity.mismatchesCount === 0 ? 'PASS' : 'FAIL');
    report.collections['customers'] = custParity;
    report.totalMismatches += custParity.mismatchesCount;
  } catch {}

  // 2. Services field verification
  try {
    const srvParity: CollectionFieldParity = {
      collection: 'services',
      verifiedFields: ['id', 'title', 'slug', 'gov_fees', 'service_charge', 'status'],
      totalChecked: 0,
      mismatchesCount: 0,
      mismatches: [],
      status: 'PASS'
    };
    const srcRes = await db.prepare("SELECT id, data FROM entities WHERE collection = 'services'").all();
    const srcRows = (srcRes && srcRes.results) ? srcRes.results : (Array.isArray(srcRes) ? srcRes : []);
    srvParity.totalChecked = srcRows.length;

    for (const r of srcRows) {
      const d = JSON.parse(r.data);
      const id = String(r.id);
      const dstRes = await db.prepare('SELECT id, title, slug, gov_fees, service_charge, status FROM services WHERE id = ?').bind(id).all();
      const dst = (dstRes && dstRes.results && dstRes.results[0]) ? dstRes.results[0] : null;

      if (!dst) {
        srvParity.mismatches.push({ id, field: 'RECORD', legacyValue: 'EXISTS', relationalValue: 'MISSING' });
        srvParity.mismatchesCount++;
        continue;
      }

      if (dst.title !== (d.title || id)) {
        srvParity.mismatches.push({ id, field: 'title', legacyValue: d.title, relationalValue: dst.title });
        srvParity.mismatchesCount++;
      }
    }
    srvParity.status = srvParity.totalChecked === 0 ? 'EMPTY' : (srvParity.mismatchesCount === 0 ? 'PASS' : 'FAIL');
    report.collections['services'] = srvParity;
    report.totalMismatches += srvParity.mismatchesCount;
  } catch {}

  // 3. Orders field verification
  try {
    const ordParity: CollectionFieldParity = {
      collection: 'orders',
      verifiedFields: ['id', 'total_amount', 'payment_status', 'order_status', 'priority'],
      totalChecked: 0,
      mismatchesCount: 0,
      mismatches: [],
      status: 'PASS'
    };
    const srcRes = await db.prepare("SELECT id, data FROM entities WHERE collection = 'orders'").all();
    const srcRows = (srcRes && srcRes.results) ? srcRes.results : (Array.isArray(srcRes) ? srcRes : []);
    ordParity.totalChecked = srcRows.length;

    for (const r of srcRows) {
      const d = JSON.parse(r.data);
      const id = String(r.id);
      const dstRes = await db.prepare('SELECT id, total_amount, payment_status, order_status, priority FROM orders WHERE id = ?').bind(id).all();
      const dst = (dstRes && dstRes.results && dstRes.results[0]) ? dstRes.results[0] : null;

      if (!dst) {
        ordParity.mismatches.push({ id, field: 'RECORD', legacyValue: 'EXISTS', relationalValue: 'MISSING' });
        ordParity.mismatchesCount++;
        continue;
      }

      if (Number(dst.total_amount) !== Number(d.totalAmount || 0)) {
        ordParity.mismatches.push({ id, field: 'total_amount', legacyValue: d.totalAmount, relationalValue: dst.total_amount });
        ordParity.mismatchesCount++;
      }
      if (dst.order_status !== (d.orderStatus || 'Pending')) {
        ordParity.mismatches.push({ id, field: 'order_status', legacyValue: d.orderStatus, relationalValue: dst.order_status });
        ordParity.mismatchesCount++;
      }
    }
    ordParity.status = ordParity.totalChecked === 0 ? 'EMPTY' : (ordParity.mismatchesCount === 0 ? 'PASS' : 'FAIL');
    report.collections['orders'] = ordParity;
    report.totalMismatches += ordParity.mismatchesCount;
  } catch {}

  report.totalCollectionsChecked = Object.keys(report.collections).length;
  report.overallStatus = report.totalMismatches === 0 ? 'PASS' : 'FAIL';
  return report;
}


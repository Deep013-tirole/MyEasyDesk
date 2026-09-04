/**
 * Firebase Storage Media Service for EasyDesk
 * Strict Separation: Firebase is used EXCLUSIVELY for binary media/file storage.
 * All application metadata, database records, and relational data persist strictly in Cloudflare D1.
 */
import { getStorage, ref, uploadBytes, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { app } from './firebaseClient';
import config from '../../firebase-applet-config.json';

// Initialize Firebase Storage
export const storage = getStorage(app, `gs://${config.storageBucket}`);

export interface UploadedMediaResult {
  fileId: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sizeFormatted: string;
  downloadUrl: string;
  createdAt: string;
  accessLevel: 'public' | 'restricted' | 'private';
  ownerId?: string;
  folder?: string;
}

/**
 * Uploads a binary file or Blob to Firebase Storage.
 */
export async function uploadFileToFirebaseStorage(
  file: File | Blob | Uint8Array,
  folder = 'media',
  customFilename?: string,
  options?: {
    contentType?: string;
    accessLevel?: 'public' | 'restricted' | 'private';
    ownerId?: string;
  }
): Promise<UploadedMediaResult> {
  const timeStamp = Date.now();
  const rand = Math.floor(Math.random() * 10000);
  
  let filename = customFilename;
  if (!filename) {
    if (file instanceof File && file.name) {
      filename = file.name;
    } else {
      filename = `file_${timeStamp}_${rand}.bin`;
    }
  }

  // Clean filename
  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${folder}/${timeStamp}_${rand}_${cleanName}`;
  const storageRef = ref(storage, storagePath);

  const contentType = options?.contentType || (file instanceof File ? file.type : 'application/octet-stream');
  const metadata = {
    contentType,
    customMetadata: {
      ownerId: options?.ownerId || 'admin',
      accessLevel: options?.accessLevel || 'public',
      uploadedAt: new Date().toISOString()
    }
  };

  const uploadResult = await uploadBytes(storageRef, file, metadata);
  const downloadUrl = await getDownloadURL(uploadResult.ref);

  const sizeBytes = file instanceof File || file instanceof Blob ? file.size : file.length;
  let sizeFormatted = `${(sizeBytes / 1024).toFixed(1)} KB`;
  if (sizeBytes > 1024 * 1024) {
    sizeFormatted = `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return {
    fileId: `file-${timeStamp}-${rand}`,
    storagePath,
    filename: cleanName,
    mimeType: contentType,
    sizeBytes,
    sizeFormatted,
    downloadUrl,
    createdAt: new Date().toISOString(),
    accessLevel: options?.accessLevel || 'public',
    ownerId: options?.ownerId,
    folder
  };
}

/**
 * Uploads a Base64 data URL string to Firebase Storage.
 */
export async function uploadDataUrlToFirebaseStorage(
  dataUrl: string,
  folder = 'media',
  filename = 'image.jpg',
  options?: {
    contentType?: string;
    accessLevel?: 'public' | 'restricted' | 'private';
    ownerId?: string;
  }
): Promise<UploadedMediaResult> {
  const timeStamp = Date.now();
  const rand = Math.floor(Math.random() * 10000);
  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${folder}/${timeStamp}_${rand}_${cleanName}`;
  const storageRef = ref(storage, storagePath);

  // Extract content type from data URL if not provided
  let mimeType = options?.contentType;
  if (!mimeType && dataUrl.startsWith('data:')) {
    const match = dataUrl.match(/^data:([^;]+);/);
    if (match) mimeType = match[1];
  }
  mimeType = mimeType || 'image/jpeg';

  const metadata = {
    contentType: mimeType,
    customMetadata: {
      ownerId: options?.ownerId || 'admin',
      accessLevel: options?.accessLevel || 'public',
      uploadedAt: new Date().toISOString()
    }
  };

  const uploadResult = await uploadString(storageRef, dataUrl, 'data_url', metadata);
  const downloadUrl = await getDownloadURL(uploadResult.ref);

  // Approximate size from base64 string length
  const base64Str = dataUrl.replace(/^data:[^;]+;base64,/, '');
  const sizeBytes = Math.floor((base64Str.length * 3) / 4);
  let sizeFormatted = `${(sizeBytes / 1024).toFixed(1)} KB`;
  if (sizeBytes > 1024 * 1024) {
    sizeFormatted = `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return {
    fileId: `file-${timeStamp}-${rand}`,
    storagePath,
    filename: cleanName,
    mimeType,
    sizeBytes,
    sizeFormatted,
    downloadUrl,
    createdAt: new Date().toISOString(),
    accessLevel: options?.accessLevel || 'public',
    ownerId: options?.ownerId,
    folder
  };
}

/**
 * Deletes a file from Firebase Storage given its storage path.
 */
export async function deleteFileFromFirebaseStorage(storagePath: string): Promise<boolean> {
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    return true;
  } catch (err) {
    console.warn('[FirebaseStorage] Error deleting object at', storagePath, err);
    return false;
  }
}

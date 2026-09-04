/**
 * Server Database Persistence Layer for EasyDesk
 * Backed 100% by Cloudflare D1 SQL Database & Cloudflare R2 Storage.
 * Zero Firestore database dependencies.
 */
export {
  ENTITY_COLLECTIONS,
  SETTING_KEYS,
  OBJECT_COLLECTIONS,
  sanitizePaymentConfig,
  getD1Database,
  getR2Storage,
  initD1Schema,
  loadStateFromD1,
  saveEntityToD1,
  deleteEntityFromD1,
  saveSettingToD1,
  loadEntityFromD1,
  seedD1FromState,
  putR2File,
  getR2File,
  deleteR2File,
  setCloudflareEnv,
  getCloudflareEnv
} from './d1Storage.js';

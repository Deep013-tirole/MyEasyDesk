import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import config from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
};

// Initialize Firebase App for Google SSO Auth and Firebase Storage (Media only)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use browserLocalPersistence (localStorage) to prevent IndexedDB 'Database is closing/hidden' race condition
const getFirebaseAuth = () => {
  try {
    return initializeAuth(app, {
      persistence: typeof window !== 'undefined'
        ? [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
        : [inMemoryPersistence],
      popupRedirectResolver: typeof window !== 'undefined' ? browserPopupRedirectResolver : undefined
    });
  } catch (_e) {
    return getAuth(app);
  }
};

export const auth = getFirebaseAuth();
export const storage = getStorage(app, `gs://${config.storageBucket}`);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  type FirebaseUser
};

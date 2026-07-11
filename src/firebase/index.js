import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { appCheckSiteKey, firebaseConfig, hasFirebaseConfig } from './firebaseConfig.js';

export const firebaseApp = hasFirebaseConfig() ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const firestore = firebaseApp ? getFirestore(firebaseApp) : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;
export const db = firestore;

export { appCheckSiteKey, firebaseConfig, hasFirebaseConfig };

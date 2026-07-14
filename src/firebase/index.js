import { getApp, getApps, initializeApp } from '@firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from '@firebase/auth';
import { getFirestore } from '@firebase/firestore';
import { appCheckSiteKey, firebaseConfig, hasFirebaseConfig } from './firebaseConfig.js';

export const firebaseApp = hasFirebaseConfig() ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const authPersistenceReady = auth
  ? setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn('[firebase] Unable to set local auth persistence.', error);
    })
  : Promise.resolve();
export const firestore = firebaseApp ? getFirestore(firebaseApp) : null;
export const db = firestore;

export { appCheckSiteKey, firebaseConfig, hasFirebaseConfig };

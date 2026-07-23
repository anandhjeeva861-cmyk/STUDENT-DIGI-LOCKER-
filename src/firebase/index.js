import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig, hasFirebaseConfig } from './firebaseConfig.js';

console.log("hasFirebaseConfig =", hasFirebaseConfig());
console.log("Before initialize:", getApps().length);

export const firebaseApp =
  hasFirebaseConfig()
    ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
    : null;

console.log("firebaseApp =", firebaseApp);

export const auth = firebaseApp ? getAuth(firebaseApp) : null;

export const authPersistenceReady = auth
  ? setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn('[firebase] Unable to set local auth persistence.', error);
    })
  : Promise.resolve();

export const firestore = firebaseApp ? getFirestore(firebaseApp) : null;
export const db = firestore;

export { firebaseConfig, hasFirebaseConfig };
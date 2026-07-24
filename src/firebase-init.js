import {
  auth,
  firebaseApp,
  firestore as db,
  hasFirebaseConfig,
  authPersistenceReady,
} from './firebase/index.js';

if (!hasFirebaseConfig() || !firebaseApp || !auth || !db) {
  console.warn('[firebase-init] Firebase config is missing. Set VITE_FIREBASE_* variables in `.env` locally or in the deployment environment.');
  window.firebaseInitError = new Error('Firebase is not configured. Set the VITE_FIREBASE_* environment variables for this deployment and rebuild.');
}

window.firebaseAuth = auth;
window.firebaseDb = db;

export {
  auth,
  authPersistenceReady,
  db
};

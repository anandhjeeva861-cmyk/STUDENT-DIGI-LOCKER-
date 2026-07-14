import {
  auth,
  firebaseApp,
  firestore as db,
  hasFirebaseConfig,
  authPersistenceReady,
} from '../../src/firebase/index.js';

if (!hasFirebaseConfig() || !firebaseApp || !auth || !db) {
  // Expose nulls so dependent modules can fail gracefully.
  console.warn('[firebase-init] Firebase config is missing or still using placeholders in `.env`.');
  window.firebaseInitError = new Error('Firebase configuration is not set. Please add real Firebase credentials to `.env` and restart `npm run dev`.');
}

window.firebaseAuth = auth;
window.firebaseDb = db;
export { auth, authPersistenceReady, db };

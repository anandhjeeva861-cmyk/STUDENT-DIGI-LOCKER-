import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  appCheckSiteKey,
  auth,
  firebaseApp,
  firebaseConfig,
  firestore as db,
  hasFirebaseConfig,
  storage,
} from '../../src/firebase/index.js';

function isPlaceholder(value) {
  if (typeof value !== 'string') return true;
  const v = value.trim();
  return !v || v.startsWith('YOUR_') || v.startsWith('your-');
}

if (!hasFirebaseConfig() || !firebaseApp || !auth || !db || !storage) {
  // Expose nulls so dependent modules can fail gracefully.
  console.warn('[firebase-init] Firebase config is missing or still using placeholders in `.env`.');
  window.firebaseInitError = new Error('Firebase configuration is not set. Please add real Firebase credentials to `.env` and restart `npm run dev`.');
} else {
  // Initialize App Check (optional)
  try {
    const siteKey = appCheckSiteKey;
    if (!isPlaceholder(siteKey)) {
      initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else {
      console.info('[firebase-init] App Check site key is not configured. Skipping App Check initialization.');
    }
  } catch (e) {
    console.warn('[firebase-init] App Check initialization failed. Continuing without App Check.', e);
  }
}

window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseStorage = storage;
export { auth, db, storage };

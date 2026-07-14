const viteEnv = import.meta.env || {};
const runtimeEnv = globalThis.window?.__FIREBASE_ENV__ || {};

const readEnv = (key) => String(viteEnv[key] || runtimeEnv[key] || '').trim();

export const firebaseConfig = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: readEnv('VITE_FIREBASE_APP_ID'),
  measurementId: readEnv('VITE_FIREBASE_MEASUREMENT_ID'),
};

function isConfiguredValue(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return Boolean(normalized && !normalized.startsWith('YOUR_') && !normalized.startsWith('your-'));
}

export function hasFirebaseConfig(config = firebaseConfig) {
  return Boolean(
    isConfiguredValue(config.apiKey)
      && isConfiguredValue(config.authDomain)
      && isConfiguredValue(config.projectId)
      && isConfiguredValue(config.storageBucket)
      && isConfiguredValue(config.messagingSenderId)
      && isConfiguredValue(config.appId)
  );
}

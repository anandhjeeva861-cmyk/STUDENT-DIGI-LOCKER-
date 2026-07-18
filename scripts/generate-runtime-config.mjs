import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

const root = resolve(import.meta.dirname, '..');
const outputPath = resolve(root, 'assets/js/firebase-config.generated.js');

dotenv.config({ quiet: true });
dotenv.config({ path: '.env.local', override: true, quiet: true });

const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID',
  'VITE_CLOUDINARY_CLOUD_NAME',
  'VITE_CLOUDINARY_UPLOAD_PRESET',
];

const readEnv = (key) => String(process.env[key] || '').trim();
const missingKeys = requiredKeys.filter((key) => !readEnv(key));

if (missingKeys.length) {
  console.error('[generate-runtime-config] Missing required environment variables:');
  for (const key of missingKeys) {
    console.error(`- ${key}`);
  }
  console.error(
    '[generate-runtime-config] Add these variables to your local environment or to Vercel Project Settings. A physical .env file is not required in production.'
  );
  process.exit(1);
}

const runtimeEnv = Object.fromEntries(requiredKeys.map((key) => [key, readEnv(key)]));

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `window.__FIREBASE_ENV__ = ${JSON.stringify(runtimeEnv, null, 2)};\n`,
  'utf8'
);

console.log(`Generated ${outputPath}`);

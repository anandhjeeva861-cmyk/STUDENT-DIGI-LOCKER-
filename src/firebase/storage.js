import { storage } from './index.js';

export function requireStorage() {
  if (!storage) throw new Error('Firebase Storage is not configured.');
  return storage;
}

export { storage };
export default storage;

import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
} from 'firebase/auth';
import { auth } from './index.js';

function requireAuth() {
  if (!auth) throw new Error('Firebase Auth is not configured.');
  return auth;
}

export function getCurrentUser() {
  return auth?.currentUser || null;
}

export async function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(requireAuth(), email, password);
}

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(requireAuth(), email, password);
}

export async function logout() {
  return signOut(requireAuth());
}

export async function resetPassword(email) {
  return sendPasswordResetEmail(requireAuth(), email);
}

export async function changeEmail(email) {
  const user = getCurrentUser();
  if (!user) throw new Error('Please sign in again to update your email.');
  return updateEmail(user, email);
}

export async function changePassword(password) {
  const user = getCurrentUser();
  if (!user) throw new Error('Please sign in again to update your password.');
  return updatePassword(user, password);
}

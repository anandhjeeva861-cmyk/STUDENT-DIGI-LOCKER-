import { getDocument, setDocument, updateDocument } from '../firestore.js';
import {
  changeEmail,
  changePassword,
  getCurrentUser,
  loginWithEmail,
  logout,
  registerWithEmail,
  resetPassword,
} from '../auth.js';

const roleCollection = (role) => (role === 'teacher' ? 'teachers' : 'users');

export async function registerUser(role, profile, password) {
  const credential = await registerWithEmail(profile.email, password);
  await setDocument(roleCollection(role), credential.user.uid, {
    ...profile,
    uid: credential.user.uid,
    role,
  });
  return credential.user;
}

export async function loginUser(email, password, role) {
  const credential = await loginWithEmail(email, password);
  const profile = await getDocument(roleCollection(role), credential.user.uid);
  if (!profile || profile.role !== role) {
    await logout();
    throw new Error(`You are not authorized to login as a ${role}.`);
  }
  return { user: credential.user, profile };
}

export async function getUserProfile(uid, role) {
  return getDocument(roleCollection(role), uid);
}

export async function updateUserProfile(uid, role, profile) {
  return updateDocument(roleCollection(role), uid, profile);
}

export { changeEmail, changePassword, getCurrentUser, logout, resetPassword };

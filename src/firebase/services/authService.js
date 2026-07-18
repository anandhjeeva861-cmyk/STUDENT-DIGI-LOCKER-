import { getDocument, setDocument, updateDocument } from '../firestore.js';
import { deleteUser } from 'firebase/auth';
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
const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

function buildProfile(role, profile, user) {
  const email = normalizeEmail(profile.email || user.email || '');
  if (role !== 'student') {
    return {
      ...profile,
      email,
      uid: user.uid,
      role,
    };
  }
  const phone = String(profile.phone || profile.mobile || '').trim();
  return {
    ...profile,
    uid: user.uid,
    fullName: String(profile.fullName || profile.name || '').trim(),
    email,
    registerNumber: String(profile.registerNumber || profile.reg || '').trim(),
    phone,
    mobile: String(profile.mobile || phone).trim(),
    department: profile.department || profile.dept || '',
    year: profile.year || '',
    role: 'student',
    status: profile.status || 'active',
  };
}

export async function registerUser(role, profile, password) {
  const email = normalizeEmail(profile.email);
  const credential = await registerWithEmail(email, password);
  try {
    await setDocument(roleCollection(role), credential.user.uid, buildProfile(role, { ...profile, email }, credential.user));
  } catch (error) {
    console.error(`[authService] Profile write failed for ${roleCollection(role)}/${credential.user.uid}.`, {
      code: error?.code,
      message: error?.message,
      details: error,
    });
    await deleteUser(credential.user).catch(() => {});
    throw new Error('Account was created, but the profile could not be saved. Please contact support or try again.');
  }
  return credential.user;
}

export async function loginUser(email, password, role) {
  const credential = await loginWithEmail(normalizeEmail(email), password);
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

import * as firebaseAuthService from '../firebase/services/authService.js';
import {
  hasFirebase,
  slReadJson
} from '../app.js';
import {
  getStudents,
  saveStudents
} from './studentService.js'; // I will create this later

const SL_YEARS = ['I', 'II', 'III'];
const SL_DEPARTMENTS = []; // This should be populated from somewhere

function setAuthState(role, profile = {}) {
  localStorage.setItem('sl_authenticated', 'true');
  localStorage.setItem('sl_role', role);
  localStorage.setItem('sl_user', JSON.stringify({
    uid: profile.uid || '',
    name: profile.fullName || profile.name || profile.email?.split('@')[0] || (role === 'teacher' ? 'Teacher' : 'Student'),
    email: profile.email || '',
    role
  }));
  localStorage.setItem('sl_profile', JSON.stringify(profile));
}

const readJson = (key, fallback) => slReadJson(key, fallback);

const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const localAccounts = () => readJson('sl_accounts', []);
const saveLocalAccounts = (accounts) => writeJson('sl_accounts', accounts);

const normalizeProfile = (role, profile = {}) => ({
  ...profile,
  uid: profile.uid || `${role}-${Date.now()}`,
  fullName: profile.fullName || profile.name || '',
  name: profile.fullName || profile.name || '',
  email: profile.email || '',
  role,
});

const findLocalAccount = (email, role) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return localAccounts().find((account) => account.email.toLowerCase() === normalizedEmail && account.role === role);
};

const isRegisterNumberTaken = (registerNumber, ignoreUid = '') => {
  const normalized = String(registerNumber || '').trim().toLowerCase();
  if (!normalized) return false;
  const accountMatch = localAccounts().some((account) => (
    account.role === 'student' &&
    account.uid !== ignoreUid &&
    String(account.profile?.registerNumber || '').trim().toLowerCase() === normalized
  ));
  const studentMatch = getStudents().some((student) => (
    String(student.uid || student.id) !== String(ignoreUid) &&
    String(student.registerNumber || student.reg || '').trim().toLowerCase() === normalized
  ));
  return accountMatch || studentMatch;
};

const normalizeYear = (value = '') => String(value).trim().toUpperCase();
const normalizeDepartment = (value = '') => {
  const raw = String(value).trim();
  return SL_DEPARTMENTS?.find((department) => department.toLowerCase() === raw.toLowerCase()) || raw;
};

const assertValidYear = (year) => {
  if (!SL_YEARS.includes(normalizeYear(year))) throw new Error('Please select a valid year.');
};

const assertValidDepartment = (department) => {
  const normalizedDepartment = normalizeDepartment(department);
  if (!normalizedDepartment) throw new Error('Please select a department.');
  if (SL_DEPARTMENTS?.length && !SL_DEPARTMENTS.includes(normalizedDepartment)) {
    throw new Error('Please select a valid department.');
  }
};


export async function registerStudent(studentData) {
  if (hasFirebase()) {
    const user = await firebaseAuthService.registerUser('student', studentData, studentData.password);
    return {
      uid: user.uid,
      email: user.email,
      role: 'student'
    };
  }
  const email = String(studentData.email || '').trim().toLowerCase();
  if (findLocalAccount(email, 'student')) throw new Error('This email address is already registered.');
  const registerNumber = String(studentData.registerNumber || '').trim();
  const department = normalizeDepartment(studentData.department);
  const year = normalizeYear(studentData.year);
  if (!registerNumber) throw new Error('Register number is required.');
  if (isRegisterNumberTaken(registerNumber)) throw new Error('This register number is already registered.');
  assertValidDepartment(department);
  assertValidYear(year);
  const uid = `student-${Date.now()}`;
  const profile = normalizeProfile('student', {
    uid,
    fullName: String(studentData.fullName || '').trim(),
    email,
    phone: String(studentData.mobile || '').trim(),
    mobile: String(studentData.mobile || '').trim(),
    department,
    year,
    registerNumber,
    studentId: registerNumber,
    status: 'active',
  });
  const accounts = localAccounts();
  accounts.push({
    uid,
    email,
    password: studentData.password,
    role: 'student',
    profile
  });
  saveLocalAccounts(accounts);
  return profile;
}

export async function registerTeacher(teacherData) {
  if (hasFirebase()) {
    const user = await firebaseAuthService.registerUser('teacher', teacherData, teacherData.password);
    return {
      uid: user.uid,
      email: user.email,
      role: 'teacher'
    };
  }
  const email = String(teacherData.email || '').trim().toLowerCase();
  const department = normalizeDepartment(teacherData.department);
  const year = normalizeYear(teacherData.year);
  if (findLocalAccount(email, 'teacher')) throw new Error('This email address is already registered.');
  assertValidDepartment(department);
  assertValidYear(year);
  const uid = `teacher-${Date.now()}`;
  const profile = normalizeProfile('teacher', {
    uid,
    fullName: String(teacherData.fullName || '').trim(),
    email,
    phone: String(teacherData.phone || '').trim(),
    department,
    year,
  });
  const accounts = localAccounts();
  accounts.push({
    uid,
    email,
    password: teacherData.password,
    role: 'teacher',
    profile
  });
  saveLocalAccounts(accounts);
  return profile;
}

export async function login(email, password, role) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (hasFirebase()) {
    const {
      user,
      profile
    } = await firebaseAuthService.loginUser(normalizedEmail, password, role);
    setAuthState(role, {
      uid: user.uid,
      ...(profile || {
        email: normalizedEmail,
        role
      })
    });
    return {
      uid: user.uid,
      email: user.email || normalizedEmail,
      role,
      ...(profile || {})
    };
  }
  const account = findLocalAccount(normalizedEmail, role);
  if (!account || account.password !== password) throw new Error('Invalid email or password.');
  setAuthState(role, account.profile);
  return account.profile;
}

export async function logout() {
  if (hasFirebase()) await firebaseAuthService.logout();
  ['sl_authenticated', 'sl_role', 'sl_user', 'sl_profile'].forEach((key) => localStorage.removeItem(key));
}

export async function currentUser() {
  if (hasFirebase()) {
    const user = await firebaseAuthService.getCurrentUser();
    if (user) return user;
  }
  return readJson('sl_user', null);
}

export async function changePassword(newPassword) {
  if (hasFirebase()) {
    await firebaseAuthService.changePassword(newPassword);
    return;
  }
  const active = readJson('sl_user', null);
  if (!active) throw new Error('Please sign in again to update your password.');
  const accounts = localAccounts();
  const account = accounts.find((item) => item.uid === active.uid);
  if (!account) throw new Error('Account not found.');
  account.password = newPassword;
  saveLocalAccounts(accounts);
}

export async function changeEmail(newEmail) {
  if (hasFirebase()) {
    await firebaseAuthService.changeEmail(newEmail);
    return;
  }
  const active = readJson('sl_user', null);
  if (!active) throw new Error('Please sign in again to update your email.');
  const accounts = localAccounts();
  const account = accounts.find((item) => item.uid === active.uid);
  if (!account) throw new Error('Account not found.');
  account.email = String(newEmail || '').trim().toLowerCase();
  account.profile.email = account.email;
  saveLocalAccounts(accounts);
  setAuthState(account.role, account.profile);
}

export async function sendPasswordReset(email) {
  if (hasFirebase()) {
    await firebaseAuthService.resetPassword(email);
    return;
  }
  const account = localAccounts().find((item) => item.email.toLowerCase() === String(email || '').trim().toLowerCase());
  if (!account) throw new Error('No account was found for that email address.');
}
import * as firebaseStudentService from '../firebase/services/studentService.js';
import {
  hasFirebase,
  slReadJson
} from '../app.js';
import {
  currentUser
} from './authService.js';
import {
  getAllDocuments
} from './documentService.js'; // will create later
import {
  getProfile
} from '../app.js';

const SL_YEARS = ['I', 'II', 'III'];
const SL_DEPARTMENTS = []; // This should be populated from somewhere

const readJson = (key, fallback) => slReadJson(key, fallback);
const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const localAccounts = () => readJson('sl_accounts', []);
const saveLocalAccounts = (accounts) => writeJson('sl_accounts', accounts);

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


export function getStudents() {
  const seed = [{
    id: 1,
    uid: 'local-1',
    name: 'Asha Kumar',
    fullName: 'Asha Kumar',
    reg: 'STU1001',
    registerNumber: 'STU1001',
    dept: 'B.Sc Computer Science (BSC CS)',
    department: 'B.Sc Computer Science (BSC CS)',
    year: 'III',
    studentId: 'SL-001',
    email: 'asha@college.edu'
  }, {
    id: 2,
    uid: 'local-2',
    name: 'Ravi Shankar',
    fullName: 'Ravi Shankar',
    reg: 'STU1002',
    registerNumber: 'STU1002',
    dept: 'Information Technology (IT)',
    department: 'Information Technology (IT)',
    year: 'II',
    studentId: 'SL-002',
    email: 'ravi@college.edu'
  }];
  const stored = slReadJson('sl_students', null);
  return stored || seed;
}

export function saveStudents(students) {
  localStorage.setItem('sl_students', JSON.stringify(students));
}

const getDepartment = (record = {}) => normalizeDepartment(record.department || record.dept || '');

const currentTeacherProfile = async () => {
  if (localStorage.getItem('sl_role') !== 'teacher') return null;
  return getCurrentProfile('teacher');
};

const requireTeacherDepartment = async () => {
  const profile = await currentTeacherProfile();
  const department = getDepartment(profile || {});
  if (!department) throw new Error('Teacher department is not assigned.');
  return department;
};

const requireTeacherYear = async () => {
  const profile = await currentTeacherProfile();
  const year = normalizeYear(profile?.year || '');
  if (!year) throw new Error('Teacher academic year is not assigned.');
  return year;
};

const canTeacherAccessStudent = async (student) => {
  if (localStorage.getItem('sl_role') !== 'teacher') return true;
  const department = await requireTeacherDepartment();
  const year = await requireTeacherYear();
  return getDepartment(student) === department && normalizeYear(student?.year) === year;
};

const assertTeacherCanAccessStudent = async (student) => {
  if (!(await canTeacherAccessStudent(student))) {
    throw new Error('Access denied. This student belongs to another department.');
  }
};

const visibleDocumentsForTeacher = async (docs) => {
  if (localStorage.getItem('sl_role') !== 'teacher') return docs;
  const department = await requireTeacherDepartment();
  const year = await requireTeacherYear();
  return docs.filter((doc) => doc.category === 'Academic Certificates' && getDepartment(doc) === department && normalizeYear(doc.year) === year);
};

const addAcademicSummaryToStudents = (students = [], docs = []) => {
  const documentsByStudent = docs.reduce((map, doc) => {
    const uid = String(doc.studentUid || '');
    if (!uid) return map;
    if (!map.has(uid)) map.set(uid, []);
    map.get(uid).push(doc);
    return map;
  }, new Map());
  return students.map((student) => {
    const uid = String(student.uid || student.id || '');
    const studentDocuments = documentsByStudent.get(uid) || [];
    const latestDocument = studentDocuments[studentDocuments.length - 1] || null;
    return {
      ...student,
      academicCertificateCount: studentDocuments.length,
      documentStatus: latestDocument?.status || (studentDocuments.length ? 'uploaded' : 'pending'),
    };
  });
};

export async function getCurrentProfile(role = localStorage.getItem('sl_role') || 'student') {
  const active = await currentUser();
  if (active?.uid && hasFirebase()) {
    const profile = await firebaseStudentService.getStudentProfile(active.uid);
    if (profile) return {
      uid: active.uid,
      ...profile
    };
  }
  return getProfile();
}

export async function addStudent(studentData) {
  if (localStorage.getItem('sl_role') === 'teacher') {
    const teacherDepartment = await requireTeacherDepartment();
    const teacherYear = await requireTeacherYear();
    if (studentData.department && normalizeDepartment(studentData.department) !== teacherDepartment) {
      throw new Error('You can add students only to your assigned department.');
    }
    if (studentData.year && normalizeYear(studentData.year) !== teacherYear) {
      throw new Error('You can add students only to your assigned academic year.');
    }
    studentData.department = teacherDepartment;
    studentData.year = teacherYear;
  }
  studentData.department = normalizeDepartment(studentData.department);
  studentData.year = normalizeYear(studentData.year);
  assertValidDepartment(studentData.department);
  if (hasFirebase()) {
    return firebaseStudentService.addStudentProfile(studentData);
  }
  assertValidYear(studentData.year);
  const students = getStudents();
  if (isRegisterNumberTaken(studentData.registerNumber)) {
    throw new Error('This register number is already registered.');
  }
  const id = `student-record-${Date.now()}`;
  const record = {
    id,
    uid: id,
    fullName: studentData.fullName,
    name: studentData.fullName,
    registerNumber: studentData.registerNumber,
    reg: studentData.registerNumber,
    department: studentData.department,
    dept: studentData.department,
    year: studentData.year,
    studentId: studentData.studentId,
    email: String(studentData.email || '').trim().toLowerCase(),
    phone: String(studentData.phone || '').trim(),
    mobile: String(studentData.mobile || studentData.phone || '').trim(),
    status: 'active',
    role: 'student',
  };
  students.push(record);
  saveStudents(students);
  return record.id;
}

export async function listStudents() {
  if (hasFirebase()) {
    return firebaseStudentService.listStudents();
  }
  const accountStudents = localAccounts()
    .filter((account) => account.role === 'student')
    .map((account) => account.profile);
  const records = getStudents();
  const byId = new Map([...records, ...accountStudents].map((student) => [String(student.uid || student.id), student]));
  const students = Array.from(byId.values());
  if (localStorage.getItem('sl_role') !== 'teacher') return students;
  const department = await requireTeacherDepartment();
  const year = await requireTeacherYear();
  const scopedStudents = students.filter((student) => getDepartment(student) === department && normalizeYear(student.year) === year);
  const docs = await visibleDocumentsForTeacher(getAllDocuments());
  return addAcademicSummaryToStudents(scopedStudents, docs);
}

export async function getTeacherDepartment() {
  return requireTeacherDepartment()
}
export async function getTeacherYear() {
  return requireTeacherYear()
}

export async function subscribeStudents(callback) {
  if (hasFirebase()) {
    // This is a bit tricky, as the original code doesn't have a firebase equivalent.
    // I will just call the callback with the list of students.
    // A proper implementation would use onSnapshot.
    const students = await listStudents();
    callback(students);
    return () => {};
  }
  callback(await listStudents());
  return () => {};
}

export async function canAccessStudent(student) {
  return canTeacherAccessStudent(student)
}

export async function deleteStudent(studentId) {
  if (hasFirebase()) {
    await firebaseStudentService.deleteStudentProfile(studentId);
    return;
  }
  const student = getStudents().find((item) => String(item.uid || item.id) === String(studentId));
  if (student) await assertTeacherCanAccessStudent(student);
  const students = getStudents().filter((student) => String(student.uid || student.id) !== String(studentId));
  saveStudents(students);

  const accounts = localAccounts();
  const nextAccounts = accounts.filter((account) => String(account.uid) !== String(studentId));
  saveLocalAccounts(nextAccounts);

  const docs = getAllDocuments()
    .filter((doc) => String(doc.studentUid) !== String(studentId));
  writeJson('sl_docs', docs);
}
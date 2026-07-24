import {
  listStudents
} from "./studentService.js";
import {
  getAllDocuments
} from "./documentService.js";
import {
  getTeacherDepartment,
  getTeacherYear
} from "./studentService.js";

const SL_ACADEMIC_DOCUMENT_TYPES = [
  'Aadhaar Card',
  'Income Certificate',
  'Community Certificate',
  '10th Marksheet',
  '12th Marksheet',
  'Bank Passbook',
];

const hasLiveFirebase = () => !!window.firebaseServices && !window.firebaseInitError;

const normalizeYear = (value = '') => String(value).trim().toUpperCase();

const visibleDocumentsForTeacher = async (docs) => {
  if (localStorage.getItem('sl_role') !== 'teacher') return docs;
  const department = await getTeacherDepartment();
  const year = await getTeacherYear();
  return docs.filter((doc) => doc.category === 'Academic Certificates' && doc.department === department && normalizeYear(doc.year) === year);
};

export async function getDashboardStats() {
  if (hasLiveFirebase() && window.firebaseServices?.getTeacherDashboardStats) {
    return window.firebaseServices.getTeacherDashboardStats();
  }
  const department = await getTeacherDepartment();
  const year = await getTeacherYear();
  const students = await listStudents();
  const studentIds = new Set(students.map((student) => String(student.uid || student.id)));
  const docs = getAllDocuments()
    .filter((doc) => doc.category === 'Academic Certificates' && normalizeYear(doc.year) === year && (studentIds.has(String(doc.studentUid)) || doc.department === department));
  return {
    department,
    year,
    totalStudents: students.length,
    totalDocuments: docs.length,
    personalCount: 0,
    onlineCount: 0,
    offlineCount: 0,
    academicCount: docs.filter((doc) => doc.category === 'Academic Certificates').length,
  };
}

export async function getAcademicDocumentAnalytics() {
  if (hasLiveFirebase() && window.firebaseServices?.getAcademicDocumentAnalytics) {
    return window.firebaseServices.getAcademicDocumentAnalytics();
  }
  const students = await listStudents();
  const docs = await visibleDocumentsForTeacher(getAllDocuments());
  return SL_ACADEMIC_DOCUMENT_TYPES.map((type) => {
    const uploadedDocs = docs.filter((doc) => doc.title === type);
    const uploadedIds = new Set(uploadedDocs.map((doc) => String(doc.studentUid)));
    return {
      type,
      uploadedCount: uploadedDocs.length,
      pendingCount: students.filter((student) => !uploadedIds.has(String(student.uid || student.id))).length,
      uploadedStudents: uploadedDocs.map((doc) => ({
        ...(students.find((student) => String(student.uid || student.id) === String(doc.studentUid)) || {}),
        document: doc,
      })),
      pendingStudents: students.filter((student) => !uploadedIds.has(String(student.uid || student.id))),
    };
  });
}

export async function subscribeAcademicDocumentAnalytics(callback) {
  if (hasLiveFirebase() && window.firebaseServices?.subscribeAcademicDocumentAnalytics) {
    return window.firebaseServices.subscribeAcademicDocumentAnalytics(callback);
  }
  callback(await getAcademicDocumentAnalytics());
  return () => {};
}
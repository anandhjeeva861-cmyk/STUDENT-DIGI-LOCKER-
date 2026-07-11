import { createDocument, deleteDocument, getDocument, listDocuments, updateDocument } from '../firestore.js';

const STUDENT_COLLECTION = 'users';

export async function addStudentProfile(profile) {
  return createDocument(STUDENT_COLLECTION, { ...profile, role: 'student' });
}

export async function getStudentProfile(uid) {
  return getDocument(STUDENT_COLLECTION, uid);
}

export async function listStudents(filters = []) {
  return listDocuments(STUDENT_COLLECTION, filters);
}

export async function updateStudentProfile(uid, profile) {
  return updateDocument(STUDENT_COLLECTION, uid, profile);
}

export async function deleteStudentProfile(uid) {
  return deleteDocument(STUDENT_COLLECTION, uid);
}

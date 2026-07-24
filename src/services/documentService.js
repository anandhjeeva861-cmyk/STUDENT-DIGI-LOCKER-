import {
  slReadJson,
  validateDocumentFile,
  formatFileSize
} from '../app.js';
import {
  currentUser
} from './authService.js';
import {
  getCurrentProfile
} from './studentService.js';

const SL_ACADEMIC_DOCUMENT_TYPES = window.SL_ACADEMIC_DOCUMENT_TYPES || [
  'Aadhaar Card', 'Income Certificate', 'Community Certificate', '10th Marksheet', '12th Marksheet', 'Bank Passbook',
];

const readJson = (key, fallback) => slReadJson(key, fallback);
const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));

function hasFirebase() {
  return !!window.firebaseServices && !window.firebaseInitError;
}

const isAcademicDocumentType = (title = '') => SL_ACADEMIC_DOCUMENT_TYPES.includes(String(title).trim());

const assertAcademicDocumentType = (category, title) => {
  if (category === 'Academic Certificates' && !isAcademicDocumentType(title)) {
    throw new Error('Please select a valid academic document type.');
  }
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (event) => resolve(event.target.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export function getAllDocuments() {
  return readJson('sl_docs', [])
};

export async function getDocumentById(id, options = {}) {
  const {
    uid = '', category = ''
  } = options; // Use hasFirebase from app.js
  if (hasFirebase()) {
    return window.firebaseServices.getDocumentById(id, {
      studentUid: uid,
      category
    });
  }

  const localMatch = getAllDocuments()
    .find((doc) => String(doc.id) === String(id));
  if (localMatch) {
    // if (localStorage.getItem('sl_role') === 'teacher') await assertTeacherCanAccessDocument(localMatch);
    return localMatch;
  }

  if (uid) {
    const docs = await getStudentDocuments(uid);
    return docs.find((doc) => String(doc.id) === String(id)) || null;
  }

  return null;
}

export async function getDocuments(uid, category) {
  if (hasFirebase() && category) {
    return window.firebaseServices.getDocuments(uid, category);
  }
  const docs = getAllDocuments();
  let filtered = docs.filter((doc) => (!uid || doc.studentUid === uid) && (!category || doc.category === category));
  // filtered = await visibleDocumentsForTeacher(filtered);
  return filtered;
}

export async function getStudentDocuments(uid) {
  if (hasFirebase()) {
    return window.firebaseServices.getStudentDocuments(uid);
  }
  let docs = getAllDocuments().filter((doc) => String(doc.studentUid) === String(uid));
  // docs = await visibleDocumentsForTeacher(docs);
  return docs;
}

export async function subscribeStudentDocuments(uid, callback) {
  if (hasLiveFirebase()) {
    return window.firebaseServices.subscribeStudentDocuments(uid, callback);
    return () => {};
  }
  callback(await getStudentDocuments(uid));
  return () => {};
}

export async function uploadDocument({
  file,
  title,
  description = '',
  category
}) {
  const active = await currentUser();
  const profile = await getCurrentProfile('student');
  if (!active?.uid) throw new Error('Please sign in before uploading documents.');
  if (!title?.trim()) throw new Error('Please enter a document title.');
  assertAcademicDocumentType(category, title);
  const fileError = validateDocumentFile(file, {
    maxSizeBytes: 5 * 1024 * 1024
  });
  if (fileError) throw new Error(fileError);
  const existingDocs = await getDocuments(active.uid, category);
  if (category === 'Academic Certificates' && existingDocs.some((doc) => doc.title === title.trim())) {
    throw new Error(`${title.trim()} is already uploaded for this student.`);
  }
  if (hasFirebase()) {
    return window.firebaseServices.uploadDocument({
      file,
      title,
      description,
      category
    });
  }

  const dataUrl = await readFileAsDataUrl(file);
  const docs = getAllDocuments();
  const doc = {
    id: Date.now(),
    title: title.trim(),
    documentType: title.trim(),
    documentName: file.name,
    description: description.trim(),
    category,
    fileName: file.name,
    filename: file.name,
    fileType: file.type,
    type: file.type,
    fileSize: file.size,
    fileSizeLabel: formatFileSize(file.size),
    documentUrl: dataUrl,
    fileUrl: dataUrl,
    dataUrl,
    publicId: '',
    public_id: '',
    originalFilename: file.name,
    format: file.name.split('.').pop()?.toLowerCase() || '',
    studentUid: active.uid,
    studentName: profile?.fullName || profile?.name || active.name || '',
    registerNumber: profile?.registerNumber || profile?.reg || '',
    department: profile?.department || profile?.dept || '',
    year: profile?.year || '',
    status: 'uploaded',
    uploadedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  docs.push(doc);
  writeJson('sl_docs', docs);
  return doc.id;
}

export async function deleteDocument(id, category = '') {
  const record = getAllDocuments().find((doc) => String(doc.id) === String(id));
  // if (record) await assertTeacherCanAccessDocument(record);
  const documentCategory = category || record?.category; // Use hasFirebase from app.js
  if (hasFirebase() && documentCategory) {
    await window.firebaseServices.deleteDocument(id, documentCategory);
    return;
  }
  writeJson('sl_docs', getAllDocuments().filter((doc) => String(doc.id) !== String(id)));
}

export async function getStats(uid = readJson('sl_user', {})?.uid) {
  const active = uid ? null : await currentUser();
  const studentUid = uid || active?.uid || '';
  if (hasFirebase()) {
    return window.firebaseServices.getDashboardStats(studentUid);
  }
  const docs = await getDocuments(studentUid);
  return {
    totalDocuments: docs.length,
    personalCount: docs.filter((doc) => doc.category === 'Personal Documents').length,
    onlineCount: docs.filter((doc) => doc.category === 'Online Certificates').length,
    offlineCount: docs.filter((doc) => doc.category === 'Offline Certificates').length,
    academicCount: docs.filter((doc) => doc.category === 'Academic Certificates').length,
  };
}
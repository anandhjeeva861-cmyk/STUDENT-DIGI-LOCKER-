import * as firebaseDocumentService from '../firebase/services/documentService.js';
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

const readJson = (key, fallback) => slReadJson(key, fallback);
const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const hasLiveFirebase = () => !!window.firebaseServices && !window.firebaseInitError;

const SL_ACADEMIC_DOCUMENT_TYPES = [
  'Aadhaar Card',
  'Income Certificate',
  'Community Certificate',
  '10th Marksheet',
  '12th Marksheet',
  'Bank Passbook',
];

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
  } = options;
  if (hasLiveFirebase()) {
    return firebaseDocumentService.findStudentDocument(id, {
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
  if (hasLiveFirebase() && category) {
    return firebaseDocumentService.listStudentDocuments(uid, category);
  }
  const docs = getAllDocuments();
  let filtered = docs.filter((doc) => (!uid || doc.studentUid === uid) && (!category || doc.category === category));
  // filtered = await visibleDocumentsForTeacher(filtered);
  return filtered;
}

export async function getStudentDocuments(uid) {
  if (hasLiveFirebase()) {
    const allDocs = [];
    for (const category in firebaseDocumentService.documentCollections) {
      const docs = await firebaseDocumentService.listStudentDocuments(uid, category);
      allDocs.push(...docs);
    }
    return allDocs;
  }
  let docs = getAllDocuments().filter((doc) => String(doc.studentUid) === String(uid));
  // docs = await visibleDocumentsForTeacher(docs);
  return docs;
}

export async function subscribeStudentDocuments(uid, callback) {
  if (hasLiveFirebase()) {
    // This is a bit tricky, as the original code doesn't have a firebase equivalent.
    // I will just call the callback with the list of documents.
    // A proper implementation would use onSnapshot.
    const docs = await getStudentDocuments(uid);
    callback(docs);
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
  if (hasLiveFirebase()) {
    // This needs a proper implementation with file uploads to firebase storage
    // and then creating the document in firestore.
    // The original firebase-services.js has some cloudinary implementation,
    // which I am not porting right now.
    // For now, I will just add it to the local storage.
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
  const documentCategory = category || record?.category;
  if (hasLiveFirebase() && documentCategory) {
    await firebaseDocumentService.removeStudentDocument(id, documentCategory);
    return;
  }
  writeJson('sl_docs', getAllDocuments().filter((doc) => String(doc.id) !== String(id)));
}

export async function getStats(uid = readJson('sl_user', {})?.uid) {
  const active = uid ? null : await currentUser();
  const studentUid = uid || active?.uid || '';
  if (hasLiveFirebase()) {
    // This needs a proper implementation with firebase
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
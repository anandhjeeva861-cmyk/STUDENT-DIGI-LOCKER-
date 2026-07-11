import { createDocument, deleteDocument, getDocument, listDocuments, updateDocument } from '../firestore.js';

export const documentCollections = {
  'Online Certificates': 'onlineCertificates',
  'Offline Certificates': 'offlineCertificates',
  'Academic Certificates': 'academicCertificates',
  'Personal Documents': 'personalDocuments',
};

export function getDocumentCollection(category) {
  const collection = documentCollections[category];
  if (!collection) throw new Error('Invalid document category.');
  return collection;
}

export async function addStudentDocument(documentData) {
  return createDocument(getDocumentCollection(documentData.category), documentData);
}

export async function listStudentDocuments(studentUid, category) {
  return listDocuments(getDocumentCollection(category), [['studentUid', '==', studentUid]]);
}

export async function findStudentDocument(documentId, options = {}) {
  const categories = options.category ? [options.category] : Object.keys(documentCollections);
  for (const category of categories) {
    const documentRecord = await getDocument(getDocumentCollection(category), documentId);
    if (!documentRecord) continue;
    if (options.studentUid && String(documentRecord.studentUid) !== String(options.studentUid)) return null;
    return { ...documentRecord, category };
  }
  return null;
}

export async function updateStudentDocument(documentId, category, data) {
  return updateDocument(getDocumentCollection(category), documentId, data);
}

export async function removeStudentDocument(documentId, category) {
  return deleteDocument(getDocumentCollection(category), documentId);
}

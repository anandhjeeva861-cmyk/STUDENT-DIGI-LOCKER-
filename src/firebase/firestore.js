import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { firestore } from './index.js';

function requireFirestore() {
  if (!firestore) throw new Error('Firestore is not configured.');
  return firestore;
}

export function collectionRef(path) {
  return collection(requireFirestore(), path);
}

export function docRef(path, id) {
  return doc(requireFirestore(), path, id);
}

export async function createDocument(path, data) {
  return addDoc(collectionRef(path), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function setDocument(path, id, data) {
  return setDoc(docRef(path, id), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updateDocument(path, id, data) {
  return updateDoc(docRef(path, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteDocument(path, id) {
  return deleteDoc(docRef(path, id));
}

export async function getDocument(path, id) {
  const snapshot = await getDoc(docRef(path, id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function listDocuments(path, filters = []) {
  const base = collectionRef(path);
  const constraints = filters.map(([field, operator, value]) => where(field, operator, value));
  const snapshot = await getDocs(constraints.length ? query(base, ...constraints) : base);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

import { auth, authPersistenceReady, db } from './firebase-init.js';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updateEmail, updatePassword, deleteUser, onAuthStateChanged } from 'firebase/auth';
import { setDoc, doc, getDoc, serverTimestamp, updateDoc, addDoc, collection, getDocs, query, where, deleteDoc, getCountFromServer, onSnapshot } from 'firebase/firestore';
import { uploadDocument as uploadToCloudinary, validateCloudinaryFile } from '../../src/services/cloudinary.js';

const VALID_DEPARTMENTS = window.SL_DEPARTMENTS || [];
const VALID_YEARS = window.SL_YEARS || ['I', 'II', 'III'];

const getCollectionName = (category) => {
  switch (category) {
    case 'Online Certificates':
      return 'onlineCertificates';
    case 'Offline Certificates':
      return 'offlineCertificates';
    case 'Academic Certificates':
      return 'academicCertificates';
    case 'Personal Documents':
      return 'personalDocuments';
    default:
      throw new Error('Invalid document category');
  }
};

const DOCUMENT_CATEGORIES = [
  'Online Certificates',
  'Offline Certificates',
  'Academic Certificates',
  'Personal Documents',
];

const TEACHER_READABLE_CATEGORIES = ['Academic Certificates'];
const ACADEMIC_DOCUMENT_TYPES = window.SL_ACADEMIC_DOCUMENT_TYPES || [
  'Aadhaar Card',
  'Income Certificate',
  'Community Certificate',
  '10th Marksheet',
  '12th Marksheet',
  'Bank Passbook',
];

const buildGeneratedId = (prefix, uid = '') => {
  const uniquePart = uid ? uid.slice(0, 8).toUpperCase() : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${uniquePart}`;
};

const isEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
const normalizeDepartment = (value = '') => {
  const raw = String(value).trim();
  return VALID_DEPARTMENTS.find((department) => department.toLowerCase() === raw.toLowerCase()) || raw;
};
const normalizeYear = (value = '') => String(value).trim().toUpperCase();

const friendlyAuthError = (error) => {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new Error('Invalid email or password.');
    case 'auth/network-request-failed':
      return new Error('Network error. Please check your internet connection and try again.');
    case 'auth/too-many-requests':
      return new Error('Too many failed attempts. Please wait a moment and try again.');
    default:
      return error;
  }
};

const validatePassword = (password = '') => {
  if (password.length < 8) throw new Error('Password must be at least 8 characters long.');
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password must include both letters and numbers.');
  }
};

const logFirestoreWriteError = (operation, error) => {
  console.error(`[firebase-services] ${operation} failed.`, {
    code: error?.code,
    message: error?.message,
    details: error,
  });
};

const defaultDepartment = () => VALID_DEPARTMENTS[0] || 'B.Sc Computer Science (BSC CS)';
const defaultYear = () => VALID_YEARS[0] || 'I';

const buildRepairProfile = (role, user, profileData = {}) => {
  const email = normalizeEmail(profileData.email || user.email || '');
  const fullName = String(profileData.fullName || profileData.name || user.displayName || email.split('@')[0] || role).trim();
  const department = normalizeDepartment(profileData.department || defaultDepartment());
  const year = normalizeYear(profileData.year || defaultYear());
  const baseProfile = {
    uid: user.uid,
    fullName,
    email,
    department,
    year,
    role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (role === 'teacher') {
    return {
      ...baseProfile,
      teacherId: profileData.teacherId || buildGeneratedId('TCH', user.uid),
      phone: String(profileData.phone || '').trim(),
    };
  }

  const registerNumber = String(profileData.registerNumber || profileData.reg || buildGeneratedId('REPAIR', user.uid)).trim();
  const phone = String(profileData.phone || profileData.mobile || '').trim();
  return {
    ...baseProfile,
    registerNumber,
    phone,
    mobile: String(profileData.mobile || phone).trim(),
    studentId: profileData.studentId || buildGeneratedId('STU', user.uid),
    status: profileData.status || 'pending',
  };
};

const ensureUserProfile = async (role, user, profileData = {}) => {
  firebaseServices._assertReady();
  if (!user?.uid) throw new Error('Cannot repair profile without an authenticated user.');
  const collectionName = role === 'teacher' ? 'teachers' : 'users';
  const profileRef = doc(db, collectionName, user.uid);
  const snapshot = await getDoc(profileRef);
  if (snapshot.exists()) {
    const data = snapshot.data();
    if (data.role !== role) {
      throw new Error(`You are not authorized to login as a ${role}.`);
    }
    return { id: snapshot.id, ...data };
  }

  const repairedProfile = buildRepairProfile(role, user, profileData);
  try {
    await setDoc(profileRef, repairedProfile);
  } catch (error) {
    logFirestoreWriteError(`Profile repair write to ${collectionName}/${user.uid}`, error);
    throw new Error(`${role === 'teacher' ? 'Teacher' : 'Student'} profile was missing and could not be repaired. Check Firestore rules and try again.`);
  }
  console.warn(`[firebase-services] Repaired missing ${role} profile at ${collectionName}/${user.uid}.`);
  return { id: user.uid, ...repairedProfile };
};

const getActiveTeacherProfile = async () => {
  firebaseServices._assertReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in as a teacher.');
  const profile = await ensureUserProfile('teacher', user);
  if (!profile.department) throw new Error('Teacher department is not assigned.');
  if (!profile.year) throw new Error('Teacher academic year is not assigned.');
  return profile;
};

const getActiveStudentProfile = async () => {
  firebaseServices._assertReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in as a student.');
  const profile = await ensureUserProfile('student', user);
  if (!profile.department) throw new Error('Student department is not assigned.');
  return profile;
};

const getStudentUid = (student, fallbackId = '') => student?.uid || fallbackId;

const assertTeacherCanAccessStudent = async (student, teacherProfile = null) => {
  const teacher = teacherProfile || await getActiveTeacherProfile();
  if (!student || student.department !== teacher.department || student.year !== teacher.year) {
    throw new Error('Access denied. This student belongs to another department or academic year.');
  }
  return teacher;
};

const getCurrentRole = async () => {
  if (!auth.currentUser) return null;
  return firebaseServices.getUserRole(auth.currentUser.uid);
};

const assertTeacherCanAccessDocumentData = async (documentData, teacherProfile = null) => {
  const teacher = teacherProfile || await getActiveTeacherProfile();
  if (documentData?.category !== 'Academic Certificates') {
    throw new Error('Access denied. Teachers can access only Academic Certificates.');
  }
  if (!documentData || documentData.department !== teacher.department || documentData.year !== teacher.year) {
    throw new Error('Access denied. This document belongs to another department or academic year.');
  }
  return teacher;
};

const assertAcademicDocumentType = (category, title) => {
  if (category !== 'Academic Certificates') return;
  if (!ACADEMIC_DOCUMENT_TYPES.includes(String(title || '').trim())) {
    throw new Error('Please select a valid academic document type.');
  }
};

const assertNoDuplicateAcademicDocument = async (studentUid, title) => {
  const duplicateQuery = query(
    collection(db, 'academicCertificates'),
    where('studentUid', '==', studentUid),
    where('title', '==', title)
  );
  const duplicateSnapshot = await getDocs(duplicateQuery);
  if (!duplicateSnapshot.empty) {
    throw new Error(`${title} is already uploaded for this student.`);
  }
};

const isLegacyFirebaseStorageUrl = (url = '') => /firebasestorage\.googleapis\.com|storage\.googleapis\.com|\.appspot\.com\/o\//i.test(String(url || ''));
const isCloudinarySecureUrl = (url = '') => /^https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|raw|video|auto)\/upload\//i.test(String(url || ''));

const assertCloudinaryDocumentMetadata = (documentUrl, publicId) => {
  if (!documentUrl || isLegacyFirebaseStorageUrl(documentUrl) || !isCloudinarySecureUrl(documentUrl)) {
    throw new Error('Document URL must be the Cloudinary secure_url.');
  }
  if (!publicId) {
    throw new Error('Document publicId must be saved from Cloudinary.');
  }
};

const addAcademicSummaryToStudents = (students = [], documents = []) => {
  const documentsByStudent = documents.reduce((map, documentRecord) => {
    const uid = String(documentRecord.studentUid || '');
    if (!uid) return map;
    if (!map.has(uid)) map.set(uid, []);
    map.get(uid).push(documentRecord);
    return map;
  }, new Map());

  return students.map((student) => {
    const uid = String(student.uid || student.id || '');
    const studentDocuments = documentsByStudent.get(uid) || [];
    const latestDocument = studentDocuments.reduce((latest, documentRecord) => {
      const latestTime = latest?.updatedAt?.seconds || latest?.createdAt?.seconds || 0;
      const documentTime = documentRecord?.updatedAt?.seconds || documentRecord?.createdAt?.seconds || 0;
      return documentTime >= latestTime ? documentRecord : latest;
    }, null);
    return {
      ...student,
      academicCertificateCount: studentDocuments.length,
      documentStatus: latestDocument?.status || (studentDocuments.length ? 'uploaded' : 'pending'),
    };
  });
};

const firebaseServices = {
  _assertReady: () => {
    if (!auth || !db) {
      const err = window.firebaseInitError || new Error('Firebase is not initialized. Missing/placeholder config.');
      throw err;
    }
  },

  _assertDepartment: (department) => {
    const normalizedDepartment = normalizeDepartment(department);
    if (!normalizedDepartment) throw new Error('Please select a department.');
    if (VALID_DEPARTMENTS.length && !VALID_DEPARTMENTS.includes(normalizedDepartment)) {
      throw new Error('Please select a valid department.');
    }
  },

  _assertYear: (year) => {
    if (!VALID_YEARS.includes(normalizeYear(year))) throw new Error('Please select a valid year.');
  },

  registerStudent: async (studentData) => {
    firebaseServices._assertReady();
    const { password, fullName, mobile } = studentData;
    const email = normalizeEmail(studentData.email);
    const department = normalizeDepartment(studentData.department);
    const year = normalizeYear(studentData.year);
    const registerNumber = studentData.registerNumber?.trim();
    firebaseServices._assertDepartment(department);
    firebaseServices._assertYear(year);
    if (!isEmail(email)) throw new Error('Please enter a valid email address.');
    validatePassword(password);
    if (!email || !password || !fullName || !department || !year || !mobile || !registerNumber) {
      throw new Error('Please complete all required student registration fields.');
    }
    if (auth.currentUser && await firebaseServices.getUserRole(auth.currentUser.uid) === 'teacher') {
      const duplicateRegisterQuery = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("registerNumber", "==", registerNumber),
        where("department", "==", department),
        where("year", "==", year)
      );
      const registerSnapshot = await getDocs(duplicateRegisterQuery);
      if (!registerSnapshot.empty) throw new Error('This register number is already registered.');
    }
    let userCredential;
    try {
      await authPersistenceReady;
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email address is already registered.');
      }
      throw error;
    }
    const user = userCredential.user;
    const generatedStudentId = buildGeneratedId('STU', user.uid);
    const studentProfile = {
      uid: user.uid,
      fullName: fullName.trim(),
      registerNumber,
      email,
      phone: mobile.trim(),
      mobile: mobile.trim(),
      department,
      year,
      studentId: generatedStudentId,
      status: 'active',
      role: 'student',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, "users", user.uid), studentProfile);
    } catch (error) {
      logFirestoreWriteError(`Student profile write to users/${user.uid}`, error);
      await deleteUser(user).catch(() => {});
      throw new Error('Student account was created, but the profile could not be saved. Please contact support or try again.');
    }
    try {
      await sendEmailVerification(user);
    } catch (error) {
      console.warn('[firebase-services] Student email verification could not be sent. Profile was saved successfully.', error);
    }
    return user;
  },

  registerTeacher: async (teacherData) => {
    firebaseServices._assertReady();
    const { password, fullName, phone } = teacherData;
    const email = normalizeEmail(teacherData.email);
    const department = normalizeDepartment(teacherData.department);
    const year = normalizeYear(teacherData.year);
    firebaseServices._assertDepartment(department);
    firebaseServices._assertYear(year);
    if (!isEmail(email)) throw new Error('Please enter a valid email address.');
    validatePassword(password);
    if (!email || !password || !fullName || !department || !year || !phone) {
      throw new Error('Please complete all required teacher registration fields.');
    }
    let userCredential;
    try {
      await authPersistenceReady;
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email address is already registered.');
      }
      throw error;
    }
    const user = userCredential.user;
    const generatedTeacherId = buildGeneratedId('TCH', user.uid);
    const teacherProfile = {
      uid: user.uid,
      fullName: fullName.trim(),
      teacherId: generatedTeacherId,
      email,
      phone: phone.trim(),
      department,
      year,
      role: 'teacher',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, "teachers", user.uid), teacherProfile);
    } catch (error) {
      logFirestoreWriteError(`Teacher profile write to teachers/${user.uid}`, error);
      await deleteUser(user).catch(() => {});
      throw new Error('Teacher account was created, but the profile could not be saved. Please contact support or try again.');
    }
    try {
      await sendEmailVerification(user);
    } catch (error) {
      console.warn('[firebase-services] Teacher email verification could not be sent. Profile was saved successfully.', error);
    }
    return user;
  },

  loginWithEmailAndPassword: async (email, password, role) => {
    firebaseServices._assertReady();
    const normalizedEmail = normalizeEmail(email);
    if (!isEmail(normalizedEmail)) throw new Error('Please enter a valid email address.');
    if (!password) throw new Error('Please enter your password.');
    await authPersistenceReady;
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (error) {
      throw friendlyAuthError(error);
    }
    const user = userCredential.user;
    try {
      await ensureUserProfile(role, user);
    } catch (error) {
      await signOut(auth);
      throw error;
    }
    return user;
  },

  getUserRole: async (uid) => {
    firebaseServices._assertReady();
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) return userDoc.data().role;
    const teacherDoc = await getDoc(doc(db, "teachers", uid));
    if (teacherDoc.exists()) return teacherDoc.data().role;
    return null;
  },

  getUserProfile: async (uid, role) => {
    firebaseServices._assertReady();
    const collectionName = role === 'teacher' ? 'teachers' : 'users';
    const userDoc = await getDoc(doc(db, collectionName, uid));
    if (userDoc.exists()) return userDoc.data();
    if (auth.currentUser && auth.currentUser.uid === uid) {
      const repairedProfile = await ensureUserProfile(role, auth.currentUser);
      return repairedProfile;
    }
    return null;
  },

  updateUserProfile: async (uid, role, data) => {
    firebaseServices._assertReady();
    firebaseServices._assertDepartment(data.department);
    const collectionName = role === 'teacher' ? 'teachers' : 'users';
    const sanitized = { ...data };
    delete sanitized.uid;
    delete sanitized.role;
    delete sanitized.email;
    if (role === 'student') {
      delete sanitized.registerNumber;
      delete sanitized.studentId;
      sanitized.status = sanitized.status || 'active';
    }
    if (role === 'teacher') {
      delete sanitized.teacherId;
      if (sanitized.year) firebaseServices._assertYear(sanitized.year);
    }
    if (sanitized.department) sanitized.department = normalizeDepartment(sanitized.department);
    if (sanitized.year) sanitized.year = normalizeYear(sanitized.year);
    await updateDoc(doc(db, collectionName, uid), { ...sanitized, updatedAt: serverTimestamp() });
  },

  updateUserEmail: async (newEmail) => {
    firebaseServices._assertReady();
    const user = auth.currentUser;
    if (!user) throw new Error('Please sign in again to update your email.');
    const email = normalizeEmail(newEmail);
    if (!isEmail(email)) throw new Error('Please enter a valid email address.');
    await updateEmail(user, email);
    const role = await firebaseServices.getUserRole(user.uid);
    if (!role) return;
    const collectionName = role === 'teacher' ? 'teachers' : 'users';
    await updateDoc(doc(db, collectionName, user.uid), {
      email,
      ...(role === 'student' ? { status: 'active' } : {}),
      updatedAt: serverTimestamp(),
    });
  },

  updateUserPassword: async (newPassword) => {
    firebaseServices._assertReady();
    const user = auth.currentUser;
    if (!user) throw new Error('Please sign in again to update your password.');
    await updatePassword(user, newPassword);
  },

  addDocument: async (docData) => {
    firebaseServices._assertReady();
    if (!docData.studentUid) throw new Error('Please sign in before uploading documents.');
    if (!docData.title?.trim()) throw new Error('Please enter a document title.');
    if (!docData.documentUrl || !docData.fileName || !docData.fileType) throw new Error('Please select a valid document file.');
    const role = await getCurrentRole();
    if (role === 'teacher') {
      throw new Error('Teachers cannot upload student documents.');
    } else if (auth.currentUser && String(docData.studentUid) !== String(auth.currentUser.uid)) {
      throw new Error('You can upload documents only to your own profile.');
    }
    docData.department = normalizeDepartment(docData.department);
    docData.year = normalizeYear(docData.year || '');
    firebaseServices._assertDepartment(docData.department);
    if (docData.year) firebaseServices._assertYear(docData.year);
    const collectionName = getCollectionName(docData.category);
    const title = docData.title.trim();
    assertAcademicDocumentType(docData.category, title);
    if (docData.category === 'Academic Certificates') {
      await assertNoDuplicateAcademicDocument(docData.studentUid, title);
    }
    const documentUrl = docData.documentUrl;
    const publicId = docData.publicId || docData.public_id || '';
    assertCloudinaryDocumentMetadata(documentUrl, publicId);
    await addDoc(collection(db, collectionName), {
      ...docData,
      title,
      documentType: docData.documentType || title,
      documentName: docData.documentName || docData.fileName || title,
      documentUrl,
      fileUrl: documentUrl,
      publicId,
      public_id: publicId,
      description: docData.description?.trim() || '',
      status: docData.status || 'uploaded',
      uploadedAt: docData.uploadedAt || serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  uploadDocument: async ({ file, title, description = '', category }) => {
    firebaseServices._assertReady();
    const activeStudent = await getActiveStudentProfile();
    const fileError = validateCloudinaryFile(file);
    if (fileError) throw new Error(fileError);
    const documentTitle = String(title || '').trim();
    if (!documentTitle) throw new Error('Please select a document type.');
    assertAcademicDocumentType(category, documentTitle);
    if (category === 'Academic Certificates') {
      await assertNoDuplicateAcademicDocument(activeStudent.uid, documentTitle);
    }
    const collectionName = getCollectionName(category);
    const uploadResult = await uploadToCloudinary(file);
    const documentUrl = uploadResult.secure_url;
    assertCloudinaryDocumentMetadata(documentUrl, uploadResult.public_id);
    const documentRecord = {
      title: documentTitle,
      documentType: documentTitle,
      documentName: file.name,
      description,
      category,
      fileName: file.name,
      filename: file.name,
      fileType: file.type,
      type: file.type,
      fileSize: uploadResult.bytes || file.size,
      fileSizeLabel: window.formatFileSize?.(uploadResult.bytes || file.size) || `${uploadResult.bytes || file.size} B`,
      documentUrl,
      fileUrl: documentUrl,
      publicId: uploadResult.public_id,
      public_id: uploadResult.public_id,
      originalFilename: uploadResult.original_filename,
      format: uploadResult.format,
      studentUid: activeStudent.uid,
      studentName: activeStudent.fullName || activeStudent.name || '',
      registerNumber: activeStudent.registerNumber || activeStudent.reg || '',
      department: normalizeDepartment(activeStudent.department),
      year: normalizeYear(activeStudent.year || ''),
      status: 'uploaded',
    };
    let documentRef;
    try {
      documentRef = await addDoc(collection(db, collectionName), {
        ...documentRecord,
        title: documentTitle,
        description: description.trim(),
        uploadedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[firebase-services] Document metadata write failed after Cloudinary upload.', {
        code: error?.code,
        message: error?.message,
        publicId: uploadResult.public_id,
        details: error,
      });
      throw new Error('File uploaded to Cloudinary, but document details could not be saved. Please contact support with the document public ID.');
    }
    return { id: documentRef.id, ...documentRecord };
  },

  getDocuments: async (uid, category) => {
    firebaseServices._assertReady();
    const collectionName = getCollectionName(category);
    const role = await getCurrentRole();
    if (role === 'teacher' && !TEACHER_READABLE_CATEGORIES.includes(category)) {
      throw new Error('Access denied. Teachers can access only Academic Certificates.');
    }
    let docsQuery = query(collection(db, collectionName), where("studentUid", "==", uid));
    if (role === 'teacher') {
      const teacher = await getActiveTeacherProfile();
      const student = await firebaseServices.getStudentById(uid);
      await assertTeacherCanAccessStudent(student, teacher);
      docsQuery = query(collection(db, collectionName), where("studentUid", "==", uid), where("department", "==", teacher.department), where("year", "==", teacher.year));
    } else if (auth.currentUser && String(uid) !== String(auth.currentUser.uid)) {
      throw new Error('Access denied. You can view only your own documents.');
    } else if (auth.currentUser) {
      const student = await getActiveStudentProfile();
      docsQuery = query(collection(db, collectionName), where("studentUid", "==", uid), where("department", "==", student.department));
    }
    const querySnapshot = await getDocs(docsQuery);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  getDocumentById: async (docId, options = {}) => {
    firebaseServices._assertReady();
    const role = await getCurrentRole();
    const categories = options.category
      ? [options.category]
      : role === 'teacher'
        ? TEACHER_READABLE_CATEGORIES
        : DOCUMENT_CATEGORIES;
    for (const category of categories) {
      const collectionName = getCollectionName(category);
      const documentSnapshot = await getDoc(doc(db, collectionName, docId));
      if (!documentSnapshot.exists()) continue;
      const data = documentSnapshot.data();
      if (options.uid && String(data.studentUid) !== String(options.uid)) return null;
      if (role === 'teacher') {
        await assertTeacherCanAccessDocumentData(data);
      } else if (auth.currentUser && String(data.studentUid) !== String(auth.currentUser.uid)) {
        return null;
      }
      return { id: documentSnapshot.id, collectionName, category, ...data };
    }
    return null;
  },

  updateDocument: async (docId, category, data) => {
    firebaseServices._assertReady();
    const collectionName = getCollectionName(category);
    const currentSnapshot = await getDoc(doc(db, collectionName, docId));
    if (!currentSnapshot.exists()) throw new Error('Document not found.');
    const currentData = currentSnapshot.data();
    assertAcademicDocumentType(category, data.title || currentData.title);
    const role = await getCurrentRole();
    if (role === 'teacher') {
      throw new Error('Teachers cannot update student documents.');
    } else if (auth.currentUser && String(currentData.studentUid) !== String(auth.currentUser.uid)) {
      throw new Error('Access denied. You can update only your own documents.');
    }
    await updateDoc(doc(db, collectionName, docId), { ...data, updatedAt: serverTimestamp() });
  },

  deleteDocument: async (docId, category) => {
    firebaseServices._assertReady();
    const collectionName = getCollectionName(category);
    const currentSnapshot = await getDoc(doc(db, collectionName, docId));
    if (!currentSnapshot.exists()) return;
    const currentData = currentSnapshot.data();
    const role = await getCurrentRole();
    if (role === 'teacher') {
      if (category !== 'Academic Certificates') {
        throw new Error('Teachers can delete only Academic Certificates.');
      }
      await assertTeacherCanAccessDocumentData(currentData);
    } else if (auth.currentUser && String(currentData.studentUid) !== String(auth.currentUser.uid)) {
      throw new Error('Access denied. You can delete only your own documents.');
    }
    if (currentData.publicId || currentData.public_id) {
      console.info('[firebase-services] Cloudinary asset retained for future server-side deletion.', {
        publicId: currentData.publicId || currentData.public_id,
      });
    }
    await deleteDoc(doc(db, collectionName, docId));
  },

  searchStudents: async (searchParams) => {
    firebaseServices._assertReady();
    let scopedDepartment = searchParams.department || '';
    let scopedYear = searchParams.year || '';
    if (auth.currentUser && await firebaseServices.getUserRole(auth.currentUser.uid) === 'teacher') {
      const teacher = await getActiveTeacherProfile();
      scopedDepartment = teacher.department;
      scopedYear = teacher.year;
    }
    let q = scopedDepartment
      ? query(collection(db, "users"), where("role", "==", "student"), where("department", "==", scopedDepartment))
      : query(collection(db, "users"), where("role", "==", "student"));
    if (searchParams.registerNumber) q = query(q, where("registerNumber", "==", searchParams.registerNumber));
    if (searchParams.name) q = query(q, where("fullName", ">=", searchParams.name), where("fullName", "<=", searchParams.name + '\uf8ff'));
    if (scopedYear) q = query(q, where("year", "==", scopedYear));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  listStudents: async () => {
    firebaseServices._assertReady();
    let studentsQuery = query(collection(db, "users"), where("role", "==", "student"));
    if (auth.currentUser && await firebaseServices.getUserRole(auth.currentUser.uid) === 'teacher') {
      const teacher = await getActiveTeacherProfile();
      studentsQuery = query(collection(db, "users"), where("role", "==", "student"), where("department", "==", teacher.department), where("year", "==", teacher.year));
      const studentsSnapshot = await getDocs(studentsQuery);
      const students = studentsSnapshot.docs.map(studentDoc => ({ id: studentDoc.id, uid: studentDoc.id, ...studentDoc.data() }));
      const documentsSnapshot = await getDocs(query(collection(db, 'academicCertificates'), where("department", "==", teacher.department), where("year", "==", teacher.year)));
      const documents = documentsSnapshot.docs.map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() }));
      return addAcademicSummaryToStudents(students, documents);
    }
    const querySnapshot = await getDocs(studentsQuery);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  subscribeStudents: async (callback) => {
    firebaseServices._assertReady();
    let studentsQuery = query(collection(db, "users"), where("role", "==", "student"));
    if (auth.currentUser && await firebaseServices.getUserRole(auth.currentUser.uid) === 'teacher') {
      const teacher = await getActiveTeacherProfile();
      studentsQuery = query(collection(db, "users"), where("role", "==", "student"), where("department", "==", teacher.department), where("year", "==", teacher.year));
      const documentsQuery = query(collection(db, 'academicCertificates'), where("department", "==", teacher.department), where("year", "==", teacher.year));
      let students = [];
      let documents = [];
      let studentsReady = false;
      let documentsReady = false;

      const emit = () => {
        if (!studentsReady || !documentsReady) return;
        callback(addAcademicSummaryToStudents(students, documents));
      };

      const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
        students = snapshot.docs.map(studentDoc => ({ id: studentDoc.id, uid: studentDoc.id, ...studentDoc.data() }));
        studentsReady = true;
        emit();
      }, (error) => {
        console.error('[firebase-services] Student listener failed.', error);
        window.slToast?.(error.message || 'Student list sync failed.', 'error');
      });

      const unsubscribeDocuments = onSnapshot(documentsQuery, (snapshot) => {
        documents = snapshot.docs.map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() }));
        documentsReady = true;
        emit();
      }, (error) => {
        console.error('[firebase-services] Student document summary listener failed.', error);
        window.slToast?.(error.message || 'Student document summary sync failed.', 'error');
      });

      return () => {
        unsubscribeStudents();
        unsubscribeDocuments();
      };
    }
    return onSnapshot(studentsQuery, (snapshot) => {
      callback(snapshot.docs.map(studentDoc => ({ id: studentDoc.id, uid: studentDoc.id, ...studentDoc.data() })));
    }, (error) => {
      console.error('[firebase-services] Student listener failed.', error);
      window.slToast?.(error.message || 'Student list sync failed.', 'error');
    });
  },

  getStudentById: async (studentId) => {
    firebaseServices._assertReady();
    const studentDoc = await getDoc(doc(db, "users", studentId));
    if (!studentDoc.exists()) return null;
    const student = { id: studentDoc.id, ...studentDoc.data() };
    if (await getCurrentRole() === 'teacher') await assertTeacherCanAccessStudent(student);
    return student;
  },

  addStudentProfile: async (studentData) => {
    firebaseServices._assertReady();
    if (auth.currentUser && await firebaseServices.getUserRole(auth.currentUser.uid) === 'teacher') {
      const teacher = await getActiveTeacherProfile();
      if (studentData.department && normalizeDepartment(studentData.department) !== teacher.department) {
        throw new Error('You can add students only to your assigned department.');
      }
      if (studentData.year && normalizeYear(studentData.year) !== teacher.year) {
        throw new Error('You can add students only to your assigned academic year.');
      }
      studentData.department = teacher.department;
      studentData.year = teacher.year;
    }
    studentData.department = normalizeDepartment(studentData.department);
    studentData.year = normalizeYear(studentData.year);
    firebaseServices._assertDepartment(studentData.department);
    firebaseServices._assertYear(studentData.year);
    const registerNumber = studentData.registerNumber?.trim();
    const studentId = studentData.studentId?.trim();
    if (!registerNumber) throw new Error('Please enter a register number.');
    const duplicateRegisterQuery = query(
      collection(db, "users"),
      where("role", "==", "student"),
      where("registerNumber", "==", registerNumber),
      where("department", "==", studentData.department),
      where("year", "==", studentData.year)
    );
    const registerSnapshot = await getDocs(duplicateRegisterQuery);
    if (!registerSnapshot.empty) throw new Error('This register number is already registered.');
    if (studentId) {
      const duplicateStudentIdQuery = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("studentId", "==", studentId),
        where("department", "==", studentData.department),
        where("year", "==", studentData.year)
      );
      const studentIdSnapshot = await getDocs(duplicateStudentIdQuery);
      if (!studentIdSnapshot.empty) throw new Error('This Student ID is already registered.');
    }
    const studentRef = doc(collection(db, "users"));
    await setDoc(studentRef, {
      uid: studentRef.id,
      fullName: studentData.fullName?.trim() || '',
      registerNumber,
      email: studentData.email?.trim() || '',
      phone: studentData.phone?.trim() || studentData.mobile?.trim() || '',
      mobile: studentData.mobile?.trim() || studentData.phone?.trim() || '',
      department: studentData.department,
      year: studentData.year,
      studentId: studentId || '',
      status: 'active',
      role: 'student',
      createdBy: auth.currentUser?.uid || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return studentRef.id;
  },

  getAllDocumentsForStudent: async (uid) => {
    firebaseServices._assertReady();
    let teacher = null;
    let studentProfile = null;
    const role = await getCurrentRole();
    if (role === 'teacher') {
      const student = await firebaseServices.getStudentById(uid);
      teacher = await assertTeacherCanAccessStudent(student);
    } else if (auth.currentUser && String(uid) === String(auth.currentUser.uid)) {
      studentProfile = await getActiveStudentProfile();
    } else if (auth.currentUser) {
      throw new Error('Access denied. You can view only your own documents.');
    }
    const categories = teacher ? TEACHER_READABLE_CATEGORIES : DOCUMENT_CATEGORIES;
    const allDocuments = {};
    for (const category of categories) {
      const collectionName = getCollectionName(category);
      const q = teacher
        ? query(collection(db, collectionName), where("studentUid", "==", uid), where("department", "==", teacher.department), where("year", "==", teacher.year))
        : studentProfile
          ? query(collection(db, collectionName), where("studentUid", "==", uid), where("department", "==", studentProfile.department))
        : query(collection(db, collectionName), where("studentUid", "==", uid));
      const querySnapshot = await getDocs(q);
      allDocuments[collectionName] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return allDocuments;
  },

  getStudentDocuments: async (uid) => {
    firebaseServices._assertReady();
    let teacher = null;
    let studentProfile = null;
    const role = await getCurrentRole();
    if (role === 'teacher') {
      const student = await firebaseServices.getStudentById(uid);
      teacher = await assertTeacherCanAccessStudent(student);
    } else if (auth.currentUser && String(uid) === String(auth.currentUser.uid)) {
      studentProfile = await getActiveStudentProfile();
    } else if (auth.currentUser) {
      throw new Error('Access denied. You can view only your own documents.');
    }
    const categories = teacher ? TEACHER_READABLE_CATEGORIES : DOCUMENT_CATEGORIES;
    const allDocuments = [];
    for (const category of categories) {
      const collectionName = getCollectionName(category);
      const q = teacher
        ? query(collection(db, collectionName), where("studentUid", "==", uid), where("department", "==", teacher.department), where("year", "==", teacher.year))
        : studentProfile
          ? query(collection(db, collectionName), where("studentUid", "==", uid), where("department", "==", studentProfile.department))
        : query(collection(db, collectionName), where("studentUid", "==", uid));
      const querySnapshot = await getDocs(q);
      querySnapshot.docs.forEach((documentSnapshot) => {
        allDocuments.push({ id: documentSnapshot.id, collectionName, category, ...documentSnapshot.data() });
      });
    }
    return allDocuments;
  },

  subscribeStudentDocuments: async (uid, callback) => {
    firebaseServices._assertReady();
    let documentsQuery;
    const role = await getCurrentRole();
    if (role === 'teacher') {
      const student = await firebaseServices.getStudentById(uid);
      const teacher = await assertTeacherCanAccessStudent(student);
      documentsQuery = query(
        collection(db, 'academicCertificates'),
        where("studentUid", "==", uid),
        where("department", "==", teacher.department),
        where("year", "==", teacher.year)
      );
    } else if (auth.currentUser && String(uid) === String(auth.currentUser.uid)) {
      const studentProfile = await getActiveStudentProfile();
      documentsQuery = query(
        collection(db, 'academicCertificates'),
        where("studentUid", "==", uid),
        where("department", "==", studentProfile.department),
        where("year", "==", studentProfile.year || '')
      );
    } else {
      throw new Error('Access denied. You can view only your own documents.');
    }
    return onSnapshot(documentsQuery, (snapshot) => {
      callback(snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        collectionName: 'academicCertificates',
        category: 'Academic Certificates',
        ...documentSnapshot.data(),
      })));
    }, (error) => {
      console.error('[firebase-services] Student document listener failed.', error);
      window.slToast?.(error.message || 'Student document sync failed.', 'error');
    });
  },

  deleteStudent: async (studentId) => {
    firebaseServices._assertReady();
    const student = await firebaseServices.getStudentById(studentId);
    if (auth.currentUser && await firebaseServices.getUserRole(auth.currentUser.uid) === 'teacher') {
      await assertTeacherCanAccessStudent(student);
    }
    const uid = student?.uid || studentId;
    const documents = await firebaseServices.getStudentDocuments(uid);
    for (const documentRecord of documents) {
      await firebaseServices.deleteDocument(documentRecord.id, documentRecord.category);
    }
    await deleteDoc(doc(db, "users", studentId));
  },

  getDashboardStats: async (uid = auth.currentUser?.uid) => {
    firebaseServices._assertReady();
    const role = await getCurrentRole();
    const categories = role === 'teacher' ? TEACHER_READABLE_CATEGORIES : DOCUMENT_CATEGORIES;
    const profile = uid && auth.currentUser && String(uid) === String(auth.currentUser.uid)
      ? await getActiveStudentProfile()
      : null;
    const counts = {
      totalDocuments: 0,
      personalCount: 0,
      onlineCount: 0,
      offlineCount: 0,
      academicCount: 0,
    };
    const keyByCategory = {
      'Personal Documents': 'personalCount',
      'Online Certificates': 'onlineCount',
      'Offline Certificates': 'offlineCount',
      'Academic Certificates': 'academicCount',
    };
    for (const category of categories) {
      const docsQuery = uid
        ? profile
          ? query(collection(db, getCollectionName(category)), where("studentUid", "==", uid), where("department", "==", profile.department))
          : query(collection(db, getCollectionName(category)), where("studentUid", "==", uid))
        : query(collection(db, getCollectionName(category)));
      const docsSnapshot = await getCountFromServer(docsQuery);
      const count = docsSnapshot.data().count;
      counts[keyByCategory[category]] = count;
      counts.totalDocuments += count;
    }
    return counts;
  },

  getTeacherDashboardStats: async () => {
    firebaseServices._assertReady();
    const teacher = await getActiveTeacherProfile();
    const studentSnapshot = await getCountFromServer(query(collection(db, "users"), where("role", "==", "student"), where("department", "==", teacher.department), where("year", "==", teacher.year)));
    const categories = TEACHER_READABLE_CATEGORIES;
    const counts = {
      department: teacher.department,
      year: teacher.year,
      totalStudents: studentSnapshot.data().count,
      totalDocuments: 0,
      personalCount: 0,
      onlineCount: 0,
      offlineCount: 0,
      academicCount: 0,
    };
    const keyByCategory = {
      'Personal Documents': 'personalCount',
      'Online Certificates': 'onlineCount',
      'Offline Certificates': 'offlineCount',
      'Academic Certificates': 'academicCount',
    };
    for (const category of categories) {
      const docsSnapshot = await getCountFromServer(
        query(collection(db, getCollectionName(category)), where("department", "==", teacher.department), where("year", "==", teacher.year))
      );
      const count = docsSnapshot.data().count;
      counts[keyByCategory[category]] = count;
      counts.totalDocuments += count;
    }
    return counts;
  },

  getAcademicDocumentAnalytics: async () => {
    firebaseServices._assertReady();
    const teacher = await getActiveTeacherProfile();
    const studentsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'student'), where('department', '==', teacher.department), where('year', '==', teacher.year)));
    const students = studentsSnapshot.docs.map((studentDoc) => ({ id: studentDoc.id, uid: studentDoc.id, ...studentDoc.data() }));
    const academicSnapshot = await getDocs(query(collection(db, 'academicCertificates'), where('department', '==', teacher.department), where('year', '==', teacher.year)));
    const documents = academicSnapshot.docs.map((documentSnapshot) => ({ id: documentSnapshot.id, ...documentSnapshot.data() }));
    return ACADEMIC_DOCUMENT_TYPES.map((type) => {
      const uploadedDocs = documents.filter((documentRecord) => documentRecord.title === type);
      const uploadedStudentIds = new Set(uploadedDocs.map((documentRecord) => String(documentRecord.studentUid)));
      const uploadedStudents = uploadedDocs.map((documentRecord) => {
        const student = students.find((item) => String(item.uid || item.id) === String(documentRecord.studentUid)) || {};
        return {
          ...student,
          document: documentRecord,
        };
      });
      const pendingStudents = students.filter((student) => !uploadedStudentIds.has(String(student.uid || student.id)));
      return {
        type,
        uploadedCount: uploadedStudents.length,
        pendingCount: pendingStudents.length,
        uploadedStudents,
        pendingStudents,
      };
    });
  },

  subscribeAcademicDocumentAnalytics: async (callback) => {
    firebaseServices._assertReady();
    const teacher = await getActiveTeacherProfile();
    const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'), where('department', '==', teacher.department), where('year', '==', teacher.year));
    const documentsQuery = query(collection(db, 'academicCertificates'), where('department', '==', teacher.department), where('year', '==', teacher.year));
    let students = [];
    let documents = [];
    let studentsReady = false;
    let documentsReady = false;

    const emit = () => {
      if (!studentsReady || !documentsReady) return;
      callback(ACADEMIC_DOCUMENT_TYPES.map((type) => {
        const uploadedDocs = documents.filter((documentRecord) => documentRecord.title === type);
        const uploadedStudentIds = new Set(uploadedDocs.map((documentRecord) => String(documentRecord.studentUid)));
        const uploadedStudents = uploadedDocs.map((documentRecord) => ({
          ...(students.find((item) => String(item.uid || item.id) === String(documentRecord.studentUid)) || {}),
          document: documentRecord,
        }));
        return {
          type,
          uploadedCount: uploadedStudents.length,
          pendingCount: students.filter((student) => !uploadedStudentIds.has(String(student.uid || student.id))).length,
          uploadedStudents,
          pendingStudents: students.filter((student) => !uploadedStudentIds.has(String(student.uid || student.id))),
        };
      }));
    };

    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      students = snapshot.docs.map((studentDoc) => ({ id: studentDoc.id, uid: studentDoc.id, ...studentDoc.data() }));
      studentsReady = true;
      emit();
    }, (error) => {
      console.error('[firebase-services] Student analytics listener failed.', error);
      window.slToast?.(error.message || 'Student analytics sync failed.', 'error');
    });

    const unsubscribeDocuments = onSnapshot(documentsQuery, (snapshot) => {
      documents = snapshot.docs.map((documentSnapshot) => ({ id: documentSnapshot.id, ...documentSnapshot.data() }));
      documentsReady = true;
      emit();
    }, (error) => {
      console.error('[firebase-services] Academic document listener failed.', error);
      window.slToast?.(error.message || 'Academic document sync failed.', 'error');
    });

    return () => {
      unsubscribeStudents();
      unsubscribeDocuments();
    };
  },

  getDocumentTotals: async () => {
    firebaseServices._assertReady();
    const categories = DOCUMENT_CATEGORIES;
    let totalDocuments = 0;
    for (const category of categories) {
      const docsSnapshot = await getCountFromServer(collection(db, getCollectionName(category)));
      totalDocuments += docsSnapshot.data().count;
    }
    return { totalDocuments };
  },

  logout: async () => {
    firebaseServices._assertReady();
    await signOut(auth);
    ['sl_authenticated', 'sl_role', 'sl_user', 'sl_profile', 'sl_docs', 'sl_students'].forEach((key) => {
      localStorage.removeItem(key);
    });
  },

  sendPasswordReset: async (email) => {
    firebaseServices._assertReady();
    await sendPasswordResetEmail(auth, normalizeEmail(email));
  },

  waitForAuthUser: async () => {
    firebaseServices._assertReady();
    await authPersistenceReady;
    if (auth.currentUser) return auth.currentUser;
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  },
};

window.firebaseServices = firebaseServices;
window.dispatchEvent(new CustomEvent('firebase-ready'));

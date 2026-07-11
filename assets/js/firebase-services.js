import { auth, db, storage } from './firebase-init.js';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updateEmail, updatePassword, deleteUser, onAuthStateChanged } from 'firebase/auth';
import { setDoc, doc, getDoc, serverTimestamp, updateDoc, addDoc, collection, getDocs, query, where, deleteDoc, getCountFromServer } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

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

const buildGeneratedId = (prefix, uid = '') => {
  const uniquePart = uid ? uid.slice(0, 8).toUpperCase() : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${uniquePart}`;
};

const isEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

const validatePassword = (password = '') => {
  if (password.length < 8) throw new Error('Password must be at least 8 characters long.');
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password must include both letters and numbers.');
  }
};

const getActiveTeacherProfile = async () => {
  firebaseServices._assertReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in as a teacher.');
  const teacherDoc = await getDoc(doc(db, "teachers", user.uid));
  if (!teacherDoc.exists() || teacherDoc.data().role !== 'teacher') {
    throw new Error('Teacher profile not found.');
  }
  const profile = { id: teacherDoc.id, ...teacherDoc.data() };
  if (!profile.department) throw new Error('Teacher department is not assigned.');
  return profile;
};

const getActiveStudentProfile = async () => {
  firebaseServices._assertReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in as a student.');
  const studentDoc = await getDoc(doc(db, "users", user.uid));
  if (!studentDoc.exists() || studentDoc.data().role !== 'student') {
    throw new Error('Student profile not found.');
  }
  const profile = { id: studentDoc.id, ...studentDoc.data() };
  if (!profile.department) throw new Error('Student department is not assigned.');
  return profile;
};

const getStudentUid = (student, fallbackId = '') => student?.uid || fallbackId;

const safeFileName = (name = 'document') => String(name).replace(/[^A-Za-z0-9._-]/g, '_');

const assertTeacherCanAccessStudent = async (student, teacherProfile = null) => {
  const teacher = teacherProfile || await getActiveTeacherProfile();
  if (!student || student.department !== teacher.department) {
    throw new Error('Access denied. This student belongs to another department.');
  }
  return teacher;
};

const getCurrentRole = async () => {
  if (!auth.currentUser) return null;
  return firebaseServices.getUserRole(auth.currentUser.uid);
};

const assertTeacherCanAccessDocumentData = async (documentData, teacherProfile = null) => {
  const teacher = teacherProfile || await getActiveTeacherProfile();
  if (!documentData || documentData.department !== teacher.department) {
    throw new Error('Access denied. This document belongs to another department.');
  }
  return teacher;
};

const firebaseServices = {
  _assertReady: () => {
    if (!auth || !db || !storage) {
      const err = window.firebaseInitError || new Error('Firebase is not initialized. Missing/placeholder config.');
      throw err;
    }
  },

  _assertDepartment: (department) => {
    if (!department) throw new Error('Please select a department.');
    if (VALID_DEPARTMENTS.length && !VALID_DEPARTMENTS.includes(department)) {
      throw new Error('Please select a valid department.');
    }
  },

  _assertYear: (year) => {
    if (!VALID_YEARS.includes(year)) throw new Error('Please select a valid year.');
  },

  registerStudent: async (studentData) => {
    firebaseServices._assertReady();
    const { email, password, fullName, department, year, mobile } = studentData;
    const registerNumber = studentData.registerNumber?.trim();
    firebaseServices._assertDepartment(department);
    firebaseServices._assertYear(year);
    if (!isEmail(email)) throw new Error('Please enter a valid email address.');
    validatePassword(password);
    if (!email || !password || !fullName || !department || !year || !mobile || !registerNumber) {
      throw new Error('Please complete all required student registration fields.');
    }
    const duplicateRegisterQuery = query(
      collection(db, "users"),
      where("registerNumber", "==", registerNumber),
      where("department", "==", studentData.department)
    );
    try {
      const registerSnapshot = await getDocs(duplicateRegisterQuery);
      if (!registerSnapshot.empty) throw new Error('This register number is already registered.');
    } catch (error) {
      if (error.message === 'This register number is already registered.') throw error;
      console.warn('[firebase-services] Register number pre-check skipped by Firestore rules.', error);
    }
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email address is already registered.');
      }
      throw error;
    }
    const user = userCredential.user;
    const generatedStudentId = buildGeneratedId('STU', user.uid);
    try {
      await sendEmailVerification(user);
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: fullName.trim(),
        registerNumber,
        email: email.trim(),
        phone: mobile.trim(),
        department: department,
        year,
        studentId: generatedStudentId,
        role: 'student',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      await deleteUser(user).catch(() => {});
      throw error;
    }
    return user;
  },

  registerTeacher: async (teacherData) => {
    firebaseServices._assertReady();
    const { email, password, fullName, department, designation, phone } = teacherData;
    firebaseServices._assertDepartment(department);
    if (!isEmail(email)) throw new Error('Please enter a valid email address.');
    validatePassword(password);
    if (!email || !password || !fullName || !department || !designation || !phone) {
      throw new Error('Please complete all required teacher registration fields.');
    }
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email address is already registered.');
      }
      throw error;
    }
    const user = userCredential.user;
    const generatedTeacherId = buildGeneratedId('TCH', user.uid);
    try {
      await sendEmailVerification(user);
      await setDoc(doc(db, "teachers", user.uid), {
        uid: user.uid,
        fullName: fullName.trim(),
        teacherId: generatedTeacherId,
        email: email.trim(),
        phone: phone.trim(),
        department: department,
        designation: designation.trim(),
        role: 'teacher',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      await deleteUser(user).catch(() => {});
      throw error;
    }
    return user;
  },

  loginWithEmailAndPassword: async (email, password, role) => {
    firebaseServices._assertReady();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const collectionName = role === 'teacher' ? 'teachers' : 'users';
    const userDoc = await getDoc(doc(db, collectionName, user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.role !== role) {
        await signOut(auth);
        throw new Error(`You are not authorized to login as a ${role}.`);
      }
    } else {
      await signOut(auth);
      throw new Error("User data not found.");
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
    return userDoc.exists() ? userDoc.data() : null;
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
    }
    if (role === 'teacher') {
      delete sanitized.teacherId;
    }
    await updateDoc(doc(db, collectionName, uid), { ...sanitized, updatedAt: serverTimestamp() });
  },

  updateUserEmail: async (newEmail) => {
    firebaseServices._assertReady();
    const user = auth.currentUser;
    if (!user) throw new Error('Please sign in again to update your email.');
    const email = newEmail.trim();
    await updateEmail(user, email);
    const role = await firebaseServices.getUserRole(user.uid);
    if (!role) return;
    const collectionName = role === 'teacher' ? 'teachers' : 'users';
    await updateDoc(doc(db, collectionName, user.uid), { email, updatedAt: serverTimestamp() });
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
    if (!docData.fileUrl || !docData.fileName || !docData.fileType) throw new Error('Please select a valid document file.');
    const role = await getCurrentRole();
    if (role === 'teacher') {
      await assertTeacherCanAccessDocumentData(docData);
    } else if (auth.currentUser && String(docData.studentUid) !== String(auth.currentUser.uid)) {
      throw new Error('You can upload documents only to your own profile.');
    }
    firebaseServices._assertDepartment(docData.department);
    const collectionName = getCollectionName(docData.category);
    await addDoc(collection(db, collectionName), {
      ...docData,
      title: docData.title.trim(),
      description: docData.description?.trim() || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  uploadDocument: async ({ file, title, description = '', category }) => {
    firebaseServices._assertReady();
    const activeStudent = await getActiveStudentProfile();
    if (!file) throw new Error('Please select a valid document file.');
    if (!title?.trim()) throw new Error('Please enter a document title.');
    const collectionName = getCollectionName(category);
    const storagePath = `students/${activeStudent.uid}/${collectionName}/${Date.now()}-${safeFileName(file.name)}`;
    const fileRef = ref(storage, storagePath);
    await uploadBytes(fileRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        studentUid: activeStudent.uid,
        department: activeStudent.department,
        category,
      },
    });
    const fileUrl = await getDownloadURL(fileRef);
    const documentRecord = {
      title,
      description,
      category,
      fileName: file.name,
      filename: file.name,
      fileType: file.type,
      type: file.type,
      fileSize: file.size,
      fileSizeLabel: window.formatFileSize?.(file.size) || `${file.size} B`,
      fileUrl,
      storagePath,
      studentUid: activeStudent.uid,
      studentName: activeStudent.fullName || activeStudent.name || '',
      registerNumber: activeStudent.registerNumber || activeStudent.reg || '',
      department: activeStudent.department,
      year: activeStudent.year || '',
    };
    const documentRef = await addDoc(collection(db, collectionName), {
      ...documentRecord,
      title: title.trim(),
      description: description.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: documentRef.id, ...documentRecord };
  },

  getDocuments: async (uid, category) => {
    firebaseServices._assertReady();
    const collectionName = getCollectionName(category);
    const role = await getCurrentRole();
    let docsQuery = query(collection(db, collectionName), where("studentUid", "==", uid));
    if (role === 'teacher') {
      const teacher = await getActiveTeacherProfile();
      const student = await firebaseServices.getStudentById(uid);
      await assertTeacherCanAccessStudent(student, teacher);
      docsQuery = query(collection(db, collectionName), where("studentUid", "==", uid), where("department", "==", teacher.department));
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
    const categories = options.category ? [options.category] : DOCUMENT_CATEGORIES;
    for (const category of categories) {
      const collectionName = getCollectionName(category);
      const documentSnapshot = await getDoc(doc(db, collectionName, docId));
      if (!documentSnapshot.exists()) continue;
      const data = documentSnapshot.data();
      if (options.uid && String(data.studentUid) !== String(options.uid)) return null;
      const role = await getCurrentRole();
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
    const role = await getCurrentRole();
    if (role === 'teacher') {
      await assertTeacherCanAccessDocumentData(currentData);
      if (data.department && data.department !== currentData.department) {
        throw new Error('Document department cannot be changed.');
      }
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
      await assertTeacherCanAccessDocumentData(currentData);
    } else if (auth.currentUser && String(currentData.studentUid) !== String(auth.currentUser.uid)) {
      throw new Error('Access denied. You can delete only your own documents.');
    }
    if (currentData.storagePath) {
      await deleteObject(ref(storage, currentData.storagePath)).catch((error) => {
        if (error.code !== 'storage/object-not-found') throw error;
      });
    }
    await deleteDoc(doc(db, collectionName, docId));
  },

  searchStudents: async (searchParams) => {
    firebaseServices._assertReady();
    let scopedDepartment = searchParams.department || '';
    if (auth.currentUser && await firebaseServices.getUserRole(auth.currentUser.uid) === 'teacher') {
      const teacher = await getActiveTeacherProfile();
      scopedDepartment = teacher.department;
    }
    let q = scopedDepartment
      ? query(collection(db, "users"), where("department", "==", scopedDepartment))
      : query(collection(db, "users"));
    if (searchParams.registerNumber) q = query(q, where("registerNumber", "==", searchParams.registerNumber));
    if (searchParams.name) q = query(q, where("fullName", ">=", searchParams.name), where("fullName", "<=", searchParams.name + '\uf8ff'));
    if (searchParams.year) q = query(q, where("year", "==", searchParams.year));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  listStudents: async () => {
    firebaseServices._assertReady();
    let studentsQuery = query(collection(db, "users"));
    if (auth.currentUser && await firebaseServices.getUserRole(auth.currentUser.uid) === 'teacher') {
      const teacher = await getActiveTeacherProfile();
      studentsQuery = query(collection(db, "users"), where("department", "==", teacher.department));
    }
    const querySnapshot = await getDocs(studentsQuery);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      if (studentData.department && studentData.department !== teacher.department) {
        throw new Error('You can add students only to your assigned department.');
      }
      studentData.department = teacher.department;
    }
    firebaseServices._assertDepartment(studentData.department);
    firebaseServices._assertYear(studentData.year);
    const registerNumber = studentData.registerNumber?.trim();
    const studentId = studentData.studentId?.trim();
    if (!registerNumber) throw new Error('Please enter a register number.');
    const duplicateRegisterQuery = query(
      collection(db, "users"),
      where("registerNumber", "==", registerNumber),
      where("department", "==", studentData.department)
    );
    const registerSnapshot = await getDocs(duplicateRegisterQuery);
    if (!registerSnapshot.empty) throw new Error('This register number is already registered.');
    if (studentId) {
      const duplicateStudentIdQuery = query(
        collection(db, "users"),
        where("studentId", "==", studentId),
        where("department", "==", studentData.department)
      );
      const studentIdSnapshot = await getDocs(duplicateStudentIdQuery);
      if (!studentIdSnapshot.empty) throw new Error('This Student ID is already registered.');
    }
    const ref = await addDoc(collection(db, "users"), {
      fullName: studentData.fullName?.trim() || '',
      registerNumber,
      email: studentData.email?.trim() || '',
      phone: studentData.phone?.trim() || studentData.mobile?.trim() || '',
      department: studentData.department,
      year: studentData.year,
      studentId: studentId || '',
      role: 'student',
      createdBy: auth.currentUser?.uid || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
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
    const categories = DOCUMENT_CATEGORIES;
    const allDocuments = {};
    for (const category of categories) {
      const collectionName = getCollectionName(category);
      const q = teacher
        ? query(collection(db, collectionName), where("studentUid", "==", uid), where("department", "==", teacher.department))
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
    const categories = DOCUMENT_CATEGORIES;
    const allDocuments = [];
    for (const category of categories) {
      const collectionName = getCollectionName(category);
      const q = teacher
        ? query(collection(db, collectionName), where("studentUid", "==", uid), where("department", "==", teacher.department))
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
    const categories = DOCUMENT_CATEGORIES;
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
    const studentSnapshot = await getCountFromServer(query(collection(db, "users"), where("department", "==", teacher.department)));
    const categories = DOCUMENT_CATEGORIES;
    const counts = {
      department: teacher.department,
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
        query(collection(db, getCollectionName(category)), where("department", "==", teacher.department))
      );
      const count = docsSnapshot.data().count;
      counts[keyByCategory[category]] = count;
      counts.totalDocuments += count;
    }
    return counts;
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
    await sendPasswordResetEmail(auth, email);
  },

  waitForAuthUser: async () => {
    firebaseServices._assertReady();
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

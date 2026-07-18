(function(){
  const isBrowser = typeof window !== 'undefined';
  if(!isBrowser) return;

  const toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  document.body.appendChild(toastContainer);

  if (!document.querySelector('link[rel="icon"]')) {
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/png';
    favicon.href = 'assets/img/sankara-logo.png';
    document.head.appendChild(favicon);
  }

  if (!document.querySelector('link[href="assets/css/responsive.css"]')) {
    const responsiveStyles = document.createElement('link');
    responsiveStyles.rel = 'stylesheet';
    responsiveStyles.href = 'assets/css/responsive.css';
    document.head.appendChild(responsiveStyles);
  }

  window.slToast = function(message, type='info') {
    const el = document.createElement('div');
    el.className = `toast-item ${type}`;
    const messageEl = document.createElement('div');
    messageEl.className = 'fw-semibold';
    messageEl.textContent = message;
    el.appendChild(messageEl);
    toastContainer.appendChild(el);
    setTimeout(()=>{ el.remove(); }, 2800);
  };

  window.escapeHtml = function(value = '') {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char]));
  };

  const firebaseStorageUrlPattern = /firebasestorage\.googleapis\.com|storage\.googleapis\.com|\.appspot\.com\/o\//i;
  const cloudinaryUrlPattern = /^https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|raw|video|auto)\/upload\//i;

  window.slIsLegacyFirebaseStorageUrl = function(url = '') {
    return firebaseStorageUrlPattern.test(String(url || ''));
  };

  window.slDocumentUrl = function(doc = {}, options = {}) {
    const { allowDataUrl = true } = options;
    const candidates = [doc.documentUrl, doc.fileUrl, allowDataUrl ? doc.dataUrl : ''];
    return candidates.find((url) => url && !window.slIsLegacyFirebaseStorageUrl(url)) || '';
  };

  window.slDownloadUrl = function(docOrUrl = {}, filename = '') {
    const sourceUrl = typeof docOrUrl === 'string'
      ? docOrUrl
      : window.slDocumentUrl(docOrUrl, { allowDataUrl: true });
    if (!sourceUrl || window.slIsLegacyFirebaseStorageUrl(sourceUrl)) return '';
    if (!cloudinaryUrlPattern.test(sourceUrl) || sourceUrl.includes('/upload/fl_attachment')) return sourceUrl;
    const attachmentName = String(filename || '').trim()
      .replace(/\.[^/.]+$/, '')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .slice(0, 120);
    const attachmentFlag = attachmentName ? `fl_attachment:${attachmentName}` : 'fl_attachment';
    return sourceUrl.replace('/upload/', `/upload/${attachmentFlag}/`);
  };

  window.slDownloadDocument = function(doc = {}, fallbackName = 'document') {
    const fileName = doc.fileName || doc.filename || doc.documentName || doc.title || fallbackName;
    const url = window.slDownloadUrl(doc, fileName);
    if (!url) {
      window.slToast?.('Download link is not available for this document.', 'error');
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  window.isEmail = window.isEmail || function(value = '') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
  };

  window.validateDocumentFile = function(file, options = {}) {
    const {
      maxSizeBytes = 750 * 1024,
      allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'],
      allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'],
    } = options;

    if (!file) return 'Please select a file.';
    const extension = String(file.name || '').split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(file.type) || !allowedExtensions.includes(extension)) {
      return 'Only PDF, JPG, JPEG, and PNG files are allowed.';
    }
    if (file.size > maxSizeBytes) {
      return maxSizeBytes >= 1024 * 1024
        ? `File size must be ${(maxSizeBytes / (1024 * 1024)).toFixed(0)} MB or smaller.`
        : `File size must be ${Math.round(maxSizeBytes / 1024)} KB or smaller.`;
    }
    return '';
  };

  window.slReadJson = window.slReadJson || function slReadJson(key, fallback = null) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch {
      localStorage.removeItem(key);
      return fallback;
    }
  };

  window.formatFileSize = function(bytes = 0) {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  window.slSetTheme = function(theme){
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('sl_theme', theme);
    document.querySelectorAll('[data-theme-toggle] button').forEach((btn) => {
      btn.innerHTML = `<i class="fas fa-${theme === 'dark' ? 'sun' : 'moon'}"></i>`;
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  };

  const savedTheme = localStorage.getItem('sl_theme') || 'light';
  window.slSetTheme(savedTheme);

  window.SL_YEARS = ['I', 'II', 'III'];
  window.SL_YEAR_LABELS = window.SL_YEAR_LABELS || { I: 'I Year', II: 'II Year', III: 'III Year' };
  window.SL_ACADEMIC_DOCUMENT_TYPES = window.SL_ACADEMIC_DOCUMENT_TYPES || [
    'Aadhaar Card',
    'Income Certificate',
    'Community Certificate',
    '10th Marksheet',
    '12th Marksheet',
    'Bank Passbook',
  ];
  window.populateYearSelects = function populateYearSelects() {
    document.querySelectorAll('[data-year-select]').forEach((select) => {
      const current = select.value;
      const placeholder = select.dataset.placeholder || 'Select Year';
      select.innerHTML = `<option value="">${placeholder}</option>` + window.SL_YEARS
        .map((year) => `<option value="${year}">${window.SL_YEAR_LABELS[year] || year}</option>`)
        .join('');
      if (window.SL_YEARS.includes(current)) select.value = current;
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.populateYearSelects);
  } else {
    window.populateYearSelects();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-theme-toggle] button');
    if (!button) return;
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    window.slSetTheme(next);
  });

  const markReady = () => document.body.classList.add('page-ready');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markReady, { once: true });
  } else {
    markReady();
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('.btn, .role-card, .nav-link, .menu-btn, .theme-btn');
    if (!target || target.classList.contains('disabled')) return;
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ui-ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    target.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  });

  window.getStudents = function(){
    const seed = [
      { id: 1, uid: 'local-1', name: 'Asha Kumar', fullName: 'Asha Kumar', reg: 'STU1001', registerNumber: 'STU1001', dept: 'B.Sc Computer Science (BSC CS)', department: 'B.Sc Computer Science (BSC CS)', year: 'III', studentId: 'SL-001', email: 'asha@college.edu' },
      { id: 2, uid: 'local-2', name: 'Ravi Shankar', fullName: 'Ravi Shankar', reg: 'STU1002', registerNumber: 'STU1002', dept: 'Information Technology (IT)', department: 'Information Technology (IT)', year: 'II', studentId: 'SL-002', email: 'ravi@college.edu' }
    ];
    const stored = window.slReadJson('sl_students', null);
    return stored || seed;
  };

  window.saveStudents = function(students){
    localStorage.setItem('sl_students', JSON.stringify(students));
  };

  window.getDocs = function(){
    const stored = window.slReadJson('sl_docs', null);
    return stored || [];
  };

  window.addDoc = function(doc){
    const docs = getDocs(); docs.push({ id: Date.now(), createdAt: new Date().toISOString(), ...doc });
    localStorage.setItem('sl_docs', JSON.stringify(docs));
  };

  window.deleteDoc = function(id){
    const docs = getDocs().filter(d => d.id !== id);
    localStorage.setItem('sl_docs', JSON.stringify(docs));
  };

  window.getUser = function(){
    return window.slReadJson('sl_user', null);
  };

  window.getProfile = function(){
    return window.slReadJson('sl_profile', null);
  };

  window.passwordStrength = function(value){
    let score = 0;
    if(value.length >= 8) score++;
    if(/[A-Z]/.test(value)) score++;
    if(/[0-9]/.test(value)) score++;
    if(/[^A-Za-z0-9]/.test(value)) score++;
    return score;
  };

  const setAuthState = function(role, profile = {}){
    localStorage.setItem('sl_authenticated', 'true');
    localStorage.setItem('sl_role', role);
    localStorage.setItem('sl_user', JSON.stringify({
      uid: profile.uid || '',
      name: profile.fullName || profile.name || profile.email?.split('@')[0] || (role === 'teacher' ? 'Teacher' : 'Student'),
      email: profile.email || '',
      role
    }));
    localStorage.setItem('sl_profile', JSON.stringify(profile));
  };

  const readJson = (key, fallback) => window.slReadJson(key, fallback);

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

  const isAcademicDocumentType = (title = '') => window.SL_ACADEMIC_DOCUMENT_TYPES.includes(String(title).trim());

  const assertAcademicDocumentType = (category, title) => {
    if (category === 'Academic Certificates' && !isAcademicDocumentType(title)) {
      throw new Error('Please select a valid academic document type.');
    }
  };

  const isRegisterNumberTaken = (registerNumber, ignoreUid = '') => {
    const normalized = String(registerNumber || '').trim().toLowerCase();
    if (!normalized) return false;
    const accountMatch = localAccounts().some((account) => (
      account.role === 'student'
      && account.uid !== ignoreUid
      && String(account.profile?.registerNumber || '').trim().toLowerCase() === normalized
    ));
    const studentMatch = window.getStudents().some((student) => (
      String(student.uid || student.id) !== String(ignoreUid)
      && String(student.registerNumber || student.reg || '').trim().toLowerCase() === normalized
    ));
    return accountMatch || studentMatch;
  };

  const normalizeYear = (value = '') => String(value).trim().toUpperCase();
  const normalizeDepartment = (value = '') => {
    const raw = String(value).trim();
    return window.SL_DEPARTMENTS?.find((department) => department.toLowerCase() === raw.toLowerCase()) || raw;
  };

  const assertValidYear = (year) => {
    if (!window.SL_YEARS.includes(normalizeYear(year))) throw new Error('Please select a valid year.');
  };

  const getDepartment = (record = {}) => normalizeDepartment(record.department || record.dept || '');

  const assertValidDepartment = (department) => {
    const normalizedDepartment = normalizeDepartment(department);
    if (!normalizedDepartment) throw new Error('Please select a department.');
    if (window.SL_DEPARTMENTS?.length && !window.SL_DEPARTMENTS.includes(normalizedDepartment)) {
      throw new Error('Please select a valid department.');
    }
  };

  const currentTeacherProfile = async () => {
    if (localStorage.getItem('sl_role') !== 'teacher') return null;
    return window.userService?.getCurrentProfile
      ? window.userService.getCurrentProfile('teacher')
      : readJson('sl_profile', null);
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

  const findLocalStudent = async (studentId) => {
    const students = await window.userService.listStudents();
    return students.find((item) => String(item.uid || item.id) === String(studentId)) || null;
  };

  const hasLiveFirebase = () => !!window.firebaseServices && !window.firebaseInitError;

  const requireLiveFirebase = () => {
    if (!hasLiveFirebase()) {
      throw new Error(window.firebaseInitError?.message || 'Firebase is not configured. Accounts and documents cannot sync until Firebase initializes successfully.');
    }
  };

  const canTeacherAccessDocument = async (documentRecord) => {
    if (localStorage.getItem('sl_role') !== 'teacher') return true;
    if (documentRecord?.category !== 'Academic Certificates') return false;
    const teacherDepartment = await requireTeacherDepartment();
    const teacherYear = await requireTeacherYear();
    const documentDepartment = getDepartment(documentRecord);
    if (documentDepartment && documentRecord?.year) return documentDepartment === teacherDepartment && normalizeYear(documentRecord.year) === teacherYear;
    if (!documentRecord?.studentUid) return false;
    const student = await findLocalStudent(documentRecord.studentUid);
    return getDepartment(student || {}) === teacherDepartment && normalizeYear(student?.year) === teacherYear;
  };

  const assertTeacherCanAccessDocument = async (documentRecord) => {
    if (!(await canTeacherAccessDocument(documentRecord))) {
      throw new Error('Access denied. This document belongs to another department.');
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

  window.authService = {
    registerStudent: async (studentData) => {
      if (hasLiveFirebase() && window.firebaseServices?.registerStudent) {
        const user = await window.firebaseServices.registerStudent(studentData);
        return { uid: user.uid, email: user.email, role: 'student' };
      }
      requireLiveFirebase();
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
      accounts.push({ uid, email, password: studentData.password, role: 'student', profile });
      saveLocalAccounts(accounts);
      return profile;
    },

    registerTeacher: async (teacherData) => {
      if (hasLiveFirebase() && window.firebaseServices?.registerTeacher) {
        const user = await window.firebaseServices.registerTeacher(teacherData);
        return { uid: user.uid, email: user.email, role: 'teacher' };
      }
      requireLiveFirebase();
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
      accounts.push({ uid, email, password: teacherData.password, role: 'teacher', profile });
      saveLocalAccounts(accounts);
      return profile;
    },

    login: async (email, password, role) => {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (hasLiveFirebase() && window.firebaseServices?.loginWithEmailAndPassword) {
        const user = await window.firebaseServices.loginWithEmailAndPassword(normalizedEmail, password, role);
        const profile = await window.firebaseServices.getUserProfile(user.uid, role);
        setAuthState(role, { uid: user.uid, ...(profile || { email: normalizedEmail, role }) });
        return { uid: user.uid, email: user.email || normalizedEmail, role, ...(profile || {}) };
      }
      requireLiveFirebase();
      const account = findLocalAccount(normalizedEmail, role);
      if (!account || account.password !== password) throw new Error('Invalid email or password.');
      setAuthState(role, account.profile);
      return account.profile;
    },

    logout: async () => {
      if (hasLiveFirebase() && window.firebaseServices?.logout) await window.firebaseServices.logout();
      ['sl_authenticated', 'sl_role', 'sl_user', 'sl_profile'].forEach((key) => localStorage.removeItem(key));
    },

    currentUser: async () => {
      if (hasLiveFirebase() && window.firebaseServices?.waitForAuthUser) {
        const user = await window.firebaseServices.waitForAuthUser();
        if (user) return user;
      }
      return readJson('sl_user', null);
    },

    changePassword: async (newPassword) => {
      if (hasLiveFirebase() && window.firebaseServices?.updateUserPassword) {
        await window.firebaseServices.updateUserPassword(newPassword);
        return;
      }
      const active = readJson('sl_user', null);
      if (!active) throw new Error('Please sign in again to update your password.');
      const accounts = localAccounts();
      const account = accounts.find((item) => item.uid === active.uid);
      if (!account) throw new Error('Account not found.');
      account.password = newPassword;
      saveLocalAccounts(accounts);
    },

    changeEmail: async (newEmail) => {
      if (hasLiveFirebase() && window.firebaseServices?.updateUserEmail) {
        await window.firebaseServices.updateUserEmail(newEmail);
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
    },

    sendPasswordReset: async (email) => {
      if (hasLiveFirebase() && window.firebaseServices?.sendPasswordReset) {
        await window.firebaseServices.sendPasswordReset(email);
        return;
      }
      requireLiveFirebase();
      const account = localAccounts().find((item) => item.email.toLowerCase() === String(email || '').trim().toLowerCase());
      if (!account) throw new Error('No account was found for that email address.');
    },
  };

  window.userService = {
    getCurrentProfile: async (role = localStorage.getItem('sl_role') || 'student') => {
      const active = await window.authService.currentUser();
      if (active?.uid && hasLiveFirebase() && window.firebaseServices?.getUserProfile) {
        const profile = await window.firebaseServices.getUserProfile(active.uid, role);
        if (profile) return { uid: active.uid, ...profile };
      }
      return readJson('sl_profile', null);
    },

    addStudent: async (studentData) => {
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
      if (hasLiveFirebase() && window.firebaseServices?.addStudentProfile) {
        return window.firebaseServices.addStudentProfile(studentData);
      }
      assertValidYear(studentData.year);
      const students = window.getStudents();
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
      window.saveStudents(students);
      return record.id;
    },

    listStudents: async () => {
      if (hasLiveFirebase() && window.firebaseServices?.listStudents) {
        return window.firebaseServices.listStudents();
      }
      const accountStudents = localAccounts()
        .filter((account) => account.role === 'student')
        .map((account) => account.profile);
      const records = window.getStudents();
      const byId = new Map([...records, ...accountStudents].map((student) => [String(student.uid || student.id), student]));
      const students = Array.from(byId.values());
      if (localStorage.getItem('sl_role') !== 'teacher') return students;
      const department = await requireTeacherDepartment();
      const year = await requireTeacherYear();
      const scopedStudents = students.filter((student) => getDepartment(student) === department && normalizeYear(student.year) === year);
      const docs = await visibleDocumentsForTeacher(window.documentService.getAllDocuments());
      return addAcademicSummaryToStudents(scopedStudents, docs);
    },

    getTeacherDepartment: async () => requireTeacherDepartment(),
    getTeacherYear: async () => requireTeacherYear(),

    subscribeStudents: async (callback) => {
      if (hasLiveFirebase() && window.firebaseServices?.subscribeStudents) {
        return window.firebaseServices.subscribeStudents(callback);
      }
      callback(await window.userService.listStudents());
      return () => {};
    },

    canAccessStudent: async (student) => canTeacherAccessStudent(student),

    deleteStudent: async (studentId) => {
      if (hasLiveFirebase() && window.firebaseServices?.deleteStudent) {
        await window.firebaseServices.deleteStudent(studentId);
        return;
      }
      const student = window.getStudents().find((item) => String(item.uid || item.id) === String(studentId));
      if (student) await assertTeacherCanAccessStudent(student);
      const students = window.getStudents().filter((student) => String(student.uid || student.id) !== String(studentId));
      window.saveStudents(students);

      const accounts = localAccounts();
      const nextAccounts = accounts.filter((account) => String(account.uid) !== String(studentId));
      saveLocalAccounts(nextAccounts);

      const docs = window.documentService.getAllDocuments()
        .filter((doc) => String(doc.studentUid) !== String(studentId));
      writeJson('sl_docs', docs);
    },
  };

  window.teacherService = {
    getDashboardStats: async () => {
      if (hasLiveFirebase() && window.firebaseServices?.getTeacherDashboardStats) {
        return window.firebaseServices.getTeacherDashboardStats();
      }
      const department = await requireTeacherDepartment();
      const year = await requireTeacherYear();
      const students = await window.userService.listStudents();
      const studentIds = new Set(students.map((student) => String(student.uid || student.id)));
      const docs = window.documentService.getAllDocuments()
        .filter((doc) => doc.category === 'Academic Certificates' && normalizeYear(doc.year) === year && (studentIds.has(String(doc.studentUid)) || getDepartment(doc) === department));
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
    },

    getAcademicDocumentAnalytics: async () => {
      if (hasLiveFirebase() && window.firebaseServices?.getAcademicDocumentAnalytics) {
        return window.firebaseServices.getAcademicDocumentAnalytics();
      }
      const students = await window.userService.listStudents();
      const docs = await visibleDocumentsForTeacher(window.documentService.getAllDocuments());
      return window.SL_ACADEMIC_DOCUMENT_TYPES.map((type) => {
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
    },

    subscribeAcademicDocumentAnalytics: async (callback) => {
      if (hasLiveFirebase() && window.firebaseServices?.subscribeAcademicDocumentAnalytics) {
        return window.firebaseServices.subscribeAcademicDocumentAnalytics(callback);
      }
      callback(await window.teacherService.getAcademicDocumentAnalytics());
      return () => {};
    },
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  window.documentService = {
    getAllDocuments: () => readJson('sl_docs', []),

    getDocumentById: async (id, options = {}) => {
      const { uid = '', category = '' } = options;
      if (hasLiveFirebase() && window.firebaseServices?.getDocumentById) {
        return window.firebaseServices.getDocumentById(id, { uid, category });
      }

      const localMatch = window.documentService.getAllDocuments()
        .find((doc) => String(doc.id) === String(id));
      if (localMatch) {
        if (localStorage.getItem('sl_role') === 'teacher') await assertTeacherCanAccessDocument(localMatch);
        return localMatch;
      }

      if (uid) {
        const docs = await window.documentService.getStudentDocuments(uid);
        return docs.find((doc) => String(doc.id) === String(id)) || null;
      }

      return null;
    },

    getDocuments: async (uid, category) => {
      if (hasLiveFirebase() && window.firebaseServices?.getDocuments && category) {
        return window.firebaseServices.getDocuments(uid, category);
      }
      const docs = window.documentService.getAllDocuments();
      let filtered = docs.filter((doc) => (!uid || doc.studentUid === uid) && (!category || doc.category === category));
      filtered = await visibleDocumentsForTeacher(filtered);
      return filtered;
    },

    getStudentDocuments: async (uid) => {
      if (hasLiveFirebase() && window.firebaseServices?.getStudentDocuments) {
        return window.firebaseServices.getStudentDocuments(uid);
      }
      let docs = window.documentService.getAllDocuments().filter((doc) => String(doc.studentUid) === String(uid));
      docs = await visibleDocumentsForTeacher(docs);
      return docs;
    },

    subscribeStudentDocuments: async (uid, callback) => {
      if (hasLiveFirebase() && window.firebaseServices?.subscribeStudentDocuments) {
        return window.firebaseServices.subscribeStudentDocuments(uid, callback);
      }
      callback(await window.documentService.getStudentDocuments(uid));
      return () => {};
    },

    uploadDocument: async ({ file, title, description = '', category }) => {
      const active = await window.authService.currentUser();
      const profile = await window.userService.getCurrentProfile('student');
      if (!active?.uid) throw new Error('Please sign in before uploading documents.');
      if (!title?.trim()) throw new Error('Please enter a document title.');
      assertAcademicDocumentType(category, title);
      const fileError = window.validateDocumentFile(file, { maxSizeBytes: 5 * 1024 * 1024 });
      if (fileError) throw new Error(fileError);
      const existingDocs = await window.documentService.getDocuments(active.uid, category);
      if (category === 'Academic Certificates' && existingDocs.some((doc) => doc.title === title.trim())) {
        throw new Error(`${title.trim()} is already uploaded for this student.`);
      }
      if (hasLiveFirebase() && window.firebaseServices?.uploadDocument) {
        const uploaded = await window.firebaseServices.uploadDocument({ title, description, category, file });
        return uploaded.id;
      }

      const dataUrl = await readFileAsDataUrl(file);
      const docs = window.documentService.getAllDocuments();
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
        fileSizeLabel: window.formatFileSize(file.size),
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
        department: normalizeDepartment(profile?.department || profile?.dept || ''),
        year: normalizeYear(profile?.year || ''),
        status: 'uploaded',
        uploadedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      docs.push(doc);
      writeJson('sl_docs', docs);
      return doc.id;
    },

    deleteDocument: async (id, category = '') => {
      const record = window.documentService.getAllDocuments().find((doc) => String(doc.id) === String(id));
      if (record) await assertTeacherCanAccessDocument(record);
      const documentCategory = category || record?.category;
      if (hasLiveFirebase() && window.firebaseServices?.deleteDocument && documentCategory) {
        await window.firebaseServices.deleteDocument(id, documentCategory);
        return;
      }
      writeJson('sl_docs', window.documentService.getAllDocuments().filter((doc) => String(doc.id) !== String(id)));
    },

    getStats: async (uid = readJson('sl_user', {})?.uid) => {
      const active = uid ? null : await window.authService.currentUser();
      const studentUid = uid || active?.uid || '';
      if (hasLiveFirebase() && window.firebaseServices?.getDashboardStats) {
        return window.firebaseServices.getDashboardStats(studentUid || undefined);
      }
      const docs = await window.documentService.getDocuments(studentUid);
      return {
        totalDocuments: docs.length,
        personalCount: docs.filter((doc) => doc.category === 'Personal Documents').length,
        onlineCount: docs.filter((doc) => doc.category === 'Online Certificates').length,
        offlineCount: docs.filter((doc) => doc.category === 'Offline Certificates').length,
        academicCount: docs.filter((doc) => doc.category === 'Academic Certificates').length,
      };
    },
  };

  window.handleLogin = function(formId, role){
    const form = document.getElementById(formId);
    if(!form) return;
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if(!data.email || !data.password){
        slToast('Please enter your email and password', 'error');
        return;
      }
      try {
        const loginRole = role === 'teacher' ? 'teacher' : 'student';
        await window.authService.login(data.email, data.password, loginRole);
        slToast('Welcome back', 'success');
        window.location.href = role === 'teacher' ? 'teacher-dashboard.html' : 'student-dashboard.html';
      } catch (error) {
        slToast(error.message || 'Login failed', 'error');
      }
    });
  };

  window.handleRegister = function(formId){
    const form = document.getElementById(formId);
    if(!form) return;
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if(!isEmail(data.email)){ slToast('Please enter a valid email address', 'error'); return; }
      if(data.password !== data.confirmPassword){ slToast('Passwords do not match', 'error'); return; }
      if((data.password || '').length < 8 || !/[A-Za-z]/.test(data.password) || !/[0-9]/.test(data.password)){
        slToast('Password must be at least 8 characters and include letters and numbers', 'error');
        return;
      }
      try {
        await window.authService.registerStudent({
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          registerNumber: data.registerNumber,
          department: data.department,
          year: data.year,
          mobile: data.mobile
        });
        await window.authService.logout();
        localStorage.setItem('sl_role', 'student');
        slToast('Registration successful. Please wait for verification.', 'success');
        setTimeout(()=>window.location.href = 'index.html', 500);
      } catch (error) {
        console.error('[app] Student registration failed.', error);
        slToast(error.message || 'Registration failed', 'error');
      }
    });
  };
})();

const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
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
}

export function slToast(message, type = 'info') {
  if (!isBrowser) return;
  const el = document.createElement('div');
  el.className = `toast-item ${type}`;
  const messageEl = document.createElement('div');
  messageEl.className = 'fw-semibold';
  messageEl.textContent = message;
  el.appendChild(messageEl);
  const toastContainer = document.querySelector('.toast-container');
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 2800);
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

const firebaseStorageUrlPattern = /firebasestorage\.googleapis\.com|storage\.googleapis\.com|\.appspot\.com\/o\//i;
const cloudinaryUrlPattern = /^https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|raw|video|auto)\/upload\//i;

export function slIsLegacyFirebaseStorageUrl(url = '') {
  return firebaseStorageUrlPattern.test(String(url || ''));
}

export function slDocumentUrl(doc = {}, options = {}) {
  const {
    allowDataUrl = true
  } = options;
  const candidates = [
    doc.documentUrl,
    doc.secure_url,
    doc.secureUrl,
    doc.fileUrl,
    doc.url,
    allowDataUrl ? doc.dataUrl : '',
  ];
  const url = candidates.find((candidate) => candidate && !slIsLegacyFirebaseStorageUrl(candidate)) || '';
  return String(url || '').trim();
}

export function slDownloadUrl(docOrUrl = {}, filename = '') {
  const sourceUrl = typeof docOrUrl === 'string' ?
    docOrUrl :
    slDocumentUrl(docOrUrl, {
      allowDataUrl: true
    });
  if (!sourceUrl || slIsLegacyFirebaseStorageUrl(sourceUrl)) return '';
  if (!cloudinaryUrlPattern.test(sourceUrl) || sourceUrl.includes('/upload/fl_attachment')) return sourceUrl;
  const attachmentName = String(filename || '').trim()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .slice(0, 120);
  const attachmentFlag = attachmentName ? `fl_attachment:${encodeURIComponent(attachmentName)}` : 'fl_attachment';
  return sourceUrl.replace('/upload/', `/upload/${attachmentFlag}/`);
}

export function slDownloadDocument(doc = {}, fallbackName = 'document') {
  const fileName = doc.fileName || doc.filename || doc.documentName || doc.title || fallbackName;
  const url = slDownloadUrl(doc, fileName);
  if (!url) {
    slToast?.('Download link is not available for this document.', 'error');
    return;
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function isEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export function validateDocumentFile(file, options = {}) {
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
    return maxSizeBytes >= 1024 * 1024 ?
      `File size must be ${(maxSizeBytes / (1024 * 1024)).toFixed(0)} MB or smaller.` :
      `File size must be ${Math.round(maxSizeBytes / 1024)} KB or smaller.`;
  }
  return '';
}

export function slReadJson(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

export function formatFileSize(bytes = 0) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function slSetTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('sl_theme', theme);
  document.querySelectorAll('[data-theme-toggle] button').forEach((btn) => {
    btn.innerHTML = `<i class="fas fa-${theme === 'dark' ? 'sun' : 'moon'}"></i>`;
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  });
}

if (isBrowser) {
  const savedTheme = localStorage.getItem('sl_theme') || 'light';
  slSetTheme(savedTheme);
}


export const SL_YEARS = ['I', 'II', 'III'];
export const SL_YEAR_LABELS = {
  I: 'I Year',
  II: 'II Year',
  III: 'III Year'
};
export const SL_ACADEMIC_DOCUMENT_TYPES = [
  'Aadhaar Card',
  'Income Certificate',
  'Community Certificate',
  '10th Marksheet',
  '12th Marksheet',
  'Bank Passbook',
];
export function populateYearSelects() {
  document.querySelectorAll('[data-year-select]').forEach((select) => {
    const current = select.value;
    const placeholder = select.dataset.placeholder || 'Select Year';
    select.innerHTML = `<option value="">${placeholder}</option>` + SL_YEARS
      .map((year) => `<option value="${year}">${SL_YEAR_LABELS[year] || year}</option>`)
      .join('');
    if (SL_YEARS.includes(current)) select.value = current;
  });
}

if (isBrowser) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', populateYearSelects);
  } else {
    populateYearSelects();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-theme-toggle] button');
    if (!button) return;
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    slSetTheme(next);
  });

  const markReady = () => document.body.classList.add('page-ready');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markReady, {
      once: true
    });
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
    ripple.addEventListener('animationend', () => ripple.remove(), {
      once: true
    });
  });
}

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

export function getDocs() {
  const stored = slReadJson('sl_docs', null);
  return stored || [];
}

export function addDoc(doc) {
  const docs = getDocs();
  docs.push({
    id: Date.now(),
    createdAt: new Date().toISOString(),
    ...doc
  });
  localStorage.setItem('sl_docs', JSON.stringify(docs));
}

export function deleteDoc(id) {
  const docs = getDocs().filter(d => d.id !== id);
  localStorage.setItem('sl_docs', JSON.stringify(docs));
}

export function getUser() {
  return slReadJson('sl_user', null);
}

export function getProfile() {
  return slReadJson('sl_profile', null);
}

export function passwordStrength(value) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return score;
}

// Expose all functions as window globals for inline HTML scripts
if (isBrowser) {
  const exports = {
    slToast,
    escapeHtml,
    slIsLegacyFirebaseStorageUrl,
    slDocumentUrl,
    slDownloadUrl,
    slDownloadDocument,
    isEmail,
    validateDocumentFile,
    slReadJson,
    formatFileSize,
    slSetTheme,
    SL_YEARS,
    SL_YEAR_LABELS,
    SL_ACADEMIC_DOCUMENT_TYPES,
    populateYearSelects,
    getStudents,
    saveStudents,
    getDocs,
    addDoc,
    deleteDoc,
    getUser,
    getProfile,
    passwordStrength
  };

  Object.entries(exports).forEach(([key, value]) => {
    if (value !== undefined && !window[key]) {
      window[key] = value;
    }
  });
}

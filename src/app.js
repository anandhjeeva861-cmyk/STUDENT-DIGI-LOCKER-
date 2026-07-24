// src/app.js - Central utility functions and global exposures

/**
 * Displays a toast notification.
 * @param {string} message - The message to display.
 * @param {'success'|'error'|'info'|'warning'} [type='info'] - The type of toast.
 */
export function slToast(message, type = 'info') {
  const toastContainer = document.getElementById('sl-toast-container') || (() => {
    const div = document.createElement('div');
    div.id = 'sl-toast-container';
    document.body.appendChild(div);
    return div;
  })();

  const toast = document.createElement('div');
  toast.className = `sl-toast sl-toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10); // Small delay to trigger CSS transition

  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}

export function slReadJson(key, fallback = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Error reading or parsing localStorage key "${key}":`, e);
    return fallback;
  }
}

export function isEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export function formatFileSize(bytes, decimalPoint) {
  if (bytes == 0) return '0 Bytes';
  const k = 1000,
    dm = decimalPoint || 2,
    sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function validateDocumentFile(file, options = {}) {
  const { maxSizeBytes = 5 * 1024 * 1024 } = options; // Default 5MB
  if (!file) return 'No file selected.';
  if (file.size > maxSizeBytes) return `File size exceeds ${formatFileSize(maxSizeBytes)}.`;
  return null; // No error
}

export function getProfile() {
  return slReadJson('sl_profile', null);
}

export function hasFirebase() {
  return !!window.firebaseServices && !window.firebaseInitError;
}

// Expose critical functions globally for legacy HTML/inline scripts
window.slToast = slToast;
window.slReadJson = slReadJson;
window.isEmail = isEmail;
window.formatFileSize = formatFileSize;
window.validateDocumentFile = validateDocumentFile;
window.getProfile = getProfile;
window.hasFirebase = hasFirebase;
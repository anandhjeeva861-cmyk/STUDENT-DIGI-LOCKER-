import { auth, authPersistenceReady } from './firebase-init.js';
import { onAuthStateChanged } from '@firebase/auth';

const publicPages = ['index.html', 'student-register.html', 'teacher-login.html', 'teacher-register.html', ''];
const teacherPages = ['teacher-dashboard.html', 'teacher-profile.html', 'add-student.html', 'search-student.html'];
const studentPages = ['student-dashboard.html', 'profile.html', 'personal-documents.html', 'online-certificates.html', 'offline-certificates.html', 'academic-certificates.html', 'view-document.html'];

const currentPage = window.location.pathname.split('/').pop() || '';
const isPublicPage = publicPages.includes(currentPage);
const isRegistrationPage = ['student-register.html', 'teacher-register.html'].includes(currentPage);
const requiredRole = teacherPages.includes(currentPage)
  ? 'teacher'
  : studentPages.includes(currentPage)
    ? 'student'
    : null;

if (!auth) {
  ['sl_authenticated', 'sl_role', 'sl_user', 'sl_profile'].forEach((key) => {
    localStorage.removeItem(key);
  });
  if (!isPublicPage) {
    window.location.href = 'index.html';
  }
} else {
  window.waitForFirebase?.(async () => {
    await authPersistenceReady;
    onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const role = await window.firebaseServices.getUserRole(user.uid);
          if (!role) {
            if (isRegistrationPage) return;
            await window.firebaseServices.logout();
            if (!isPublicPage) window.location.href = 'index.html';
            return;
          }
          if (isPublicPage && !isRegistrationPage) {
            window.location.href = role === 'teacher' ? 'teacher-dashboard.html' : 'student-dashboard.html';
            return;
          }
          if (requiredRole && role !== requiredRole) {
            window.location.href = role === 'teacher' ? 'teacher-dashboard.html' : 'student-dashboard.html';
          }
        } else if (!isPublicPage) {
          window.location.href = 'index.html';
        }
      } catch (error) {
        console.error('[auth-guard] Auth check failed.', error);
        if (!isPublicPage) {
          await window.firebaseServices?.logout?.().catch(() => {});
          window.location.href = 'index.html';
          return;
        }
      }
    });
  });
}

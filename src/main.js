import './app.js';
import './firebase-init.js';
import { initializePasswordStrengthMeter } from './login.js';
import { initializeFormValidation } from './validation.js';
import { initializeLayout } from './layout.js';
import { refreshDashboard } from './dashboard.js';
import * as authService from './services/authService.js';
import * as studentService from './services/studentService.js';
import * as documentService from './services/documentService.js';
import * as teacherService from './services/teacherService.js';

// Load critical legacy assets that set window.* globals
import '../assets/js/constants.js'; // window.SL_DEPARTMENTS, populateDepartmentSelects, etc.
import '../assets/js/firebase-services.js'; // window.firebaseServices for hasLiveFirebase() checks

window.authService = authService;
window.userService = studentService;
window.documentService = documentService;
window.teacherService = teacherService;

initializePasswordStrengthMeter();
initializeFormValidation();
initializeLayout();

console.log('Vite application started');

// Determine current page to run page-specific code
const currentPage = window.location.pathname.split('/').pop() || '';

// Only run dashboard code on dashboard pages
const isDashboardPage = [
  'student-dashboard.html',
  'teacher-dashboard.html'
].includes(currentPage);

if (isDashboardPage) {
  refreshDashboard();
}

// Only attach login/register handlers on login/register pages
const isLoginPage = ['index.html', 'teacher-login.html'].includes(currentPage);
const isRegisterPage = ['student-register.html', 'teacher-register.html'].includes(currentPage);

if (isLoginPage || isRegisterPage) {
  const handleLogin = function(formId, role) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.email || !data.password) {
        window.slToast('Please enter your email and password', 'error');
        return;
      }
      try {
        const loginRole = role === 'teacher' ? 'teacher' : 'student';
        await window.authService.login(data.email, data.password, loginRole);
        window.slToast('Welcome back', 'success');
        window.location.href = role === 'teacher' ? 'teacher-dashboard.html' : 'student-dashboard.html';
      } catch (error) {
        window.slToast(error.message || 'Login failed', 'error');
      }
    });
  };

  const handleRegister = function(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (!isEmail(data.email)) {
        slToast('Please enter a valid email address', 'error');
        return;
      }
      if (data.password !== data.confirmPassword) {
        slToast('Passwords do not match', 'error');
        return;
      }
      if ((data.password || '').length < 8 || !/[A-Za-z]/.test(data.password) || !/[0-9]/.test(data.password)) {
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
        setTimeout(() => window.location.href = 'index.html', 500);
      } catch (error) {
        console.error('[app] Student registration failed.', error);
        slToast(error.message || 'Registration failed', 'error');
      }
    });
  };

  window.handleLogin = handleLogin;
  window.handleRegister = handleRegister;
}

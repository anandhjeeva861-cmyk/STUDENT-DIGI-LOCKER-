import { initializePasswordStrengthMeter } from '../login.js';

document.addEventListener('DOMContentLoaded', () => {
  window.handleRegister('teacherRegisterForm', 'teacher');
  initializePasswordStrengthMeter();
});
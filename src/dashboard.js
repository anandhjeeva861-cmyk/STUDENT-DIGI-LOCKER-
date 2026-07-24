import {
  slReadJson
} from './app.js';
import * as userService from './services/studentService.js';
import * as documentService from './services/documentService.js';
import * as teacherService from './services/teacherService.js';

function animateCount(element, target, formatter = (value) => String(value)) {
  const end = Number(target) || 0;
  const start = Number(element.dataset.currentCount || 0);
  const duration = 520;
  const startedAt = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(start + (end - start) * eased);
    element.textContent = formatter(value);
    if (progress < 1) requestAnimationFrame(tick);
    else element.dataset.currentCount = String(end);
  };
  requestAnimationFrame(tick);
}

export async function refreshDashboard() {
  const role = localStorage.getItem('sl_role') || 'student';
  const user = slReadJson('sl_user', {});
  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = user.name || (role === 'teacher' ? 'Professor' : 'Student');
  });

  let stats = {
    totalDocuments: 0,
    onlineCount: 0,
    offlineCount: 0,
    academicCount: 0
  };
  try {
    const profile = await userService.getCurrentProfile(role);
    const fullName = profile?.fullName || profile?.name || (role === 'teacher' ? 'Teacher' : 'Student');
    document.querySelectorAll('[data-user-name]').forEach(el => {
      el.textContent = fullName;
    });
    document.querySelectorAll('[data-welcome-name]').forEach(el => {
      el.textContent = fullName;
    });
    const topbarWelcome = document.querySelector('[data-topbar-welcome]');
    if (topbarWelcome) topbarWelcome.textContent = `Welcome, ${fullName}`;

    const data = role === 'teacher' ?
      await teacherService.getDashboardStats() :
      await documentService.getStats();
    if (role === 'teacher') {
      const department = data.department || profile?.department || '-';
      const year = data.year || profile?.year || '-';
      document.querySelectorAll('[data-teacher-department]').forEach(el => {
        el.textContent = department;
      });
      document.querySelectorAll('[data-teacher-year]').forEach(el => {
        el.textContent = window.SL_YEAR_LABELS?.[year] || year;
      });
    }
    stats = {
      totalDocuments: data.totalDocuments || 0,
      personalCount: data.personalCount ?? 0,
      onlineCount: data.onlineCount ?? 0,
      offlineCount: data.offlineCount ?? 0,
      academicCount: data.academicCount ?? 0
    };
  } catch (error) {
    console.warn('Dashboard stats unavailable', error);
  }

  document.querySelectorAll('[data-doc-count]').forEach(el => {
    const cat = el.getAttribute('data-doc-count');
    let count = 0;
    if (cat === 'online') count = stats.onlineCount;
    else if (cat === 'offline') count = stats.offlineCount;
    else if (cat === 'academic') count = stats.academicCount;
    else if (cat === 'personal') count = stats.personalCount;
    else count = stats.totalDocuments;
    el.dataset.targetCount = String(count);
    animateCount(el, count, (value) => `${value} ${value === 1 ? 'document' : 'documents'}`);
  });

  const summaryDocs = document.getElementById('summaryDocs');
  if (summaryDocs) animateCount(summaryDocs, stats.totalDocuments || 0);
  const totalDocuments = document.getElementById('totalDocuments');
  if (totalDocuments) animateCount(totalDocuments, stats.totalDocuments || 0);

}
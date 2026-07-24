(function(){
  const isBrowser = typeof window !== 'undefined';
  if(!isBrowser) return;

  // Auth pages: Login & Registration — these pages must NOT get the dashboard sidebar layout
  const AUTH_PAGES = new Set([
    'index.html',
    'teacher-login.html',
    'student-register.html',
    'teacher-register.html'
  ]);

  const _page = window.location.pathname.split('/').pop() || '';
  // This is a legacy file. The new module `src/layout.js` handles layout injection.
  if (AUTH_PAGES.has(_page) || true) return;

  function getRole(){ return localStorage.getItem('sl_role') || 'student'; }
  function getUserName(){
    const user = window.slReadJson?.('sl_user', {}) || {};
    return user.name || (getRole() === 'teacher' ? 'Teacher' : 'Student');
  }
  function isActivePage(href) {
    return window.location.pathname.split('/').pop() === href;
  }

  const shell = document.createElement('div');
  shell.className = 'app-shell';
  document.body.prepend(shell);

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div class="brand">
      <img class="portal-logo portal-logo-sidebar" src="assets/img/sankara-logo.png" alt="Sankara Educational Institutions logo">
      <div>
        <strong>Student Digital Locker</strong>
        <small>Secure campus portal</small>
      </div>
    </div>
    <nav class="nav-list">
      <a class="nav-link ${getRole()==='teacher'?'':'active'}" href="${getRole()==='teacher'?'teacher-dashboard.html':'student-dashboard.html'}"><i class="fas fa-gauge-high"></i> Dashboard</a>
      ${getRole() === 'teacher' ? `<a class="nav-link" href="search-student.html"><i class="fas fa-list"></i> Student List</a><a class="nav-link" href="teacher-profile.html"><i class="fas fa-user-tie"></i> View Profile</a>` : `<a class="nav-link" href="personal-documents.html"><i class="fas fa-id-card"></i> Personal Docs</a><a class="nav-link" href="online-certificates.html"><i class="fas fa-cloud"></i> Online Certificates</a><a class="nav-link" href="offline-certificates.html"><i class="fas fa-folder-open"></i> Offline Certificates</a><a class="nav-link" href="academic-certificates.html"><i class="fas fa-graduation-cap"></i> Academic Certificates</a><a class="nav-link" href="profile.html"><i class="fas fa-user"></i> View Profile</a>`}
      <a id="logoutBtn" class="nav-link" href="index.html"><i class="fas fa-right-from-bracket"></i> Logout</a>
    </nav>
  `;
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.setAttribute('data-sidebar-close', '');

  const main = document.createElement('main');
  main.className = 'main-panel';
  const currentBody = document.body;
  const children = Array.from(currentBody.childNodes).filter(node => node.nodeType === 1 && !node.classList?.contains('app-shell'));
  children.forEach(node => main.appendChild(node));
  shell.appendChild(sidebar);
  shell.appendChild(overlay);
  shell.appendChild(main);

  sidebar.querySelectorAll('.nav-link').forEach((link) => {
    const href = link.getAttribute('href');
    link.classList.toggle('active', href && isActivePage(href));
  });

  const topbar = document.createElement('header');
  topbar.className = 'topbar';
  topbar.innerHTML = `
    <div class="d-flex align-items-center gap-3">
      <button type="button" class="menu-btn" data-sidebar-toggle aria-label="Open menu" aria-expanded="false">
        <i class="fas fa-bars"></i>
      </button>
      <img class="portal-logo portal-logo-topbar" src="assets/img/sankara-logo.png" alt="Sankara Educational Institutions logo">
      <div>
        <div class="fw-semibold">${document.title}</div>
        <div class="text-muted small" data-topbar-welcome>Welcome, ${getUserName()}</div>
      </div>
    </div>
    <div class="d-flex align-items-center gap-3">
      <div class="theme-toggle-auth" data-theme-toggle><button type="button" class="theme-btn" aria-label="Toggle theme"><i class="fas fa-moon"></i></button></div>
    </div>
  `;
  main.insertBefore(topbar, main.firstChild);
  window.slSetTheme?.(localStorage.getItem('sl_theme') || 'light');

  const menuButton = topbar.querySelector('[data-sidebar-toggle]');
  const setSidebarOpen = (isOpen) => {
    document.body.classList.toggle('sidebar-open', isOpen);
    menuButton?.setAttribute('aria-expanded', String(isOpen));
    menuButton?.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  };
  menuButton?.addEventListener('click', () => setSidebarOpen(!document.body.classList.contains('sidebar-open')));
  overlay.addEventListener('click', () => setSidebarOpen(false));
  sidebar.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => setSidebarOpen(false));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setSidebarOpen(false);
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (window.authService?.logout) {
        await window.authService.logout();
      } else if (window.firebaseServices?.logout) {
        await window.firebaseServices.logout();
      }
      window.location.href = 'index.html';
    });
  }
})();

(function(){
  const role = localStorage.getItem('sl_role') || 'student';
  const user = JSON.parse(localStorage.getItem('sl_user') || '{}');
  document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = user.name || (role === 'teacher' ? 'Professor' : 'Student'); });

  async function refreshDashboard(){
    let stats = { totalDocuments: 0, onlineCount: 0, offlineCount: 0, academicCount: 0 };
    try {
      const profile = await window.userService?.getCurrentProfile(role);
      const fullName = profile?.fullName || profile?.name || (role === 'teacher' ? 'Teacher' : 'Student');
      document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = fullName; });
      document.querySelectorAll('[data-welcome-name]').forEach(el => { el.textContent = fullName; });
      const topbarWelcome = document.querySelector('[data-topbar-welcome]');
      if (topbarWelcome) topbarWelcome.textContent = `Welcome, ${fullName}`;

      const data = role === 'teacher'
        ? await window.teacherService.getDashboardStats()
        : await window.documentService.getStats();
      if (role === 'teacher') {
        const department = data.department || profile?.department || '-';
        document.querySelectorAll('[data-teacher-department]').forEach(el => { el.textContent = department; });
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
      if(cat === 'online') count = stats.onlineCount;
      else if(cat === 'offline') count = stats.offlineCount;
      else if(cat === 'academic') count = stats.academicCount;
      else if(cat === 'personal') count = stats.personalCount;
      else count = stats.totalDocuments;
      el.textContent = `${count} ${count === 1 ? 'document' : 'documents'}`;
    });

    const summaryDocs = document.getElementById('summaryDocs');
    if (summaryDocs) summaryDocs.textContent = stats.totalDocuments || 0;
    const totalDocuments = document.getElementById('totalDocuments');
    if (totalDocuments) totalDocuments.textContent = stats.totalDocuments || 0;

  }

  refreshDashboard();
})();

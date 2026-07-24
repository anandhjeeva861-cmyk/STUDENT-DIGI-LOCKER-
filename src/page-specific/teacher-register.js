document.getElementById('teacherRegisterForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  if (data.password !== data.confirmPassword) {
    window.slToast('Passwords do not match', 'error');
    return;
  }
  if ((data.password || '').length < 8 || !/[A-Za-z]/.test(data.password) || !/[0-9]/.test(data.password)) {
    window.slToast('Password must be at least 8 characters and include letters and numbers', 'error');
    return;
  }
  if (!window.isEmail(data.email)) {
    window.slToast('Please enter a valid email address', 'error');
    return;
  }
  if (!data.department) {
    window.slToast('Please select a department', 'error');
    return;
  }
  if (!data.year) {
    window.slToast('Please select an academic year', 'error');
    return;
  }
  try {
    await window.authService.registerTeacher({
      fullName: data.fullName,
      department: data.department,
      year: data.year,
      email: data.email,
      phone: data.phone,
      password: data.password
    });
    await window.authService.logout();
    window.slToast('Teacher registration successful. Please sign in.', 'success');
    setTimeout(() => {
      window.location.href = 'teacher-login.html';
    }, 600);
  } catch (error) {
    window.slToast(error.message || 'Teacher registration failed', 'error');
  }
});
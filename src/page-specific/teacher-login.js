const handleTeacherForgotPassword = async function handleTeacherForgotPassword() {
  const email = document.getElementById('teacherEmail').value;
  if (!email) {
    window.slToast('Please enter your email address.', 'error');
    return;
  }
  try {
    await window.authService.sendPasswordReset(email);
    window.slToast('Password reset request accepted.', 'success');
  } catch (error) {
    window.slToast(error.message, 'error');
  }
};

window.handleTeacherForgotPassword = handleTeacherForgotPassword;
window.handleLogin('teacherLoginForm', 'teacher');
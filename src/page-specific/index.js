
const showLogin = function showLogin(role) {
  document.getElementById('chooseRole').classList.add('d-none');
  document.getElementById('studentLoginForm').classList.remove('d-none');
};
const backToChoose = function backToChoose() {
  document.getElementById('chooseRole').classList.remove('d-none');
  document.getElementById('studentLoginForm').classList.add('d-none');
};
const handleForgotPassword = async function handleForgotPassword() {
  const email = document.getElementById('studentEmail').value;
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

window.showLogin = showLogin;
window.backToChoose = backToChoose;
window.handleForgotPassword = handleForgotPassword;

handleLogin('studentLoginForm', 'student');
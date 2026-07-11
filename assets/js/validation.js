(function(){
  const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  window.isEmail = isEmail;
  document.querySelectorAll('input[required], select[required]').forEach(el => {
    el.addEventListener('blur', () => {
      if(el.value.trim() === '') {
        el.classList.add('is-invalid');
      } else {
        el.classList.remove('is-invalid');
      }
    });
  });

  document.querySelectorAll('.password-field input').forEach(input => {
    const field = input.closest('.password-field');
    const button = field?.querySelector('.toggle-pw');
    if(button){
      button.addEventListener('click', () => {
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        button.innerHTML = `<i class="fas fa-eye${isHidden ? '' : '-slash'}"></i>`;
      });
    }
  });

  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', (event) => {
      const required = form.querySelectorAll('[required]');
      let invalid = false;
      required.forEach(field => {
        if(!field.value.trim()) {
          field.classList.add('is-invalid');
          invalid = true;
        }
      });
      if(invalid) event.preventDefault();
    });
  });
})();

export function initializePasswordStrengthMeter() {
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('input', () => {
      const password = form.querySelector('input[name="password"]');
      const meter = form.querySelector('.pw-meter .bar');
      if (!password || !meter) return;
      const strength = password.value.length;
      const width = Math.min(100, (strength / 12) * 100);
      meter.style.width = `${width}%`;
    });
  });
}
// Resolves when Firebase is ready for use.
// Strategy:
// 1) Wait for the custom `firebase-ready` event.
// 2) Also poll for `window.firebaseServices` presence.
(function () {
  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) return;

  function waitForFirebase(onReady, opts = {}) {
    const {
      timeoutMs = 15000,
      pollIntervalMs = 200,
      requiredMethods = [],
    } = opts;

    const started = Date.now();

    return new Promise((resolve) => {
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        try {
          if (typeof onReady === 'function') onReady();
        } finally {
          resolve(true);
        }
      };

      const hasServices = () => {
        return !!(
          window.firebaseServices
          && typeof window.firebaseServices === 'object'
          && requiredMethods.every((method) => typeof window.firebaseServices[method] === 'function')
        );
      };

      // If already ready, finish.
      if (hasServices()) {
        finish();
        return;
      }

      // Listen for event.
      const onEvent = () => finish();
      window.addEventListener('firebase-ready', onEvent, { once: true });

      // Poll in case event never fires.
      const t = window.setInterval(() => {
        if (hasServices()) {
          window.clearInterval(t);
          finish();
          return;
        }
        if (Date.now() - started > timeoutMs) {
          window.clearInterval(t);
          window.removeEventListener('firebase-ready', onEvent);
          if (typeof window.slToast === 'function') {
            window.slToast(
              'Firebase is not configured or failed to initialize. Check console for details.',
              'error'
            );
          }
          resolve(false);
        }
      }, pollIntervalMs);
    });
  }

  window.waitForFirebase = waitForFirebase;
})();


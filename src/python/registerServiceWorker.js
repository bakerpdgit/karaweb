// Register the pyodide service worker as early as possible.
//
// To make sure users always pick up new versions when we ship them, we:
//   1. Pass `updateViaCache: 'none'` so the SW script itself isn't HTTP-cached
//      between page loads — the browser re-fetches /pyodide-sw.js every time.
//   2. Call `registration.update()` on every page load — same effect on
//      browsers that ignore #1.
//   3. Listen for `controllerchange` and reload the page exactly once when a
//      new SW takes over an existing client, so the JS bundle the page is
//      running and the SW it depends on stay in lockstep.

let registered = null;
let reloading = false;

export function registerPyodideServiceWorker() {
  if (registered) return registered;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    registered = Promise.reject(new Error('Service workers not supported'));
    return registered;
  }

  // Reload exactly once when the active SW is replaced by a newer one.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  registered = navigator.serviceWorker
    .register('/pyodide-sw.js', { scope: '/', updateViaCache: 'none' })
    .then(async (reg) => {
      // Kick an update check on load. If the script bytes changed, the new
      // SW installs, takes control via skipWaiting/clients.claim, and our
      // controllerchange handler reloads the page.
      try { await reg.update(); } catch {}
      if (reg.active) return reg;
      return new Promise((resolve) => {
        const sw = reg.installing || reg.waiting;
        if (!sw) { resolve(reg); return; }
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') resolve(reg);
        });
      });
    })
    .catch((err) => {
      console.warn('pyodide-sw registration failed:', err);
      throw err;
    });
  return registered;
}

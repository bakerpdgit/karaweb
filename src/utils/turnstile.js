// Cloudflare Turnstile loader.
//
// Lazily injects the Turnstile script tag the first time getTurnstileToken
// is called, then renders an invisible widget on demand and resolves
// with the resulting single-use token. The widget is reset after each
// successful read so the next call gets a fresh token.
//
// In dev (`VITE_SKIP_TURNSTILE === 'true'`) we never touch the network
// and return an empty string — the developer is responsible for using a
// no-Turnstile Apps Script during testing.

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const SCRIPT_ID     = 'cf-turnstile-script';

let scriptPromise = null;
let widgetId = null;
let widgetContainer = null;
let pendingResolve = null;   // captures the current in-flight token request
let pendingReject  = null;

function isSkipped() {
  return import.meta.env.VITE_SKIP_TURNSTILE === 'true';
}

function siteKey() {
  return String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '');
}

function loadTurnstileScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Turnstile requires a browser document.'));
      return;
    }
    if (window.turnstile?.render) { resolve(); return; }
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Turnstile script failed to load.')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = TURNSTILE_SRC + '?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Turnstile script failed to load.'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function ensureContainer() {
  if (widgetContainer && document.body.contains(widgetContainer)) return widgetContainer;
  widgetContainer = document.createElement('div');
  widgetContainer.id = 'cf-turnstile-host';
  widgetContainer.style.position = 'fixed';
  widgetContainer.style.right = '12px';
  widgetContainer.style.bottom = '12px';
  widgetContainer.style.zIndex = '9999';
  widgetContainer.style.opacity = '0.001';   // invisible but rendered
  widgetContainer.style.pointerEvents = 'none';
  document.body.appendChild(widgetContainer);
  return widgetContainer;
}

function settle(error, token) {
  const resolve = pendingResolve;
  const reject  = pendingReject;
  pendingResolve = null;
  pendingReject  = null;
  if (!resolve) return;
  if (error) reject(error); else resolve(token);
}

/**
 * Fetch a fresh Turnstile token. Returns '' when skipped.
 *
 * Token policy: single-use, expires after about 5 minutes. Always call
 * immediately before the request you want to protect.
 */
export async function getTurnstileToken() {
  if (isSkipped()) return '';
  const key = siteKey();
  if (!key) {
    console.warn('Turnstile: VITE_TURNSTILE_SITE_KEY is not set; submitting with empty token.');
    return '';
  }
  await loadTurnstileScript();
  if (!window.turnstile?.render) {
    throw new Error('Turnstile failed to initialise.');
  }
  // Serialise calls — Turnstile's invisible widget can only resolve one
  // execute() at a time. Newer callers must wait for the previous token.
  if (pendingResolve) {
    await new Promise((r) => {
      const prev = pendingResolve;
      pendingResolve = (t) => { prev(t); r(); };
      const prevR = pendingReject;
      pendingReject = (e) => { prevR(e); r(); };
    });
  }
  const container = ensureContainer();
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject  = reject;
    try {
      if (widgetId == null) {
        // First-time render. Cloudflare hasn't started any prior
        // execute, so the synchronous execute() runs clean.
        widgetId = window.turnstile.render(container, {
          sitekey: key,
          size: 'invisible',
          callback: (tok) => settle(null, tok),
          'error-callback': () => settle(new Error('Turnstile reported an error.')),
          'timeout-callback': () => settle(new Error('Turnstile timed out.')),
        });
        window.turnstile.execute(widgetId);
      } else {
        // Re-use: reset() clears any stale token, but Cloudflare's
        // internal "executing" flag from the previous execute may
        // still be set when called back-to-back — that triggers
        // a benign but noisy console warning. Deferring execute()
        // by one macrotask lets that flag clear first.
        window.turnstile.reset(widgetId);
        setTimeout(() => {
          try { window.turnstile.execute(widgetId); }
          catch (err) { settle(err); }
        }, 0);
      }
    } catch (err) {
      settle(err);
    }
  });
}

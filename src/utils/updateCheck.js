// Detects whether the deployed build is newer than the one we're running.
//
// `vite.config.js` writes `dist/version.json` (with a `buildTime` field) on
// every `vite build`, and inlines the same value into the JS bundle as the
// `__BUILD_TIME__` global. At runtime we fetch /version.json (cache-busted
// per call) and compare.
//
// Skipped entirely in dev — the dev server doesn't write version.json, and
// the inlined timestamp is just the dev-server start time, so the comparison
// would always be wrong.

const CURRENT = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

export const CURRENT_BUILD_TIME = CURRENT;

/**
 * Returns `true` when the live `version.json` has a different buildTime
 * than the one baked into this bundle (i.e. a newer deploy is available).
 * Returns `false` on any error (network, parse, missing file) so the
 * caller treats "not sure" as "no update".
 */
export async function checkForUpdate() {
  if (!import.meta.env.PROD) return false;
  if (!CURRENT) return false;
  try {
    // Cache-bust on every call: a stale CDN copy would defeat the whole
    // mechanism. `no-store` plus a query-string nonce is belt-and-braces.
    const resp = await fetch('/version.json?_=' + Date.now(), {
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!resp.ok) return false;
    const body = await resp.json();
    const live = String(body?.buildTime || '');
    return !!live && live !== CURRENT;
  } catch {
    return false;
  }
}

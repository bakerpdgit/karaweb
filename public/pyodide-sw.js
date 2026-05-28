// Service worker for KaraWeb's Python mode.
//
// Adapted from pythonfrontend/public/pysw.js. Responsibilities:
//
//   1. Bridge synchronous XMLHttpRequest calls made from inside the pyodide
//      web worker (e.g. `/@kara@/req.js`, `/@step@/break.js`) over to the
//      main thread, by parking the pending request as a Promise that the
//      main thread later resolves via postMessage.
//
// Version is bumped whenever this file's behaviour changes; any byte change
// triggers the browser's update flow (which we further reinforce in the
// main-thread registration helper).
const SW_VERSION = '2026-05-17-7';

addEventListener('install',  () => self.skipWaiting());
addEventListener('activate', () => self.clients.claim());

let karaPromiseResolve = null;
let karaLookahead = null;        // ps-kara-resp data that arrived before a fetch parked a promise
let stepPromiseResolve = null;
let stepLookahead = null;        // ps-step-continue data that arrived before a fetch parked a promise
let inputPromiseResolve = null;
let inputLookahead = null;

// activeRunToken: the token the main thread declared (via 'ps-set-active-run')
// for the currently-live python run. Every sync-XHR from the worker carries
// its own runToken in the query string. A mismatch means the request belongs
// to a previous run whose worker has been terminated (or whose Reset was
// clicked) — we respond immediately with {cancelled:true} so the dead
// worker's last fetch can't deadlock the next run's promise channel.
let activeRunToken = null;

function cancelledResponse() {
  return new Response(JSON.stringify({ cancelled: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.cmd) return;

  if (data.cmd === 'ps-set-active-run') {
    activeRunToken = data.runToken || null;
    return;
  }
  if (data.cmd === 'ps-reset') {
    activeRunToken = null;
    karaLookahead = null;
    stepLookahead = null;
    inputLookahead = null;
    if (karaPromiseResolve)  { karaPromiseResolve(cancelledResponse());  karaPromiseResolve = null; }
    if (stepPromiseResolve)  { stepPromiseResolve(cancelledResponse());  stepPromiseResolve = null; }
    if (inputPromiseResolve) { inputPromiseResolve(cancelledResponse()); inputPromiseResolve = null; }
  } else if (data.cmd === 'ps-kara-resp') {
    // Race-safe: if no fetch has parked a promise yet, stash the FULL
    // response data so the next fetch returns it verbatim. The previous
    // implementation just incremented a counter and dropped the payload,
    // which made kara silently see `None` from move/tree_front and loop
    // forever against an invisible tree.
    const local = karaPromiseResolve;
    karaPromiseResolve = null;
    if (local) {
      local(new Response(JSON.stringify(data), { status: 200 }));
    } else {
      karaLookahead = data;
    }
  } else if (data.cmd === 'ps-step-continue') {
    const local = stepPromiseResolve;
    stepPromiseResolve = null;
    if (local) {
      local(new Response(JSON.stringify(data), { status: 200 }));
    } else {
      stepLookahead = data;
    }
  } else if (data.cmd === 'ps-input-resp') {
    const local = inputPromiseResolve;
    inputPromiseResolve = null;
    if (local) {
      local(new Response(JSON.stringify(data), { status: 200 }));
    } else {
      inputLookahead = data;
    }
  }
});

// Resolve any pending promise with a 304 (no-content) Response — used when a
// new fetch supersedes an old one we never got around to answering.
function bumpStale(resolveFn) {
  if (!resolveFn) return;
  try { resolveFn(new Response(null, { status: 304 })); } catch {}
}

// Returns true when the fetch URL's runToken matches the currently-active
// run, or when no activeRunToken is set (e.g. a one-shot kara_init bootstrap
// that doesn't carry a token). Returns false for a stale token — the caller
// should respond with cancelledResponse() immediately.
function tokenMatches(url) {
  const token = url.searchParams.get('runToken') || '';
  if (!activeRunToken) return true;   // permissive when no run is active
  return token === activeRunToken;
}

addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);

  if (u.pathname === '/@kara@/req.js') {
    if (!tokenMatches(u)) { e.respondWith(cancelledResponse()); return; }
    if (karaLookahead !== null) {
      const local = karaLookahead;
      karaLookahead = null;
      e.respondWith(new Response(JSON.stringify(local), { status: 200 }));
      return;
    }
    e.respondWith(new Promise((resolve) => {
      bumpStale(karaPromiseResolve);
      karaPromiseResolve = resolve;
    }));
    return;
  }

  if (u.pathname === '/@step@/break.js') {
    if (!tokenMatches(u)) { e.respondWith(cancelledResponse()); return; }
    if (stepLookahead !== null) {
      const local = stepLookahead;
      stepLookahead = null;
      e.respondWith(new Response(JSON.stringify(local), { status: 200 }));
      return;
    }
    e.respondWith(new Promise((resolve) => {
      bumpStale(stepPromiseResolve);
      stepPromiseResolve = resolve;
    }));
    return;
  }

  if (u.pathname === '/@input@/req.js') {
    if (!tokenMatches(u)) { e.respondWith(cancelledResponse()); return; }
    if (inputLookahead !== null) {
      const local = inputLookahead;
      inputLookahead = null;
      e.respondWith(new Response(JSON.stringify(local), { status: 200 }));
      return;
    }
    e.respondWith(new Promise((resolve) => {
      bumpStale(inputPromiseResolve);
      inputPromiseResolve = resolve;
    }));
    return;
  }

  // All other requests: pass through unchanged. Pyodide v0.28+ does not
  // require cross-origin isolation / SharedArrayBuffer, so we avoid the
  // first-load reload-required dance of COEP/COOP injection.
});

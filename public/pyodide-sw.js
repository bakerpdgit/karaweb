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
const SW_VERSION = '2026-05-17-6';

addEventListener('install',  () => self.skipWaiting());
addEventListener('activate', () => self.clients.claim());

let karaPromiseResolve = null;
let karaLookahead = null;        // ps-kara-resp data that arrived before a fetch parked a promise
let stepPromiseResolve = null;
let stepLookahead = null;        // ps-step-continue data that arrived before a fetch parked a promise
let inputPromiseResolve = null;
let inputLookahead = null;

addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.cmd) return;

  if (data.cmd === 'ps-reset') {
    karaLookahead = null;
    stepLookahead = null;
    inputLookahead = null;
    if (karaPromiseResolve)  { karaPromiseResolve(new Response(null, { status: 304 }));  karaPromiseResolve = null; }
    if (stepPromiseResolve)  { stepPromiseResolve(new Response('{}', { status: 200 }));  stepPromiseResolve = null; }
    if (inputPromiseResolve) { inputPromiseResolve(new Response('{}', { status: 200 })); inputPromiseResolve = null; }
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

addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);

  if (u.pathname === '/@kara@/req.js') {
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

// Typed wrappers around window.localStorage for the cloud-save subsystem.
//
// All keys live under a "karaweb." prefix so they coexist with any other
// site state. Every setItem call is wrapped to swallow quota / privacy
// errors — we'd rather lose persistence than crash the app.
//
// Keying scheme:
//   keydetails               — single per-teacher RSA keypair
//   classes.{classCode}      — one entry per class list (username list)
//   cloudcfg.google-drive    — single per-teacher Apps Script config
//   cloudcfg.codehooks.{classCode} — legacy codehooks per-class config
//   student.{challengeFileGuid}    — student's session for a particular file
//   queue.{challengeFileGuid}      — offline result buffer per file
//   loaded.{challengeFileGuid}     — last-seen loadedCloudSave snapshot per file

const PREFIX = 'karaweb.';

function safeGet(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(PREFIX + key, value);
    return true;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('karaweb localStorage write failed:', err?.message ?? err);
    }
    return false;
  }
}

function safeRemove(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(PREFIX + key);
  } catch { /* ignore */ }
}

function safeKeys() {
  const keys = [];
  try {
    if (typeof window === 'undefined' || !window.localStorage) return keys;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length));
    }
  } catch { /* ignore */ }
  return keys;
}

function readJSON(key) {
  const raw = safeGet(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function writeJSON(key, value) {
  return safeSet(key, JSON.stringify(value));
}

// ── Keydetails (single per-teacher) ─────────────────────────────────────
// Two shapes are supported:
//   (a) Unencrypted: { publicKeyJwk, privateKeyJwk, savedAt }
//   (b) Encrypted:   { publicKeyJwk, encryptedKeyPair, savedAt }
//
// The boot-time loader inspects which is present to decide whether
// the keypair lands fully unlocked or in a locked state pending a
// password prompt.

export function getKeyDetails() {
  return readJSON('keydetails');
}

export function setKeyDetails(keyDetails) {
  return writeJSON('keydetails', keyDetails);
}

export function removeKeyDetails() {
  safeRemove('keydetails');
}

// ── Class lists (one entry per class) ───────────────────────────────────
// JSON shape per class: { classCode, initials, yearGroup, academicYear,
//                          classLetter, students: [{username, code, suffixApplied}],
//                          updatedAt }

export function getClassList(classCode) {
  return readJSON(`classes.${classCode}`);
}

export function setClassList(classCode, cl) {
  return writeJSON(`classes.${classCode}`, cl);
}

export function removeClassList(classCode) {
  safeRemove(`classes.${classCode}`);
}

export function listClassLists() {
  return safeKeys()
    .filter(k => k.startsWith('classes.'))
    .map(k => k.slice('classes.'.length));
}

// ── Student session (keyed by challengeFileGuid) ────────────────────────
// JSON shape: { challengeFileGuid, username, studentCode }

export function getStudentSession(challengeFileGuid) {
  return readJSON(`student.${challengeFileGuid}`);
}

export function setStudentSession(challengeFileGuid, session) {
  return writeJSON(`student.${challengeFileGuid}`, session);
}

export function removeStudentSession(challengeFileGuid) {
  safeRemove(`student.${challengeFileGuid}`);
}

// ── Result queue (keyed by challengeFileGuid) ───────────────────────────
// Stored as JSON: array of { encryptedPayload, submittedAt, studentCode,
//                            challengeGuid, challengeFileGuid }

const QUEUE_CAP = 200;

export function getQueuedResults(challengeFileGuid) {
  const list = readJSON(`queue.${challengeFileGuid}`);
  return Array.isArray(list) ? list : [];
}

export function pushQueuedResult(challengeFileGuid, item) {
  const list = getQueuedResults(challengeFileGuid);
  list.push(item);
  while (list.length > QUEUE_CAP) list.shift();
  return writeJSON(`queue.${challengeFileGuid}`, list);
}

export function setQueuedResults(challengeFileGuid, list) {
  return writeJSON(`queue.${challengeFileGuid}`, list);
}

export function clearQueuedResults(challengeFileGuid) {
  safeRemove(`queue.${challengeFileGuid}`);
}

export function listQueuedFiles() {
  return safeKeys()
    .filter(k => k.startsWith('queue.'))
    .map(k => k.slice('queue.'.length));
}

// ── Cloud config (Google Drive = single per-teacher; Codehooks = per-class) ──

export function getGoogleDriveConfig() {
  return readJSON('cloudcfg.google-drive');
}

export function setGoogleDriveConfig(cfg) {
  return writeJSON('cloudcfg.google-drive', cfg);
}

// Codehooks config is single per-teacher (no longer per-class) —
// mirrors the Google Drive config. Earlier per-class entries under
// `cloudcfg.codehooks.{classCode}` are abandoned.
export function getCodehooksConfig() {
  return readJSON('cloudcfg.codehooks');
}

export function setCodehooksConfig(cfg) {
  return writeJSON('cloudcfg.codehooks', cfg);
}

// ── Loaded-cloud-save snapshot (per challengeFileGuid) ──────────────────
// Stored by the student-login flow so the boot-time queue flush can
// reconstruct the full cloudSave block.

export function getLastLoadedCloudSave(challengeFileGuid) {
  return readJSON(`loaded.${challengeFileGuid}`);
}

export function setLastLoadedCloudSave(challengeFileGuid, cs) {
  return writeJSON(`loaded.${challengeFileGuid}`, cs);
}

// ── Session-tier mirrors (per-tab, cleared on tab close) ────────────────
// We unconditionally mirror state.keydetails + state.classes into
// sessionStorage on every change so a page reload within the same tab
// can re-hydrate them, even if the teacher said "No" to the
// Remember-on-device localStorage prompt.
//
// Boot precedence: localStorage (opt-in, durable) > sessionStorage
// (per-tab, automatic) > nothing (file prompt).

const SESSION_KEYDETAILS_KEY = 'session.keydetails';
const SESSION_CLASSES_KEY    = 'session.classes';

function safeSessionGet(key) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function safeSessionSet(key, value) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    window.sessionStorage.setItem(PREFIX + key, value);
    return true;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('karaweb sessionStorage write failed:', err?.message ?? err);
    }
    return false;
  }
}

function safeSessionRemove(key) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.removeItem(PREFIX + key);
  } catch { /* ignore */ }
}

export function getSessionKeyDetails() {
  const raw = safeSessionGet(SESSION_KEYDETAILS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setSessionKeyDetails(kd) {
  if (!kd?.publicKeyJwk) { safeSessionRemove(SESSION_KEYDETAILS_KEY); return; }
  safeSessionSet(SESSION_KEYDETAILS_KEY, JSON.stringify(kd));
}

export function getSessionClasses() {
  const raw = safeSessionGet(SESSION_CLASSES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function setSessionClasses(list) {
  if (!Array.isArray(list) || list.length === 0) {
    safeSessionRemove(SESSION_CLASSES_KEY);
    return;
  }
  safeSessionSet(SESSION_CLASSES_KEY, JSON.stringify(list));
}

// ── Welcome slideshow seen-flags ─────────────────────────────────────────
// Two independent boolean preferences stored as the string '1'. Both are
// UI preferences only — not gated behind the RememberOnDeviceModal
// consent flow (no personal data).
//
//   welcome.main.shown    → student / first-visit welcome slideshow
//   welcome.editor.shown  → teacher / Challenge Editor welcome slideshow

const WELCOME_MAIN_KEY          = 'welcome.main.shown';
const WELCOME_EDITOR_KEY        = 'welcome.editor.shown';
const WELCOME_TEACHER_KEYS_KEY  = 'welcome.teacherKeys.shown';

export function getMainWelcomeShown() {
  return safeGet(WELCOME_MAIN_KEY) === '1';
}
export function setMainWelcomeShown(shown) {
  if (shown) safeSet(WELCOME_MAIN_KEY, '1');
  else safeRemove(WELCOME_MAIN_KEY);
}

export function getWelcomeShown() {
  return safeGet(WELCOME_EDITOR_KEY) === '1';
}
export function setWelcomeShown(shown) {
  if (shown) safeSet(WELCOME_EDITOR_KEY, '1');
  else safeRemove(WELCOME_EDITOR_KEY);
}

export function getTeacherKeysWelcomeShown() {
  return safeGet(WELCOME_TEACHER_KEYS_KEY) === '1';
}
export function setTeacherKeysWelcomeShown(shown) {
  if (shown) safeSet(WELCOME_TEACHER_KEYS_KEY, '1');
  else safeRemove(WELCOME_TEACHER_KEYS_KEY);
}

// ── One-time migration from the legacy per-class scheme ─────────────────
// Old layout: keydetails.{classCode}, student.{classCode}, queue.{classCode},
//   cloudcfg.{classCode}, loaded.{classCode}.
// New layout: see header. We migrate keydetails into the single per-teacher
// slot (first one found wins), and absorb the embedded students into a
// class-list entry. We rename cloudcfg.{classCode} → cloudcfg.codehooks.{classCode}.
// Student session / queue / loaded keys keyed by classCode are abandoned —
// those used to be tied to the class but now key by challengeFileGuid which
// the legacy world never had; safer to let the student re-login fresh.

const MIGRATION_DONE_KEY = 'migration.v3.done';

export function runLegacyMigrationOnce() {
  if (safeGet(MIGRATION_DONE_KEY) === '1') return { ran: false };
  const summary = { ran: true, keydetailsImported: 0, classesImported: 0, codehooksConfigsRenamed: 0 };

  for (const key of safeKeys()) {
    // Legacy keydetails.{classCode}
    if (key.startsWith('keydetails.') && key !== 'keydetails') {
      const classCode = key.slice('keydetails.'.length);
      const data = readJSON(key);
      if (data?.publicKeyJwk && data?.privateKeyJwk) {
        // Only adopt as the per-teacher keypair if we don't already have one.
        if (!getKeyDetails()) {
          setKeyDetails({
            publicKeyJwk: data.publicKeyJwk,
            privateKeyJwk: data.privateKeyJwk,
            savedAt: new Date().toISOString(),
          });
          summary.keydetailsImported += 1;
        }
        // Absorb the embedded class list as a new class entry if not already present.
        if (Array.isArray(data.students) && data.students.length > 0
            && !getClassList(classCode)) {
          setClassList(classCode, {
            classCode,
            students: data.students.map(s => ({
              username: String(s.username),
              code: String(s.code),
              suffixApplied: !!s.suffixApplied,
            })),
            updatedAt: new Date().toISOString(),
          });
          summary.classesImported += 1;
        }
      }
      safeRemove(key);
      continue;
    }
    // Legacy cloudcfg.{classCode} (the old codehooks per-class one)
    // OR cloudcfg.codehooks.{classCode} (slightly newer per-class
    // variant). Codehooks is now per-teacher, not per-class — adopt
    // the first one we find as the single cloudcfg.codehooks slot,
    // drop the rest.
    if ((key.startsWith('cloudcfg.') && !key.startsWith('cloudcfg.codehooks.') && key !== 'cloudcfg.google-drive' && key !== 'cloudcfg.codehooks')
        || key.startsWith('cloudcfg.codehooks.')) {
      const data = readJSON(key);
      if (data?.apiBaseUrl && !getCodehooksConfig()) {
        setCodehooksConfig(data);
        summary.codehooksConfigsRenamed += 1;
      }
      safeRemove(key);
      continue;
    }
    // Drop legacy student.* / queue.* / loaded.* keyed by classCode — we
    // can't know which file they belong to. Students will re-login fresh.
    if (key.startsWith('student.') || key.startsWith('queue.') || key.startsWith('loaded.')) {
      // Heuristic: classCode-keyed if it looks like a class code (letters+digits+dashes).
      const tail = key.replace(/^(student|queue|loaded)\./, '');
      if (/^[A-Z]{1,4}\d{2}-\d{2}-Y\d{1,2}[A-Z]$/.test(tail)) {
        safeRemove(key);
      }
    }
  }

  safeSet(MIGRATION_DONE_KEY, '1');
  return summary;
}

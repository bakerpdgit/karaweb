// Per-book progress storage. One localStorage key per (book × user-slot)
// holding pass/fail + the code snapshot for each challenge in that book.
//
// Schema:
//   karaweb.book.<bookGuid>.progress.<userSlot> = {
//     bookGuid, userSlot, updatedAt,
//     challenges: {
//       <challengeGuid>: {
//         passed: bool,
//         attempts: number,
//         lastAttemptAt: ISOstring,
//         code: { fsm, blocks, python },
//       },
//     },
//   }
//
// `userSlot` is the student's 6-digit cloud-save code if a
// `studentSession` is active, otherwise the literal string `'anon'`.
// Usernames are NEVER stored — only the numeric code or 'anon'. Different
// students on the same browser get separate entries.

const KEY_PREFIX = 'karaweb.book.';
const PROGRESS_INFIX = '.progress.';
const MAX_KEY_BYTES = 256 * 1024;   // soft cap per (book, userSlot)

const safeStorage = () => {
  try { return window.localStorage; } catch { return null; }
};

export function resolveUserSlot(studentSession) {
  const code = studentSession?.studentCode;
  if (typeof code === 'string' && /^\d{6}$/.test(code)) return code;
  return 'anon';
}

function buildKey(bookGuid, userSlot) {
  return `${KEY_PREFIX}${bookGuid}${PROGRESS_INFIX}${userSlot}`;
}

function readEntry(bookGuid, userSlot) {
  const s = safeStorage();
  if (!s || !bookGuid) return null;
  try {
    const raw = s.getItem(buildKey(bookGuid, userSlot));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || obj.bookGuid !== bookGuid) return null;
    if (!obj.challenges || typeof obj.challenges !== 'object') obj.challenges = {};
    return obj;
  } catch {
    return null;
  }
}

function writeEntry(bookGuid, userSlot, entry) {
  const s = safeStorage();
  if (!s || !bookGuid) return;
  try {
    let json = JSON.stringify(entry);
    if (json.length > MAX_KEY_BYTES) {
      // Trim the oldest `code` blobs until under the cap. We sort
      // challenge entries by `lastAttemptAt` ascending and drop the
      // `code` field on the oldest first — pass/fail metadata stays.
      const trimmable = Object.entries(entry.challenges || {})
        .filter(([_, v]) => v?.code)
        .sort((a, b) => (a[1].lastAttemptAt || '').localeCompare(b[1].lastAttemptAt || ''));
      for (const [guid] of trimmable) {
        if (json.length <= MAX_KEY_BYTES) break;
        entry.challenges[guid] = { ...entry.challenges[guid], code: null };
        json = JSON.stringify(entry);
      }
    }
    s.setItem(buildKey(bookGuid, userSlot), json);
  } catch {
    /* quota exceeded — silent drop is acceptable for non-critical progress data */
  }
}

export function getBookProgress(bookGuid, userSlot) {
  return readEntry(bookGuid, userSlot);
}

/**
 * Persist the code snapshot for a challenge run that's about to start.
 * Increments the `attempts` counter and refreshes `lastAttemptAt`.
 * `code` is `{ fsm, blocks, python }` — only the slot(s) for the
 * mode just run will be populated; others stay null/empty.
 */
export function saveChallengeRun(bookGuid, userSlot, challengeGuid, code) {
  if (!bookGuid || !challengeGuid) return;
  const existing = readEntry(bookGuid, userSlot) ?? {
    bookGuid, userSlot, updatedAt: new Date().toISOString(), challenges: {},
  };
  const prev = existing.challenges[challengeGuid] || {};
  const now = new Date().toISOString();
  existing.challenges[challengeGuid] = {
    ...prev,
    attempts: (prev.attempts || 0) + 1,
    lastAttemptAt: now,
    code,
  };
  existing.updatedAt = now;
  writeEntry(bookGuid, userSlot, existing);
}

/**
 * Persist the pass/fail outcome for a challenge run that just finished.
 * Leaves the stored `code` and `attempts` untouched.
 */
export function saveChallengeResult(bookGuid, userSlot, challengeGuid, passed) {
  if (!bookGuid || !challengeGuid) return;
  const existing = readEntry(bookGuid, userSlot);
  if (!existing) return;       // no prior saveChallengeRun for this slot — nothing to update
  const prev = existing.challenges[challengeGuid];
  if (!prev) return;
  existing.challenges[challengeGuid] = { ...prev, passed: !!passed };
  existing.updatedAt = new Date().toISOString();
  writeEntry(bookGuid, userSlot, existing);
}

/**
 * List the user-slot keys currently stored for a book. Used by the UI
 * to decide whether to show the "Reset book progress" menu item.
 */
export function listBookProgressSlots(bookGuid) {
  const s = safeStorage();
  if (!s || !bookGuid) return [];
  const prefix = `${KEY_PREFIX}${bookGuid}${PROGRESS_INFIX}`;
  const slots = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(prefix)) slots.push(k.slice(prefix.length));
    }
  } catch { /* ignore */ }
  return slots;
}

/**
 * Overwrite the stored progress for a (book, userSlot) with the
 * supplied per-challenge map. Used by the "Save progress" / restore-
 * on-load flow: the imported file becomes the new source of truth
 * for this device + user.
 */
export function importBookProgress(bookGuid, userSlot, challengesMap) {
  if (!bookGuid || !challengesMap) return;
  const entry = {
    bookGuid, userSlot,
    updatedAt: new Date().toISOString(),
    challenges: challengesMap,
  };
  writeEntry(bookGuid, userSlot, entry);
}

/**
 * Wipe ALL stored progress (across every user-slot) for a book.
 */
export function clearBookProgress(bookGuid) {
  const s = safeStorage();
  if (!s || !bookGuid) return;
  for (const slot of listBookProgressSlots(bookGuid)) {
    try { s.removeItem(buildKey(bookGuid, slot)); } catch { /* ignore */ }
  }
}

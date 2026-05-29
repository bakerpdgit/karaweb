import {
  createWorld, createFSM, computeSensors, executeStep,
  makeDefaultGuard,
} from './utils.js';
import { newGuid } from './utils/guid.js';

// ── Initial state ────────────────────────────────────────────────────────────

const initWorld = createWorld(15, 10);

export const DEFAULT_PYTHON_CODE = `# Your code goes here. The two lines above are added automatically.

`;

export const initialState = {
  appMode: 'blocks',         // 'fsm' | 'blocks' | 'python'
  world: initWorld,
  fsm: createFSM(),
  sensors: computeSensors(initWorld),
  sim: {
    mode: 'edit',         // 'edit' | 'running' | 'paused'
    currentStateId: null,
    lastTransitionId: null,
    savedWorld: null,     // snapshot taken at sim start, for reset
    stepCount: 0,
    speed: 600,           // ms per step
    log: [],              // newest first, capped at 100
    error: null,
    checkpointIdx: 0,     // highest matched checkpoint during this run (0 = initial)
    showingSolution: false, // when true, the right-hand editor renders the read-only solution view
  },
  // Shared by Blocks + Python (Monaco) modes — both use the pyodide runner.
  runner: {
    status: 'idle',          // 'idle'|'loading'|'ready'|'running'|'paused'|'error'|'finished'
    output: [],              // captured stdout / tracebacks, newest last
    awaitingInput: false,    // worker is parked waiting for user input()
    inputPrompt: '',         // prompt text passed to input()
    installing: null,        // name of pyodide package currently being installed
    locals: {},              // { name: repr } shipped by kara_init.py on each breakpoint
  },
  blocks: {
    blocklyState: null,         // Blockly.serialization.workspaces.save()
    currentBlockId: null,       // highlighted block during stepping
    errorBlockId: null,
  },
  python: {
    code: '',
    fontSize: 14,
    currentLine: null,
    errorLine: null,
  },
  dirtyFsm: false,
  dirtyBlocks: false,
  dirtyPython: false,
  worldTool: 'tree',

  // ── Challenge subsystem ────────────────────────────────────────────────
  // `challenges` is an array of challenge definitions. Each one names its
  // expected programming mode (fsm/blocks/python), an initial world, a
  // target world the user has to reach, and starter code (per-mode object).
  challenges: [],
  // `challengeWork` keeps each user's saved attempt for each challenge,
  // separately from the default workspace. Keyed by challenge id.
  challengeWork: {},
  // null = on default workspace; otherwise the active challenge being played.
  currentChallengeId: null,
  // Top-level "challenge editor mode" toggle. When true the main UI shows
  // the editor view rather than the normal one.
  challengeEditor: false,
  // Inside the editor, which challenge is being edited and which
  // checkpoint (initial / intermediate / target) is being painted.
  editingChallengeId: null,
  editingCheckpointIdx: 0,       // 0 = initial, last = target, in between = intermediate
  // Inside the editor, whether the world+code being shown is the
  // starter (default) or the teacher's reference solution. Toggled
  // by a control in the checkpoint bar. The reference solution shares
  // the same `editingCheckpointIdx` so the teacher can paint the
  // solution's view of any checkpoint.
  editingTarget: 'starter',      // 'starter' | 'solution'
  // Result of the most recent run against a challenge's target world.
  challengeResult: null,         // null | 'success' | 'fail'
  // Snapshot of the default workspace taken when entering a challenge or
  // the editor so we can restore it on exit.
  defaultSnapshot: null,

  // ── Editor tabs ────────────────────────────────────────────────────────
  // Active tab inside the Challenge Editor view. Only meaningful while
  // `challengeEditor` is true.
  editorActiveTab: 'challenges',  // 'challenges' | 'classList' | 'cloudSave' | 'analyse'

  // ── Class list / cloud save / analyse subsystems ──────────────────────
  // All cloud-related slices default to empty/disabled values so the
  // existing non-cloud workflow is completely unaffected.
  //
  // Per-teacher RSA keypair — held once, used across every class and
  // every challenge book the teacher works with.
  //
  // Shape: null (no keys) | {
  //   publicKeyJwk:  jwk,                              // always set when keydetails is non-null
  //   privateKeyJwk: jwk | null,                       // null when locked
  //   encryptedKeyPair: { salt, iv, ciphertext, iterations } | null,
  //   submissionVerifier: string | null,               // base64 PBKDF2 of (password, publicKey.n); cloud backends gate teacher ops on it
  //   lastUsedAt: number | null,                       // ms epoch; cleared on lock
  // }
  //
  // The encryptedKeyPair envelope is the same shape produced by
  // src/utils/crypto/passwordKey.js. When non-null, the privateKeyJwk
  // can be re-derived from it given the password the teacher entered.
  // submissionVerifier is derived alongside on unlock/generate so the
  // teacher's cloud requests can carry proof of password knowledge
  // without re-prompting (the unlock modal has already collected it).
  keydetails: null,

  // Saved class lists, loaded from localStorage on boot. Each entry:
  //   { classCode, initials, yearGroup, academicYear, classLetter,
  //     students: [{username, code, suffixApplied}], updatedAt }
  classes: [],

  // Stable identity for the currently-edited challenge book. Auto-minted
  // on first entry to the Challenge Editor (see CH_ENTER_EDITOR).
  // Embedded in saved JSON and the cloud-save block so the Apps Script
  // can route submissions to a per-book spreadsheet.
  challengeFileGuid: '',

  // Draft editor state for the currently-active class list. Becomes a
  // class-list entry on save. Year-group and class-letter start blank
  // so the teacher must explicitly pick from the dropdowns; academic
  // year defaults to the current AY (filled in by CL_NEW_DRAFT and the
  // boot loader rather than statically here, so it stays current
  // across runs without a build step).
  classList: {
    initials: '',
    yearGroup: '',
    academicYear: '',
    classLetter: '',
    classCode: '',            // derived from the four fields above
    students: [],             // [{ username, code, suffixApplied }]
    collisions: [],           // [{ code, usernames: [...] }]
    status: { busy: false, message: '', kind: '' },
  },
  cloudSave: {
    method: 'google-drive',           // 'google-drive' | 'codehooks'
    apiBaseUrl: '',
    turnstileSiteKey: '',
    registered: false,
    status: { busy: false, message: '', kind: '' },
  },
  analyse: {
    records: [],
    sessionToken: null,
    lastFetchedAt: null,
    status: { busy: false, message: '', kind: '' },
  },
  // Set after a student successfully logs into a cloud-save challenges
  // file. Used by the result-submission effect.
  studentSession: null,       // { classCode, username, studentCode } | null

  // Cloud-save info embedded inside the currently-loaded challenges file
  // (if any). Read by the student-login modal and the result-submission
  // effect. Distinct from `cloudSave` which is the teacher's own config
  // used to *build* the embedded block on save.
  loadedCloudSave: null,      // { apiBaseUrl, classCode, publicKeyJwk, schemaVersion } | null

  // Bumped whenever an action mutates the right-hand editor's code from
  // outside the editor's own input flow (e.g. CH_COPY_BETWEEN_TARGETS).
  // Used as part of the `ctxKey` that remounts BlocksEditor / FSMEditor
  // / PythonEditor so their internal models are rebuilt from the new
  // state instead of holding the stale workspace.
  editorRefreshTick: 0,

  // Single per-session scratchpad challenge slot. Built when the teacher
  // clicks a student submission cell in the Submissions tab — clones
  // the source challenge's worlds + notes, swaps in the student's code,
  // and activates as the current challenge so the teacher can re-run /
  // tweak the solution. Never saved to disk; replaced wholesale on the
  // next student-cell click; lost when the teacher selects any real
  // challenge.
  scratchpadChallenge: null,

  // Captured editor context at the moment the scratchpad was opened,
  // so the "Return to grid" button can restore the teacher to the
  // Submissions tab in the editor without losing any in-memory state.
  // Shape: { editingChallengeId, editingCheckpointIdx, editingTarget,
  // editorActiveTab, appMode } | null
  scratchpadReturnInfo: null,
};

// ── Challenge helpers ────────────────────────────────────────────────────────

function cloneWorld(world) {
  return {
    width: world.width,
    height: world.height,
    cells: world.cells.map(row => row.map(c => ({ ...c }))),
    kara: { ...world.kara },
  };
}

function emptyStarter(mode) {
  if (mode === 'fsm')    return null;
  if (mode === 'blocks') return null;
  if (mode === 'python') return '';
  return null;
}

function makeChallenge(world, name, mode = 'blocks', options = {}) {
  const id = newGuid();
  const {
    solutionAvailableToStudents = false,
  } = options;
  return {
    id,
    // `guid` matches `id` for freshly minted challenges; for legacy
    // challenges loaded from v4 files it is backfilled to the existing id.
    // The guid is what the cloud-save backend uses to attribute results.
    guid: id,
    name,
    mode,
    notes: '',                   // optional markdown shown to the student
    allowModeChange: false,      // if true, student can switch mode while in this challenge
    initialWorld: cloneWorld(world),
    targetWorld:  cloneWorld(world),
    intermediateCheckpoints: [], // ordered worlds the program must pass through
    starter:  { fsm: null, blocks: null, python: '' },
    // Teacher's reference solution (per mode, like `starter`). When
    // `solutionAvailableToStudents` is true the entries are raw code
    // (mode-shape); when false each populated entry is a
    // `KaraWeb Cloud Save` envelope string from
    // src/utils/crypto/envelope.js. The flag IS the encryption
    // state — no separate `solutionEncrypted` field.
    solution: { fsm: null, blocks: null, python: '' },
    solutionAvailableToStudents,
    // Optional per-mode caps on how much code the student can add
    // beyond the starter. Defaults: enforced=false (no caps applied).
    // When `enforced` is true, the per-mode numbers define how much
    // extra (beyond the starter's count) the student is allowed.
    // Effective cap = count(starter) + limits.<mode>.<metric>.
    // See src/utils/codeLimits.js for the counters + cap helpers.
    limits: {
      enforced: false,
      blocks: { added: 0 },
      fsm:    { states: 0, transitions: 0 },
      python: { tokens: 0 },
    },
    // If true, CH_CHECK_RESULT always passes regardless of final world.
    // Used by built-in examples that never halt (e.g. Forest Circler).
    noCheckTarget: false,
    // If true, checkpoint/target matching ignores Kara's final facing
    // direction — the world matches as long as Kara stands on the
    // right cell with the right cell-contents.
    ignoreOrientation: false,
  };
}

// The full ordered sequence of worlds the student's program must touch
// during execution: [initial, ...intermediateCheckpoints, target].
export function getCheckpointSequence(ch) {
  if (!ch) return [];
  const inter = Array.isArray(ch.intermediateCheckpoints) ? ch.intermediateCheckpoints : [];
  return [ch.initialWorld, ...inter, ch.targetWorld];
}

// Look up one checkpoint by its index in the full sequence.
export function getCheckpointAtIdx(ch, idx) {
  const seq = getCheckpointSequence(ch);
  if (idx < 0 || idx >= seq.length) return null;
  return seq[idx];
}

// Return a new challenge object with the checkpoint at `idx` replaced.
// Index 0 writes initialWorld; last writes targetWorld; in-between
// writes the matching slot in intermediateCheckpoints.
function setCheckpointInChallenge(ch, idx, newWorld) {
  const inter = Array.isArray(ch.intermediateCheckpoints) ? ch.intermediateCheckpoints : [];
  const total = inter.length + 2;
  if (idx <= 0)                return { ...ch, initialWorld: cloneWorld(newWorld) };
  if (idx >= total - 1)        return { ...ch, targetWorld:  cloneWorld(newWorld) };
  const next = inter.slice();
  next[idx - 1] = cloneWorld(newWorld);
  return { ...ch, intermediateCheckpoints: next };
}

function takeSnapshot(state) {
  return {
    appMode: state.appMode,
    world:   cloneWorld(state.world),
    fsm:     state.fsm,
    blocks:  { ...state.blocks, currentBlockId: null, errorBlockId: null },
    python:  { ...state.python, currentLine: null, errorLine: null },
  };
}

function applySnapshot(state, snap) {
  return withSensors({
    ...state,
    appMode: snap.appMode,
    fsm:     snap.fsm,
    blocks:  snap.blocks,
    python:  snap.python,
  }, snap.world);
}

// Save current editor state back into the active challenge (used in editor
// mode when switching challenges, switching world tabs, or exiting).
//
// World persistence is skipped while a simulation is in progress (the
// world is the running sim state, not the canonical checkpoint); the
// teacher must reset the sim to restore the painted world before it
// gets persisted. Code persistence is unconditional — code doesn't
// mutate during sim runs.
//
// Persists ONLY the active mode (state.appMode) into the corresponding
// slot field. The other modes' data in state was loaded by the most
// recent loadChallengeForEditing and is preserved untouched in the
// challenge object — the teacher can pre-build starter / solution code
// in all three modes and switching between them won't wipe anything.
function persistEditingChallenge(state) {
  if (!state.challengeEditor || !state.editingChallengeId) return state;
  const cid = state.editingChallengeId;
  const idx = state.editingCheckpointIdx ?? 0;
  const persistWorld = state.sim.mode === 'edit';
  const editingTarget = state.editingTarget === 'solution' ? 'solution' : 'starter';
  const activeMode = state.appMode;
  return {
    ...state,
    challenges: state.challenges.map(c => {
      if (c.id !== cid) return c;
      let updated = persistWorld ? setCheckpointInChallenge(c, idx, state.world) : c;
      const slotName = editingTarget;            // 'starter' | 'solution'
      const slot = updated[slotName] || { fsm: null, blocks: null, python: '' };
      // Persist only the mode the editor is currently displaying.
      if (activeMode === 'fsm') {
        updated = { ...updated, [slotName]: { ...slot, fsm: state.fsm } };
      } else if (activeMode === 'blocks') {
        updated = { ...updated, [slotName]: { ...slot, blocks: state.blocks.blocklyState } };
      } else if (activeMode === 'python') {
        updated = { ...updated, [slotName]: { ...slot, python: state.python.code } };
      }
      return updated;
    }),
  };
}

// Save in-progress user code for the active challenge to challengeWork.
function persistChallengeWork(state) {
  if (!state.currentChallengeId) return state;
  const cid = state.currentChallengeId;
  const ch = state.challenges.find(c => c.id === cid);
  if (!ch) return state;
  const codeSnap = { fsm: null, blocks: null, python: '' };
  if (ch.mode === 'fsm')    codeSnap.fsm    = state.fsm;
  if (ch.mode === 'blocks') codeSnap.blocks = state.blocks.blocklyState;
  if (ch.mode === 'python') codeSnap.python = state.python.code;
  return {
    ...state,
    challengeWork: { ...state.challengeWork, [cid]: codeSnap },
  };
}

// Load a challenge's world + (user's work || starter) into the active state.
function loadChallenge(state, challenge) {
  const userWork = state.challengeWork[challenge.id];
  let fsm = state.fsm;
  let blocksState = null;
  let pythonCode = '';
  if (challenge.mode === 'fsm') {
    fsm = userWork?.fsm ?? challenge.starter.fsm ?? createFSM();
  } else if (challenge.mode === 'blocks') {
    blocksState = userWork?.blocks ?? challenge.starter.blocks ?? null;
  } else if (challenge.mode === 'python') {
    pythonCode = userWork?.python ?? challenge.starter.python ?? '';
  }
  return withSensors({
    ...state,
    appMode: challenge.mode,
    fsm,
    blocks: { ...state.blocks, blocklyState: blocksState, currentBlockId: null, errorBlockId: null },
    python: { ...state.python, code: pythonCode, currentLine: null, errorLine: null },
  }, cloneWorld(challenge.initialWorld));
}

// Load a challenge into editor state for editing. Reads code from
// the `starter` or `solution` slot depending on `state.editingTarget`,
// and populates state for ALL THREE modes so the teacher can switch
// app mode without losing in-progress data for the other modes.
// Caller is responsible for setting state.appMode if they want a
// specific mode in the editor (e.g. CH_ENTER_EDITOR forces the
// challenge's primary mode); otherwise the existing appMode is kept.
function loadChallengeForEditing(state, challenge) {
  const seq = getCheckpointSequence(challenge);
  const idx = Math.min(state.editingCheckpointIdx ?? 0, seq.length - 1);
  const world = seq[idx] ?? challenge.initialWorld;
  const slot = state.editingTarget === 'solution'
    ? (challenge.solution ?? { fsm: null, blocks: null, python: '' })
    : (challenge.starter ?? { fsm: null, blocks: null, python: '' });
  return withSensors({
    ...state,
    fsm: slot.fsm ?? createFSM(),
    blocks: { ...state.blocks, blocklyState: slot.blocks ?? null, currentBlockId: null, errorBlockId: null },
    python: { ...state.python, code: slot.python ?? '', currentLine: null, errorLine: null },
  }, cloneWorld(world));
}

// In challenge-editor mode, if the teacher has a sim running / paused /
// finished, reset it cleanly before any navigation action (switching
// challenges, checkpoints, editor tabs, starter/solution view). This
// restores the painted world and clears runner state so the next
// navigation lands on a clean slate.
function resetEditorSimIfActive(state) {
  if (!state.challengeEditor) return state;
  if (state.sim.mode === 'edit'
      && state.runner.status !== 'finished'
      && state.runner.status !== 'error'
      && !state.sim.showingSolution) {
    return state;
  }
  const restored = state.sim.savedWorld ?? state.world;
  return {
    ...state,
    world: restored,
    sensors: computeSensors(restored),
    challengeResult: null,
    sim: {
      ...state.sim,
      mode: 'edit',
      currentStateId: null,
      lastTransitionId: null,
      savedWorld: null,
      stepCount: 0,
      log: [],
      error: null,
      showingSolution: false,
    },
    runner: { ...state.runner, status: 'ready', awaitingInput: false, inputPrompt: '' },
    blocks: { ...state.blocks, currentBlockId: null, errorBlockId: null },
    python: { ...state.python, currentLine: null, errorLine: null },
  };
}

// When a teacher hits Run in challenge-editor mode, the simulation should
// always begin from checkpoint 0 (the initial world) regardless of which
// checkpoint they were last painting. This persists any in-progress paint
// edits to the displayed checkpoint, then loads the initial world.
function resetEditorWorldToInitial(state) {
  if (!state.challengeEditor || !state.editingChallengeId) return state;
  const persisted = persistEditingChallenge(state);
  const ch = persisted.challenges.find(c => c.id === persisted.editingChallengeId);
  if (!ch) return persisted;
  return withSensors(
    { ...persisted, editingCheckpointIdx: 0 },
    cloneWorld(ch.initialWorld),
  );
}

export function worldsEqual(a, b, { ignoreOrientation = false } = {}) {
  if (!a || !b) return false;
  if (a.width !== b.width || a.height !== b.height) return false;
  if (a.kara.x !== b.kara.x || a.kara.y !== b.kara.y) return false;
  if (!ignoreOrientation && a.kara.direction !== b.kara.direction) return false;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const ca = a.cells[y][x];
      const cb = b.cells[y][x];
      if (!!ca.hasLeaf !== !!cb.hasLeaf) return false;
      if ((ca.object ?? null) !== (cb.object ?? null)) return false;
    }
  }
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function withSensors(state, world) {
  return { ...state, world, sensors: computeSensors(world) };
}

// ── Reducer ──────────────────────────────────────────────────────────────────

export function reducer(state, action) {
  const next = innerReducer(state, action);
  if (next === state) return next;
  // Auto-persist any edits while in challenge editor mode so cell paints,
  // FSM/Blocks/Python tweaks all flow into the active challenge without
  // needing the user to explicitly switch tabs first.
  if (next.challengeEditor && next.editingChallengeId) {
    // Skip CH_-prefixed actions — they manage their own persistence already
    // and an extra round-trip could clobber a freshly-loaded world.
    if (typeof action?.type === 'string' && action.type.startsWith('CH_')) return next;
    return persistEditingChallenge(next);
  }
  return next;
}

function innerReducer(state, action) {
  switch (action.type) {

    // ── World ──────────────────────────────────────────────────────────────

    case 'SET_CELL': {
      const { x, y, patch } = action;
      const cells = state.world.cells.map((row, ry) =>
        row.map((cell, rx) =>
          rx === x && ry === y ? { ...cell, ...patch } : cell
        )
      );
      return withSensors(state, { ...state.world, cells });
    }

    case 'SET_KARA': {
      const newWorld = { ...state.world, kara: { ...state.world.kara, ...action.patch } };
      return withSensors(state, newWorld);
    }

    case 'CLEAR_WORLD': {
      const newWorld = createWorld(state.world.width, state.world.height);
      return withSensors(state, newWorld);
    }

    case 'RESIZE_WORLD': {
      const newWorld = createWorld(action.width, action.height);
      return withSensors(state, newWorld);
    }

    case 'SET_WORLD_TOOL':
      return { ...state, worldTool: action.tool };

    // ── FSM ────────────────────────────────────────────────────────────────

    case 'ADD_STATE': {
      const id = `s${Date.now()}`;
      const newFsmState = { id, label: `q${state.fsm._nextNum}`, x: action.x, y: action.y };
      return {
        ...state, dirtyFsm: true,
        fsm: {
          ...state.fsm,
          states: [...state.fsm.states, newFsmState],
          _nextNum: state.fsm._nextNum + 1,
        },
      };
    }

    case 'UPDATE_STATE':
      return {
        ...state, dirtyFsm: true,
        fsm: {
          ...state.fsm,
          states: state.fsm.states.map(s => s.id === action.id ? { ...s, ...action.patch } : s),
        },
      };

    case 'DELETE_STATE': {
      const remaining = state.fsm.states.filter(s => s.id !== action.id);
      const newStartId =
        state.fsm.startStateId === action.id ? (remaining[0]?.id ?? null) : state.fsm.startStateId;
      return {
        ...state, dirtyFsm: true,
        fsm: {
          ...state.fsm,
          states: remaining,
          transitions: state.fsm.transitions.filter(t => t.fromId !== action.id && t.toId !== action.id),
          startStateId: newStartId,
        },
      };
    }

    case 'SET_START_STATE':
      return { ...state, dirtyFsm: true, fsm: { ...state.fsm, startStateId: action.id } };

    case 'ADD_TRANSITION': {
      const id = `t${Date.now()}`;
      return {
        ...state, dirtyFsm: true,
        fsm: {
          ...state.fsm,
          transitions: [
            ...state.fsm.transitions,
            {
              id,
              fromId: action.fromId,
              toId: action.toId,
              guard: action.guard ?? makeDefaultGuard(),
              action: action.action ?? 'none',
            },
          ],
        },
      };
    }

    case 'UPDATE_TRANSITION':
      return {
        ...state, dirtyFsm: true,
        fsm: {
          ...state.fsm,
          transitions: state.fsm.transitions.map(t => t.id === action.id ? { ...t, ...action.patch } : t),
        },
      };

    case 'DELETE_TRANSITION':
      return {
        ...state, dirtyFsm: true,
        fsm: { ...state.fsm, transitions: state.fsm.transitions.filter(t => t.id !== action.id) },
      };

    case 'REORDER_TRANSITION': {
      const ts = [...state.fsm.transitions];
      const [moved] = ts.splice(action.from, 1);
      ts.splice(action.to, 0, moved);
      return { ...state, dirtyFsm: true, fsm: { ...state.fsm, transitions: ts } };
    }

    // ── FSM simulation ─────────────────────────────────────────────────────

    case 'SIM_START': {
      if (!state.fsm.startStateId || state.fsm.states.length === 0) {
        return {
          ...state,
          sim: { ...state.sim, error: 'Add at least one state and set a start state first.' },
        };
      }
      // In challenge editor, always run from the initial world (checkpoint 0)
      // even if the teacher was currently painting an intermediate / target.
      const base = resetEditorWorldToInitial(state);
      return {
        ...base,
        challengeResult: null,
        sim: {
          ...base.sim,
          mode: 'running',
          currentStateId: base.fsm.startStateId,
          lastTransitionId: null,
          savedWorld: base.world,
          stepCount: 0,
          checkpointIdx: 0,
          log: [],
          error: null,
        },
      };
    }

    case 'SIM_STEP': {
      if (!state.sim.currentStateId) return state;
      try {
        const { newWorld, newStateId, transition, sensors } = executeStep(
          state.world, state.fsm, state.sim.currentStateId
        );
        const fromLabel = state.fsm.states.find(s => s.id === state.sim.currentStateId)?.label ?? '?';
        const toLabel   = state.fsm.states.find(s => s.id === newStateId)?.label ?? '?';
        const entry = {
          step: state.sim.stepCount + 1,
          fromLabel, toLabel,
          action: transition.action,
          sensors: { ...sensors },
          transitionId: transition.id,
        };
        return {
          ...state,
          world: newWorld,
          sensors: computeSensors(newWorld),
          sim: {
            ...state.sim,
            currentStateId: newStateId,
            lastTransitionId: transition.id,
            stepCount: state.sim.stepCount + 1,
            log: [entry, ...state.sim.log].slice(0, 100),
            error: null,
          },
        };
      } catch (err) {
        return { ...state, sim: { ...state.sim, mode: 'paused', error: err.message } };
      }
    }

    case 'SIM_PAUSE':
      return { ...state, sim: { ...state.sim, mode: 'paused' } };
    case 'SIM_RESUME':
      return { ...state, sim: { ...state.sim, mode: 'running', error: null } };

    case 'SIM_RESET': {
      const restored = state.sim.savedWorld ?? state.world;
      return {
        ...state,
        world: restored,
        sensors: computeSensors(restored),
        // Clear the challenge pass/fail banner on Reset so the next
        // Run starts clean (both student and teacher-editor flows).
        challengeResult: null,
        sim: {
          ...state.sim,
          mode: 'edit',
          currentStateId: null,
          lastTransitionId: null,
          savedWorld: null,
          stepCount: 0,
          log: [],
          error: null,
        },
        runner: { ...state.runner, locals: {} },
      };
    }

    case 'SIM_SET_SPEED':
      return { ...state, sim: { ...state.sim, speed: action.speed } };

    case 'CLEAR_SIM_ERROR':
      return { ...state, sim: { ...state.sim, error: null } };

    case 'LOAD_WORLD_FSM':
      return withSensors({
        ...initialState,
        appMode: state.appMode,
        fsm: action.fsm,
        worldTool: state.worldTool,
        // User-wide persisted identity / config — independent of any loaded file.
        keydetails:     state.keydetails,
        classes:        state.classes,
        classList:      state.classList,
        cloudSave:      state.cloudSave,
        studentSession: state.studentSession,
      }, action.world);

    // ── App mode & persistence ──────────────────────────────────────────────

    case 'SET_APP_MODE': {
      if (state.appMode === action.mode) return state;
      // In challenge editor mode: persist the OLD mode's code into the
      // current slot before switching, then change appMode. Per-mode
      // data for the new mode is already in state (loaded when the
      // target was last switched / the editor was entered).
      if (state.challengeEditor && state.editingChallengeId) {
        const persisted = persistEditingChallenge(state);
        return { ...persisted, appMode: action.mode, challengeResult: null };
      }
      // If a previous Python run is still half-running (paused, finished,
      // mid-error), reset the sim cleanly so the new mode lands in 'edit'.
      // We restore the snapshotted world if we have one. Switching mode
      // also dismisses showingSolution — the new mode might not have a
      // solution, and even if it does the student should re-opt-in.
      const needsReset = state.sim.mode !== 'edit'
        || state.runner.status === 'finished'
        || state.runner.status === 'error'
        || state.sim.showingSolution;
      if (!needsReset) return { ...state, appMode: action.mode };
      const restored = state.sim.savedWorld ?? state.world;
      return {
        ...state,
        appMode: action.mode,
        world: restored,
        sensors: computeSensors(restored),
        sim: {
          ...state.sim,
          mode: 'edit',
          currentStateId: null,
          lastTransitionId: null,
          savedWorld: null,
          stepCount: 0,
          log: [],
          error: null,
          showingSolution: false,
        },
        runner: { ...state.runner, status: 'ready', awaitingInput: false, inputPrompt: '' },
        blocks: { ...state.blocks, currentBlockId: null, errorBlockId: null },
        python: { ...state.python, currentLine: null, errorLine: null },
      };
    }

    case 'MARK_SAVED': {
      if (state.appMode === 'blocks') return { ...state, dirtyBlocks: false };
      if (state.appMode === 'python') return { ...state, dirtyPython: false };
      return { ...state, dirtyFsm: false };
    }

    // ── Shared runner state (used by Blocks + Python modes) ─────────────────

    case 'RUN_SET_STATUS':
      return { ...state, runner: { ...state.runner, status: action.status } };

    case 'RUN_APPEND_OUTPUT': {
      const lines = Array.isArray(action.lines) ? action.lines : [action.line];
      return {
        ...state,
        runner: { ...state.runner, output: [...state.runner.output, ...lines].slice(-500) },
      };
    }

    case 'RUN_CLEAR_OUTPUT':
      return { ...state, runner: { ...state.runner, output: [] } };

    case 'RUN_AWAIT_INPUT':
      return {
        ...state,
        runner: { ...state.runner, awaitingInput: true, inputPrompt: action.prompt ?? '' },
      };

    case 'RUN_CLEAR_INPUT':
      return { ...state, runner: { ...state.runner, awaitingInput: false, inputPrompt: '' } };

    case 'RUN_SET_INSTALLING':
      return { ...state, runner: { ...state.runner, installing: action.name ?? null } };

    case 'RUNNER_SET_LOCALS':
      // Snapshot of the user-frame's primitive locals shipped by the
      // Python runtime on every breakpoint. Drives the Variables chip.
      return {
        ...state,
        runner: { ...state.runner, locals: action.locals && typeof action.locals === 'object' ? action.locals : {} },
      };

    case 'RUN_SET_ERROR':
      return {
        ...state,
        sim: { ...state.sim, error: action.message ?? null },
        blocks: { ...state.blocks, errorBlockId: action.blockId ?? null },
        python: { ...state.python, errorLine: action.line ?? null },
      };

    // ── Blocks mode ─────────────────────────────────────────────────────────

    case 'BLK_SET_STATE':
      return {
        ...state,
        dirtyBlocks: action.markDirty !== false,
        blocks: { ...state.blocks, blocklyState: action.blocklyState },
      };

    case 'BLK_SET_CURRENT':
      return {
        ...state,
        blocks: { ...state.blocks, currentBlockId: action.blockId ?? null },
      };

    case 'BLK_SET_ERROR_BLOCK':
      return {
        ...state,
        blocks: { ...state.blocks, errorBlockId: action.blockId ?? null },
      };

    // ── Python mode (Monaco) ────────────────────────────────────────────────

    case 'PYC_SET_CODE':
      return {
        ...state,
        dirtyPython: action.markDirty !== false,
        python: { ...state.python, code: action.code ?? '' },
      };

    case 'PYC_SET_FONT_SIZE':
      return { ...state, python: { ...state.python, fontSize: action.fontSize } };

    case 'PYC_SET_CURRENT_LINE':
      return { ...state, python: { ...state.python, currentLine: action.line ?? null } };

    case 'PYC_SET_ERROR_LINE':
      return { ...state, python: { ...state.python, errorLine: action.line ?? null } };

    // ── Python execution simulation (shared) ────────────────────────────────

    case 'SIM_PY_START': {
      // In challenge editor, always run from the initial world (checkpoint 0).
      const base = resetEditorWorldToInitial(state);
      return {
        ...base,
        challengeResult: null,
        sim: {
          ...base.sim,
          mode: 'running',
          savedWorld: base.world,
          stepCount: 0,
          checkpointIdx: 0,
          log: [],
          error: null,
        },
        runner: { ...base.runner, output: [], awaitingInput: false, inputPrompt: '' },
        blocks: { ...base.blocks, currentBlockId: null, errorBlockId: null },
        python: { ...base.python, currentLine: null, errorLine: null },
      };
    }

    case 'SIM_PY_RESET': {
      const restored = state.sim.savedWorld ?? state.world;
      return {
        ...state,
        world: restored,
        sensors: computeSensors(restored),
        // Clear the challenge pass/fail banner on Reset so the next
        // Run starts clean (both student and teacher-editor flows).
        challengeResult: null,
        sim: {
          ...state.sim,
          mode: 'edit',
          savedWorld: null,
          stepCount: 0,
          log: [],
          error: null,
        },
        runner: { ...state.runner, status: 'idle', awaitingInput: false, inputPrompt: '', locals: {} },
        blocks: { ...state.blocks, currentBlockId: null, errorBlockId: null },
        python: { ...state.python, currentLine: null, errorLine: null },
      };
    }

    case 'SIM_PY_PAUSE':
      return { ...state, sim: { ...state.sim, mode: 'paused' } };
    case 'SIM_PY_RESUME':
      return { ...state, sim: { ...state.sim, mode: 'running', error: null } };

    case 'SIM_PY_FINISHED':
      return {
        ...state,
        sim: { ...state.sim, mode: 'paused' },
        runner: { ...state.runner, status: 'finished', awaitingInput: false, inputPrompt: '', locals: {} },
        blocks: { ...state.blocks, currentBlockId: null },
        python: { ...state.python, currentLine: null },
      };

    case 'SIM_PY_INCREMENT_STEP':
      return { ...state, sim: { ...state.sim, stepCount: state.sim.stepCount + 1 } };

    case 'SIM_PY_APPLY_WORLD':
      return withSensors(state, action.world);

    // ── Challenges ──────────────────────────────────────────────────────────

    case 'CH_ENTER_EDITOR': {
      // Save current default workspace, enter editor mode with a fresh
      // (or selected) challenge active.
      const snapshot = state.defaultSnapshot ?? takeSnapshot(state);
      let challenges = state.challenges;
      let editingId = state.editingChallengeId ?? challenges[0]?.id ?? null;
      if (!editingId) {
        const fresh = makeChallenge(state.world, `Challenge ${challenges.length + 1}`, state.appMode === 'fsm' ? 'fsm' : state.appMode);
        challenges = [fresh];
        editingId = fresh.id;
      }
      const ch = challenges.find(c => c.id === editingId);
      const checkpointIdx = state.editingCheckpointIdx ?? 0;
      // Mint a stable file GUID the first time the teacher opens the
      // editor for this in-memory project. Persisted in saved JSON so
      // submissions for this challenge book all land in one spreadsheet.
      const challengeFileGuid = state.challengeFileGuid || newGuid();
      const next = {
        ...state,
        challenges,
        challengeFileGuid,
        challengeEditor: true,
        editingChallengeId: editingId,
        editingCheckpointIdx: checkpointIdx,
        editingTarget: 'starter',   // always land on starter view when entering the editor
        appMode: ch.mode,           // land on the challenge's primary mode
        defaultSnapshot: snapshot,
        currentChallengeId: null,
        scratchpadChallenge: null,
        scratchpadReturnInfo: null,  // entering editor discards any scratchpad preview
        challengeResult: null,
        editorActiveTab: 'challenges',
      };
      return loadChallengeForEditing(next, ch);
    }

    case 'CH_EXIT_EDITOR': {
      // Persist the current edits back into the challenge, then restore
      // the default workspace.
      const persisted = persistEditingChallenge(state);
      const snap = persisted.defaultSnapshot;
      const restored = snap ? applySnapshot(persisted, snap) : persisted;
      return {
        ...restored,
        challengeEditor: false,
        editingChallengeId: null,
        editingCheckpointIdx: 0,
        editingTarget: 'starter',
        defaultSnapshot: null,
      };
    }

    case 'CH_NEW': {
      const persisted = persistEditingChallenge(state);
      // Sticky default: copy `solutionAvailableToStudents` from the
      // most-recently-edited challenge. When no keydetails are loaded
      // the flag is forced to `true` (visible) — we can't encrypt
      // without a public key, so hiding solutions isn't possible.
      const ref = persisted.challenges.find(c => c.id === persisted.editingChallengeId)
        ?? persisted.challenges[persisted.challenges.length - 1]
        ?? null;
      const stickyAvail = ref ? !!ref.solutionAvailableToStudents : false;
      const effectiveAvail = persisted.keydetails ? stickyAvail : true;
      // Use a fresh default world rather than cloning the teacher's
      // current view — every new challenge starts blank so the teacher
      // isn't carrying over leaves/trees from a previous one.
      const freshWorld = createWorld(state.world.width, state.world.height);
      const newCh = makeChallenge(
        freshWorld,
        `Challenge ${persisted.challenges.length + 1}`,
        persisted.appMode === 'fsm' ? 'fsm' : persisted.appMode,
        { solutionAvailableToStudents: effectiveAvail },
      );
      const challenges = [...persisted.challenges, newCh];
      const next = {
        ...persisted,
        challenges,
        editingChallengeId: newCh.id,
        editingCheckpointIdx: 0,
        editingTarget: 'starter',
        appMode: newCh.mode,
      };
      return loadChallengeForEditing(next, newCh);
    }

    case 'CH_DELETE': {
      const filtered = state.challenges.filter(c => c.id !== action.id);
      const work = { ...state.challengeWork };
      delete work[action.id];
      let editingId = state.editingChallengeId;
      let extra = {};
      if (editingId === action.id) {
        editingId = filtered[0]?.id ?? null;
        if (editingId) extra = loadChallengeForEditing({ ...state, challenges: filtered, editingChallengeId: editingId }, filtered.find(c => c.id === editingId));
      }
      return {
        ...state,
        challenges: filtered,
        challengeWork: work,
        editingChallengeId: editingId,
        ...extra,
      };
    }

    case 'CH_MOVE': {
      const persisted = persistEditingChallenge(state);
      const ts = [...persisted.challenges];
      const idx = ts.findIndex(c => c.id === action.id);
      if (idx < 0) return state;
      const target = Math.max(0, Math.min(ts.length - 1, idx + action.delta));
      if (target === idx) return state;
      const [moved] = ts.splice(idx, 1);
      ts.splice(target, 0, moved);
      return { ...persisted, challenges: ts };
    }

    case 'CH_RENAME':
      return {
        ...state,
        challenges: state.challenges.map(c =>
          c.id === action.id ? { ...c, name: action.name } : c
        ),
      };

    case 'CH_SET_NOTES':
      return {
        ...state,
        challenges: state.challenges.map(c =>
          c.id === action.id ? { ...c, notes: String(action.notes ?? '') } : c
        ),
      };

    case 'CH_SET_ALLOW_MODE_CHANGE':
      return {
        ...state,
        challenges: state.challenges.map(c =>
          c.id === action.id ? { ...c, allowModeChange: !!action.allow } : c
        ),
      };

    case 'CH_COPY_BETWEEN_TARGETS': {
      // Copy the OTHER target's data (for the current app mode) into
      // the active editing target's slot. The caller has already
      // decrypted the source (if it was an encrypted solution
      // envelope) and passes plain `sourceData` matching the
      // current mode's shape (fsm object | blocklyState | python
      // string).
      if (!state.challengeEditor || !state.editingChallengeId) return state;
      const cid = state.editingChallengeId;
      const dstTarget = state.editingTarget === 'solution' ? 'solution' : 'starter';
      const mode = state.appMode;
      const sourceData = action.sourceData;
      const updated = state.challenges.map(c => {
        if (c.id !== cid) return c;
        const slot = c[dstTarget] || { fsm: null, blocks: null, python: '' };
        return { ...c, [dstTarget]: { ...slot, [mode]: sourceData } };
      });
      // Bump the refresh tick so the right-hand editor remounts and
      // rebuilds its internal model from the new code.
      const next = { ...state, challenges: updated, editorRefreshTick: (state.editorRefreshTick ?? 0) + 1 };
      // Reflect in editor state for the current mode so the user
      // immediately sees the change in the right-hand editor.
      if (mode === 'fsm') {
        return withSensors({ ...next, fsm: sourceData ?? createFSM() }, state.world);
      }
      if (mode === 'blocks') {
        return {
          ...next,
          blocks: { ...next.blocks, blocklyState: sourceData ?? null, currentBlockId: null, errorBlockId: null },
        };
      }
      if (mode === 'python') {
        return {
          ...next,
          python: { ...next.python, code: sourceData ?? '', currentLine: null, errorLine: null },
        };
      }
      return next;
    }

    case 'CH_SET_LIMITS': {
      // Update a challenge's `limits` field. `action.limits` is a
      // partial object — `enforced` and any nested per-mode keys
      // that aren't supplied keep their existing values.
      return {
        ...state,
        challenges: state.challenges.map(c => {
          if (c.id !== action.id) return c;
          const cur = c.limits || { enforced: false, blocks: { added: 0 }, fsm: { states: 0, transitions: 0 }, python: { tokens: 0 } };
          const nextLimits = {
            enforced: action.limits?.enforced ?? cur.enforced,
            blocks: { ...cur.blocks, ...(action.limits?.blocks || {}) },
            fsm:    { ...cur.fsm,    ...(action.limits?.fsm    || {}) },
            python: { ...cur.python, ...(action.limits?.python || {}) },
          };
          return { ...c, limits: nextLimits };
        }),
      };
    }

    case 'CH_SET_IGNORE_ORIENTATION':
      return {
        ...state,
        challenges: state.challenges.map(c =>
          c.id === action.id ? { ...c, ignoreOrientation: !!action.ignore } : c
        ),
      };

    case 'CH_SET_SOL_VISIBILITY':
      // Set the per-challenge visibility flag and (atomically) replace
      // the solution data with the encrypt / decrypt result. The
      // crypto round-trip is async, so the component performs it and
      // hands the already-keyed data to this reducer.
      return {
        ...state,
        challenges: state.challenges.map(c =>
          c.id === action.id
            ? { ...c, solution: action.solution, solutionAvailableToStudents: !!action.visible }
            : c
        ),
      };

    case 'CH_SET_EDITING_TARGET': {
      // Switch the editor between starter-code view and
      // solution-code view. Persist the current code into the OLD
      // target, then load code from the NEW target. World stays put.
      const wanted = action.target === 'solution' ? 'solution' : 'starter';
      if (state.editingTarget === wanted) return state;
      const persisted = persistEditingChallenge(resetEditorSimIfActive(state));
      const next = { ...persisted, editingTarget: wanted };
      const ch = next.challenges.find(c => c.id === next.editingChallengeId);
      if (!ch) return next;
      return loadChallengeForEditing(next, ch);
    }

    case 'SIM_SHOW_SOLUTION': {
      // Show / hide the read-only reference solution for the active
      // challenge. When showing, the right-hand editor renders the
      // solution code with readOnly: true; the student can also Run
      // it (because we swap state.fsm/blocks/python to the solution
      // code) but can't edit it.
      //
      // The student's in-progress code is preserved in challengeWork
      // so it returns intact when they close the solution view.
      const wantShow = !!action.showing;
      if (wantShow === !!state.sim.showingSolution) return state;
      if (!state.currentChallengeId) return state;
      const ch = state.challenges.find(c => c.id === state.currentChallengeId);
      if (!ch) return state;
      const mode = ch.mode;
      // Reset any in-progress sim so neither view inherits a partial
      // world / running runner from the other.
      const restoredWorld = state.sim.savedWorld ?? cloneWorld(ch.initialWorld);
      const cleanSim = {
        ...state.sim,
        mode: 'edit',
        currentStateId: null,
        lastTransitionId: null,
        savedWorld: null,
        stepCount: 0,
        checkpointIdx: 0,
        log: [],
        error: null,
        showingSolution: wantShow,
      };
      const cleanRunner = { ...state.runner, status: 'idle', awaitingInput: false, inputPrompt: '' };
      const cleanBlocks = { ...state.blocks, currentBlockId: null, errorBlockId: null };
      const cleanPython = { ...state.python, currentLine: null, errorLine: null };
      if (wantShow) {
        // Stash user's current code (state) into challengeWork, then
        // swap in the solution code provided by the dispatcher.
        const userCode = { fsm: null, blocks: null, python: '' };
        if (mode === 'fsm')    userCode.fsm    = state.fsm;
        if (mode === 'blocks') userCode.blocks = state.blocks.blocklyState;
        if (mode === 'python') userCode.python = state.python.code;
        const sol = action.solutionData ?? { fsm: null, blocks: null, python: '' };
        const next = {
          ...state,
          challengeWork: { ...state.challengeWork, [ch.id]: userCode },
          sim: cleanSim,
          runner: cleanRunner,
          blocks: cleanBlocks,
          python: cleanPython,
          challengeResult: null,
        };
        if (mode === 'fsm')    return withSensors({ ...next, fsm: sol.fsm ?? createFSM(), blocks: cleanBlocks, python: cleanPython }, restoredWorld);
        if (mode === 'blocks') return withSensors({ ...next, blocks: { ...cleanBlocks, blocklyState: sol.blocks ?? null }, python: cleanPython }, restoredWorld);
        if (mode === 'python') return withSensors({ ...next, blocks: cleanBlocks, python: { ...cleanPython, code: sol.python ?? '' } }, restoredWorld);
        return next;
      }
      // wantShow === false: restore the user's code from challengeWork.
      const userWork = state.challengeWork[ch.id];
      const next = {
        ...state,
        sim: cleanSim,
        runner: cleanRunner,
        blocks: cleanBlocks,
        python: cleanPython,
        challengeResult: null,
      };
      if (mode === 'fsm')    return withSensors({ ...next, fsm: userWork?.fsm ?? ch.starter.fsm ?? createFSM() }, cloneWorld(ch.initialWorld));
      if (mode === 'blocks') return withSensors({ ...next, blocks: { ...cleanBlocks, blocklyState: userWork?.blocks ?? ch.starter.blocks ?? null } }, cloneWorld(ch.initialWorld));
      if (mode === 'python') return withSensors({ ...next, python: { ...cleanPython, code: userWork?.python ?? ch.starter.python ?? '' } }, cloneWorld(ch.initialWorld));
      return next;
    }

    case 'CH_SET_MODE': {
      // Persist current edits, change the challenge's primary mode
      // (the mode students see by default), and snap the editor
      // appMode to match so the teacher's editor reflects the
      // new default. Starter + solution per-mode data are kept
      // intact — the teacher may have pre-built code in all three
      // modes and this setting only affects the student's default.
      const persisted = persistEditingChallenge(resetEditorSimIfActive(state));
      const updated = persisted.challenges.map(c =>
        c.id === action.id ? { ...c, mode: action.mode } : c
      );
      const next = { ...persisted, challenges: updated };
      const ch = updated.find(c => c.id === action.id);
      if (state.editingChallengeId === action.id && ch) {
        return loadChallengeForEditing({ ...next, appMode: action.mode }, ch);
      }
      return next;
    }

    case 'CH_SET_EDITING_CHALLENGE': {
      const persisted = persistEditingChallenge(resetEditorSimIfActive(state));
      const ch = persisted.challenges.find(c => c.id === action.id);
      if (!ch) return persisted;
      const next = {
        ...persisted,
        editingChallengeId: ch.id,
        editingCheckpointIdx: 0,
        appMode: ch.mode,           // align with the new challenge's primary mode
      };
      return loadChallengeForEditing(next, ch);
    }

    case 'CH_SELECT_CHECKPOINT': {
      // Switch the painting view to a different checkpoint (initial,
      // target, or an intermediate). Persist the current displayed
      // world to the old slot, then load the requested one.
      const wanted = Number(action.idx) || 0;
      if (wanted === state.editingCheckpointIdx) return state;
      const persisted = persistEditingChallenge(resetEditorSimIfActive(state));
      const ch = persisted.challenges.find(c => c.id === persisted.editingChallengeId);
      if (!ch) return { ...persisted, editingCheckpointIdx: wanted };
      const seq = getCheckpointSequence(ch);
      const clamped = Math.max(0, Math.min(wanted, seq.length - 1));
      return withSensors({ ...persisted, editingCheckpointIdx: clamped }, cloneWorld(seq[clamped]));
    }

    case 'CH_ADD_CHECKPOINT': {
      // Insert a new intermediate checkpoint just before the target,
      // initialised as a clone of whatever the current target world is
      // (so the teacher can tweak from a useful starting point).
      if (!state.challengeEditor || !state.editingChallengeId) return state;
      const persisted = persistEditingChallenge(state);
      const cid = persisted.editingChallengeId;
      const ch = persisted.challenges.find(c => c.id === cid);
      if (!ch) return state;
      const inter = Array.isArray(ch.intermediateCheckpoints) ? ch.intermediateCheckpoints : [];
      const seed = cloneWorld(ch.targetWorld);
      const nextInter = [...inter, seed];
      const newChallenges = persisted.challenges.map(c =>
        c.id === cid ? { ...c, intermediateCheckpoints: nextInter } : c,
      );
      // Select the newly-added checkpoint so the teacher starts painting it.
      const newIdx = nextInter.length;   // intermediates are at 1..N, so newest is at index nextInter.length
      return withSensors({ ...persisted, challenges: newChallenges, editingCheckpointIdx: newIdx }, cloneWorld(seed));
    }

    case 'CH_REMOVE_CHECKPOINT': {
      // Remove an intermediate checkpoint by its sequence index. The
      // initial (0) and target (last) checkpoints can't be removed.
      if (!state.challengeEditor || !state.editingChallengeId) return state;
      const persisted = persistEditingChallenge(state);
      const cid = persisted.editingChallengeId;
      const ch = persisted.challenges.find(c => c.id === cid);
      if (!ch) return state;
      const inter = Array.isArray(ch.intermediateCheckpoints) ? ch.intermediateCheckpoints : [];
      const total = inter.length + 2;
      const idx = Number(action.idx);
      if (idx <= 0 || idx >= total - 1) return state;
      const nextInter = inter.slice();
      nextInter.splice(idx - 1, 1);
      const newChallenges = persisted.challenges.map(c =>
        c.id === cid ? { ...c, intermediateCheckpoints: nextInter } : c,
      );
      // After removal, move selection to the previous checkpoint.
      const newSelected = Math.max(0, idx - 1);
      const seqAfter = getCheckpointSequence(newChallenges.find(c => c.id === cid));
      return withSensors(
        { ...persisted, challenges: newChallenges, editingCheckpointIdx: newSelected },
        cloneWorld(seqAfter[newSelected]),
      );
    }

    case 'CH_SELECT': {
      const ch = state.challenges.find(c => c.id === action.id);
      if (!ch) return state;
      // If the student was currently viewing the previous challenge's
      // solution, don't push that read-only solution state into their
      // own challengeWork. Skip persistChallengeWork in that case.
      // Same applies when leaving the scratchpad — discard any temp
      // edits, never persisted to challengeWork.
      const snap = state.defaultSnapshot ?? takeSnapshot(state);
      const persistedWork = (state.sim.showingSolution || state.scratchpadChallenge)
        ? state
        : persistChallengeWork(state);
      const next = {
        ...persistedWork,
        currentChallengeId: ch.id,
        scratchpadChallenge: null,
        scratchpadReturnInfo: null,
        defaultSnapshot: snap,
        challengeResult: null,
        challengeEditor: false,
        editingChallengeId: null,
        sim: {
          ...persistedWork.sim,
          mode: 'edit',
          currentStateId: null,
          lastTransitionId: null,
          savedWorld: null,
          stepCount: 0,
          log: [],
          error: null,
          showingSolution: false,
        },
        runner: { ...persistedWork.runner, status: 'idle', awaitingInput: false, inputPrompt: '' },
      };
      return loadChallenge(next, ch);
    }

    case 'CH_EXIT_PLAY': {
      // Don't persist solution-view code as the student's work when
      // they exit mid-show. Same for scratchpad teacher-preview.
      const persisted = (state.sim.showingSolution || state.scratchpadChallenge)
        ? state
        : persistChallengeWork(state);
      const snap = persisted.defaultSnapshot;
      const restored = snap ? applySnapshot(persisted, snap) : persisted;
      return {
        ...restored,
        currentChallengeId: null,
        scratchpadChallenge: null,
        scratchpadReturnInfo: null,
        defaultSnapshot: null,
        challengeResult: null,
        sim: { ...restored.sim, showingSolution: false },
      };
    }

    case 'CH_RESET_TO_STARTER': {
      if (!state.currentChallengeId) return state;
      const ch = state.challenges.find(c => c.id === state.currentChallengeId);
      if (!ch) return state;
      const work = { ...state.challengeWork };
      delete work[ch.id];
      const next = {
        ...state,
        challengeWork: work,
        challengeResult: null,
        sim: {
          ...state.sim,
          mode: 'edit',
          currentStateId: null,
          lastTransitionId: null,
          savedWorld: null,
          stepCount: 0,
          log: [],
          error: null,
          showingSolution: false,
        },
        runner: { ...state.runner, status: 'idle', awaitingInput: false, inputPrompt: '' },
      };
      return loadChallenge(next, ch);
    }

    case 'CH_CHECK_RESULT': {
      // Active challenge to test against: the student's current
      // challenge, OR the editor's challenge when the teacher is
      // running starter/solution code as a sanity check, OR the
      // teacher's scratchpad when previewing a student submission.
      const id = state.currentChallengeId
        ?? (state.challengeEditor ? state.editingChallengeId : null);
      if (!id) return state;
      const ch = (state.scratchpadChallenge?.id === id)
        ? state.scratchpadChallenge
        : state.challenges.find(c => c.id === id);
      if (!ch) return state;
      // Special case: challenges flagged `noCheckTarget` always pass
      // when the program halted without error (used for examples
      // like Forest Circler that never naturally halt — pass/fail
      // against a fixed target wouldn't make sense).
      if (ch.noCheckTarget) {
        return { ...state, challengeResult: 'success' };
      }
      // The student passes only if the program reached the final
      // checkpoint (the target). For a challenge with no intermediate
      // checkpoints, that's simply `worldsEqual(world, target)`. With
      // intermediates, the `sim.checkpointIdx` tracking (advanced on
      // every world change during the run, see SIM_ADVANCE_CHECKPOINT)
      // must have reached the last index in the sequence.
      const seq = getCheckpointSequence(ch);
      const lastIdx = seq.length - 1;
      const cmpOpts = { ignoreOrientation: !!ch.ignoreOrientation };
      // Catch-up check in case the final step landed on the target
      // before the visibility-driven effect had a chance to advance.
      let reached = state.sim.checkpointIdx ?? 0;
      while (reached < lastIdx && worldsEqual(state.world, seq[reached + 1], cmpOpts)) {
        reached += 1;
      }
      const ok = reached >= lastIdx;
      return {
        ...state,
        sim: { ...state.sim, checkpointIdx: reached },
        challengeResult: ok ? 'success' : 'fail',
      };
    }

    case 'SIM_ADVANCE_CHECKPOINT':
      // Advance the matched-checkpoint counter. The action is fired
      // from App.jsx whenever the world changes during a run and the
      // new world equals the next-expected checkpoint.
      return {
        ...state,
        sim: { ...state.sim, checkpointIdx: Math.max(state.sim.checkpointIdx ?? 0, Number(action.idx) || 0) },
      };

    case 'CH_CLEAR_RESULT':
      return { ...state, challengeResult: null };

    case 'CH_COPY_FROM_PREVIOUS': {
      // Copy the previous checkpoint's world onto the currently-edited
      // one. No-op when the initial checkpoint (idx 0) is selected — it
      // has no predecessor.
      if (!state.challengeEditor || !state.editingChallengeId) return state;
      const idx = state.editingCheckpointIdx ?? 0;
      if (idx <= 0) return state;
      const ch = state.challenges.find(c => c.id === state.editingChallengeId);
      if (!ch) return state;
      const seq = getCheckpointSequence(ch);
      const source = seq[idx - 1];
      if (!source) return state;
      const copy = cloneWorld(source);
      const newChallenges = state.challenges.map(c =>
        c.id === state.editingChallengeId ? setCheckpointInChallenge(c, idx, copy) : c,
      );
      return withSensors({ ...state, challenges: newChallenges }, copy);
    }

    case 'CH_REPLACE_ALL': {
      // Used by file load — replace the whole challenge subsystem and the
      // cloud-save block (if any). The classes list / keydetails / student
      // session are kept (they live in localStorage and are independent of
      // the loaded file). Adopt the loaded file's challengeFileGuid so
      // submissions land in the right per-book spreadsheet.
      //
      // If the file carries a cloudSave block, mirror its method +
      // apiBaseUrl into the teacher's `cloudSave` config so the
      // Cloud Save tab opens on the correct backend with the URL
      // pre-filled (and the wizard auto-resumes at Step 5).
      const cs = action.cloudSave ?? null;
      const nextCloudSave = cs
        ? {
            ...state.cloudSave,
            method: cs.method === 'google-drive' ? 'google-drive' : 'codehooks',
            apiBaseUrl: cs.apiBaseUrl || '',
            turnstileSiteKey: cs.turnstileSiteKey || state.cloudSave.turnstileSiteKey,
            registered: true,
          }
        : state.cloudSave;
      return {
        ...state,
        challenges: action.challenges ?? [],
        challengeWork: action.challengeWork ?? {},
        challengeFileGuid: action.challengeFileGuid || state.challengeFileGuid,
        currentChallengeId: null,
        challengeEditor: false,
        editingChallengeId: null,
        editingCheckpointIdx: 0,
        defaultSnapshot: null,
        challengeResult: null,
        scratchpadChallenge: null,
        scratchpadReturnInfo: null,
        loadedCloudSave: cs,
        cloudSave: nextCloudSave,
      };
    }

    case 'CH_DETACH_AS_PLAIN': {
      // Recovery path used when the teacher no longer has the keydetails
      // that matches the loaded cloud-save book. Drops any encrypted
      // (hidden) solutions and clears the cloud-save backend settings so
      // the book becomes a plain editable challenges file that can be
      // re-saved under a new keydetails file — or shared with another
      // teacher who'll use their own keys. Stripping cloudSave also
      // prevents a forwarded book from continuing to POST results to the
      // original teacher's backend.
      const detachedChallenges = (state.challenges || []).map(ch => {
        if (!ch || ch.solutionAvailableToStudents !== false) return ch;
        return {
          ...ch,
          solution: { fsm: null, blocks: null, python: '' },
          solutionAvailableToStudents: true,
        };
      });
      return {
        ...state,
        challenges: detachedChallenges,
        loadedCloudSave: null,
        cloudSave: { ...initialState.cloudSave },
        challengeFileGuid: '',
      };
    }

    case 'CH_FILE_GUID_SET':
      return { ...state, challengeFileGuid: action.guid || '' };

    case 'CH_OPEN_SCRATCHPAD': {
      // Build a temporary "scratchpad" challenge from a source challenge
      // (clones its worlds + notes) with the supplied solution code
      // dropped into the starter slot. Activate it as the current
      // challenge so the teacher can re-run / tweak the student's
      // attempt outside the editor — but never written to disk or
      // surfaced in the challenge list.
      const source = state.challenges.find(c => c.id === action.sourceChallengeId);
      if (!source) return state;
      const sol = action.solution || {};
      const solMode = sol.mode === 'fsm' || sol.mode === 'blocks' || sol.mode === 'python'
        ? sol.mode
        : source.mode;
      // Decrypted solution shapes (see utils/currentSolutionSnapshot.js):
      //   fsm    → sol.fsm    = { states, transitions, startStateId }
      //   blocks → sol.blocks = { blocklyState }
      //   python → sol.python = { code, fontSize }
      // We unwrap each one to the flat shape the starter slot expects.
      const submittedFsm    = sol.fsm    ?? null;
      const submittedBlocks = sol.blocks?.blocklyState ?? null;
      const submittedPython = sol.python?.code ?? (typeof sol.python === 'string' ? sol.python : '');
      const starter = {
        fsm:    solMode === 'fsm'    ? (submittedFsm    ?? source.starter?.fsm    ?? null) : (source.starter?.fsm    ?? null),
        blocks: solMode === 'blocks' ? (submittedBlocks ?? source.starter?.blocks ?? null) : (source.starter?.blocks ?? null),
        python: solMode === 'python' ? (submittedPython ?? source.starter?.python ?? '')   : (source.starter?.python ?? ''),
      };
      const scratchpadId = 'scratchpad-' + newGuid();
      const scratchpad = {
        id: scratchpadId,
        guid: scratchpadId,
        name: `Viewing ${action.studentLabel || 'student'} — ${source.name}`,
        mode: solMode,
        notes: source.notes ?? '',
        allowModeChange: true,
        initialWorld: cloneWorld(source.initialWorld),
        targetWorld:  cloneWorld(source.targetWorld),
        intermediateCheckpoints: (source.intermediateCheckpoints || []).map(cloneWorld),
        starter,
        solution: { fsm: null, blocks: null, python: '' },
        solutionAvailableToStudents: false,
        limits: { enforced: false, blocks: { added: 0 }, fsm: { states: 0, transitions: 0 }, python: { tokens: 0 } },
        noCheckTarget: !!source.noCheckTarget,
        ignoreOrientation: !!source.ignoreOrientation,
        __scratchpad: true,
      };
      // Load the scratchpad as if the teacher had picked it as a
      // challenge: switch out of editor, install the world + code,
      // reset sim state.
      const cleanSim = {
        ...state.sim,
        mode: 'edit',
        currentStateId: null,
        lastTransitionId: null,
        savedWorld: null,
        stepCount: 0,
        checkpointIdx: 0,
        log: [],
        error: null,
        showingSolution: false,
      };
      const cleanRunner = { ...state.runner, status: 'idle', awaitingInput: false, inputPrompt: '' };
      const cleanBlocks = { ...state.blocks, currentBlockId: null, errorBlockId: null };
      const cleanPython = { ...state.python, currentLine: null, errorLine: null };
      // Capture the editor context so "Return to grid" lands the
      // teacher back exactly where they were (challenge being edited,
      // active editor tab — typically 'analyse' since the click came
      // from there).
      const returnInfo = state.challengeEditor ? {
        editingChallengeId:    state.editingChallengeId,
        editingCheckpointIdx:  state.editingCheckpointIdx ?? 0,
        editingTarget:         state.editingTarget ?? 'starter',
        editorActiveTab:       state.editorActiveTab ?? 'analyse',
        appMode:               state.appMode,
      } : null;
      const next = {
        ...state,
        scratchpadChallenge: scratchpad,
        scratchpadReturnInfo: returnInfo,
        currentChallengeId: scratchpadId,
        challengeEditor: false,
        editingChallengeId: null,
        editingCheckpointIdx: 0,
        editingTarget: 'starter',
        defaultSnapshot: state.defaultSnapshot ?? takeSnapshot(state),
        challengeResult: null,
        appMode: solMode,
        sim: cleanSim,
        runner: cleanRunner,
      };
      if (solMode === 'fsm') {
        return withSensors(
          { ...next, fsm: starter.fsm ?? createFSM(), blocks: cleanBlocks, python: cleanPython },
          cloneWorld(scratchpad.initialWorld),
        );
      }
      if (solMode === 'blocks') {
        return withSensors(
          { ...next, blocks: { ...cleanBlocks, blocklyState: starter.blocks ?? null }, python: cleanPython },
          cloneWorld(scratchpad.initialWorld),
        );
      }
      return withSensors(
        { ...next, blocks: cleanBlocks, python: { ...cleanPython, code: starter.python ?? '' } },
        cloneWorld(scratchpad.initialWorld),
      );
    }

    case 'CH_EXIT_SCRATCHPAD': {
      // Reverse CH_OPEN_SCRATCHPAD: drop the temp challenge, apply the
      // editor-context snapshot we captured, and land back in the
      // editor on the tab the teacher was on (typically Submissions).
      // The AnalysePanel caches its grid in a module-level slot so the
      // restored panel re-displays last-fetched results without a
      // round-trip to the backend.
      const info = state.scratchpadReturnInfo;
      const snap = state.defaultSnapshot;
      const restored = snap ? applySnapshot(state, snap) : state;
      if (!info) {
        // No editor to return to — fall through to the standard exit.
        return {
          ...restored,
          currentChallengeId: null,
          scratchpadChallenge: null,
          scratchpadReturnInfo: null,
          defaultSnapshot: null,
          challengeResult: null,
          sim: { ...restored.sim, showingSolution: false },
        };
      }
      const ch = restored.challenges.find(c => c.id === info.editingChallengeId);
      const reEntered = {
        ...restored,
        currentChallengeId: null,
        scratchpadChallenge: null,
        scratchpadReturnInfo: null,
        defaultSnapshot: snap,         // keep snapshot — editor still owns it
        challengeResult: null,
        challengeEditor: true,
        editingChallengeId:   info.editingChallengeId,
        editingCheckpointIdx: info.editingCheckpointIdx,
        editingTarget:        info.editingTarget,
        editorActiveTab:      info.editorActiveTab,
        appMode:              info.appMode,
        sim: { ...restored.sim, showingSolution: false },
      };
      if (!ch) return reEntered;
      return loadChallengeForEditing(reEntered, ch);
    }

    // ── Editor tabs ────────────────────────────────────────────────────────
    case 'EDITOR_SET_TAB': {
      // Auto-reset any in-progress editor sim when navigating to a non-
      // challenges tab (or even between tabs) — the world / runner
      // state shouldn't survive a context switch.
      const cleaned = resetEditorSimIfActive(state);
      return { ...cleaned, editorActiveTab: action.tab };
    }

    // ── Teacher key pair (per-teacher) ────────────────────────────────────
    case 'KEY_SET': {
      // Accept the new shape with encryptedKeyPair + lastUsedAt as
      // optional. If only the public key is supplied (i.e. keys are
      // loaded but currently locked), privateKeyJwk lands as null.
      const k = action.keydetails;
      if (!k) return { ...state, keydetails: null };
      return {
        ...state,
        keydetails: {
          publicKeyJwk:    k.publicKeyJwk || null,
          privateKeyJwk:   k.privateKeyJwk || null,
          encryptedKeyPair: k.encryptedKeyPair || null,
          submissionVerifier: k.submissionVerifier || null,
          lastUsedAt:      k.lastUsedAt ?? (k.privateKeyJwk ? Date.now() : null),
        },
      };
    }
    case 'KEY_CLEAR':
      return { ...state, keydetails: null };
    case 'KEY_UNLOCK':
      if (!state.keydetails) return state;
      return {
        ...state,
        keydetails: {
          ...state.keydetails,
          privateKeyJwk: action.privateKeyJwk,
          submissionVerifier: action.submissionVerifier ?? state.keydetails.submissionVerifier ?? null,
          lastUsedAt:    Date.now(),
        },
      };
    case 'KEY_LOCK':
      // Drop privateKeyJwk + the verifier but keep publicKeyJwk +
      // encryptedKeyPair so re-unlocking is possible without
      // re-loading the file.
      if (!state.keydetails?.encryptedKeyPair) return state;
      return {
        ...state,
        keydetails: {
          ...state.keydetails,
          privateKeyJwk: null,
          submissionVerifier: null,
          lastUsedAt:    null,
        },
      };
    case 'KEY_TOUCH':
      // Refresh the idle timer after any successful private-key use.
      if (!state.keydetails?.privateKeyJwk) return state;
      return {
        ...state,
        keydetails: { ...state.keydetails, lastUsedAt: Date.now() },
      };

    // ── Saved class lists (multi) ─────────────────────────────────────────
    case 'CLASSES_SET_LIST':
      return { ...state, classes: Array.isArray(action.list) ? action.list : [] };
    case 'CLASSES_UPSERT': {
      const entry = action.entry;
      if (!entry?.classCode) return state;
      const idx = state.classes.findIndex(c => c.classCode === entry.classCode);
      const next = state.classes.slice();
      if (idx >= 0) next[idx] = entry;
      else next.push(entry);
      return { ...state, classes: next };
    }
    case 'CLASSES_DELETE':
      return { ...state, classes: state.classes.filter(c => c.classCode !== action.classCode) };

    // ── Class list draft (currently edited class) ─────────────────────────
    case 'CL_SET_FIELD':
      return {
        ...state,
        classList: { ...state.classList, [action.field]: action.value },
      };
    case 'CL_SET_CLASS_CODE':
      return {
        ...state,
        classList: { ...state.classList, classCode: action.classCode },
      };
    case 'CL_SET_STUDENTS':
      return {
        ...state,
        classList: {
          ...state.classList,
          students: action.students,
          collisions: action.collisions ?? [],
        },
      };
    case 'CL_LOAD_DRAFT': {
      // Copy a saved class into the editor draft. If the saved entry is
      // missing the four code-component fields (older saves, or imports
      // that only knew the composite code), derive them from the
      // classCode so the form auto-fills correctly.
      const entry = state.classes.find(c => c.classCode === action.classCode);
      if (!entry) return state;
      const m = String(entry.classCode || '').match(/^([A-Z]{1,4})(\d{2}-\d{2})-Y(\d{1,2})([A-Z])$/);
      const split = m
        ? { initials: m[1], academicYear: m[2], yearGroup: m[3], classLetter: m[4] }
        : { initials: '', academicYear: '', yearGroup: '', classLetter: '' };
      return {
        ...state,
        classList: {
          initials:     entry.initials     || split.initials,
          yearGroup:    entry.yearGroup    || split.yearGroup,
          academicYear: entry.academicYear || split.academicYear,
          classLetter:  entry.classLetter  || split.classLetter,
          classCode:    entry.classCode,
          students:     entry.students ?? [],
          collisions:   [],
          status:       { busy: false, message: '', kind: '' },
        },
      };
    }
    case 'CL_NEW_DRAFT':
      return {
        ...state,
        classList: {
          initials: '', yearGroup: '',
          academicYear: action.academicYear ?? '',
          classLetter: '',
          classCode: '', students: [], collisions: [],
          status: { busy: false, message: '', kind: '' },
        },
      };
    case 'CL_SET_STATUS':
      return {
        ...state,
        classList: {
          ...state.classList,
          status: {
            busy: !!action.busy,
            message: action.message ?? '',
            kind: action.kind ?? '',
          },
        },
      };

    // ── Cloud Save ────────────────────────────────────────────────────────
    case 'CS_SET_FIELD':
      return {
        ...state,
        cloudSave: { ...state.cloudSave, [action.field]: action.value },
      };
    case 'CS_SET_METHOD': {
      const method = action.method === 'google-drive' ? 'google-drive' : 'codehooks';
      if (state.cloudSave.method === method) return state;
      // Switching method invalidates any prior registration of the *other*
      // backend, and also clears the URL / turnstile fields so a
      // codehooks URL doesn't leak into the google-drive form (and
      // vice versa). The panel's auto-load effect will repopulate
      // them from this method's own saved slot if one exists.
      return {
        ...state,
        cloudSave: {
          ...state.cloudSave,
          method,
          apiBaseUrl: '',
          turnstileSiteKey: '',
          registered: false,
        },
      };
    }
    case 'CS_SET_REGISTERED':
      return {
        ...state,
        cloudSave: { ...state.cloudSave, registered: !!action.registered },
      };
    case 'CS_SET_STATUS':
      return {
        ...state,
        cloudSave: {
          ...state.cloudSave,
          status: {
            busy: !!action.busy,
            message: action.message ?? '',
            kind: action.kind ?? '',
          },
        },
      };

    // ── Analyse ───────────────────────────────────────────────────────────
    case 'AN_SET_RECORDS':
      return {
        ...state,
        analyse: {
          ...state.analyse,
          records: action.records ?? [],
          lastFetchedAt: action.lastFetchedAt ?? new Date().toISOString(),
        },
      };
    case 'AN_SET_TOKEN':
      return {
        ...state,
        analyse: { ...state.analyse, sessionToken: action.sessionToken ?? null },
      };
    case 'AN_SET_STATUS':
      return {
        ...state,
        analyse: {
          ...state.analyse,
          status: {
            busy: !!action.busy,
            message: action.message ?? '',
            kind: action.kind ?? '',
          },
        },
      };

    // ── Student session ───────────────────────────────────────────────────
    case 'STUDENT_LOGIN':
      return {
        ...state,
        studentSession: {
          sessionKey: action.sessionKey,
          username: action.username,
          studentCode: action.studentCode,
        },
      };
    case 'STUDENT_LOGOUT':
      return { ...state, studentSession: null };

    default:
      return state;
  }
}

// ── Save-state helper ────────────────────────────────────────────────────────
// When the user is mid-challenge or mid-edit, persist their current work into
// `challengeWork` / the challenge definition, then write the *default*
// workspace (from defaultSnapshot) as the file's main world/code. That way
// reloading the file lands the user in their default workspace, and they can
// pick a challenge from the menu to resume.
export function getSaveState(state) {
  if (state.challengeEditor) {
    const synced = persistEditingChallenge(state);
    const snap = synced.defaultSnapshot ?? takeSnapshot(synced);
    return {
      appMode: snap.appMode, world: snap.world, fsm: snap.fsm,
      blocks: snap.blocks, python: snap.python,
      challenges: synced.challenges, challengeWork: synced.challengeWork,
    };
  }
  if (state.currentChallengeId) {
    const synced = persistChallengeWork(state);
    const snap = synced.defaultSnapshot ?? takeSnapshot(synced);
    return {
      appMode: snap.appMode, world: snap.world, fsm: snap.fsm,
      blocks: snap.blocks, python: snap.python,
      challenges: synced.challenges, challengeWork: synced.challengeWork,
    };
  }
  return {
    appMode: state.appMode, world: state.world, fsm: state.fsm,
    blocks: state.blocks, python: state.python,
    challenges: state.challenges, challengeWork: state.challengeWork,
  };
}

// ── URL ?mode= helper ─────────────────────────────────────────────────────────

export function getInitialAppMode() {
  if (typeof window === 'undefined') return initialState.appMode;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  if (mode === 'fsm' || mode === 'blocks' || mode === 'python') return mode;
  return initialState.appMode;
}

import {
  createWorld, createFSM, computeSensors, executeStep,
  makeDefaultGuard,
} from './utils.js';

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
  },
  // Shared by Blocks + Python (Monaco) modes — both use the pyodide runner.
  runner: {
    status: 'idle',          // 'idle'|'loading'|'ready'|'running'|'paused'|'error'|'finished'
    output: [],              // captured stdout / tracebacks, newest last
    awaitingInput: false,    // worker is parked waiting for user input()
    inputPrompt: '',         // prompt text passed to input()
    installing: null,        // name of pyodide package currently being installed
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
  // Inside the editor, which challenge is being edited and which world
  // (initial or target) is being painted.
  editingChallengeId: null,
  editingWorldView: 'initial',   // 'initial' | 'target'
  // Result of the most recent run against a challenge's target world.
  challengeResult: null,         // null | 'success' | 'fail'
  // Snapshot of the default workspace taken when entering a challenge or
  // the editor so we can restore it on exit.
  defaultSnapshot: null,
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

function makeChallenge(world, name, mode = 'blocks') {
  return {
    id: `c${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
    name,
    mode,
    initialWorld: cloneWorld(world),
    targetWorld:  cloneWorld(world),
    starter: { fsm: null, blocks: null, python: '' },
  };
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
function persistEditingChallenge(state) {
  if (!state.challengeEditor || !state.editingChallengeId) return state;
  const cid = state.editingChallengeId;
  const view = state.editingWorldView;
  return {
    ...state,
    challenges: state.challenges.map(c => {
      if (c.id !== cid) return c;
      const updated = { ...c };
      if (view === 'initial') updated.initialWorld = cloneWorld(state.world);
      else                    updated.targetWorld  = cloneWorld(state.world);
      // Persist starter code in the challenge's mode.
      if (c.mode === 'fsm')    updated.starter = { ...c.starter, fsm:    state.fsm };
      if (c.mode === 'blocks') updated.starter = { ...c.starter, blocks: state.blocks.blocklyState };
      if (c.mode === 'python') updated.starter = { ...c.starter, python: state.python.code };
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

// Load a challenge into editor state for editing.
function loadChallengeForEditing(state, challenge) {
  const view = state.editingWorldView;
  const world = view === 'initial' ? challenge.initialWorld : challenge.targetWorld;
  let fsm = state.fsm;
  let blocksState = null;
  let pythonCode = '';
  if (challenge.mode === 'fsm')    fsm = challenge.starter.fsm    ?? createFSM();
  if (challenge.mode === 'blocks') blocksState = challenge.starter.blocks;
  if (challenge.mode === 'python') pythonCode  = challenge.starter.python ?? '';
  return withSensors({
    ...state,
    appMode: challenge.mode,
    fsm,
    blocks: { ...state.blocks, blocklyState: blocksState, currentBlockId: null, errorBlockId: null },
    python: { ...state.python, code: pythonCode, currentLine: null, errorLine: null },
  }, cloneWorld(world));
}

function worldsEqual(a, b) {
  if (!a || !b) return false;
  if (a.width !== b.width || a.height !== b.height) return false;
  if (a.kara.x !== b.kara.x || a.kara.y !== b.kara.y) return false;
  if (a.kara.direction !== b.kara.direction) return false;
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
      return {
        ...state,
        challengeResult: null,
        sim: {
          ...state.sim,
          mode: 'running',
          currentStateId: state.fsm.startStateId,
          lastTransitionId: null,
          savedWorld: state.world,
          stepCount: 0,
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
      }, action.world);

    // ── App mode & persistence ──────────────────────────────────────────────

    case 'SET_APP_MODE': {
      if (state.appMode === action.mode) return state;
      // If a previous Python run is still half-running (paused, finished,
      // mid-error), reset the sim cleanly so the new mode lands in 'edit'.
      // We restore the snapshotted world if we have one.
      const needsReset = state.sim.mode !== 'edit'
        || state.runner.status === 'finished'
        || state.runner.status === 'error';
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

    case 'SIM_PY_START':
      return {
        ...state,
        challengeResult: null,
        sim: {
          ...state.sim,
          mode: 'running',
          savedWorld: state.world,
          stepCount: 0,
          log: [],
          error: null,
        },
        runner: { ...state.runner, output: [], awaitingInput: false, inputPrompt: '' },
        blocks: { ...state.blocks, currentBlockId: null, errorBlockId: null },
        python: { ...state.python, currentLine: null, errorLine: null },
      };

    case 'SIM_PY_RESET': {
      const restored = state.sim.savedWorld ?? state.world;
      return {
        ...state,
        world: restored,
        sensors: computeSensors(restored),
        sim: {
          ...state.sim,
          mode: 'edit',
          savedWorld: null,
          stepCount: 0,
          log: [],
          error: null,
        },
        runner: { ...state.runner, status: 'idle', awaitingInput: false, inputPrompt: '' },
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
        runner: { ...state.runner, status: 'finished', awaitingInput: false, inputPrompt: '' },
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
      const view = state.editingWorldView || 'initial';
      const next = {
        ...state,
        challenges,
        challengeEditor: true,
        editingChallengeId: editingId,
        editingWorldView: view,
        defaultSnapshot: snapshot,
        currentChallengeId: null,
        challengeResult: null,
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
        editingWorldView: 'initial',
        defaultSnapshot: null,
      };
    }

    case 'CH_NEW': {
      const persisted = persistEditingChallenge(state);
      const newCh = makeChallenge(state.world, `Challenge ${persisted.challenges.length + 1}`, persisted.appMode === 'fsm' ? 'fsm' : persisted.appMode);
      const challenges = [...persisted.challenges, newCh];
      const next = {
        ...persisted,
        challenges,
        editingChallengeId: newCh.id,
        editingWorldView: 'initial',
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

    case 'CH_SET_MODE': {
      // Persist current edits to the old challenge first, then switch mode.
      // Switching mode resets starter code in that mode to empty.
      const persisted = persistEditingChallenge(state);
      const updated = persisted.challenges.map(c =>
        c.id === action.id
          ? { ...c, mode: action.mode, starter: { fsm: null, blocks: null, python: '' } }
          : c
      );
      const next = { ...persisted, challenges: updated };
      const ch = updated.find(c => c.id === action.id);
      if (state.editingChallengeId === action.id && ch) {
        return loadChallengeForEditing(next, ch);
      }
      return next;
    }

    case 'CH_SET_EDITING_CHALLENGE': {
      const persisted = persistEditingChallenge(state);
      const ch = persisted.challenges.find(c => c.id === action.id);
      if (!ch) return persisted;
      const next = {
        ...persisted,
        editingChallengeId: ch.id,
        editingWorldView: 'initial',
      };
      return loadChallengeForEditing(next, ch);
    }

    case 'CH_SET_VIEW': {
      // Switching between Initial / Target world tabs: persist the current
      // displayed world to the old slot, then load the other.
      if (action.view === state.editingWorldView) return state;
      const persisted = persistEditingChallenge(state);
      const ch = persisted.challenges.find(c => c.id === persisted.editingChallengeId);
      if (!ch) return { ...persisted, editingWorldView: action.view };
      const newWorld = action.view === 'initial' ? ch.initialWorld : ch.targetWorld;
      return withSensors({ ...persisted, editingWorldView: action.view }, cloneWorld(newWorld));
    }

    case 'CH_SELECT': {
      const ch = state.challenges.find(c => c.id === action.id);
      if (!ch) return state;
      const snap = state.defaultSnapshot ?? takeSnapshot(state);
      const persistedWork = persistChallengeWork(state);
      const next = {
        ...persistedWork,
        currentChallengeId: ch.id,
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
        },
        runner: { ...persistedWork.runner, status: 'idle', awaitingInput: false, inputPrompt: '' },
      };
      return loadChallenge(next, ch);
    }

    case 'CH_EXIT_PLAY': {
      const persisted = persistChallengeWork(state);
      const snap = persisted.defaultSnapshot;
      const restored = snap ? applySnapshot(persisted, snap) : persisted;
      return {
        ...restored,
        currentChallengeId: null,
        defaultSnapshot: null,
        challengeResult: null,
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
        },
        runner: { ...state.runner, status: 'idle', awaitingInput: false, inputPrompt: '' },
      };
      return loadChallenge(next, ch);
    }

    case 'CH_CHECK_RESULT': {
      if (!state.currentChallengeId) return state;
      const ch = state.challenges.find(c => c.id === state.currentChallengeId);
      if (!ch) return state;
      const ok = worldsEqual(state.world, ch.targetWorld);
      return { ...state, challengeResult: ok ? 'success' : 'fail' };
    }

    case 'CH_CLEAR_RESULT':
      return { ...state, challengeResult: null };

    case 'CH_COPY_WORLD': {
      // Copy the source world (initial or target) onto the world currently
      // being edited, in the active challenge. Useful for seeding the target
      // world with the initial layout before tweaking it.
      if (!state.challengeEditor || !state.editingChallengeId) return state;
      const ch = state.challenges.find(c => c.id === state.editingChallengeId);
      if (!ch) return state;
      const source = action.from === 'initial' ? ch.initialWorld : ch.targetWorld;
      const copy = cloneWorld(source);
      const newChallenges = state.challenges.map(c => {
        if (c.id !== state.editingChallengeId) return c;
        if (state.editingWorldView === 'initial') return { ...c, initialWorld: cloneWorld(copy) };
        return { ...c, targetWorld: cloneWorld(copy) };
      });
      return withSensors({ ...state, challenges: newChallenges }, copy);
    }

    case 'CH_REPLACE_ALL':
      // Used by file load — replace the whole challenge subsystem.
      return {
        ...state,
        challenges: action.challenges ?? [],
        challengeWork: action.challengeWork ?? {},
        currentChallengeId: null,
        challengeEditor: false,
        editingChallengeId: null,
        editingWorldView: 'initial',
        defaultSnapshot: null,
        challengeResult: null,
      };

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

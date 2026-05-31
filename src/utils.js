import { newGuid } from './utils/guid.js';

// ── Direction helpers ────────────────────────────────────────────────────────

export const DIRECTIONS = ['right', 'down', 'left', 'up'];

export const DIR_DELTA = {
  right: { dx: 1, dy: 0 },
  down:  { dx: 0, dy: 1 },
  left:  { dx: -1, dy: 0 },
  up:    { dx: 0, dy: -1 },
};

export function turnLeft(dir) {
  // facing right → turn left → facing up
  return DIRECTIONS[(DIRECTIONS.indexOf(dir) + 3) % 4];
}

export function turnRight(dir) {
  return DIRECTIONS[(DIRECTIONS.indexOf(dir) + 1) % 4];
}

// Return the cell one step in `dir` from (x, y). By default the world
// wraps at its edges (the historical behaviour). When `wraps` is false
// the function returns `null` to signal "off the edge" — callers
// (sensor read, move action) decide whether that's a wall, an error,
// or some other outcome.
function step(x, y, dir, width, height, wraps = true) {
  const { dx, dy } = DIR_DELTA[dir];
  const nx = x + dx;
  const ny = y + dy;
  if (!wraps) {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return null;
    return { x: nx, y: ny };
  }
  return {
    x: ((nx % width) + width) % width,
    y: ((ny % height) + height) % height,
  };
}

// ── World helpers ────────────────────────────────────────────────────────────

export function createWorld(width = 15, height = 10) {
  return {
    width,
    height,
    cells: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ hasLeaf: false, object: null }))
    ),
    kara: { x: Math.floor(width / 2), y: Math.floor(height / 2), direction: 'right' },
  };
}

// Clone cells deeply (cheap — cells are small plain objects)
function cloneCells(cells) {
  return cells.map(row => row.map(c => ({ ...c })));
}

export function cloneWorld(world) {
  return {
    width: world.width,
    height: world.height,
    cells: cloneCells(world.cells),
    kara: { ...world.kara },
    fixedEdges: !!world.fixedEdges,
  };
}

// ── Sensor computation ───────────────────────────────────────────────────────

export function computeSensors(world) {
  const { cells, kara, width, height, fixedEdges } = world;
  const wraps = !fixedEdges;
  const front = step(kara.x, kara.y, kara.direction,            width, height, wraps);
  const left  = step(kara.x, kara.y, turnLeft(kara.direction),  width, height, wraps);
  const right = step(kara.x, kara.y, turnRight(kara.direction), width, height, wraps);

  // With fixed edges, an off-grid look-ahead is treated as a tree-like
  // wall: tree-front/left/right is true; mushroom-front is false.
  const frontCell = front ? cells[front.y][front.x] : null;
  const leftCell  = left  ? cells[left.y][left.x]   : null;
  const rightCell = right ? cells[right.y][right.x] : null;

  return {
    treeFront:     frontCell ? frontCell.object === 'tree' : true,
    treeLeft:      leftCell  ? leftCell.object  === 'tree' : true,
    treeRight:     rightCell ? rightCell.object === 'tree' : true,
    mushroomFront: frontCell ? frontCell.object === 'mushroom' : false,
    onLeaf:        cells[kara.y][kara.x].hasLeaf,
    // expose adjacent positions for world editor highlighting (null when off-grid)
    _frontPos: front,
    _leftPos:  left,
    _rightPos: right,
  };
}

// ── Guard matching ───────────────────────────────────────────────────────────

// guard[sensor] is true | false | null (don't-care)
export function guardMatches(guard, sensors) {
  for (const key of ['treeFront', 'treeLeft', 'treeRight', 'mushroomFront', 'onLeaf']) {
    const g = guard[key];
    if (g !== null && g !== sensors[key]) return false;
  }
  return true;
}

export function findMatchingTransition(transitions, currentStateId, sensors) {
  return transitions.find(t => t.fromId === currentStateId && guardMatches(t.guard, sensors)) ?? null;
}

// ── Action application ───────────────────────────────────────────────────────

export function applyAction(world, action) {
  if (!action || action === 'none') return world;

  const cells = cloneCells(world.cells);
  let kara = { ...world.kara };
  const { width, height } = world;

  switch (action) {
    case 'turnLeft':
      kara.direction = turnLeft(kara.direction);
      break;

    case 'turnRight':
      kara.direction = turnRight(kara.direction);
      break;

    case 'move': {
      const wraps = !world.fixedEdges;
      const front = step(kara.x, kara.y, kara.direction, width, height, wraps);
      if (!front) {
        throw new Error('Kara cannot walk off the edge of the world!');
      }
      const frontCell = cells[front.y][front.x];

      if (frontCell.object === 'tree') {
        throw new Error('Kara cannot move into a tree!');
      }
      if (frontCell.object === 'mushroom') {
        const behind = step(front.x, front.y, kara.direction, width, height, wraps);
        if (!behind) {
          throw new Error('Cannot push mushroom off the edge of the world!');
        }
        const behindCell = cells[behind.y][behind.x];
        if (behindCell.object !== null) {
          throw new Error('Cannot push mushroom — cell behind it is blocked!');
        }
        behindCell.object = 'mushroom';
        frontCell.object = null;
      }
      kara.x = front.x;
      kara.y = front.y;
      break;
    }

    case 'putLeaf':
      cells[kara.y][kara.x].hasLeaf = true;
      break;

    case 'removeLeaf':
      if (!cells[kara.y][kara.x].hasLeaf) {
        throw new Error('No leaf to remove here!');
      }
      cells[kara.y][kara.x].hasLeaf = false;
      break;

    default:
      break;
  }

  return { ...world, cells, kara };
}

// ── Python bridge: map Python method names to FSM action names ───────────────

// Python uses snake_case method names; the FSM internally uses camelCase
// action identifiers. Both map onto the same applyAction implementation.
const PY_ACTION_MAP = {
  move: 'move',
  turn_left: 'turnLeft',
  turn_right: 'turnRight',
  put_leaf: 'putLeaf',
  remove_leaf: 'removeLeaf',
};

export function applyKaraPyAction(world, pyAction) {
  const internal = PY_ACTION_MAP[pyAction];
  if (!internal) throw new Error(`Unknown kara action: ${pyAction}`);
  return applyAction(world, internal);
}

const PY_SENSOR_MAP = {
  tree_front: 'treeFront',
  tree_left: 'treeLeft',
  tree_right: 'treeRight',
  mushroom_front: 'mushroomFront',
  on_leaf: 'onLeaf',
};

export function readKaraPySensor(world, pySensor) {
  const internal = PY_SENSOR_MAP[pySensor];
  if (!internal) throw new Error(`Unknown kara sensor: ${pySensor}`);
  const sensors = computeSensors(world);
  return !!sensors[internal];
}

export const PY_ACTION_NAMES = Object.keys(PY_ACTION_MAP);
export const PY_SENSOR_NAMES = Object.keys(PY_SENSOR_MAP);

// ── FSM execution step ───────────────────────────────────────────────────────

export function executeStep(world, fsm, currentStateId) {
  const sensors = computeSensors(world);
  const transition = findMatchingTransition(fsm.transitions, currentStateId, sensors);

  if (!transition) {
    const state = fsm.states.find(s => s.id === currentStateId);
    throw new Error(
      `No matching transition from state "${state?.label ?? currentStateId}" for current sensor values.`
    );
  }

  const newWorld = applyAction(world, transition.action);
  return { newWorld, newStateId: transition.toId, transition, sensors };
}

// ── FSM factory ──────────────────────────────────────────────────────────────

export function createFSM() {
  const id = 's0';
  return {
    states: [{ id, label: 'q1', x: 180, y: 180 }],
    transitions: [],
    startStateId: id,
    _nextNum: 2,
  };
}

// ── Display helpers ──────────────────────────────────────────────────────────

const SENSOR_ABBR = {
  treeFront: 'TF', treeLeft: 'TL', treeRight: 'TR',
  mushroomFront: 'MF', onLeaf: 'OL',
};

const ACTION_LABEL = {
  none: '—', move: 'move', turnLeft: '↺L', turnRight: '↻R',
  putLeaf: '+leaf', removeLeaf: '−leaf',
};

export function formatGuard(guard) {
  const parts = [];
  for (const [key, abbr] of Object.entries(SENSOR_ABBR)) {
    const v = guard[key];
    if (v === true)  parts.push(abbr);
    if (v === false) parts.push(`¬${abbr}`);
  }
  return parts.length ? parts.join(' ') : '✱';
}

export function formatAction(action) {
  return ACTION_LABEL[action] ?? action;
}

export function makeDefaultGuard() {
  return { treeFront: null, treeLeft: null, treeRight: null, mushroomFront: null, onLeaf: null };
}

// ── SVG path helpers for FSMEditor ──────────────────────────────────────────

const STATE_R = 28;

export function transitionPath(fromState, toState, curveOffset) {
  if (fromState.id === toState.id) {
    return selfLoopPath(fromState);
  }

  const dx = toState.x - fromState.x;
  const dy = toState.y - fromState.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const nx = -uy; // normal (90° CCW)
  const ny = ux;

  const sx = fromState.x + ux * STATE_R;
  const sy = fromState.y + uy * STATE_R;
  const ex = toState.x - ux * STATE_R;
  const ey = toState.y - uy * STATE_R;

  const offset = curveOffset ?? 0;
  const cx = (sx + ex) / 2 + nx * offset;
  const cy = (sy + ey) / 2 + ny * offset;

  // Quadratic bezier
  const d = `M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`;

  // Label at t=0.5 along bezier: P = P0/4 + P1/2 + P2/4
  const lx = 0.25 * sx + 0.5 * cx + 0.25 * ex;
  const ly = 0.25 * sy + 0.5 * cy + 0.25 * ey;

  return { d, lx, ly };
}

function selfLoopPath(state) {
  const { x, y } = state;
  const r = STATE_R;
  const sx = x - 14;
  const sy = y - r;
  const ex = x + 14;
  const ey = y - r;
  const cp1x = x - 55;
  const cp1y = y - r - 65;
  const cp2x = x + 55;
  const cp2y = y - r - 65;
  const d = `M ${sx},${sy} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`;
  return { d, lx: x, ly: y - r - 50 };
}

export { STATE_R };

// ── Save / Load ───────────────────────────────────────────────────────────────

export function buildSaveData(opts) {
  const {
    world, fsm, appMode, blocklyState, pythonCode, pythonFontSize, name,
    challenges, challengeWork, cloudSave, challengeFileGuid,
    userProgress,  // optional { bookGuid, userSlot, updatedAt, challenges } — opt-in via "Save progress" menu item
  } = opts;
  const base = {
    karaWebVersion: 5,
    appMode: (appMode === 'blocks' || appMode === 'python') ? appMode : 'fsm',
    name: name || 'KaraWebWorld',
    savedAt: new Date().toISOString(),
    world: {
      width: world.width,
      height: world.height,
      cells: world.cells,
      kara: world.kara,
    },
  };
  if (challengeFileGuid) {
    base.challengeFileGuid = challengeFileGuid;
  }
  if (appMode === 'blocks') {
    base.blocks = { blocklyState: blocklyState ?? null };
  } else if (appMode === 'python') {
    base.python = { code: pythonCode ?? '', fontSize: pythonFontSize ?? 14 };
  } else {
    base.fsm = {
      states: fsm.states,
      transitions: fsm.transitions,
      startStateId: fsm.startStateId,
    };
  }
  if (challenges?.length || Object.keys(challengeWork ?? {}).length) {
    base.challenges    = challenges ?? [];
    base.challengeWork = challengeWork ?? {};
  }
  if (cloudSave && cloudSave.apiBaseUrl && cloudSave.publicKeyJwk) {
    // Cloud-save block must never include the private key or student list.
    // For google-drive (v3) we identify the book by challengeFileGuid.
    // For codehooks (v2) we identify the class by classCode.
    const method = cloudSave.method === 'google-drive' ? 'google-drive' : 'codehooks';
    if (method === 'google-drive') {
      const guid = cloudSave.challengeFileGuid || challengeFileGuid;
      if (guid) {
        base.cloudSave = {
          schemaVersion: 3,
          method: 'google-drive',
          apiBaseUrl: cloudSave.apiBaseUrl,
          challengeFileGuid: guid,
          publicKeyJwk: cloudSave.publicKeyJwk,
        };
      }
    } else {
      // codehooks branch: no longer scoped by classCode — the
      // backend identifies the teacher by publicKey fingerprint.
      const guid = cloudSave.challengeFileGuid || challengeFileGuid;
      if (guid) {
        base.cloudSave = {
          schemaVersion: 3,
          method: 'codehooks',
          apiBaseUrl: cloudSave.apiBaseUrl,
          challengeFileGuid: guid,
          publicKeyJwk: cloudSave.publicKeyJwk,
        };
      }
    }
    if (base.cloudSave && cloudSave.turnstileSiteKey) {
      base.cloudSave.turnstileSiteKey = cloudSave.turnstileSiteKey;
    }
  }
  // Optional embedded student progress (added by the "Save progress"
  // menu action). Backwards-compatible: older clients ignore the
  // unknown field.
  if (userProgress && userProgress.challenges && Object.keys(userProgress.challenges).length > 0) {
    base.userProgress = {
      bookGuid:   userProgress.bookGuid   ?? challengeFileGuid ?? '',
      userSlot:   userProgress.userSlot   ?? 'anon',
      updatedAt:  userProgress.updatedAt  ?? new Date().toISOString(),
      challenges: userProgress.challenges,
    };
  }
  return base;
}

export function downloadJSON(obj, filename) {
  const json = JSON.stringify(obj, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseSaveData(raw) {
  if (!raw?.karaWebVersion || !raw.world) {
    throw new Error('Unrecognised file format — is this a KaraWeb save file?');
  }
  const world = {
    width:  raw.world.width,
    height: raw.world.height,
    cells:  raw.world.cells,
    kara:   raw.world.kara,
  };
  let fsm;
  if (raw.fsm) {
    const maxN = raw.fsm.states.reduce((m, s) => {
      const match = s.label?.match(/^q(\d+)$/);
      return match ? Math.max(m, parseInt(match[1])) : m;
    }, 0);
    fsm = {
      states:       raw.fsm.states,
      transitions:  raw.fsm.transitions,
      startStateId: raw.fsm.startStateId,
      _nextNum:     maxN + 1,
    };
  } else {
    fsm = createFSM();
  }
  // Versions: v1 had no appMode (always fsm). v2 used appMode='python' for blocks.
  // v3 uses 'blocks' and 'python' distinctly. Migrate v2 → v3.
  let appMode = raw.appMode;
  if (raw.karaWebVersion <= 2 && appMode === 'python') appMode = 'blocks';
  if (appMode !== 'blocks' && appMode !== 'python') appMode = 'fsm';

  // Blockly state can be under raw.blocks.blocklyState (v3) or
  // raw.python.blocklyState (v2). Both supported.
  const blocklyState =
    raw.blocks?.blocklyState ?? raw.python?.blocklyState ?? null;

  // Python (Monaco) state is only in v3+.
  const pythonCode     = (raw.karaWebVersion >= 3) ? (raw.python?.code ?? null) : null;
  const pythonFontSize = (raw.karaWebVersion >= 3) ? (raw.python?.fontSize ?? null) : null;

  // Challenges are v4+.
  const rawChallenges  = (raw.karaWebVersion >= 4) ? (raw.challenges ?? []) : [];
  const challengeWork  = (raw.karaWebVersion >= 4) ? (raw.challengeWork ?? {}) : {};

  // v5 added `guid` per challenge for stable cloud-side identity. Legacy
  // challenges (loaded from v4 files) get guid = id so the existing
  // challengeWork[id] map keeps linking. New challenges minted in code use
  // a UUID for both fields.
  const challenges = rawChallenges.map((c) => {
    const withGuid = c.guid ? c : { ...c, guid: c.id };
    // intermediateCheckpoints was added later; ensure every loaded
    // challenge carries at least an empty array so the editor and the
    // simulation can treat it uniformly.
    const withCheckpoints = Array.isArray(withGuid.intermediateCheckpoints)
      ? withGuid
      : { ...withGuid, intermediateCheckpoints: [] };
    // Solution feature added later; backfill the per-mode slot.
    // `solutionEncrypted` used to be a separately-stored flag — it's
    // now derived from `!solutionAvailableToStudents`. We discard
    // any incoming `solutionEncrypted` field but reconcile the
    // visibility flag against the actual data: if any populated
    // mode entry starts with the envelope header, the data is
    // encrypted, so visible must be false regardless of what the
    // legacy flag said. This guards against files saved with stale
    // pairs (or hand-edited JSON).
    const solution = withCheckpoints.solution
      && typeof withCheckpoints.solution === 'object'
      ? withCheckpoints.solution
      : { fsm: null, blocks: null, python: '' };
    const ENVELOPE_HEADER = 'KaraWeb Cloud Save';
    const anyEnvelope = ['fsm', 'blocks', 'python'].some(m =>
      typeof solution[m] === 'string' && solution[m].startsWith(ENVELOPE_HEADER));
    const visibleFromFlag = !!withCheckpoints.solutionAvailableToStudents;
    const visible = anyEnvelope ? false : visibleFromFlag;
    // Per-mode "max code size" caps for the student. Backfilled
    // to disabled so old challenges keep working.
    const rawLimits = withCheckpoints.limits || {};
    const limits = {
      enforced: !!rawLimits.enforced,
      blocks: { added:       Number(rawLimits.blocks?.added       ?? 0) || 0 },
      fsm:    { states:      Number(rawLimits.fsm?.states         ?? 0) || 0,
                transitions: Number(rawLimits.fsm?.transitions    ?? 0) || 0 },
      python: { tokens:      Number(rawLimits.python?.tokens      ?? 0) || 0 },
    };
    return {
      ...withCheckpoints,
      solution,
      solutionAvailableToStudents: visible,
      noCheckTarget: !!withCheckpoints.noCheckTarget,
      ignoreOrientation: !!withCheckpoints.ignoreOrientation,
      endOnTargetNotRequired: !!withCheckpoints.endOnTargetNotRequired,
      limits,
      disallowedBlocks: Array.isArray(withCheckpoints.disallowedBlocks)
        ? withCheckpoints.disallowedBlocks.filter(t => typeof t === 'string')
        : [],
      fixedWorldEdges: !!withCheckpoints.fixedWorldEdges,
    };
  });

  // v5 added the optional cloudSave block. Only honour it if it looks valid.
  // schemaVersion 1: codehooks-only (no `method`, no turnstileSiteKey).
  // schemaVersion 2: adds `method` + optional `turnstileSiteKey`.
  // schemaVersion 3: google-drive flavour, identifies the book by
  // `challengeFileGuid` instead of `classCode`. Per-teacher script.
  let cloudSave = null;
  if (raw.karaWebVersion >= 5 && raw.cloudSave) {
    const c = raw.cloudSave;
    if (c.apiBaseUrl && c.publicKeyJwk) {
      const method = c.method === 'google-drive' ? 'google-drive' : 'codehooks';
      if (method === 'google-drive' && c.challengeFileGuid) {
        cloudSave = {
          schemaVersion: c.schemaVersion ?? 3,
          method: 'google-drive',
          apiBaseUrl: String(c.apiBaseUrl),
          challengeFileGuid: String(c.challengeFileGuid),
          publicKeyJwk: c.publicKeyJwk,
        };
      } else if (method === 'codehooks' && c.challengeFileGuid) {
        cloudSave = {
          schemaVersion: c.schemaVersion ?? 3,
          method: 'codehooks',
          challengeFileGuid: String(c.challengeFileGuid),
          apiBaseUrl: String(c.apiBaseUrl),
          publicKeyJwk: c.publicKeyJwk,
        };
      }
      if (cloudSave && c.turnstileSiteKey) {
        cloudSave.turnstileSiteKey = String(c.turnstileSiteKey);
      }
    }
  }

  // Top-level challengeFileGuid (v5+). If the file doesn't carry one we
  // mint a fresh one on load so the in-memory project has stable identity.
  const challengeFileGuid =
    (raw.karaWebVersion >= 5 && raw.challengeFileGuid)
      ? String(raw.challengeFileGuid)
      : (cloudSave?.challengeFileGuid || '');

  // Optional embedded student progress (added by "Save progress" export).
  // Only honoured when the bookGuid in the progress payload matches the
  // file's own challengeFileGuid — guards against pasted-in mismatched
  // progress blobs.
  let userProgress = null;
  if (raw.userProgress
      && typeof raw.userProgress === 'object'
      && raw.userProgress.challenges
      && typeof raw.userProgress.challenges === 'object'
      && raw.userProgress.bookGuid
      && raw.userProgress.bookGuid === challengeFileGuid) {
    userProgress = {
      bookGuid:  String(raw.userProgress.bookGuid),
      userSlot:  String(raw.userProgress.userSlot || 'anon'),
      updatedAt: String(raw.userProgress.updatedAt || ''),
      challenges: raw.userProgress.challenges,
    };
  }

  return {
    world, fsm, appMode, blocklyState, pythonCode, pythonFontSize,
    challenges, challengeWork, cloudSave, challengeFileGuid,
    userProgress,
  };
}

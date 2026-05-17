// ── Direction helpers ────────────────────────────────────────────────────────

export const DIRECTIONS = ['right', 'down', 'left', 'up'];

const DIR_DELTA = {
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

// Return wrapped (x, y) of the cell one step in `dir` from (x, y)
function step(x, y, dir, width, height) {
  const { dx, dy } = DIR_DELTA[dir];
  return {
    x: ((x + dx) % width + width) % width,
    y: ((y + dy) % height + height) % height,
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

// ── Sensor computation ───────────────────────────────────────────────────────

export function computeSensors(world) {
  const { cells, kara, width, height } = world;
  const front = step(kara.x, kara.y, kara.direction, width, height);
  const left  = step(kara.x, kara.y, turnLeft(kara.direction), width, height);
  const right = step(kara.x, kara.y, turnRight(kara.direction), width, height);

  const frontCell = cells[front.y][front.x];
  const leftCell  = cells[left.y][left.x];
  const rightCell = cells[right.y][right.x];

  return {
    treeFront:     frontCell.object === 'tree',
    treeLeft:      leftCell.object  === 'tree',
    treeRight:     rightCell.object === 'tree',
    mushroomFront: frontCell.object === 'mushroom',
    onLeaf:        cells[kara.y][kara.x].hasLeaf,
    // expose adjacent positions for world editor highlighting
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
      const front = step(kara.x, kara.y, kara.direction, width, height);
      const frontCell = cells[front.y][front.x];

      if (frontCell.object === 'tree') {
        throw new Error('Kara cannot move into a tree!');
      }
      if (frontCell.object === 'mushroom') {
        const behind = step(front.x, front.y, kara.direction, width, height);
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

export function buildSaveData(world, fsm, name) {
  return {
    karaWebVersion: 1,
    name: name || 'KaraWebWorld',
    savedAt: new Date().toISOString(),
    world: {
      width: world.width,
      height: world.height,
      cells: world.cells,
      kara: world.kara,
    },
    fsm: {
      states: fsm.states,
      transitions: fsm.transitions,
      startStateId: fsm.startStateId,
    },
  };
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
  if (!raw?.karaWebVersion || !raw.world || !raw.fsm) {
    throw new Error('Unrecognised file format — is this a KaraWeb save file?');
  }
  const world = {
    width:  raw.world.width,
    height: raw.world.height,
    cells:  raw.world.cells,
    kara:   raw.world.kara,
  };
  // Re-derive _nextNum from the highest q{n} label present
  const maxN = raw.fsm.states.reduce((m, s) => {
    const match = s.label?.match(/^q(\d+)$/);
    return match ? Math.max(m, parseInt(match[1])) : m;
  }, 0);
  const fsm = {
    states:       raw.fsm.states,
    transitions:  raw.fsm.transitions,
    startStateId: raw.fsm.startStateId,
    _nextNum:     maxN + 1,
  };
  return { world, fsm };
}

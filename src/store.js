import {
  createWorld, createFSM, computeSensors, executeStep,
  makeDefaultGuard,
} from './utils.js';

// ── Initial state ────────────────────────────────────────────────────────────

const initWorld = createWorld(15, 10);

export const initialState = {
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
  // ephemeral UI — persisted here so components stay in sync
  worldTool: 'tree',     // 'tree'|'mushroom'|'leaf'|'erase'|'kara'
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function withSensors(state, world) {
  return { ...state, world, sensors: computeSensors(world) };
}

// ── Reducer ──────────────────────────────────────────────────────────────────

export function reducer(state, action) {
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
        ...state,
        fsm: {
          ...state.fsm,
          states: [...state.fsm.states, newFsmState],
          _nextNum: state.fsm._nextNum + 1,
        },
      };
    }

    case 'UPDATE_STATE': {
      return {
        ...state,
        fsm: {
          ...state.fsm,
          states: state.fsm.states.map(s =>
            s.id === action.id ? { ...s, ...action.patch } : s
          ),
        },
      };
    }

    case 'DELETE_STATE': {
      const remaining = state.fsm.states.filter(s => s.id !== action.id);
      const newStartId =
        state.fsm.startStateId === action.id
          ? (remaining[0]?.id ?? null)
          : state.fsm.startStateId;
      return {
        ...state,
        fsm: {
          ...state.fsm,
          states: remaining,
          transitions: state.fsm.transitions.filter(
            t => t.fromId !== action.id && t.toId !== action.id
          ),
          startStateId: newStartId,
        },
      };
    }

    case 'SET_START_STATE':
      return { ...state, fsm: { ...state.fsm, startStateId: action.id } };

    case 'ADD_TRANSITION': {
      const id = `t${Date.now()}`;
      return {
        ...state,
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

    case 'UPDATE_TRANSITION': {
      return {
        ...state,
        fsm: {
          ...state.fsm,
          transitions: state.fsm.transitions.map(t =>
            t.id === action.id ? { ...t, ...action.patch } : t
          ),
        },
      };
    }

    case 'DELETE_TRANSITION': {
      return {
        ...state,
        fsm: {
          ...state.fsm,
          transitions: state.fsm.transitions.filter(t => t.id !== action.id),
        },
      };
    }

    case 'REORDER_TRANSITION': {
      // Move transition at index `from` to index `to` (same fromId group)
      const ts = [...state.fsm.transitions];
      const [moved] = ts.splice(action.from, 1);
      ts.splice(action.to, 0, moved);
      return { ...state, fsm: { ...state.fsm, transitions: ts } };
    }

    // ── Simulation ─────────────────────────────────────────────────────────

    case 'SIM_START': {
      if (!state.fsm.startStateId || state.fsm.states.length === 0) {
        return {
          ...state,
          sim: { ...state.sim, error: 'Add at least one state and set a start state first.' },
        };
      }
      return {
        ...state,
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
        return {
          ...state,
          sim: { ...state.sim, mode: 'paused', error: err.message },
        };
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

    default:
      return state;
  }
}

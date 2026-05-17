// PythonRunner: main-thread controller for the pyodide worker.
//
// Used by both Blocks mode (Blockly-generated Python) and Python mode
// (Monaco-typed Python). The runner is mode-aware so it can highlight the
// right artifact (block id vs line number) and provide an init prelude.
//
// Responsibilities:
//   - Spawn (and re-spawn) the worker on demand.
//   - Pre-warm: caller can ask us to load pyodide eagerly so Run is fast.
//   - Listen for messages from the worker:
//       * `kara`     -- a Ladybird method call; mutate world via
//                       applyKaraPyAction / readKaraPySensor and respond.
//       * `breakpt`  -- worker parked at a statement; highlight the current
//                       block/line and schedule continue after sim.speed.
//       * `print`    -- stdout chunk; forward to the output panel.
//       * `input`    -- worker called input(); flip RUN_AWAIT_INPUT.
//       * `install`  -- worker requesting a package install (loadPackage).
//       * `debug-finished` -- run ended (ok | error | interrupt).

import { applyKaraPyAction, readKaraPySensor, cloneWorld } from '../utils.js';

const WORKER_URL = '/pyodide-worker.js';

export class PythonRunner {
  constructor({ getWorld, getSpeed, getMode, dispatch }) {
    this.getWorld  = getWorld;
    this.getSpeed  = getSpeed;
    this.getMode   = getMode;        // () => 'blocks' | 'python'
    this.dispatch  = dispatch;

    this.worker = null;
    this.workerReady = null;
    this.workerReadyResolve = null;
    this.workerReadyReject = null;

    this.lineToBlockId = [];
    this.pendingStepTimer = null;
    this.running = false;
    // Synchronous pause flag — driven by start/pause/resume/step. Avoids
    // races with React state since handleBreakpoint can fire on a microtask
    // before the next useEffect commits.
    this.userPaused = false;
    // Buffer for stdout chunks. Python emits the message and the trailing
    // "\n" as separate write() calls, so we accumulate and only emit full
    // lines (otherwise every print produces a spurious blank line entry).
    this._stdoutBuffer = '';
    // Runner-owned snapshot of the world. Kept synchronously consistent
    // across kara-method calls so sensor reads aren't subject to React
    // render timing. Each applyKaraPyAction updates this snapshot; we still
    // dispatch SIM_PY_APPLY_WORLD so React-driven UI (world grid) updates.
    this.world = null;
  }

  flushStdout(force = false) {
    if (!this._stdoutBuffer) return;
    const lines = [];
    while (true) {
      const idx = this._stdoutBuffer.indexOf('\n');
      if (idx < 0) break;
      lines.push(this._stdoutBuffer.slice(0, idx));
      this._stdoutBuffer = this._stdoutBuffer.slice(idx + 1);
    }
    if (force && this._stdoutBuffer) {
      lines.push(this._stdoutBuffer);
      this._stdoutBuffer = '';
    }
    if (lines.length) this.dispatch({ type: 'RUN_APPEND_OUTPUT', lines });
  }

  // ── Worker lifecycle ──────────────────────────────────────────────────────

  ensureWorker() {
    if (this.worker) return this.workerReady;
    this.dispatch({ type: 'RUN_SET_STATUS', status: 'loading' });
    this.worker = new Worker(WORKER_URL);
    this.workerReady = new Promise((resolve, reject) => {
      this.workerReadyResolve = resolve;
      this.workerReadyReject = reject;
    });
    this.worker.addEventListener('message', (e) => this.handleWorkerMessage(e));
    this.worker.addEventListener('error', (e) => {
      console.error('pyodide worker error:', e);
      this.dispatch({ type: 'RUN_SET_STATUS', status: 'error' });
      this.dispatch({
        type: 'RUN_SET_ERROR',
        message: `Python worker error: ${e.message || 'unknown'}`,
      });
      if (this.workerReadyReject) this.workerReadyReject(e);
    });
    this.worker.postMessage({ cmd: 'init' });
    return this.workerReady;
  }

  /** Pre-warm: kick off worker load if not started — but don't block. */
  prewarm() {
    if (!this.worker) {
      this.ensureWorker().catch(() => {});
    }
  }

  destroyWorker() {
    if (this.pendingStepTimer) { clearTimeout(this.pendingStepTimer); this.pendingStepTimer = null; }
    if (this.worker) { this.worker.terminate(); this.worker = null; }
    this.workerReady = null;
    this.workerReadyResolve = null;
    this.workerReadyReject = null;
    this.running = false;
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ cmd: 'ps-reset' });
    }
    this.dispatch({ type: 'RUN_SET_STATUS', status: 'idle' });
    this.dispatch({ type: 'RUN_CLEAR_INPUT' });
    this.dispatch({ type: 'RUN_SET_INSTALLING', name: null });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async start({ code, lineToBlockId, stepped = true }) {
    this.lineToBlockId = lineToBlockId || [];
    this.userPaused = false;
    this._stdoutBuffer = '';
    // Snapshot the world at run start; subsequent actions mutate this copy
    // synchronously so sensor reads never depend on React's render schedule.
    this.world = cloneWorld(this.getWorld());
    try {
      await this.ensureWorker();
    } catch {
      return;
    }
    this.dispatch({ type: 'RUN_SET_STATUS', status: 'running' });
    this.running = true;
    this.worker.postMessage({ cmd: stepped ? 'debug' : 'run', code });
  }

  pause() {
    this.userPaused = true;
    if (this.pendingStepTimer) { clearTimeout(this.pendingStepTimer); this.pendingStepTimer = null; }
    this.dispatch({ type: 'RUN_SET_STATUS', status: 'paused' });
  }

  resume() {
    this.userPaused = false;
    this.dispatch({ type: 'RUN_SET_STATUS', status: 'running' });
    this.continueStep(false);
  }

  step() {
    // Step = continue past current breakpoint, then re-park at the next one.
    this.userPaused = true;
    this.dispatch({ type: 'RUN_SET_STATUS', status: 'paused' });
    this.continueStep(true);
  }

  reset() {
    this._stdoutBuffer = '';
    this.world = null;
    this.destroyWorker();
    this.dispatch({ type: 'SIM_PY_RESET' });
    // Re-warm the worker in the background so the next Run is fast — the
    // previous worker was just terminated so pyodide needs to re-load.
    this.prewarm();
  }

  /** User typed an answer to a Python input() prompt and pressed Enter. */
  respondInput(text, prompt = '') {
    if (!navigator.serviceWorker?.controller) return;
    // Echo prompt + answer as one combined output line so it reads naturally
    // (`Enter name: Jack`) instead of as two separate lines.
    this.dispatch({ type: 'RUN_APPEND_OUTPUT', line: `${prompt}${text}` });
    this.dispatch({ type: 'RUN_CLEAR_INPUT' });
    navigator.serviceWorker.controller.postMessage({
      cmd: 'ps-input-resp',
      data: String(text),
    });
  }

  continueStep(/* singleStep */) {
    if (!navigator.serviceWorker?.controller) return;
    navigator.serviceWorker.controller.postMessage({
      cmd: 'ps-step-continue',
      step: true,
    });
  }

  // ── Worker → main thread message handling ─────────────────────────────────

  handleWorkerMessage(e) {
    const d = e.data;
    if (!d || !d.cmd) return;

    switch (d.cmd) {
      case 'init-done':
        this.dispatch({ type: 'RUN_SET_STATUS', status: 'ready' });
        if (this.workerReadyResolve) this.workerReadyResolve();
        break;

      case 'init-failed':
        this.dispatch({ type: 'RUN_SET_STATUS', status: 'error' });
        this.dispatch({
          type: 'RUN_SET_ERROR',
          message: `Python runtime failed to load: ${d.message ?? 'unknown'}`,
        });
        if (this.workerReadyReject) this.workerReadyReject(new Error(d.message));
        break;

      case 'installing':
        this.dispatch({ type: 'RUN_SET_INSTALLING', name: d.name ?? '…' });
        break;
      case 'install-done':
        this.dispatch({ type: 'RUN_SET_INSTALLING', name: null });
        break;
      case 'install-failed':
        this.dispatch({ type: 'RUN_SET_INSTALLING', name: null });
        this.dispatch({
          type: 'RUN_APPEND_OUTPUT',
          line: `Could not install package "${d.name}": ${d.message ?? 'unknown error'}`,
        });
        break;

      case 'print': {
        this._stdoutBuffer += String(d.msg ?? '');
        this.flushStdout(false);
        break;
      }

      case 'input': {
        // Glue any partial line still sitting in stdout onto the front of
        // the prompt so e.g. `print("hi"); input("? ")` shows `hi? ` inline
        // with the input field, and dispatch `hi? <answer>` as one line.
        const fullPrompt = this._stdoutBuffer + String(d.prompt ?? '');
        this._stdoutBuffer = '';
        this.dispatch({ type: 'RUN_AWAIT_INPUT', prompt: fullPrompt });
        break;
      }

      case 'kara':
        this.handleKara(d);
        break;

      case 'breakpt':
        this.handleBreakpoint(d);
        break;

      case 'debug-finished':
        this.handleFinished(d);
        break;

      default:
        break;
    }
  }

  handleKara({ msg }) {
    let parsed;
    try { parsed = JSON.parse(msg); } catch { parsed = {}; }
    const action = parsed.action;
    let resp = { value: null };
    // Lazily snapshot the world if we don't already have one (defensive —
    // start() should always seed this.world first).
    if (!this.world) this.world = cloneWorld(this.getWorld());
    try {
      switch (action) {
        case 'init':
          break;
        case 'move': case 'turn_left': case 'turn_right':
        case 'put_leaf': case 'remove_leaf': {
          this.world = applyKaraPyAction(this.world, action);
          this.dispatch({ type: 'SIM_PY_APPLY_WORLD', world: this.world });
          this.dispatch({ type: 'SIM_PY_INCREMENT_STEP' });
          break;
        }
        case 'tree_front': case 'tree_left': case 'tree_right':
        case 'mushroom_front': case 'on_leaf':
          resp.value = readKaraPySensor(this.world, action);
          break;
        default:
          resp = { error: `Unknown kara action: ${action}` };
      }
    } catch (err) {
      resp = { error: err.message || String(err) };
    }
    // Diagnostic: log every kara call so a user can paste this back if they
    // hit something that looks like an infinite loop or stuck state.
    if (this.world) {
      const k = this.world.kara;
      console.log(`[kara] ${action} → resp=${JSON.stringify(resp)} kara=(${k.x},${k.y}) dir=${k.direction}`);
    }
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ cmd: 'ps-kara-resp', ...resp });
    }
  }

  handleBreakpoint({ lineno }) {
    const mode = this.getMode();
    if (mode === 'blocks') {
      const blockId = this.lineToBlockId[lineno] ?? null;
      this.dispatch({ type: 'BLK_SET_CURRENT', blockId });
    } else {
      // Python (Monaco): lineToBlockId here is absolute-line → user-line
      // (or null for the auto-prepended prelude lines).
      const userLine = this.lineToBlockId[lineno] ?? null;
      this.dispatch({ type: 'PYC_SET_CURRENT_LINE', line: userLine });
    }

    if (this.userPaused) {
      this.dispatch({ type: 'RUN_SET_STATUS', status: 'paused' });
      return;
    }

    const speed = Math.max(50, this.getSpeed() | 0);
    if (this.pendingStepTimer) clearTimeout(this.pendingStepTimer);
    this.pendingStepTimer = setTimeout(() => {
      this.pendingStepTimer = null;
      if (this.userPaused) {
        this.dispatch({ type: 'RUN_SET_STATUS', status: 'paused' });
        return;
      }
      this.continueStep(false);
    }, speed);
  }

  handleFinished({ reason, errorLine }) {
    this.running = false;
    this.world = null;
    // Flush any partial line still sitting in the buffer (e.g. `print(x, end="")`).
    this.flushStdout(true);
    if (reason === 'error') {
      const mode = this.getMode();
      let blockId = null;
      let line = null;
      if (errorLine != null) {
        const mapped = this.lineToBlockId[errorLine] ?? null;
        if (mode === 'blocks') blockId = mapped;
        else                    line   = mapped; // user-editor line
      }
      this.dispatch({
        type: 'RUN_SET_ERROR',
        message: 'Python error — see the output panel for details.',
        blockId,
        line,
      });
      this.dispatch({ type: 'RUN_SET_STATUS', status: 'error' });
    }
    this.dispatch({ type: 'SIM_PY_FINISHED' });
  }
}

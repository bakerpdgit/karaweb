import React from 'react';

const MODE_OPTIONS = [
  { value: 'fsm',    label: 'FSM' },
  { value: 'blocks', label: 'Blocks' },
  { value: 'python', label: 'Python' },
];

const PY_FONT_SIZES = [10, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32];

export default function SimulationControls({
  sim, dispatch,
  appMode = 'fsm',
  pythonRunner = null,
  runnerStatus = 'idle',
  generatePython = null,
  awaitingInput = false,
  modeLocked = false,
  allowedModes = null,
  pythonFontSize = 14,
}) {
  // A challenge can narrow the offered modes (e.g. a lists/functions
  // book that has nothing to say in FSM). null = every mode.
  const modeOptions = Array.isArray(allowedModes) && allowedModes.length
    ? MODE_OPTIONS.filter(o => allowedModes.includes(o.value))
    : MODE_OPTIONS;
  const { mode, stepCount, speed } = sim;
  const isEdit    = mode === 'edit';
  const isRunning = mode === 'running';
  const isPaused  = mode === 'paused';
  const isPy      = appMode === 'blocks' || appMode === 'python';
  const finished  = isPy && runnerStatus === 'finished';

  const pyLoading = isPy && runnerStatus === 'loading';

  const handleRun = () => {
    if (isPy) {
      const gen = generatePython?.();
      if (!gen) return;
      dispatch({ type: 'SIM_PY_START' });
      pythonRunner.start(gen);
    } else {
      dispatch({ type: 'SIM_START' });
    }
  };

  const handlePause = () => {
    if (isPy) { dispatch({ type: 'SIM_PY_PAUSE' }); pythonRunner.pause(); }
    else      { dispatch({ type: 'SIM_PAUSE' }); }
  };
  const handleResume = () => {
    if (isPy) { dispatch({ type: 'SIM_PY_RESUME' }); pythonRunner.resume(); }
    else      { dispatch({ type: 'SIM_RESUME' }); }
  };
  const handleStep = () => {
    if (isPy) pythonRunner.step();
    else      dispatch({ type: 'SIM_STEP' });
  };
  const handleReset = () => {
    if (isPy) pythonRunner.reset();
    else      dispatch({ type: 'SIM_RESET' });
  };

  const onModeChange = (e) => {
    const next = e.target.value;
    if (next === appMode) return;
    dispatch({ type: 'SET_APP_MODE', mode: next });
  };

  const changeFontSize = (delta) => {
    const idx = PY_FONT_SIZES.indexOf(pythonFontSize);
    let next;
    if (delta < 0) next = idx > 0 ? PY_FONT_SIZES[idx - 1] : PY_FONT_SIZES[0];
    else next = idx >= 0 && idx < PY_FONT_SIZES.length - 1 ? PY_FONT_SIZES[idx + 1] : PY_FONT_SIZES[PY_FONT_SIZES.length - 1];
    dispatch({ type: 'PYC_SET_FONT_SIZE', fontSize: next });
  };

  return (
    <div className="sim-controls">
      <div className="sim-mode-select" title={modeLocked
        ? 'This challenge is locked to a single mode — the teacher has not allowed switching.'
        : 'Switch coding mode (programs in other modes stay in memory)'}>
        <select
          className="sim-mode-dropdown"
          value={appMode}
          onChange={onModeChange}
          disabled={modeLocked || mode !== 'edit'}
        >
          {modeOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="sim-buttons">
        {isEdit && (
          <button className="sim-btn run"
            onClick={handleRun}
            disabled={pyLoading || awaitingInput}
            title={pyLoading ? 'Loading Python runtime…' : 'Start simulation'}>
            ▶ Run
          </button>
        )}
        {isRunning && !finished && (
          <button className="sim-btn pause" onClick={handlePause}
            disabled={awaitingInput}>⏸ Pause</button>
        )}
        {isPaused && !finished && (
          <>
            <button className="sim-btn run" onClick={handleResume}
              disabled={awaitingInput}>▶ Resume</button>
            <button className="sim-btn step" onClick={handleStep}
              disabled={awaitingInput}
              title="Execute one step">⏭ Step</button>
          </>
        )}
        {(!isEdit) && (
          <button className="sim-btn reset" onClick={handleReset}
            title={finished
              ? 'Program ended — reset to restore the original world.'
              : 'Reset to start (restores original world)'}>⏹ Reset</button>
        )}
      </div>

      <div className="sim-speed">
        <label>
          Speed:
          {/* The underlying state is `speed` in ms-per-step (lower = faster).
              The slider is inverted so dragging right speeds Kara up:
              displayValue = MIN + MAX - speed. */}
          <input
            type="range" min="100" max="2000" step="50"
            value={2100 - speed}
            onChange={e => dispatch({ type: 'SIM_SET_SPEED', speed: 2100 - +e.target.value })}
            title="Drag right to speed up Kara"
          />
          <span>{speed} ms / step</span>
        </label>
      </div>

      {!isEdit && (
        <div className="sim-info">
          <span>Mode: <strong>{finished ? 'finished' : mode}</strong></span>
          <span>Steps: <strong>{stepCount}</strong></span>
        </div>
      )}

      {pyLoading && (
        <div className="sim-info"><em>Loading Python runtime…</em></div>
      )}

      {appMode === 'python' && (
        <div className="sim-font-controls" title="Editor font size">
          <span className="sim-font-label">Font:</span>
          <button
            type="button"
            className="sim-font-btn"
            title="Decrease font size"
            onClick={() => changeFontSize(-1)}
          >A−</button>
          <button
            type="button"
            className="sim-font-btn"
            title="Increase font size"
            onClick={() => changeFontSize(+1)}
          >A+</button>
          <select
            className="sim-font-select"
            value={pythonFontSize}
            onChange={e => dispatch({ type: 'PYC_SET_FONT_SIZE', fontSize: +e.target.value })}
          >
            {PY_FONT_SIZES.map(s => (<option key={s} value={s}>{s} px</option>))}
          </select>
        </div>
      )}
    </div>
  );
}

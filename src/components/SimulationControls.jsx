import React from 'react';

export default function SimulationControls({
  sim, dispatch,
  appMode = 'fsm',
  pythonRunner = null,
  runnerStatus = 'idle',
  generatePython = null,
  awaitingInput = false,
}) {
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

  return (
    <div className="sim-controls">
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
          <input
            type="range" min="100" max="2000" step="50"
            value={speed}
            onChange={e => dispatch({ type: 'SIM_SET_SPEED', speed: +e.target.value })}
          />
          <span>{speed} ms</span>
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
    </div>
  );
}

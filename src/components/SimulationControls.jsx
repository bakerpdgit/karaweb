import React from 'react';

export default function SimulationControls({ sim, dispatch }) {
  const { mode, stepCount, speed, error } = sim;
  const isEdit    = mode === 'edit';
  const isRunning = mode === 'running';
  const isPaused  = mode === 'paused';

  return (
    <div className="sim-controls">
      <div className="sim-buttons">
        {isEdit && (
          <button className="sim-btn run"
            onClick={() => dispatch({ type: 'SIM_START' })}
            title="Start simulation"
          >
            ▶ Run
          </button>
        )}
        {isRunning && (
          <button className="sim-btn pause"
            onClick={() => dispatch({ type: 'SIM_PAUSE' })}
          >
            ⏸ Pause
          </button>
        )}
        {isPaused && (
          <>
            <button className="sim-btn run"
              onClick={() => dispatch({ type: 'SIM_RESUME' })}
            >
              ▶ Resume
            </button>
            <button className="sim-btn step"
              onClick={() => dispatch({ type: 'SIM_STEP' })}
              title="Execute one step"
            >
              ⏭ Step
            </button>
          </>
        )}
        {!isEdit && (
          <button className="sim-btn reset"
            onClick={() => dispatch({ type: 'SIM_RESET' })}
            title="Reset to start (restores original world)"
          >
            ⏹ Reset
          </button>
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
          <span>Mode: <strong>{mode}</strong></span>
          <span>Steps: <strong>{stepCount}</strong></span>
        </div>
      )}

    </div>
  );
}

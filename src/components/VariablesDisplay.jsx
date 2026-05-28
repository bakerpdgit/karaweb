import React from 'react';

/**
 * Small chip-list of the user-program's current local variables.
 *
 * The Python runtime (see `public/python-runtime/kara_init.py`'s
 * `_capture_locals_for_chip`) ships a `{name: short_repr}` snapshot
 * on every breakpoint; PythonRunner forwards it via
 * `RUNNER_SET_LOCALS` so this component just reads `runner.locals`
 * from state.
 *
 * Renders nothing when the dict is empty (no active run, or no
 * primitive locals to show), so it stays out of the way in pure
 * FSM mode and between runs.
 */
export default function VariablesDisplay({ locals }) {
  const entries = locals && typeof locals === 'object'
    ? Object.entries(locals)
    : [];
  if (entries.length === 0) return null;
  // Stable ordering: keep insertion order from Python (already the
  // local-variable definition order in the user's frame). Avoids
  // visual reshuffling between steps.
  return (
    <div className="variables-display">
      <div className="variables-title">Variables</div>
      <div className="variables-chips">
        {entries.map(([name, val]) => (
          <span key={name} className="var-chip" title={`${name} = ${val}`}>
            <span className="var-name">{name}</span>
            <span className="var-eq">=</span>
            <span className="var-val">{val}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

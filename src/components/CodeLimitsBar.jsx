import React from 'react';
import {
  countBlocks, countPythonTokens, countFsmStates, countFsmTransitions,
  effectiveBlocksCap, effectivePythonTokensCap,
  effectiveFsmStatesCap, effectiveFsmTransitionsCap,
} from '../utils/codeLimits.js';

// Compute the "extras" the teacher's solution adds beyond the starter,
// per mode. Returns null when nothing meaningful applies to this mode.
function extrasFor(challenge, appMode, fsm, blocksState, pythonCode) {
  if (!challenge) return null;
  const enforced = !!challenge.limits?.enforced;
  if (appMode === 'blocks') {
    const used = Math.max(0, countBlocks(blocksState) - countBlocks(challenge.starter?.blocks));
    const cap  = enforced ? Number(challenge.limits.blocks?.added ?? 0) : null;
    return [{ label: 'extra blocks', used, cap }];
  }
  if (appMode === 'fsm') {
    const usedS = Math.max(0, countFsmStates(fsm)      - countFsmStates(challenge.starter?.fsm));
    const usedT = Math.max(0, countFsmTransitions(fsm) - countFsmTransitions(challenge.starter?.fsm));
    const capS  = enforced ? Number(challenge.limits.fsm?.states      ?? 0) : null;
    const capT  = enforced ? Number(challenge.limits.fsm?.transitions ?? 0) : null;
    return [
      { label: 'extra states',      used: usedS, cap: capS },
      { label: 'extra transitions', used: usedT, cap: capT },
    ];
  }
  if (appMode === 'python') {
    const used = Math.max(0, countPythonTokens(pythonCode) - countPythonTokens(challenge.starter?.python));
    const cap  = enforced ? Number(challenge.limits.python?.tokens ?? 0) : null;
    return [{ label: 'extra tokens', used, cap }];
  }
  return null;
}

/**
 * Teacher-facing extras counter — shown above the right-hand editor
 * when the teacher is editing the solution. Always renders (with or
 * without enforcement) so the teacher can calibrate a sensible limit
 * by seeing how many extras their solution actually uses.
 */
export function SolutionExtrasBar({ challenge, appMode, fsm, blocksState, pythonCode }) {
  const metrics = extrasFor(challenge, appMode, fsm, blocksState, pythonCode);
  if (!metrics) return null;
  return (
    <div className="code-limits-bar solution-extras">
      <span className="clb-label">📐 Solution uses:</span>
      {metrics.map((m, i) => (
        <span key={m.label} className="clb-metric">
          <strong>{m.used}</strong> {m.label}
          {m.cap != null && <> {' '}<span className="cl-hint">(limit: {m.cap})</span></>}
          {i < metrics.length - 1 && '  ·'}
        </span>
      ))}
    </div>
  );
}

/**
 * Live counter shown to the student above the editor when the
 * teacher has set a per-mode limit on the challenge. Tracks
 * usage against the effective cap (starter size + teacher's added
 * limit) and turns amber / red as the budget runs low.
 *
 * Only renders when the active challenge actually has a limit
 * configured for the current app mode. Returns null otherwise so
 * the editor isn't cluttered for unlimited challenges.
 */
export default function CodeLimitsBar({ challenge, appMode, fsm, blocksState, pythonCode }) {
  if (!challenge) return null;
  const metrics = [];
  if (appMode === 'blocks') {
    const cap = effectiveBlocksCap(challenge);
    if (cap != null) metrics.push({ label: 'Blocks', used: countBlocks(blocksState), cap });
  } else if (appMode === 'fsm') {
    const sCap = effectiveFsmStatesCap(challenge);
    if (sCap != null) metrics.push({ label: 'States', used: countFsmStates(fsm), cap: sCap });
    const tCap = effectiveFsmTransitionsCap(challenge);
    if (tCap != null) metrics.push({ label: 'Transitions', used: countFsmTransitions(fsm), cap: tCap });
  } else if (appMode === 'python') {
    const cap = effectivePythonTokensCap(challenge);
    if (cap != null) metrics.push({ label: 'Tokens', used: countPythonTokens(pythonCode), cap });
  }
  if (metrics.length === 0) return null;

  // Overall severity: amber when any metric is within 1 of cap; red
  // when any is at or over cap.
  const worstRemaining = Math.min(...metrics.map(m => m.cap - m.used));
  const severity = worstRemaining <= 0 ? 'maxed'
                  : worstRemaining <= 1 ? 'warn'
                  : '';

  return (
    <div className={`code-limits-bar ${severity}`} role="status">
      <span className="clb-label">🧮 Code limit:</span>
      {metrics.map((m, i) => (
        <span key={m.label} className="clb-metric">
          {m.label}: <strong>{m.used} / {m.cap}</strong>
          {i < metrics.length - 1 && '  ·'}
        </span>
      ))}
      {severity === 'maxed' && (
        <span style={{ marginLeft: 'auto', fontWeight: 600 }}>You're at the limit — try removing something before adding more.</span>
      )}
    </div>
  );
}

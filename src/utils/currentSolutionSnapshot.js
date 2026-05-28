// Build a JSON snapshot of the student's current solution program, by mode.
//
// The snapshot becomes the inner payload that's RSA-OAEP-encrypted and
// stored in the per-row `encryptedSolution` cell. The teacher decrypts
// it later in Analyse and renders it in a read-only editor of the
// matching mode.
//
// Shape:
//   { mode: 'fsm',    fsm:    { states, transitions, startStateId } }
//   { mode: 'blocks', blocks: { blocklyState } }
//   { mode: 'python', python: { code, fontSize } }
//
// PII guard: every snapshot is passed through `sanitiseSolution` before
// it returns, which strips Python comments and Blockly block-comments.
// The student still sees their original comments locally — only the
// submitted copy is sanitised. See `sanitiseSolution.js` for details.

import { sanitiseSolution } from './sanitiseSolution.js';

const SOFT_CAP_CHARS = 10000;   // mirrors the script's 10 KB plaintext cap

export function currentSolutionSnapshot(state) {
  const mode = state.appMode;
  let solution;
  if (mode === 'fsm') {
    solution = { mode, fsm: {
      states:       state.fsm?.states ?? [],
      transitions:  state.fsm?.transitions ?? [],
      startStateId: state.fsm?.startStateId ?? null,
    }};
  } else if (mode === 'blocks') {
    solution = { mode, blocks: { blocklyState: state.blocks?.blocklyState ?? null } };
  } else if (mode === 'python') {
    solution = { mode, python: {
      code:     state.python?.code ?? '',
      fontSize: state.python?.fontSize ?? 14,
    }};
  } else {
    solution = { mode: 'unknown' };
  }
  // Strip comment-style PII before we measure size or return.
  solution = sanitiseSolution(solution);
  // Light-touch length guard — if the solution payload would be too big
  // for the script's 10 KB cap, mark it truncated. The teacher still
  // gets a valid envelope; only the inner program body is replaced.
  const json = JSON.stringify(solution);
  if (json.length > SOFT_CAP_CHARS) {
    return { mode, truncated: true, reason: `Solution exceeded ${SOFT_CAP_CHARS} chars` };
  }
  return solution;
}

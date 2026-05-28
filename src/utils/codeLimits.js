// Per-mode "size" counters used by the optional teacher limits on
// student code. Each function returns 0 for null/empty input.
//
//   countBlocks(blocklyState)      → blocks in the Blockly tree
//   countPythonTokens(code)        → "meaningful" tokens (identifiers,
//                                    literals, operators) — skips
//                                    syntax noise like parens, commas
//                                    and colons
//   countFsmStates(fsm)            → fsm.states.length
//   countFsmTransitions(fsm)       → fsm.transitions.length

// ── Blocks ─────────────────────────────────────────────────────────────

// Walks the Blockly serialisation tree counting every `type`-bearing
// node. Handles both `next.block` chains and nested `inputs[k].block`
// children. Shadow blocks (`inputs[k].shadow`) are placeholders and
// not counted.
export function countBlocks(blocklyState) {
  if (!blocklyState?.blocks?.blocks) return 0;
  let n = 0;
  const walk = (b) => {
    if (!b || typeof b !== 'object') return;
    if (b.type) n += 1;
    if (b.next?.block) walk(b.next.block);
    if (b.inputs) {
      for (const key of Object.keys(b.inputs)) {
        const slot = b.inputs[key];
        if (slot?.block) walk(slot.block);
      }
    }
  };
  for (const root of blocklyState.blocks.blocks) walk(root);
  return n;
}

// ── Python ─────────────────────────────────────────────────────────────

// "Meaningful" Python token counter. Includes identifiers, keywords,
// numbers, string literals (each counted as one token regardless of
// content length), and operators. Skips comments, brackets, parens,
// braces, commas, colons, semicolons, dots, and whitespace.
//
// Example: `def doSomething(a, b, c):` → 5 (def, doSomething, a, b, c).
//          `x = y + 1`                  → 5 (x, =, y, +, 1).
//          `if foo > bar:`              → 4 (if, foo, >, bar).
//
// Implementation notes:
//   - Triple-quoted strings (docstrings) count as 1 token each, even
//     though they may carry many words — the goal is to bound code
//     complexity, not prose.
//   - Line comments are stripped before tokenisation.
//   - Multi-char operators (==, !=, <=, etc.) match before single-char
//     so they count as one token each.
const PY_TOKEN_RE = new RegExp([
  '"""[\\s\\S]*?"""',                    // triple-double string
  "'''[\\s\\S]*?'''",                    // triple-single string
  '"(?:\\\\.|[^"\\\\])*"',                // double-quoted string
  "'(?:\\\\.|[^'\\\\])*'",                // single-quoted string
  '[a-zA-Z_][a-zA-Z_0-9]*',              // identifier / keyword
  '\\d+(?:\\.\\d+)?',                    // number
  '<=|>=|==|!=|<<|>>|\\*\\*|\\/\\/|->',  // multi-char operators
  '[+\\-*/%<>=!&|^~@]',                  // single-char operators
].join('|'), 'g');

export function countPythonTokens(code) {
  if (!code) return 0;
  const stripped = String(code).replace(/#[^\n]*/g, '');
  const tokens = stripped.match(PY_TOKEN_RE);
  return tokens ? tokens.length : 0;
}

// ── FSM ────────────────────────────────────────────────────────────────

export function countFsmStates(fsm) {
  return Array.isArray(fsm?.states) ? fsm.states.length : 0;
}

export function countFsmTransitions(fsm) {
  return Array.isArray(fsm?.transitions) ? fsm.transitions.length : 0;
}

// ── Effective caps (teacher-set limit + starter size) ──────────────────
//
// Limits stored on the challenge are "additional beyond starter". The
// effective cap a student can hit is `count(starter) + limit`. These
// helpers compute the cap for each metric, returning null when there
// is no limit (unlimited).

export function effectiveBlocksCap(challenge) {
  if (!challenge?.limits?.enforced) return null;
  const added = Number(challenge.limits.blocks?.added ?? 0) || 0;
  return countBlocks(challenge.starter?.blocks) + added;
}

export function effectivePythonTokensCap(challenge) {
  if (!challenge?.limits?.enforced) return null;
  const added = Number(challenge.limits.python?.tokens ?? 0) || 0;
  return countPythonTokens(challenge.starter?.python) + added;
}

export function effectiveFsmStatesCap(challenge) {
  if (!challenge?.limits?.enforced) return null;
  const added = Number(challenge.limits.fsm?.states ?? 0) || 0;
  return countFsmStates(challenge.starter?.fsm) + added;
}

export function effectiveFsmTransitionsCap(challenge) {
  if (!challenge?.limits?.enforced) return null;
  const added = Number(challenge.limits.fsm?.transitions ?? 0) || 0;
  return countFsmTransitions(challenge.starter?.fsm) + added;
}

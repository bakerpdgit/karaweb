// Strip teacher-readable comment content from a student solution
// snapshot before it is RSA-OAEP-encrypted for upload.
//
// Why: students may innocently put personal information into code
// comments ("# my name is Tom Smith, Year 10A"). The encrypted blob
// ends up on the teacher's Google Drive sheet, where a later
// keydetails leak would expose that PII. Stripping comments at
// submission time cuts off the most common PII channel without
// preventing the teacher from seeing the actual code.
//
// What we strip:
//   - Python end-of-line `# …` comments (but not `#` inside strings)
//   - Python triple-quoted string CONTENT (`'''…'''` / `"""…"""`).
//     The opening + closing quote markers are kept so the program is
//     still syntactically valid; only the characters between them are
//     dropped. Catches docstrings AND any large multi-line strings
//     that might carry PII. Single-line `'…'` / `"…"` strings are
//     kept intact (they're typically short literals).
//   - Blockly: any `comment` key whose value carries a `text` field
//     (this is the shape Blockly serialisation uses for block comments)
//
// What we DON'T touch:
//   - FSM state machines — no free-text comment surface

// ── Python ─────────────────────────────────────────────────────────────

// Walk the source one character at a time tracking the active quote
// style so a `#` inside a string isn't treated as a comment marker.
// Triple-quoted strings (`'''` / `"""`) are tracked separately from
// single-character strings (`'` / `"`). String escapes (`\"`, `\'`)
// inside single-character strings are handled.
export function stripPythonComments(src) {
  const input = String(src ?? '');
  let out = '';
  let i = 0;
  let inSingle = false;     // currently inside '…' or "…"  (the quote char is `quoteChar`)
  let quoteChar = '';
  let inTriple = false;     // currently inside '''…''' or """…"""  (also tracked via `quoteChar`)
  while (i < input.length) {
    const ch = input[i];
    // Inside a triple-quoted string: skip every character until the
    // matching closer. We keep the opening + closing quote markers
    // (already emitted on entry / about to be emitted now) so the
    // program is still syntactically valid; only the contents go.
    if (inTriple) {
      if (ch === quoteChar && input[i + 1] === quoteChar && input[i + 2] === quoteChar) {
        out += quoteChar + quoteChar + quoteChar;
        i += 3;
        inTriple = false;
        quoteChar = '';
        continue;
      }
      i += 1;
      continue;
    }
    // Inside a single-line string: pass through, handle backslash-escapes.
    if (inSingle) {
      if (ch === '\\' && i + 1 < input.length) {
        out += ch + input[i + 1];
        i += 2;
        continue;
      }
      if (ch === quoteChar) {
        out += ch;
        i += 1;
        inSingle = false;
        quoteChar = '';
        continue;
      }
      // Newlines inside a single-line string would actually be a syntax
      // error in Python; pass through unchanged either way.
      out += ch;
      i += 1;
      continue;
    }
    // Not in a string: detect triple-quote, single-quote, or comment.
    if ((ch === "'" || ch === '"')
        && input[i + 1] === ch && input[i + 2] === ch) {
      out += ch + ch + ch;
      quoteChar = ch;
      inTriple = true;
      i += 3;
      continue;
    }
    if (ch === "'" || ch === '"') {
      out += ch;
      quoteChar = ch;
      inSingle = true;
      i += 1;
      continue;
    }
    if (ch === '#') {
      // Skip everything up to (but not including) the next newline.
      let j = i;
      while (j < input.length && input[j] !== '\n') j += 1;
      // Drop trailing whitespace on the kept line so we don't leave
      // a row of dangling spaces where the comment used to be.
      out = out.replace(/[ \t]+$/, '');
      i = j;        // leave the newline for the next iteration
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

// ── Blockly ────────────────────────────────────────────────────────────

// Recursively drop any `comment` field that looks like a Blockly block
// comment object (`{ text, pinned?, height?, width? }`). Other uses of
// the key `comment` (none expected) are still removed; the cost is
// negligible.
export function stripBlocklyComments(node) {
  if (Array.isArray(node)) {
    return node.map(stripBlocklyComments);
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'comment') continue;
      out[k] = stripBlocklyComments(v);
    }
    return out;
  }
  return node;
}

// ── Top-level entry point ──────────────────────────────────────────────

export function sanitiseSolution(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  if (snapshot.mode === 'python' && snapshot.python?.code) {
    return {
      ...snapshot,
      python: {
        ...snapshot.python,
        code: stripPythonComments(snapshot.python.code),
      },
    };
  }
  if (snapshot.mode === 'blocks' && snapshot.blocks?.blocklyState) {
    return {
      ...snapshot,
      blocks: {
        ...snapshot.blocks,
        blocklyState: stripBlocklyComments(snapshot.blocks.blocklyState),
      },
    };
  }
  return snapshot;
}

// Python generator setup, with hooks that build a line→blockId map alongside
// the emitted code. The map is what lets the PythonRunner highlight the
// correct block when the worker pauses at a given line.

import * as Blockly from 'blockly';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { registerKaraBlocks } from './karaBlocks.js';
import { buildInitBlocklyState } from './initBlocks.js';

let initialised = false;

export function initBlocks() {
  if (initialised) return;
  registerKaraBlocks();
  initialised = true;
}

/**
 * Generate Python from `code` parts, computing a line→blockId map.
 *
 * Approach: monkey-patch pythonGenerator.scrub_ during the generate pass.
 * Each block's scrub_ call wraps that block's own emitted code (before any
 * follow-on chain). We count the newlines in *just that block's own code*
 * (everything before the recursive nextCode), and tag those lines with the
 * block's id.
 */
export function generateWithMap(initWorkspace, userWorkspace) {
  initBlocks();
  const lineToBlockId = [null]; // 1-indexed; lineToBlockId[1] = first line

  // We tag every statement block by appending a TRAILING `# __kb__:ID`
  // comment to the FIRST line of its own emitted code. Trailing comments
  // never confuse Python's parser even at the end of `if`/`while`/`for`/`def`
  // headers (`while X:  # comment` is valid). Crucially this avoids the
  // problem of prepending a comment line that then becomes the un-indented
  // first line when `prefixLines` adds INDENT for nested bodies.
  //
  // Value blocks (those returning [code, prec] arrays) never reach scrub_,
  // so inline expressions are never tagged — which is what we want.

  const MARK = '__kb__';
  const tagRegex = new RegExp(`\\s*#\\s*${MARK}:(\\S+)\\s*$`);
  const origScrub = pythonGenerator.scrub_;
  pythonGenerator.scrub_ = function (block, code, opt_thisOnly) {
    // Only statement blocks (no output connection) should be tagged. Value
    // blocks (kara_tree_front, logic_negate, etc.) flow through scrub_ in
    // Blockly 12 but they emit inline expressions, so adding a comment to
    // them produces broken Python (e.g. `while X # marker:`).
    if (block.outputConnection) {
      return origScrub.call(this, block, code, opt_thisOnly);
    }
    const next = opt_thisOnly ? '' : pythonGenerator.blockToCode(block.getNextBlock());
    const marker = ` # ${MARK}:${block.id}`;
    const nl = code.indexOf('\n');
    let tagged;
    if (nl === -1) {
      tagged = code + marker;
    } else {
      tagged = code.slice(0, nl) + marker + code.slice(nl);
    }
    return tagged + next;
  };

  const initCode = pythonGenerator.workspaceToCode(initWorkspace);
  const userCode = pythonGenerator.workspaceToCode(userWorkspace);

  pythonGenerator.scrub_ = origScrub;

  // Walk the combined code line-by-line. For each line carrying our marker,
  // strip the marker and tag the line with that block id. Lines without a
  // marker (e.g. body continuations) inherit the most recent marker. This
  // lets `elif`/`else`/`pass` lines map to the enclosing block.
  const combined = `${initCode}\n${userCode}`.split('\n');
  const outLines = [];
  let currentBlockId = null;
  for (const ln of combined) {
    const m = ln.match(tagRegex);
    if (m) {
      currentBlockId = m[1];
      outLines.push(ln.slice(0, m.index));
    } else {
      outLines.push(ln);
    }
    lineToBlockId.push(currentBlockId);
  }
  // Trim trailing blank lines (cosmetic).
  while (outLines.length && outLines[outLines.length - 1].trim() === '') {
    outLines.pop();
    lineToBlockId.pop();
  }
  return { code: outLines.join('\n'), lineToBlockId };
}

/**
 * Generate Python from a stored blocklyState + the current world.
 * Spins up headless Blockly workspaces, loads the saved state, generates,
 * disposes. Used by the Run button without needing a DOM reference to the
 * live editor.
 */
export function generateFromState(world, userBlocklyState) {
  initBlocks();
  const initState = buildInitBlocklyState(world);
  const initWs = new Blockly.Workspace();
  const userWs = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(initState, initWs);
    if (userBlocklyState) {
      Blockly.serialization.workspaces.load(userBlocklyState, userWs);
    }
    return generateWithMap(initWs, userWs);
  } finally {
    initWs.dispose();
    userWs.dispose();
  }
}

/**
 * Build the runnable Python program for Python (Monaco) mode: the auto-prepended
 * init lines (`from karaweb import Ladybird` + `kara = Ladybird(x, y, "dir")`)
 * followed by the user's typed code. Returns `{ code, lineToBlockId }` so the
 * PythonRunner can offset error/breakpoint line numbers back to the user's
 * editor coordinate system.
 *
 * lineToBlockId entries for the prelude lines are `null` and for user-code
 * lines are the *user-editor* line number (so the Monaco decoration lands on
 * the right line). This keeps PythonRunner mode-agnostic — it dispatches the
 * line value verbatim.
 */
export function buildPythonProgram(world, userCode) {
  const { x, y, direction } = world.kara;
  const prelude = `from karaweb import Ladybird\nkara = Ladybird(${x}, ${y}, "${direction}")\n`;
  const preludeLines = 2;
  const code = prelude + (userCode ?? '');
  // For Python mode the runner uses `currentLine` directly, but we still
  // return a lineToBlockId-shaped array so PythonRunner can treat it uniformly:
  //   absolute line → user-editor line (or null for prelude).
  const lineToBlockId = [null];
  const total = code.split('\n').length;
  for (let i = 1; i <= total; i++) {
    if (i <= preludeLines) lineToBlockId.push(null);
    else                    lineToBlockId.push(i - preludeLines);
  }
  return { code, lineToBlockId };
}

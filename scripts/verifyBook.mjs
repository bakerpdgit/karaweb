// Verifies a challenge book end-to-end, offline.
//
//   node scripts/verifyBook.mjs dist-content/intro-to-programming-book-2.json
//
// For every challenge it:
//   1. generates Python from the stored Blockly solution (headless Blockly,
//      same generator the app uses),
//   2. hands both that code and the stored Python-mode solution to
//      scripts/simulateBook.py, which replays them against a faithful port
//      of the world model in src/utils.js and checks the checkpoint
//      sequence / target exactly as CH_CHECK_RESULT does,
//   3. checks the solutions fit the challenge's own code limits and only
//      use blocks the challenge allows.
//
// Exit code is non-zero if anything fails, so it doubles as a test.

import * as Blockly from 'blockly';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerKaraBlocks } from '../src/python/blocks/karaBlocks.js';
import { countBlocks, countPythonTokens } from '../src/utils/codeLimits.js';

registerKaraBlocks();

const __dirname = dirname(fileURLToPath(import.meta.url));
const bookPath = process.argv[2] ?? 'dist-content/intro-to-programming-book-2.json';
const book = JSON.parse(readFileSync(bookPath, 'utf8'));

function generate(state) {
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(state, ws);
    return pythonGenerator.workspaceToCode(ws);
  } finally {
    ws.dispose();
  }
}

// Every `type` in a Blockly state tree — used for the disallowed-block check.
function blockTypes(state, out = new Set()) {
  const walk = (b) => {
    if (!b || typeof b !== 'object') return;
    if (b.type) out.add(b.type);
    if (b.next?.block) walk(b.next.block);
    if (b.inputs) for (const k of Object.keys(b.inputs)) { walk(b.inputs[k].block); }
  };
  for (const root of state?.blocks?.blocks ?? []) walk(root);
  return out;
}

const problems = [];
const cases = [];
const sizes = [];

for (const ch of book.challenges) {
  const modes = Array.isArray(ch.allowedModes) && ch.allowedModes.length
    ? ch.allowedModes
    : ['fsm', 'blocks', 'python'];

  // ── Blocks solution ──────────────────────────────────────────────
  let blocksCode = null;
  if (modes.includes('blocks')) {
    if (!ch.solution?.blocks) {
      problems.push(`${ch.name}: no blocks solution`);
    } else {
      try {
        blocksCode = generate(ch.solution.blocks);
      } catch (e) {
        problems.push(`${ch.name}: blocks solution failed to generate — ${e.message}`);
      }
      const used = blockTypes(ch.solution.blocks);
      for (const banned of ch.disallowedBlocks ?? []) {
        if (used.has(banned)) problems.push(`${ch.name}: blocks solution uses disallowed block ${banned}`);
      }
      if (ch.limits?.enforced) {
        const cap = countBlocks(ch.starter?.blocks) + (ch.limits.blocks?.added ?? 0);
        const n = countBlocks(ch.solution.blocks);
        if (n > cap) problems.push(`${ch.name}: blocks solution is ${n} blocks, cap is ${cap}`);
      }
      // The starter must itself be loadable (it is what the student gets).
      if (ch.starter?.blocks) {
        try { generate(ch.starter.blocks); }
        catch (e) { problems.push(`${ch.name}: blocks STARTER failed to generate — ${e.message}`); }
      }
    }
  }

  // ── Python solution ──────────────────────────────────────────────
  let pythonCode = null;
  if (modes.includes('python')) {
    const py = ch.solution?.python ?? '';
    if (!py.trim()) {
      problems.push(`${ch.name}: no python solution`);
    } else {
      pythonCode = py;
      if (ch.limits?.enforced) {
        const cap = countPythonTokens(ch.starter?.python) + (ch.limits.python?.tokens ?? 0);
        const n = countPythonTokens(py);
        if (n > cap) problems.push(`${ch.name}: python solution is ${n} tokens, cap is ${cap}`);
      }
    }
  }

  // The starter is what the student is handed: it must run (or be empty)
  // but must NOT already solve the challenge.
  let starterBlocksCode = null;
  if (ch.starter?.blocks) {
    try { starterBlocksCode = generate(ch.starter.blocks); } catch { /* reported above */ }
  }

  cases.push({
    name: ch.name,
    id: ch.id,
    fixedEdges: !!ch.fixedWorldEdges,
    ignoreOrientation: !!ch.ignoreOrientation,
    endOnTargetNotRequired: !!ch.endOnTargetNotRequired,
    noCheckTarget: !!ch.noCheckTarget,
    checkpoints: [ch.initialWorld, ...(ch.intermediateCheckpoints ?? []), ch.targetWorld],
    programs: { blocks: blocksCode, python: pythonCode },
    starters: { blocks: starterBlocksCode, python: ch.starter?.python || null },
  });

  // Report the size of each solution against its cap, so the margin is
  // visible when tuning a challenge.
  if (ch.limits?.enforced) {
    const bCap = countBlocks(ch.starter?.blocks) + (ch.limits.blocks?.added ?? 0);
    const pCap = countPythonTokens(ch.starter?.python) + (ch.limits.python?.tokens ?? 0);
    sizes.push(`  ${ch.name.padEnd(32)} blocks ${String(countBlocks(ch.solution?.blocks)).padStart(3)}/${String(bCap).padEnd(3)}`
      + `   python ${String(countPythonTokens(ch.solution?.python)).padStart(3)}/${pCap}`);
  }
}

mkdirSync(join(__dirname, 'tmp'), { recursive: true });
const payloadPath = join(__dirname, 'tmp', 'verify-payload.json');
writeFileSync(payloadPath, JSON.stringify({ cases }, null, 1));

// Dump the generated Blocks-mode Python too — handy when a case fails and
// you want to see what the blocks actually say.
writeFileSync(
  join(__dirname, 'tmp', 'blocks-python.txt'),
  cases.map(c => `### ${c.name}\n${c.programs.blocks ?? '(none)'}\n`).join('\n'),
);

let simOut = '';
let simFailed = false;
try {
  simOut = execFileSync('python', [join(__dirname, 'simulateBook.py'), payloadPath], {
    encoding: 'utf8',
  });
} catch (e) {
  simOut = (e.stdout ?? '') + (e.stderr ?? '');
  simFailed = true;
}
process.stdout.write(simOut);

console.log('\nSolution size vs cap (limit = starter + allowance):');
for (const line of sizes) console.log(line);

if (problems.length) {
  console.log('\nStatic checks:');
  for (const p of problems) console.log('  ✗ ' + p);
} else {
  console.log('\nStatic checks: ok (limits, disallowed blocks, solutions present)');
}

process.exit(problems.length || simFailed ? 1 : 0);

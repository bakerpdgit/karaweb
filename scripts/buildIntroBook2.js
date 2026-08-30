// Builds dist-content/intro-to-programming-book-2.json — a 20-challenge
// "Intro to Programming, Book 2: Lists & Functions" karaweb book.
//
// Run with: node scripts/buildIntroBook2.js
// Verify with: node scripts/verifyBook.mjs dist-content/intro-to-programming-book-2.json
//
// The script is pure and re-runnable: stable ids, stable savedAt. Every
// challenge carries BOTH a Blocks and a Python reference solution, hidden
// from students (solutionAvailableToStudents: false) but visible to a
// teacher who opens the book in the challenge editor.
//
// Design notes
//   - FSM is switched off per challenge (allowedModes) — states and
//     transitions have nothing to say about lists or functions.
//   - Code limits are set so the intended shape (a function, a list loop)
//     fits comfortably while the brute-force alternative does not.
//   - Sensors are removed from the toolbox on the "work from the data"
//     challenges, so the plan has to come from the list rather than from
//     looking around.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── World helpers ──────────────────────────────────────────────────────────

function makeWorld(width, height, karaX, karaY, karaDir, trees = [], mushrooms = [], leaves = []) {
  const cells = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ hasLeaf: false, object: null }))
  );
  for (const [x, y] of trees)     cells[y][x] = { hasLeaf: false, object: 'tree' };
  for (const [x, y] of mushrooms) cells[y][x] = { hasLeaf: false, object: 'mushroom' };
  for (const [x, y] of leaves)    cells[y][x].hasLeaf = true;
  return { width, height, cells, kara: { x: karaX, y: karaY, direction: karaDir } };
}

function clone(w) { return JSON.parse(JSON.stringify(w)); }

function at(w, x, y, dir = w.kara.direction) {
  const out = clone(w);
  out.kara = { x, y, direction: dir };
  return out;
}
function addLeaves(w, cells) {
  const out = clone(w);
  for (const [x, y] of cells) out.cells[y][x].hasLeaf = true;
  return out;
}
function clearLeaves(w, cells) {
  const out = clone(w);
  for (const [x, y] of cells) out.cells[y][x].hasLeaf = false;
  return out;
}
function noLeaves(w) {
  const out = clone(w);
  for (const row of out.cells) for (const c of row) c.hasLeaf = false;
  return out;
}

// ── Blockly builders ───────────────────────────────────────────────────────
// These emit the JSON shape produced by Blockly.serialization.workspaces.save.
// Ids are generated per challenge (resetIds) so re-runs are byte-identical.

let _idCounter = 0;
function id(prefix) { _idCounter += 1; return `${prefix}_${_idCounter}`; }
function resetIds() { _idCounter = 0; }

// Kara actions / sensors
const move       = () => ({ type: 'kara_move',        id: id('mv') });
const turnLeft   = () => ({ type: 'kara_turn_left',   id: id('tl') });
const turnRight  = () => ({ type: 'kara_turn_right',  id: id('tr') });
const putLeaf    = () => ({ type: 'kara_put_leaf',    id: id('pl') });
const removeLeaf = () => ({ type: 'kara_remove_leaf', id: id('rl') });

const treeFront     = () => ({ type: 'kara_tree_front',     id: id('tf') });
const treeLeft      = () => ({ type: 'kara_tree_left',      id: id('tlb') });
const treeRight     = () => ({ type: 'kara_tree_right',     id: id('trb') });
const mushroomFront = () => ({ type: 'kara_mushroom_front', id: id('mf') });
const onLeaf        = () => ({ type: 'kara_on_leaf',        id: id('ol') });

// Literals
const num  = (n) => ({ type: 'math_number', id: id('n'), fields: { NUM: n } });
const str  = (s) => ({ type: 'text',        id: id('s'), fields: { TEXT: String(s) } });
const bool = (b) => ({ type: 'logic_boolean', id: id('b'), fields: { BOOL: b ? 'TRUE' : 'FALSE' } });

// Logic / maths
const notExpr = (e)    => ({ type: 'logic_negate', id: id('not'), inputs: { BOOL: { block: e } } });
const andExpr = (a, b) => ({ type: 'logic_operation', id: id('and'), fields: { OP: 'AND' }, inputs: { A: { block: a }, B: { block: b } } });
const orExpr  = (a, b) => ({ type: 'logic_operation', id: id('or'),  fields: { OP: 'OR'  }, inputs: { A: { block: a }, B: { block: b } } });
const cmp = (op, a, b) => ({ type: 'logic_compare', id: id('cmp'), fields: { OP: op }, inputs: { A: { block: a }, B: { block: b } } });
const arith = (op, a, b) => ({
  type: 'math_arithmetic', id: id('ar'), fields: { OP: op },
  inputs: {
    A: { shadow: { type: 'math_number', fields: { NUM: 0 } }, block: a },
    B: { shadow: { type: 'math_number', fields: { NUM: 0 } }, block: b },
  },
});
const add = (a, b) => arith('ADD', a, b);
const sub = (a, b) => arith('MINUS', a, b);

// Variables
const get = (name) => ({ type: 'variables_get', id: id('vg'), fields: { VAR: { id: `var_${name}`, name } } });
const set = (name, value) => ({
  type: 'variables_set', id: id('vs'),
  fields: { VAR: { id: `var_${name}`, name } },
  inputs: { VALUE: { block: value } },
});

// Loops
function forRange(varName, from, to, body) {
  // `from` / `to` accept a plain number (rendered as the block's shadow
  // value) or an expression block plugged into the socket.
  const slot = (v) => typeof v === 'number'
    ? { shadow: { type: 'math_number', fields: { NUM: v } } }
    : { shadow: { type: 'math_number', fields: { NUM: 1 } }, block: v };
  return {
    type: 'controls_for', id: id('for'),
    fields: { VAR: { id: `var_${varName}`, name: varName } },
    inputs: {
      FROM: slot(from),
      TO:   slot(to),
      BY:   { shadow: { type: 'math_number', fields: { NUM: 1 } } },
      DO:   { block: body },
    },
  };
}
const whileBlock = (cond, body) => ({
  type: 'controls_whileUntil', id: id('w'),
  fields: { MODE: 'WHILE' },
  inputs: { BOOL: { block: cond }, DO: { block: body } },
});
const ifBlock = (cond, thenBody) => ({
  type: 'controls_if', id: id('if'),
  inputs: { IF0: { block: cond }, DO0: { block: thenBody } },
});
const ifElseBlock = (cond, thenBody, elseBody) => ({
  type: 'controls_if', id: id('ife'),
  extraState: { hasElse: true },
  inputs: { IF0: { block: cond }, DO0: { block: thenBody }, ELSE: { block: elseBody } },
});

// Lists
const list = (items) => ({
  type: 'lists_create_with', id: id('lc'),
  extraState: { itemCount: items.length },
  inputs: Object.fromEntries(items.map((it, i) => [`ADD${i}`, { block: it }])),
});
const listLen = (l) => ({ type: 'lists_length', id: id('ll'), inputs: { VALUE: { block: l } } });
const listGet = (l, index) => ({
  type: 'lists_getIndex', id: id('lg'),
  fields: { MODE: 'GET', WHERE: 'FROM_START' },
  inputs: { VALUE: { block: l }, AT: { block: index } },
});
const listSet = (l, index, value) => ({
  type: 'lists_setIndex', id: id('ls'),
  fields: { MODE: 'SET', WHERE: 'FROM_START' },
  inputs: { LIST: { block: l }, AT: { block: index }, TO: { block: value } },
});
const listAppend = (l, value) => ({
  type: 'lists_setIndex', id: id('la'),
  fields: { MODE: 'INSERT', WHERE: 'LAST' },
  inputs: { LIST: { block: l }, TO: { block: value } },
});

// Functions
const defProc = (name, params, body) => ({
  type: 'procedures_defnoreturn', id: id('def'),
  fields: { NAME: name },
  extraState: { params: params.map(p => ({ name: p, id: `var_${p}` })) },
  ...(body ? { inputs: { STACK: { block: body } } } : {}),
});
const callProc = (name, args = []) => ({
  type: 'procedures_callnoreturn', id: id('call'),
  extraState: { name, params: args.map((_, i) => `p${i}`) },
  inputs: Object.fromEntries(args.map((a, i) => [`ARG${i}`, { block: a }])),
});
const defReturn = (name, params, body, returnExpr) => ({
  type: 'procedures_defreturn', id: id('defr'),
  fields: { NAME: name },
  extraState: { params: params.map(p => ({ name: p, id: `var_${p}` })) },
  inputs: {
    ...(body ? { STACK: { block: body } } : {}),
    ...(returnExpr ? { RETURN: { block: returnExpr } } : {}),
  },
});
const callReturn = (name, args = []) => ({
  type: 'procedures_callreturn', id: id('callr'),
  extraState: { name, params: args.map((_, i) => `p${i}`) },
  inputs: Object.fromEntries(args.map((a, i) => [`ARG${i}`, { block: a }])),
});

// Chain statement blocks into a `next` sequence; returns the head.
function seq(...stmts) {
  const flat = stmts.flat().filter(Boolean);
  if (flat.length === 0) return null;
  for (let i = 1; i < flat.length; i++) flat[i - 1].next = { block: flat[i] };
  return flat[0];
}

// Wrap top-level roots (function definitions + the main stack) into a
// workspace envelope. Definitions are stacked down the left; the main
// program sits to their right so nothing overlaps when it opens.
function ws(...roots) {
  const flat = roots.flat().filter(Boolean);
  if (flat.length === 0) return null;
  const defs = flat.filter(b => b.type?.startsWith('procedures_def'));
  const main = flat.filter(b => !b.type?.startsWith('procedures_def'));
  let y = 20;
  for (const d of defs) { d.x = 20; d.y = y; y += 200; }
  let my = 20;
  for (const m of main) { m.x = defs.length ? 360 : 20; m.y = my; my += 260; }
  return { blocks: { languageVersion: 0, blocks: flat } };
}

// ── Challenge factory ──────────────────────────────────────────────────────

function mkChallenge({
  n, name, notes,
  world, target, intermediates = [],
  blocks, python,
  starterBlocks = null, starterPython = '',
  blocksAdded = 0, pythonTokens = 0, enforceLimits = true,
  disallowedBlocks = [],
  fixedWorldEdges = true,
  ignoreOrientation = true,
  endOnTargetNotRequired = false,
}) {
  const guid = `intro2-ch${String(n).padStart(2, '0')}-0000-0000-0000-000000000000`;
  return {
    id: guid,
    guid,
    name,
    mode: 'blocks',
    notes,
    allowModeChange: true,
    // Lists and functions are a Blocks/Python topic — FSM is hidden.
    allowedModes: ['blocks', 'python'],
    initialWorld: world,
    targetWorld: target,
    intermediateCheckpoints: intermediates,
    starter:  { fsm: null, blocks: starterBlocks, python: starterPython },
    solution: { fsm: null, blocks, python },
    // Hidden from students; a teacher opening the book in the challenge
    // editor can still read and run it.
    solutionAvailableToStudents: false,
    limits: {
      enforced: enforceLimits,
      blocks: { added: blocksAdded },
      fsm:    { states: 0, transitions: 0 },
      python: { tokens: pythonTokens },
    },
    noCheckTarget: false,
    ignoreOrientation,
    endOnTargetNotRequired,
    disallowedBlocks,
    fixedWorldEdges,
  };
}

const SENSOR_BLOCKS = [
  'kara_tree_front', 'kara_tree_left', 'kara_tree_right',
  'kara_mushroom_front', 'kara_on_leaf',
];

const challenges = [];

// ═══════════════════════════════════════════════════════════════════════════
// Section A — Functions (1–7)
// ═══════════════════════════════════════════════════════════════════════════

// 1. A function to call — the definition is given; write the calls.
{
  resetIds();
  const w = makeWorld(11, 3, 0, 1, 'right');
  const t = at(addLeaves(w, [[1, 1], [2, 1], [4, 1], [5, 1], [8, 1], [9, 1]]), 9, 1);
  const bedBody = () => seq(putLeaf(), move(), putLeaf());
  challenges.push(mkChallenge({
    n: 1,
    name: '1. A function to call',
    world: w, target: t,
    notes:
`# A function to call

A function is a name for a group of instructions. **bed** is already written for you: it plants a leaf, steps forward, and plants another.

Walk Kara to each of the three beds and **call bed** at the start of each one. The beds are not evenly spaced, so count the steps between them.

## Concepts
- Calling a function runs its instructions, then carries on where it left off.
- Writing the steps once and calling them three times is shorter — and easier to fix — than writing them out three times.`,
    starterBlocks: ws(defProc('bed', [], bedBody())),
    starterPython:
`def bed():
    kara.put_leaf()
    kara.move()
    kara.put_leaf()

`,
    blocks: ws(
      defProc('bed', [], bedBody()),
      seq(move(), callProc('bed'), move(), move(), callProc('bed'), move(), move(), move(), callProc('bed')),
    ),
    python:
`def bed():
    kara.put_leaf()
    kara.move()
    kara.put_leaf()

kara.move()
bed()
kara.move()
kara.move()
bed()
kara.move()
kara.move()
kara.move()
bed()
`,
    blocksAdded: 10,
    pythonTokens: 18,
  }));
}

// 2. Write your own function — same shape at three unevenly spaced spots.
{
  resetIds();
  const w = makeWorld(9, 3, 0, 1, 'right');
  const t = at(addLeaves(w, [[1, 0], [3, 0], [7, 0]]), 7, 1);
  const flagBody = () => seq(turnLeft(), move(), putLeaf(), turnLeft(), turnLeft(), move(), turnLeft());
  challenges.push(mkChallenge({
    n: 2,
    name: '2. Write your own function',
    world: w, target: t,
    notes:
`# Write your own function

Kara plants a **flag** like this: turn to face up, step forward, drop a leaf, turn around, step back, and face right again.

She must plant a flag above columns **1, 3 and 7**. Write that seven-step shape **once** as a function, then call it three times.

## Concepts
- A function turns a shape you use again and again into a single named instruction.
- Writing the shape out three times would not fit inside this challenge's block limit.`,
    blocks: ws(
      defProc('flag', [], flagBody()),
      seq(
        move(), callProc('flag'),
        move(), move(), callProc('flag'),
        move(), move(), move(), move(), callProc('flag'),
      ),
    ),
    python:
`def flag():
    kara.turn_left()
    kara.move()
    kara.put_leaf()
    kara.turn_left()
    kara.turn_left()
    kara.move()
    kara.turn_left()

kara.move()
flag()
kara.move()
kara.move()
flag()
kara.move()
kara.move()
kara.move()
kara.move()
flag()
`,
    blocksAdded: 20,
    pythonTokens: 42,
  }));
}

// 3. A function in a loop — definition given, student adds the loop.
{
  resetIds();
  const w = makeWorld(13, 3, 0, 1, 'right');
  const t = at(addLeaves(w, [[3, 0], [6, 0], [9, 0], [12, 0]]), 12, 1);
  const flagBody = () => seq(turnLeft(), move(), putLeaf(), turnLeft(), turnLeft(), move(), turnLeft());
  challenges.push(mkChallenge({
    n: 3,
    name: '3. A function in a loop',
    world: w, target: t,
    notes:
`# A function in a loop

The **flag** function is written for you again. This time the flags are evenly spaced: three steps apart, four of them.

Put the call **inside a loop** so the whole job is a handful of blocks.

## Concepts
- Loops and functions work together: the loop says *how many times*, the function says *what to do*.
- Kara starts three columns before the first flag, so each turn of the loop is "three steps, then a flag".`,
    starterBlocks: ws(defProc('flag', [], flagBody())),
    starterPython:
`def flag():
    kara.turn_left()
    kara.move()
    kara.put_leaf()
    kara.turn_left()
    kara.turn_left()
    kara.move()
    kara.turn_left()

`,
    blocks: ws(
      defProc('flag', [], flagBody()),
      forRange('i', 1, 4, seq(move(), move(), move(), callProc('flag'))),
    ),
    python:
`def flag():
    kara.turn_left()
    kara.move()
    kara.put_leaf()
    kara.turn_left()
    kara.turn_left()
    kara.move()
    kara.turn_left()

for i in range(4):
    kara.move()
    kara.move()
    kara.move()
    flag()
`,
    blocksAdded: 7,
    pythonTokens: 15,
  }));
}

// 4. Call it twice — the same function used above and below each column.
{
  resetIds();
  const w = makeWorld(10, 3, 0, 1, 'right');
  const t = at(addLeaves(w, [[3, 0], [3, 2], [6, 0], [6, 2], [9, 0], [9, 2]]), 9, 1);
  const flagBody = () => seq(turnLeft(), move(), putLeaf(), turnLeft(), turnLeft(), move(), turnLeft());
  challenges.push(mkChallenge({
    n: 4,
    name: '4. Call it twice',
    world: w, target: t,
    notes:
`# Call it twice

Same **flag** shape as before — but now every third column needs a leaf **above and below** it.

The trick: \`flag\` plants to Kara's left. Turn her around between the two calls and the same function plants on the other side.

## Concepts
- One function can be useful in more than one place. Turning Kara first changes what it does.
- Write \`flag\` once, call it six times.`,
    blocks: ws(
      defProc('flag', [], flagBody()),
      forRange('i', 1, 3, seq(
        move(), move(), move(),
        callProc('flag'),
        turnLeft(), turnLeft(),
        callProc('flag'),
        turnLeft(), turnLeft(),
      )),
    ),
    python:
`def flag():
    kara.turn_left()
    kara.move()
    kara.put_leaf()
    kara.turn_left()
    kara.turn_left()
    kara.move()
    kara.turn_left()

for i in range(3):
    kara.move()
    kara.move()
    kara.move()
    flag()
    kara.turn_left()
    kara.turn_left()
    flag()
    kara.turn_left()
    kara.turn_left()
`,
    blocksAdded: 21,
    pythonTokens: 45,
  }));
}

// 5. A function with a parameter — header + calls given, body missing.
{
  resetIds();
  const w = makeWorld(14, 3, 0, 1, 'right');
  const t = at(addLeaves(w, [[4, 1], [6, 1], [11, 1]]), 11, 1);
  challenges.push(mkChallenge({
    n: 5,
    name: '5. A function with a parameter',
    world: w, target: t,
    notes:
`# A function with a parameter

\`walk\` is called three times with a different number each time: **4**, then **2**, then **5**. That number arrives inside the function as **n**.

The calls are written for you. Fill in the body so \`walk(n)\` moves Kara forward **n** steps.

## Concepts
- A parameter is a value the caller hands to the function — one function, many jobs.
- Inside the function, \`n\` behaves like a variable holding whatever the caller passed in.`,
    starterBlocks: ws(
      defProc('walk', ['n'], null),
      seq(
        callProc('walk', [num(4)]), putLeaf(),
        callProc('walk', [num(2)]), putLeaf(),
        callProc('walk', [num(5)]), putLeaf(),
      ),
    ),
    starterPython:
`def walk(n):
    pass

walk(4)
kara.put_leaf()
walk(2)
kara.put_leaf()
walk(5)
kara.put_leaf()
`,
    blocks: ws(
      defProc('walk', ['n'], forRange('k', 1, get('n'), move())),
      seq(
        callProc('walk', [num(4)]), putLeaf(),
        callProc('walk', [num(2)]), putLeaf(),
        callProc('walk', [num(5)]), putLeaf(),
      ),
    ),
    python:
`def walk(n):
    for k in range(n):
        kara.move()

walk(4)
kara.put_leaf()
walk(2)
kara.put_leaf()
walk(5)
kara.put_leaf()
`,
    blocksAdded: 6,
    pythonTokens: 12,
  }));
}

// 6. Choose the size — student writes a parameterised planting function.
{
  resetIds();
  const w = makeWorld(15, 3, 0, 1, 'right');
  const t = at(addLeaves(w, [
    [0, 1], [1, 1], [2, 1],                 // bed of 3
    [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], // bed of 5
    [12, 1], [13, 1],                       // bed of 2
  ]), 14, 1);
  const bedBody = () => forRange('k', 1, get('n'), seq(putLeaf(), move()));
  challenges.push(mkChallenge({
    n: 6,
    name: '6. Choose the size',
    world: w, target: t,
    notes:
`# Choose the size

Three flower beds, three different lengths: **3**, **5** and **2** leaves, with two empty squares between them.

Write **one** function \`bed(n)\` that plants a row of *n* leaves, walking forward as it goes. Then call it three times with the right sizes.

## Concepts
- The parameter decides how many times the loop inside the function runs.
- \`bed\` leaves Kara on the square just past the last leaf — plan your gaps around that.`,
    blocks: ws(
      defProc('bed', ['n'], bedBody()),
      seq(
        callProc('bed', [num(3)]), move(), move(),
        callProc('bed', [num(5)]), move(), move(),
        callProc('bed', [num(2)]),
      ),
    ),
    python:
`def bed(n):
    for k in range(n):
        kara.put_leaf()
        kara.move()

bed(3)
kara.move()
kara.move()
bed(5)
kara.move()
kara.move()
bed(2)
`,
    blocksAdded: 17,
    pythonTokens: 31,
  }));
}

// 7. A function that answers — a boolean-returning helper in a while test.
{
  resetIds();
  const trees = [[6, 1], [11, 1]];
  const mush  = [[3, 1]];
  const w = makeWorld(13, 3, 0, 1, 'right', trees, mush);
  // Kara stops in front of the mushroom (x=2), plants, then must get past:
  // she goes round it via the row below and stops in front of the tree at 6.
  const t = at(addLeaves(w, [[2, 1], [5, 1]]), 5, 1);
  const midway = at(addLeaves(w, [[2, 1]]), 2, 1);
  const blockedExpr = () => orExpr(treeFront(), mushroomFront());
  challenges.push(mkChallenge({
    n: 7,
    name: '7. A function that answers',
    world: w, target: t,
    notes:
`# A function that answers

Some functions hand a value **back** to whoever called them. Write \`blocked\` — it takes no steps and returns **true** when a tree *or* a mushroom is directly in front of Kara.

Then use it twice: walk until blocked and plant a leaf, go around the obstacle along the row below, and walk until blocked again and plant a second leaf.

## Concepts
- A function with a **return** value can be used anywhere a value fits — including a \`while\` condition.
- \`while not blocked()\` reads almost like English, which is the point.`,
    blocks: ws(
      defReturn('blocked', [], null, blockedExpr()),
      seq(
        whileBlock(notExpr(callReturn('blocked')), move()),
        putLeaf(),
        turnRight(), move(), turnLeft(),
        move(), move(),
        turnLeft(), move(), turnRight(),
        whileBlock(notExpr(callReturn('blocked')), move()),
        putLeaf(),
      ),
    ),
    python:
`def blocked():
    return kara.tree_front() or kara.mushroom_front()

while not blocked():
    kara.move()
kara.put_leaf()
kara.turn_right()
kara.move()
kara.turn_left()
kara.move()
kara.move()
kara.turn_left()
kara.move()
kara.turn_right()
while not blocked():
    kara.move()
kara.put_leaf()
`,
    intermediates: [midway],
    blocksAdded: 24,
    pythonTokens: 50,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Section B — Lists (8–14)
// ═══════════════════════════════════════════════════════════════════════════

// 8. Item by item — reading a short list by index.
{
  resetIds();
  const w = makeWorld(12, 3, 0, 1, 'right');
  const t = at(addLeaves(w, [[4, 1], [6, 1], [11, 1]]), 11, 1);
  const stepsList = () => set('steps', list([num(4), num(2), num(5)]));
  const legFor = (i) => forRange('k', 1, listGet(get('steps'), num(i)), move());
  challenges.push(mkChallenge({
    n: 8,
    name: '8. Item by item',
    world: w, target: t,
    notes:
`# Item by item

A **list** holds several values under one name. \`steps\` is written for you: it says how far to walk before each of the three leaves.

Take the items **one at a time** — walk \`steps\` item 1, plant, then item 2, plant, then item 3, plant.

## Concepts
- In Blocks, list items are numbered from **1**. In Python they are numbered from **0**, so \`steps[0]\` is the first one.
- Kara's sensors are switched off here: the plan comes from the list, not from looking around.`,
    starterBlocks: ws(stepsList()),
    starterPython: `steps = [4, 2, 5]\n\n`,
    blocks: ws(seq(
      stepsList(),
      legFor(1), putLeaf(),
      legFor(2), putLeaf(),
      legFor(3), putLeaf(),
    )),
    python:
`steps = [4, 2, 5]

for k in range(steps[0]):
    kara.move()
kara.put_leaf()
for k in range(steps[1]):
    kara.move()
kara.put_leaf()
for k in range(steps[2]):
    kara.move()
kara.put_leaf()
`,
    blocksAdded: 20,
    pythonTokens: 36,
    disallowedBlocks: SENSOR_BLOCKS,
  }));
}

// 9. Walk the whole list — one loop over every item.
{
  resetIds();
  const gaps = [3, 1, 4, 2, 2, 3, 1];
  let gx = 0;
  const stops = gaps.map(g => { gx += g; return [gx, 1]; });
  const w = makeWorld(17, 3, 0, 1, 'right');
  const t = at(addLeaves(w, stops), 16, 1);
  const gapsList = () => set('gaps', list(gaps.map(g => num(g))));
  challenges.push(mkChallenge({
    n: 9,
    name: '9. Walk the whole list',
    world: w, target: t,
    notes:
`# Walk the whole list

Seven gaps this time — writing them out one at a time would take all day.

Loop over the list instead: for every item, walk that many steps and plant a leaf. The loop runs **length of gaps** times, and each turn uses item number \`i\`.

## Concepts
- A loop plus a list handles any number of items without changing the code.
- Python can walk a list directly: \`for gap in gaps:\` hands you each value in turn.`,
    starterBlocks: ws(gapsList()),
    starterPython: `gaps = [3, 1, 4, 2, 2, 3, 1]\n\n`,
    blocks: ws(seq(
      gapsList(),
      forRange('i', 1, listLen(get('gaps')), seq(
        forRange('k', 1, listGet(get('gaps'), get('i')), move()),
        putLeaf(),
      )),
    )),
    python:
`gaps = [3, 1, 4, 2, 2, 3, 1]

for gap in gaps:
    for k in range(gap):
        kara.move()
    kara.put_leaf()
`,
    blocksAdded: 11,
    pythonTokens: 20,
    disallowedBlocks: SENSOR_BLOCKS,
  }));
}

// 10. Left or right — a list of words steering the route.
{
  resetIds();
  const w = makeWorld(6, 6, 1, 1, 'right');
  const t = at(addLeaves(w, [[1, 3], [3, 3], [3, 1], [5, 1]]), 5, 1);
  const turnsList = () => set('turns', list([str('R'), str('L'), str('L'), str('R')]));
  challenges.push(mkChallenge({
    n: 10,
    name: '10. Left or right',
    world: w, target: t,
    notes:
`# Left or right

A list can hold words as well as numbers. \`turns\` is the route: **R**, **L**, **L**, **R**.

For each item: turn that way, take **two** steps, and plant a leaf.

## Concepts
- Compare a list item with a piece of text to decide what to do: \`turns[i] = "R"\`.
- An **if / else** inside the loop gives every item its own decision.`,
    starterBlocks: ws(turnsList()),
    starterPython: `turns = ["R", "L", "L", "R"]\n\n`,
    blocks: ws(seq(
      turnsList(),
      forRange('i', 1, listLen(get('turns')), seq(
        ifElseBlock(
          cmp('EQ', listGet(get('turns'), get('i')), str('R')),
          turnRight(),
          turnLeft(),
        ),
        move(), move(),
        putLeaf(),
      )),
    )),
    python:
`turns = ["R", "L", "L", "R"]

for turn in turns:
    if turn == "R":
        kara.turn_right()
    else:
        kara.turn_left()
    kara.move()
    kara.move()
    kara.put_leaf()
`,
    blocksAdded: 18,
    pythonTokens: 28,
    disallowedBlocks: SENSOR_BLOCKS,
  }));
}

// 11. Remember the row — build a list with "add item", then use it.
{
  resetIds();
  const w = makeWorld(7, 3, 0, 1, 'right', [], [], [[0, 1], [2, 1], [3, 1], [5, 1]]);
  const t = at(addLeaves(w, [[0, 0], [2, 0], [3, 0], [5, 0]]), 6, 0);
  challenges.push(mkChallenge({
    n: 11,
    name: '11. Remember the row',
    world: w, target: t,
    notes:
`# Remember the row

The middle row has a pattern of leaves in the six squares starting under Kara. Copy that pattern onto the row above, leaving the originals where they are.

Walk the six squares, **adding** what you find (\`on leaf?\`) to a list that starts empty. Then return to the start, step up a row, and walk it again planting wherever the list says *true*.

## Concepts
- \`add item to list\` grows a list while the program runs.
- The list is Kara's memory: the second pass reads item 1, item 2, … in the order she recorded them.`,
    blocks: ws(seq(
      set('rec', list([])),
      forRange('i', 1, 6, seq(listAppend(get('rec'), onLeaf()), move())),
      turnLeft(), turnLeft(),
      forRange('k', 1, 6, move()),
      turnRight(), move(), turnRight(),
      forRange('i', 1, 6, seq(
        ifBlock(cmp('EQ', listGet(get('rec'), get('i')), bool(true)), putLeaf()),
        move(),
      )),
    )),
    python:
`rec = []
for i in range(6):
    rec.append(kara.on_leaf())
    kara.move()

kara.turn_left()
kara.turn_left()
for k in range(6):
    kara.move()
kara.turn_right()
kara.move()
kara.turn_right()

for i in range(6):
    if rec[i]:
        kara.put_leaf()
    kara.move()
`,
    blocksAdded: 26,
    pythonTokens: 50,
  }));
}

// 12. The biggest number — scan a list for its maximum.
{
  resetIds();
  const w = makeWorld(7, 3, 0, 1, 'right');
  const t = at(addLeaves(w, [[5, 1]]), 5, 1);
  const heightsList = () => set('heights', list([num(2), num(5), num(3), num(1), num(4)]));
  challenges.push(mkChallenge({
    n: 12,
    name: '12. The biggest number',
    world: w, target: t,
    notes:
`# The biggest number

\`heights\` holds five numbers. Kara must walk forward as far as the **biggest** one and plant a leaf there.

Keep a variable — call it \`best\` — starting at 0. Look at every item in turn, and whenever an item beats \`best\`, store that item instead.

## Concepts
- Finding the largest value means remembering the best one **so far** while you scan.
- The comparison belongs inside the loop; the walk happens after it.`,
    starterBlocks: ws(heightsList()),
    starterPython: `heights = [2, 5, 3, 1, 4]\n\n`,
    blocks: ws(seq(
      heightsList(),
      set('best', num(0)),
      forRange('i', 1, listLen(get('heights')),
        ifBlock(
          cmp('GT', listGet(get('heights'), get('i')), get('best')),
          set('best', listGet(get('heights'), get('i'))),
        ),
      ),
      forRange('k', 1, get('best'), move()),
      putLeaf(),
    )),
    python:
`heights = [2, 5, 3, 1, 4]

best = 0
for height in heights:
    if height > best:
        best = height

for k in range(best):
    kara.move()
kara.put_leaf()
`,
    blocksAdded: 22,
    pythonTokens: 30,
    disallowedBlocks: SENSOR_BLOCKS,
  }));
}

// 13. Fix the plan — change items with "set item in list".
{
  resetIds();
  const w = makeWorld(12, 3, 0, 1, 'right');
  const t = at(addLeaves(w, [[0, 1], [1, 1], [3, 1], [4, 1], [5, 1], [7, 1], [9, 1]]), 11, 1);
  const planList = () => set('plan', list([num(2), num(1), num(1), num(4)]));
  const plantLoop = () => forRange('i', 1, listLen(get('plan')), seq(
    forRange('k', 1, listGet(get('plan'), get('i')), seq(putLeaf(), move())),
    move(),
  ));
  challenges.push(mkChallenge({
    n: 13,
    name: '13. Fix the plan',
    world: w, target: t,
    notes:
`# Fix the plan

The planting loop is already written: it reads \`plan\` and plants that many leaves in each of the four beds, leaving one empty square between beds.

Two entries are wrong. Bed **2** needs **3** leaves and bed **4** needs **1**. Change those two items *before* the loop runs — leave the loop alone.

## Concepts
- \`set item in list\` overwrites one value and leaves the rest of the list untouched.
- Fixing the data is often easier than rewriting the code that reads it.`,
    starterBlocks: ws(seq(planList(), plantLoop())),
    starterPython:
`plan = [2, 1, 1, 4]

for count in plan:
    for k in range(count):
        kara.put_leaf()
        kara.move()
    kara.move()
`,
    blocks: ws(seq(
      planList(),
      listSet(get('plan'), num(2), num(3)),
      listSet(get('plan'), num(4), num(1)),
      plantLoop(),
    )),
    python:
`plan = [2, 1, 1, 4]
plan[1] = 3
plan[3] = 1

for count in plan:
    for k in range(count):
        kara.put_leaf()
        kara.move()
    kara.move()
`,
    blocksAdded: 18,
    pythonTokens: 20,
    disallowedBlocks: SENSOR_BLOCKS,
  }));
}

// 14. Backwards through the list — same data, other end first.
{
  resetIds();
  const w = makeWorld(10, 3, 0, 1, 'right');
  const t = at(addLeaves(w, [[3, 1], [5, 1], [9, 1]]), 9, 1);
  const stepsList = () => set('steps', list([num(4), num(2), num(3)]));
  challenges.push(mkChallenge({
    n: 14,
    name: '14. Backwards through the list',
    world: w, target: t,
    notes:
`# Backwards through the list

Same idea as *Walk the whole list*, but read \`steps\` from the **last** item to the first: 3 steps, then 2, then 4 — planting a leaf at each stop.

## Concepts
- A count-down loop starts at **length of steps** and counts back to 1.
- Python has \`reversed(steps)\`, which hands you the items in the opposite order.`,
    starterBlocks: ws(stepsList()),
    starterPython: `steps = [4, 2, 3]\n\n`,
    blocks: ws(seq(
      stepsList(),
      forRange('i', listLen(get('steps')), 1, seq(
        forRange('k', 1, listGet(get('steps'), get('i')), move()),
        putLeaf(),
      )),
    )),
    python:
`steps = [4, 2, 3]

for count in reversed(steps):
    for k in range(count):
        kara.move()
    kara.put_leaf()
`,
    blocksAdded: 12,
    pythonTokens: 20,
    disallowedBlocks: SENSOR_BLOCKS,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Section C — Lists and functions together (15–20)
// ═══════════════════════════════════════════════════════════════════════════

// 15. A list in a function — the list is the parameter.
{
  resetIds();
  const w = makeWorld(6, 7, 0, 0, 'right');
  const t = at(addLeaves(w, [[3, 0], [5, 0], [5, 2], [5, 6]]), 5, 6);
  const followBody = () => forRange('i', 1, listLen(get('plan')), seq(
    forRange('k', 1, listGet(get('plan'), get('i')), move()),
    putLeaf(),
  ));
  challenges.push(mkChallenge({
    n: 15,
    name: '15. A list in a function',
    world: w, target: t,
    notes:
`# A list in a function

Two routes to walk: **[3, 2]** across the top, then **[2, 4]** down the right-hand side. Each number is a distance, and every stop gets a leaf.

Write one function \`follow(plan)\` whose parameter **is a list**, then call it once per route with a turn in between.

## Concepts
- A parameter can hold a whole list, not just a single number.
- One function, two different lists — the same code walks both routes.`,
    blocks: ws(
      defProc('follow', ['plan'], followBody()),
      seq(
        set('route1', list([num(3), num(2)])),
        set('route2', list([num(2), num(4)])),
        callProc('follow', [get('route1')]),
        turnRight(),
        callProc('follow', [get('route2')]),
      ),
    ),
    python:
`def follow(plan):
    for count in plan:
        for k in range(count):
            kara.move()
        kara.put_leaf()

route1 = [3, 2]
route2 = [2, 4]
follow(route1)
kara.turn_right()
follow(route2)
`,
    blocksAdded: 26,
    pythonTokens: 36,
    disallowedBlocks: SENSOR_BLOCKS,
  }));
}

// 16. Bar chart — a list of heights drawn by a parameterised function.
{
  resetIds();
  const w = makeWorld(5, 6, 0, 5, 'right');
  const t = at(addLeaves(w, [
    [0, 4], [0, 3], [0, 2],
    [1, 4],
    [2, 4], [2, 3], [2, 2], [2, 1],
    [3, 4], [3, 3],
  ]), 4, 5);
  const barBody = () => seq(
    turnLeft(),
    forRange('k', 1, get('n'), seq(move(), putLeaf())),
    turnLeft(), turnLeft(),
    forRange('k', 1, get('n'), move()),
    turnLeft(),
  );
  const heightsList = () => set('heights', list([num(3), num(1), num(4), num(2)]));
  challenges.push(mkChallenge({
    n: 16,
    name: '16. Bar chart',
    world: w, target: t,
    notes:
`# Bar chart

\`heights\` is **[3, 1, 4, 2]**. Draw it as a bar chart: above each column, a tower of leaves that tall, built upwards from Kara's row.

Write \`bar(n)\` — face up, plant \`n\` leaves on the way up, come back down and face right again. Then loop over \`heights\`, drawing a bar and stepping right each time.

## Concepts
- The function keeps the fiddly up-and-back shape in one place; the loop just supplies the numbers.
- Writing the bar shape out four times would not come close to fitting the block limit.`,
    starterBlocks: ws(heightsList()),
    starterPython: `heights = [3, 1, 4, 2]\n\n`,
    blocks: ws(
      defProc('bar', ['n'], barBody()),
      seq(
        heightsList(),
        forRange('i', 1, listLen(get('heights')), seq(
          callProc('bar', [listGet(get('heights'), get('i'))]),
          move(),
        )),
      ),
    ),
    python:
`heights = [3, 1, 4, 2]

def bar(n):
    kara.turn_left()
    for k in range(n):
        kara.move()
        kara.put_leaf()
    kara.turn_left()
    kara.turn_left()
    for k in range(n):
        kara.move()
    kara.turn_left()

for height in heights:
    bar(height)
    kara.move()
`,
    blocksAdded: 22,
    pythonTokens: 42,
    disallowedBlocks: SENSOR_BLOCKS,
  }));
}

// 17. Add it up — a running total across the list.
{
  resetIds();
  const w = makeWorld(13, 3, 0, 1, 'right');
  const leaves = [];
  for (let i = 0; i < 12; i++) leaves.push([i, 1]);
  const t = at(addLeaves(w, leaves), 12, 1);
  const loadsList = () => set('loads', list([num(2), num(1), num(3), num(2), num(4)]));
  challenges.push(mkChallenge({
    n: 17,
    name: '17. Add it up',
    world: w, target: t,
    notes:
`# Add it up

Five deliveries: \`loads\` is **[2, 1, 3, 2, 4]**. Kara must plant one leaf for **every** item delivered, in one unbroken row starting where she stands.

Add the list up into a total first, then plant that many leaves.

## Concepts
- A running total starts at 0 **outside** the loop and grows by one item each time round.
- Working the number out from the data means the code still works if the deliveries change.`,
    starterBlocks: ws(loadsList()),
    starterPython: `loads = [2, 1, 3, 2, 4]\n\n`,
    blocks: ws(seq(
      loadsList(),
      set('total', num(0)),
      forRange('i', 1, listLen(get('loads')),
        set('total', add(get('total'), listGet(get('loads'), get('i')))),
      ),
      forRange('k', 1, get('total'), seq(putLeaf(), move())),
    )),
    python:
`loads = [2, 1, 3, 2, 4]

total = 0
for load in loads:
    total = total + load

for k in range(total):
    kara.put_leaf()
    kara.move()
`,
    blocksAdded: 18,
    pythonTokens: 26,
    disallowedBlocks: SENSOR_BLOCKS,
  }));
}

// 18. Two lists at once — same index into both.
{
  resetIds();
  const w = makeWorld(6, 6, 1, 1, 'right');
  const t = at(addLeaves(w, [[3, 1], [3, 4], [4, 4]]), 4, 4);
  const gapsList  = () => set('gaps',  list([num(2), num(3), num(1)]));
  const turnsList = () => set('turns', list([str('R'), str('L'), str('R')]));
  challenges.push(mkChallenge({
    n: 18,
    name: '18. Two lists at once',
    world: w, target: t,
    notes:
`# Two lists at once

Two lists describe one journey: \`gaps\` says how far to walk, \`turns\` says which way to turn afterwards. Item 1 of each belongs to the first leg, item 2 to the second, and so on.

For each leg: walk the gap, turn as instructed, plant a leaf.

## Concepts
- One loop counter can index **both** lists — \`gaps[i]\` and \`turns[i]\` belong together.
- Python's \`range(len(gaps))\` gives you the positions rather than the values, which is what you need here.`,
    starterBlocks: ws(seq(gapsList(), turnsList())),
    starterPython: `gaps = [2, 3, 1]\nturns = ["R", "L", "R"]\n\n`,
    blocks: ws(seq(
      gapsList(),
      turnsList(),
      forRange('i', 1, listLen(get('gaps')), seq(
        forRange('k', 1, listGet(get('gaps'), get('i')), move()),
        ifElseBlock(
          cmp('EQ', listGet(get('turns'), get('i')), str('R')),
          turnRight(),
          turnLeft(),
        ),
        putLeaf(),
      )),
    )),
    python:
`gaps = [2, 3, 1]
turns = ["R", "L", "R"]

for i in range(len(gaps)):
    for k in range(gaps[i]):
        kara.move()
    if turns[i] == "R":
        kara.turn_right()
    else:
        kara.turn_left()
    kara.put_leaf()
`,
    blocksAdded: 20,
    pythonTokens: 34,
    disallowedBlocks: SENSOR_BLOCKS,
  }));
}

// 19. Beds and gaps — two functions driven by two lists.
{
  resetIds();
  const w = makeWorld(16, 3, 0, 1, 'right');
  const t = at(addLeaves(w, [[0, 1], [1, 1], [5, 1], [6, 1], [7, 1], [10, 1]]), 15, 1);
  const bedBody  = () => forRange('k', 1, get('n'), seq(putLeaf(), move()));
  const walkBody = () => forRange('k', 1, get('n'), move());
  const sizesList = () => set('sizes', list([num(2), num(3), num(1)]));
  const gapsList  = () => set('gaps',  list([num(3), num(2), num(4)]));
  challenges.push(mkChallenge({
    n: 19,
    name: '19. Beds and gaps',
    world: w, target: t,
    notes:
`# Beds and gaps

\`sizes\` gives the length of each bed; \`gaps\` gives the empty stretch that follows it.

Write **two** small functions — \`bed(n)\` plants a row of *n* leaves, \`walk(n)\` just travels *n* squares — and let one loop over the two lists call them in turn.

## Concepts
- Two short functions, each doing one job, read better than one long one doing both.
- Both take a parameter, so the same pair handles any pair of lists.`,
    starterBlocks: ws(seq(sizesList(), gapsList())),
    starterPython: `sizes = [2, 3, 1]\ngaps = [3, 2, 4]\n\n`,
    blocks: ws(
      defProc('bed', ['n'], bedBody()),
      defProc('walk', ['n'], walkBody()),
      seq(
        sizesList(),
        gapsList(),
        forRange('i', 1, listLen(get('sizes')), seq(
          callProc('bed',  [listGet(get('sizes'), get('i'))]),
          callProc('walk', [listGet(get('gaps'),  get('i'))]),
        )),
      ),
    ),
    python:
`sizes = [2, 3, 1]
gaps = [3, 2, 4]

def bed(n):
    for k in range(n):
        kara.put_leaf()
        kara.move()

def walk(n):
    for k in range(n):
        kara.move()

for i in range(len(sizes)):
    bed(sizes[i])
    walk(gaps[i])
`,
    blocksAdded: 24,
    pythonTokens: 40,
    disallowedBlocks: SENSOR_BLOCKS,
  }));
}

// 20. The delivery round — capstone: lists, two functions, arithmetic, return trip.
{
  resetIds();
  const w = makeWorld(17, 3, 0, 1, 'right');
  const leaves = [[0, 1], [1, 1], [4, 1], [8, 1], [9, 1], [10, 1], [12, 1]];
  const outbound = at(addLeaves(w, leaves), 16, 1);
  const t = at(addLeaves(w, leaves), 0, 1, 'left');
  const bedBody  = () => forRange('k', 1, get('n'), seq(putLeaf(), move()));
  const walkBody = () => forRange('k', 1, get('n'), move());
  const planList = () => set('plan', list([num(2), num(1), num(3), num(1)]));
  challenges.push(mkChallenge({
    n: 20,
    name: '20. The delivery round',
    world: w, target: t,
    notes:
`# The delivery round

The row is four **plots of four squares each**. \`plan\` says how many leaves each plot needs: **[2, 1, 3, 1]**.

For every plot: plant its leaves starting at the plot's left-hand edge, then walk on to the start of the next plot — that is \`4 - plan[i]\` squares, because planting already moved Kara along. Reach the far end, then bring her all the way home.

## Concepts
- The distance to the next plot is **worked out** from the data rather than typed in.
- The trip home is \`4 × length of plan\` squares, so the code survives a longer plan.
- The checkpoint checks Kara really did reach the far end before turning back.`,
    starterBlocks: ws(planList()),
    starterPython: `plan = [2, 1, 3, 1]\n\n`,
    blocks: ws(
      defProc('bed', ['n'], bedBody()),
      defProc('walk', ['n'], walkBody()),
      seq(
        planList(),
        forRange('i', 1, listLen(get('plan')), seq(
          callProc('bed', [listGet(get('plan'), get('i'))]),
          callProc('walk', [sub(num(4), listGet(get('plan'), get('i')))]),
        )),
        turnLeft(), turnLeft(),
        callProc('walk', [arith('MULTIPLY', num(4), listLen(get('plan')))]),
      ),
    ),
    python:
`plan = [2, 1, 3, 1]

def bed(n):
    for k in range(n):
        kara.put_leaf()
        kara.move()

def walk(n):
    for k in range(n):
        kara.move()

for size in plan:
    bed(size)
    walk(4 - size)

kara.turn_left()
kara.turn_left()
walk(4 * len(plan))
`,
    intermediates: [outbound],
    blocksAdded: 32,
    pythonTokens: 48,
    disallowedBlocks: SENSOR_BLOCKS,
  }));
}

// ── Assemble file ──────────────────────────────────────────────────────────

const bookGuid = 'intro2-book-0000-0000-0000-000000000000';

const book = {
  karaWebVersion: 5,
  appMode: 'blocks',
  name: 'Intro to Programming — Book 2: Lists & Functions',
  savedAt: new Date('2026-08-30T00:00:00Z').toISOString(),
  world: challenges[0].initialWorld,
  blocks: { blocklyState: null },
  challengeFileGuid: bookGuid,
  challenges,
  challengeWork: {},
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'dist-content');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'intro-to-programming-book-2.json');
writeFileSync(outPath, JSON.stringify(book, null, 1));
console.log(`Wrote ${outPath} (${challenges.length} challenges)`);

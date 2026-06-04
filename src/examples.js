// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWorld(width, height, karaX, karaY, karaDir, trees = [], mushrooms = [], leaves = []) {
  const cells = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ hasLeaf: false, object: null }))
  );
  for (const [x, y] of trees)     cells[y][x] = { hasLeaf: false, object: 'tree' };
  for (const [x, y] of mushrooms) cells[y][x] = { hasLeaf: false, object: 'mushroom' };
  for (const [x, y] of leaves)    cells[y][x] = { hasLeaf: true,  object: null };
  return { width, height, cells, kara: { x: karaX, y: karaY, direction: karaDir } };
}

// guard: all sensors default to null (don't-care); pass only the ones you care about
const g = (o = {}) => ({
  treeFront: null, treeLeft: null, treeRight: null,
  mushroomFront: null, onLeaf: null,
  ...o,
});

// ── Introduction notes ────────────────────────────────────────────────────────

// Common to all three modes: world description + sensor list. Used as
// the prefix for every mode-specific intro.
const INTRO_COMMON = `## Welcome to KaraWeb

**Kara** is a ladybug living in a rectangular world. She can sense her immediate surroundings and take one action per step.

## The World

Kara's world contains three types of objects:

- **Tree 🌲** — An impassable obstacle. Kara cannot walk into a tree.
- **Mushroom 🍄** — Kara can push mushrooms by walking into them, provided the cell behind is free.
- **Leaf 🍀** — Kara can pick up leaves using the *Remove Leaf* action.

By default the world **wraps around** at every edge — walking off the right re-enters from the left, etc. Teachers can opt out per-challenge to give the world hard, impassable edges instead.

## Kara's Sensors

At each step Kara reads five boolean sensors:

- **treeFront** — Is there a tree directly ahead?
- **treeLeft** — Is there a tree immediately to the left?
- **treeRight** — Is there a tree immediately to the right?
- **mushroomFront** — Is there a mushroom directly ahead?
- **onLeaf** — Is Kara standing on a leaf?

`;

const INTRO_FSM = `## The FSM is a Mealy Machine

Your program is a **Finite State Machine** — specifically a *Mealy machine*. In a Mealy machine the outputs (actions) appear on the **transitions**, not inside the states. Each arrow represents a rule of the form:

**guard / action**

The **guard** is a pattern of sensor values (true, false, or *don't-care ×*). The **action** is what Kara does when that transition fires.

At each step Kara reads her sensors, the machine checks the outgoing transitions from the **current state** in priority order, and the **first** matching transition fires — Kara performs the action and the machine moves to the next state.

## Getting Started

- Draw a world using the tools in the World panel on the left.
- Double-click the FSM canvas to add a state.
- Drag from the small circle on a state to another state to add a transition.
- Click a transition arrow to set its **guard** and **action**.
- Right-click a state to set it as the **start state**.
- Press **Run** to simulate, or **Step** to advance one step at a time.

Load one of the **Examples** from the header dropdown to see a complete working program!`;

const INTRO_BLOCKS = `## Programming with Blocks

In **Blocks mode** you build Kara's program by dragging colourful blocks together — no typing required. Blocks snap into sequences like jigsaw pieces, so your program reads top-to-bottom as a list of instructions.

The toolbox on the left of the editor groups blocks by purpose:

- **Kara** — actions (move, turn, put / remove leaf) and sensors (tree-front?, on-leaf?, …).
- **Logic** — \`if\`, \`if / else\`, comparisons, \`and\` / \`or\` / \`not\`, \`true\` / \`false\`.
- **Loops** — \`repeat N times\` and \`while … do\`.
- **Math**, **Text**, **Lists**, **Variables**, **Functions** — the standard Blockly building blocks.

Each block has a clear shape: tall blocks are **statements** (do something), oval blocks are **boolean values** (true/false), and rounded blocks are **numbers** or **text**. Mismatched shapes won't snap, so the editor stops you assembling nonsense.

## Getting Started

- Drag a Kara action block onto the workspace.
- Snap more blocks below it to build a sequence.
- Try a **repeat** loop with one or more actions inside it.
- Press **Run** to watch Kara execute your program.
- Behind the scenes your blocks become real Python — click the eye icon on a block to see the generated code.

Load one of the **Examples** from the header dropdown to see a complete working program!`;

const INTRO_PYTHON = `## Programming in Python

In **Python mode** you write real Python code in a Monaco editor — the same one VS Code uses, with syntax highlighting, autocompletion, and red squiggles under errors. Your program runs in the browser via Pyodide (CPython compiled to WebAssembly), so anything Python can do (within limits) it can do here.

A \`kara\` object is provided for you with all the standard actions and sensors:

\`\`\`python
kara.move()
kara.turn_left()
kara.turn_right()
kara.put_leaf()
kara.remove_leaf()

kara.tree_front()      # → True / False
kara.tree_left()
kara.tree_right()
kara.mushroom_front()
kara.on_leaf()
\`\`\`

You can use everything Python normally offers — variables, \`if\` / \`elif\` / \`else\`, \`while\` / \`for\` loops, functions, lists, dictionaries, \`print()\`, \`input()\`, the lot.

## Getting Started

- Start with a single \`kara.move()\` to confirm it runs.
- Wrap actions in a loop: \`for _ in range(5): kara.move()\`.
- Combine with sensors and \`if\` to make Kara react.
- Press **Run** to execute, or **Step** to advance one statement at a time.

Load one of the **Examples** from the header dropdown to see a complete working program!`;

export const INTRO_NOTES_BY_MODE = {
  fsm:    INTRO_COMMON + INTRO_FSM,
  blocks: INTRO_COMMON + INTRO_BLOCKS,
  python: INTRO_COMMON + INTRO_PYTHON,
};

// Pick the right intro based on the current app mode. Falls back to
// Blocks (the default mode for new sessions) when an unknown mode
// slips in.
export function getIntroNotes(appMode) {
  return INTRO_NOTES_BY_MODE[appMode] ?? INTRO_NOTES_BY_MODE.blocks;
}

// Legacy export — kept so any older import keeps building. Prefer
// `getIntroNotes(appMode)` for new callers.
export const INTRO_NOTES = INTRO_NOTES_BY_MODE.blocks;

// ── Example 1: Left-Turn Pathfinder ──────────────────────────────────────────

const ex1World = makeWorld(
  15, 10,
  0, 4, 'right',                           // Kara at (0,4) facing right
  [[4,2],[4,3],[4,4],[3,1],[1,2]],          // trees
  [],                                        // mushrooms
  [[2,7]],                                   // leaf
);

const ex1Fsm = {
  states: [
    { id: 's1', label: 'q1', x: 130, y: 160 },
    { id: 's2', label: 'q2', x: 340, y: 160 },
  ],
  transitions: [
    { id: 't1', fromId: 's1', toId: 's1', guard: g({ treeFront: true }),                              action: 'turnLeft'   },
    { id: 't2', fromId: 's1', toId: 's2', guard: g({ treeFront: false, onLeaf: true }),               action: 'removeLeaf' },
    { id: 't3', fromId: 's1', toId: 's1', guard: g({ treeFront: false, onLeaf: false }),              action: 'move'       },
  ],
  startStateId: 's1',
};

const ex1NotesFsm = `## Example 1: Left-Turn Pathfinder

**Difficulty:** ⭐ Beginner

Kara starts facing right. A small number of trees form a winding path. A single leaf waits at the end. Turn left whenever there's a tree ahead, eat the leaf when you land on it, and keep moving otherwise.

## The Key Insight

At every step, exactly one of three situations applies:

- **treeFront = true** — Turn left (can't go forward).
- **treeFront = false, onLeaf = true** — Remove leaf (done!).
- **treeFront = false, onLeaf = false** — Move forward.

Because these three cases are exhaustive, **one state with three transitions** solves the problem. The machine loops in q1, turning and moving, until it reaches the leaf — then exits to q2.

## Why Priority Order Matters

Transitions are checked top to bottom. The *treeFront = true → turnLeft* rule must come **first**, so Kara always turns before attempting to step into a tree. The *onLeaf* check comes second; *move* is the last-resort fallback.

## The Mealy Machine Perspective

This machine has only one working state. All the logic lives in the transition guards — the state itself carries no information. This is a useful pattern when the world geometry does all the "remembering" for you.`;

const ex1NotesBlocks = `## Example 1: Left-Turn Pathfinder

**Difficulty:** ⭐ Beginner

Kara starts facing right. A small number of trees form a winding path. A single leaf waits at the end. Turn left whenever there's a tree ahead, eat the leaf when you land on it, and keep moving otherwise.

## The Key Insight

At every step, exactly one of three situations applies:

- **tree front?** — Turn left (can't go forward).
- **on leaf?** — Remove the leaf (done!).
- **otherwise** — Move forward.

Wrap those three choices in an \`if / else if / else\` block and put the whole thing inside a \`repeat while\` loop so Kara keeps reacting.

## Building It

1. Drag a **repeat while** block onto the workspace. Use \`true\` as the condition so the loop runs forever (until the leaf is eaten).
2. Inside the loop, snap an **if / else if / else** block.
3. First branch: \`if tree-front?\` → \`turn-left\`.
4. Second branch: \`else if on-leaf?\` → \`remove-leaf\`.
5. Last branch: \`else\` → \`move\`.

## Why the Order Matters

Blockly checks the branches top to bottom. The *tree-front* check must come **first**, so Kara always turns before trying to step into a tree. The *on-leaf* check comes second; *move* is the fallback.

## What's Happening Under the Hood

Each Kara action block compiles to a Python call (\`kara.move()\`, \`kara.turn_left()\`, …). The whole program becomes a real Python program — you can peek at the generated code via the eye icon on a block.`;

const ex1NotesPython = `## Example 1: Left-Turn Pathfinder

**Difficulty:** ⭐ Beginner

Kara starts facing right. A small number of trees form a winding path. A single leaf waits at the end. Turn left whenever there's a tree ahead, eat the leaf when you land on it, and keep moving otherwise.

## The Key Insight

At every step, exactly one of three situations applies:

- \`kara.tree_front()\` — Turn left (can't go forward).
- \`kara.on_leaf()\` — Remove the leaf (done!).
- Otherwise — Move forward.

## The Shape of the Program

\`\`\`python
while True:
    if kara.tree_front():
        kara.turn_left()
    elif kara.on_leaf():
        kara.remove_leaf()
        break
    else:
        kara.move()
\`\`\`

## Why the Order Matters

Python evaluates the \`if / elif / else\` chain top to bottom. The *tree_front* check must come **first** so Kara always turns before trying to step into a tree. The *on_leaf* check comes second; *move* is the fallback.

A \`break\` after removing the leaf exits the loop cleanly. (You can also let the loop run forever — once there's no leaf left, the *elif* branch just stops firing.)`;

// ── Example 2: Row Harvester ──────────────────────────────────────────────────

const ex2Leaves = Array.from({ length: 13 }, (_, i) => [i + 1, 4]); // x=1..13, y=4

const ex2World = makeWorld(
  15, 10,
  7, 4, 'right',                            // Kara at (7,4) facing right, on a leaf
  [],                                         // trees
  [[0,4],[14,4]],                             // mushrooms at both ends
  ex2Leaves,                                  // leaves across the row
);

const ex2Fsm = {
  states: [
    { id: 's1', label: 'q1', x: 90,  y: 160 },
    { id: 's2', label: 'q2', x: 240, y: 160 },
    { id: 's3', label: 'q3', x: 390, y: 160 },
    { id: 's4', label: 'q4', x: 540, y: 160 },
  ],
  transitions: [
    // q1: going right, eating
    { id: 't1', fromId: 's1', toId: 's1', guard: g({ onLeaf: true }),                              action: 'removeLeaf' },
    { id: 't2', fromId: 's1', toId: 's1', guard: g({ onLeaf: false, mushroomFront: false }),       action: 'move'       },
    { id: 't3', fromId: 's1', toId: 's2', guard: g({ mushroomFront: true }),                       action: 'turnLeft'   },
    // q2: first half of U-turn
    { id: 't4', fromId: 's2', toId: 's3', guard: g(),                                              action: 'turnLeft'   },
    // q3: going left, eating
    { id: 't5', fromId: 's3', toId: 's3', guard: g({ onLeaf: true }),                              action: 'removeLeaf' },
    { id: 't6', fromId: 's3', toId: 's3', guard: g({ onLeaf: false, mushroomFront: false }),       action: 'move'       },
    { id: 't7', fromId: 's3', toId: 's4', guard: g({ mushroomFront: true }),                       action: 'none'       },
  ],
  startStateId: 's1',
};

const ex2NotesFsm = `## Example 2: Row Harvester

**Difficulty:** ⭐⭐ Easy

A row of leaves stretches across the grid, capped by mushrooms at both ends. Kara starts in the middle, facing right. Eat every leaf, turn around at each mushroom, and stop when you reach the second mushroom.

## The Key Insight: 180° Takes Two Steps

Kara can only turn 90° per step. A U-turn requires **two turns** — two separate time steps — so the FSM needs a state to remember it is halfway through the turn:

- **q1** — going right, eating leaves
- **q2** — halfway through the U-turn (first 90° done, second pending)
- **q3** — going left, eating leaves
- **q4** — done

Without q2, there is no way to issue a second turnLeft on the very next step. The FSM can output only **one action per step**.

## Guard Priority

In q1 and q3, when Kara is at the last leaf before a mushroom, both *onLeaf = true* and *mushroomFront = true* may hold simultaneously. Placing the *removeLeaf* rule **first** ensures that leaf is eaten before the turn fires on the following step.

## The Mealy Machine Perspective

The states here encode the **direction of travel** and the **mid-turn moment**. Without those distinctions in the FSM, Kara has no way to know which direction she came from or whether she has already started turning.`;

const ex2NotesBlocks = `## Example 2: Row Harvester

**Difficulty:** ⭐⭐ Easy

A row of leaves stretches across the grid, capped by mushrooms at both ends. Kara starts in the middle, facing right. Eat every leaf, turn around at each mushroom, and stop when you reach the second mushroom.

## The Key Insight: Top-Down Code Just Works

In Blocks mode you don't need to "remember states" — you can write the whole story straight down the workspace:

1. Walk right, eating leaves, until a mushroom is in front of you.
2. Turn around (two left turns).
3. Walk left, eating leaves, until a mushroom is in front of you.

## Building It

1. **First sweep** — drag a \`repeat while\` block with the condition \`not mushroom-front?\`. Inside, place an \`if\` block: \`if on-leaf?\` → \`remove-leaf\`. After the \`if\`, snap a \`move\` block.
2. **U-turn** — after the loop, snap two \`turn-left\` blocks.
3. **Second sweep** — duplicate the first \`repeat while\` block.

## Why the *remove-leaf* Block Comes First

Inside each loop, *remove-leaf* must run **before** *move*. If you moved first, you'd step off the leaf without eating it. Putting *remove-leaf* at the top of the loop body fixes that.

## What Blocks Hide From You

You don't need a "halfway through turning" variable here — Blockly executes the second \`turn-left\` block right after the first, no memory required. The FSM version of this same example uses four states for exactly this reason. Sequential code is usually shorter.`;

const ex2NotesPython = `## Example 2: Row Harvester

**Difficulty:** ⭐⭐ Easy

A row of leaves stretches across the grid, capped by mushrooms at both ends. Kara starts in the middle, facing right. Eat every leaf, turn around at each mushroom, and stop when you reach the second mushroom.

## The Key Insight: Sequential Code Just Works

In Python mode you don't need to "remember states" — you can write the whole story straight down the page:

1. Walk right, eating leaves, until a mushroom is in front of you.
2. Turn around (two left turns).
3. Walk left, eating leaves, until a mushroom is in front of you.

## The Shape of the Program

\`\`\`python
def sweep():
    while not kara.mushroom_front():
        if kara.on_leaf():
            kara.remove_leaf()
        kara.move()

sweep()
kara.turn_left()
kara.turn_left()
sweep()
\`\`\`

## Why the *remove_leaf* Call Comes First

Inside each loop, \`remove_leaf\` must run **before** \`move\`. If you moved first, you'd step off the leaf without eating it.

## What Python Hides From You

You don't need a "halfway through turning" variable — Python runs the second \`kara.turn_left()\` right after the first, no memory required. The FSM version of this same example uses four states for exactly this reason; sequential code is usually shorter.`;

// ── Example 3: Forest Circler ─────────────────────────────────────────────────

const ex3Trees = [];
for (let y = 2; y <= 6; y++)
  for (let x = 5; x <= 9; x++)
    ex3Trees.push([x, y]);

const ex3World = makeWorld(
  15, 10,
  4, 4, 'up',        // Kara at (4,4) facing up — forest is to her right
  ex3Trees,
  [],
  [],
);

const ex3Fsm = {
  states: [
    { id: 's1', label: 'q1', x: 130, y: 180 },
    { id: 's2', label: 'q2', x: 340, y: 180 },
  ],
  transitions: [
    // q1: main loop — right-hand rule
    { id: 't1', fromId: 's1', toId: 's2', guard: g({ treeRight: false }),                          action: 'turnRight'  },
    { id: 't2', fromId: 's1', toId: 's1', guard: g({ treeRight: true, treeFront: true }),          action: 'turnLeft'   },
    { id: 't3', fromId: 's1', toId: 's1', guard: g({ treeRight: true, treeFront: false }),         action: 'move'       },
    // q2: just turned right — check if we can advance
    { id: 't4', fromId: 's2', toId: 's1', guard: g({ treeFront: false }),                          action: 'move'       },
    { id: 't5', fromId: 's2', toId: 's1', guard: g({ treeFront: true }),                           action: 'turnLeft'   },
  ],
  startStateId: 's1',
};

const ex3NotesFsm = `## Example 3: Forest Circler

**Difficulty:** ⭐⭐⭐ Medium

A rectangular forest of trees occupies the centre of the world. Kara starts outside, facing up, with the forest to her right. Her task: circulate the forest indefinitely, always keeping a tree to her right.

## The Algorithm: Right-Hand Rule

Kara follows the classic *right-hand rule* — always keep the wall to your right. At each step:

- **No tree to the right** — Turn right (step toward the wall).
- **Tree to the right, path clear ahead** — Move forward.
- **Tree to the right, blocked ahead** — Turn left (navigate a corner).

## Why Two States?

After turning right, Kara needs to check whether she can actually advance in the new direction before committing. She cannot check *and* move in the same step. State q2 exists to hold this "pending check" moment:

- **q2 + treeFront = false** — Advance succeeded; move and return to q1.
- **q2 + treeFront = true** — Advance blocked; turn left (undo the right turn) and return to q1.

q2 encodes that we *tentatively* turned right and now need to commit or cancel.

## Surprising Fact

This exact same two-state FSM — unchanged — navigates **inside a maze** as well as around the outside of a forest. Both are instances of the right-hand rule. Try redesigning the world as a maze and see if q1–q2 still works!`;

const ex3NotesBlocks = `## Example 3: Forest Circler

**Difficulty:** ⭐⭐⭐ Medium

A rectangular forest of trees occupies the centre of the world. Kara starts outside, facing up, with the forest to her right. Her task: circulate the forest indefinitely, always keeping a tree to her right.

## The Algorithm: Right-Hand Rule

Kara follows the classic *right-hand rule* — always keep the wall to your right. At each step:

- **No tree to the right** — Turn right (step toward the wall).
- **Tree to the right, path clear ahead** — Move forward.
- **Tree to the right, blocked ahead** — Turn left (navigate a corner).

## Building It

1. Drag a \`repeat while\` block with the condition \`true\` — Kara just keeps circling forever.
2. Inside, use an \`if / else if / else\` block:
   - \`if not tree-right?\` → \`turn-right\`, then **immediately** \`move\` (you can stack two action blocks in the same branch).
   - \`else if tree-front?\` → \`turn-left\`.
   - \`else\` → \`move\`.

## Why Two Actions in One Branch?

In Blocks mode every branch can hold any number of statements — so after turning right you can move on the same iteration, no extra state required. The FSM version of this example needed a whole second state (q2) just to remember "I just turned right, now please move." Sequential code skips that bookkeeping for free.

## Surprising Fact

This same program — unchanged — navigates **inside a maze** as well as around the outside of a forest. Both are instances of the right-hand rule.`;

const ex3NotesPython = `## Example 3: Forest Circler

**Difficulty:** ⭐⭐⭐ Medium

A rectangular forest of trees occupies the centre of the world. Kara starts outside, facing up, with the forest to her right. Her task: circulate the forest indefinitely, always keeping a tree to her right.

## The Algorithm: Right-Hand Rule

Kara follows the classic *right-hand rule* — always keep the wall to your right. At each step:

- **No tree to the right** — Turn right (step toward the wall).
- **Tree to the right, path clear ahead** — Move forward.
- **Tree to the right, blocked ahead** — Turn left (navigate a corner).

## The Shape of the Program

\`\`\`python
while True:
    if not kara.tree_right():
        kara.turn_right()
        kara.move()
    elif kara.tree_front():
        kara.turn_left()
    else:
        kara.move()
\`\`\`

## Why Two Statements in One Branch?

In Python every branch can hold any number of statements — so after turning right you can move on the same iteration, no extra state required. The FSM version of this example needed a whole second state (q2) just to remember "I just turned right, now please move." Sequential code skips that bookkeeping for free.

## Surprising Fact

This same program — unchanged — navigates **inside a maze** as well as around the outside of a forest. Both are instances of the right-hand rule.`;

// ── Example 4: Mushroom Pusher ────────────────────────────────────────────────

const ex4World = makeWorld(
  15, 10,
  0, 4, 'right',      // Kara at (0,4) facing right
  [],
  [[4,4]],             // mushroom at (4,4)
  [[7,4]],             // leaf at (7,4)  — one cell behind mushroom's target
);

const ex4Fsm = {
  states: [
    { id: 's1', label: 'q1', x: 150, y: 180 },
    { id: 's2', label: 'q2', x: 370, y: 180 },
  ],
  transitions: [
    { id: 't1', fromId: 's1', toId: 's2', guard: g({ onLeaf: true }),  action: 'removeLeaf' },
    { id: 't2', fromId: 's1', toId: 's1', guard: g({ onLeaf: false }), action: 'move'       },
  ],
  startStateId: 's1',
};

const ex4NotesFsm = `## Example 4: Mushroom Pusher

**Difficulty:** ⭐⭐⭐⭐ Hard

A mushroom sits several cells ahead of Kara. A leaf is placed further along the same row. Kara must push the mushroom rightward and stop at exactly the right moment.

## The Challenge

There is no sensor that says "the mushroom is now on the target cell." Kara can detect *mushroomFront* and *onLeaf*, but never directly observe where the mushroom has ended up.

So how does she know when to stop?

## The Trick: Spatial Encoding

The leaf is placed exactly **one cell behind the mushroom's intended final position**. Because Kara and the mushroom are always one cell apart during pushing, the moment the mushroom reaches its target, Kara steps onto the leaf on that very same push.

This turns a seemingly impossible detection problem into a simple *onLeaf* check.

## The FSM

Just two transitions in q1:

- **onLeaf = true** — removeLeaf → q2 (done!) — *priority 1*
- **onLeaf = false** — move — *priority 2*

The move rule leaves *mushroomFront* as don't-care (×). Kara uses *move* both when walking toward the mushroom and when pushing it — the action is identical either way.

## The Mealy Machine Perspective

The world geometry encodes the stopping condition spatially. The FSM has essentially no memory — it just moves until it senses the leaf. This is a powerful design pattern: when possible, encode information in the **world layout** rather than in extra FSM states.`;

const ex4NotesBlocks = `## Example 4: Mushroom Pusher

**Difficulty:** ⭐⭐⭐⭐ Hard

A mushroom sits several cells ahead of Kara. A leaf is placed further along the same row. Kara must push the mushroom rightward and stop at exactly the right moment.

## The Challenge

There is no block that says "the mushroom is now on the target cell." Kara can read \`mushroom-front?\` and \`on-leaf?\`, but never directly observes where the mushroom has ended up.

So how does she know when to stop?

## The Trick: Spatial Encoding

The leaf is placed exactly **one cell behind the mushroom's intended final position**. Because Kara and the mushroom are always one cell apart during pushing, the moment the mushroom reaches its target, Kara steps onto the leaf on that very same push.

That turns a seemingly impossible detection problem into a simple \`on-leaf?\` check.

## Building It

1. Drag a \`repeat while\` block with the condition \`not on-leaf?\`.
2. Inside the loop, snap a single \`move\` block.
3. After the loop, snap \`remove-leaf\`.

That's the whole program: walk forward until standing on the leaf, then eat it. Kara uses \`move\` both when walking toward the mushroom and when pushing it — the action is identical either way.

## The Design Pattern

The world geometry encodes the stopping condition spatially. The Blocks program is almost trivial — it just moves until \`on-leaf?\` becomes true. When possible, encode information in the **world layout** rather than in extra checks or variables.`;

const ex4NotesPython = `## Example 4: Mushroom Pusher

**Difficulty:** ⭐⭐⭐⭐ Hard

A mushroom sits several cells ahead of Kara. A leaf is placed further along the same row. Kara must push the mushroom rightward and stop at exactly the right moment.

## The Challenge

There is no sensor that says "the mushroom is now on the target cell." Kara can call \`kara.mushroom_front()\` and \`kara.on_leaf()\`, but never directly observes where the mushroom has ended up.

So how does she know when to stop?

## The Trick: Spatial Encoding

The leaf is placed exactly **one cell behind the mushroom's intended final position**. Because Kara and the mushroom are always one cell apart during pushing, the moment the mushroom reaches its target, Kara steps onto the leaf on that very same push.

That turns a seemingly impossible detection problem into a simple \`kara.on_leaf()\` check.

## The Shape of the Program

\`\`\`python
while not kara.on_leaf():
    kara.move()
kara.remove_leaf()
\`\`\`

Walk forward until standing on the leaf, then eat it. Kara uses \`move\` both when walking toward the mushroom and when pushing it — the action is identical either way.

## The Design Pattern

The world geometry encodes the stopping condition spatially. The Python program is almost trivial — it just moves until \`on_leaf()\` becomes true. When possible, encode information in the **world layout** rather than in extra checks or variables.`;

// ── Target worlds (manually traced from the reference FSM solutions) ─────

// Ex1: Kara walks the winding path, eats the lone leaf and halts in q2.
// Ends at (2,7) facing down, leaf removed, trees unchanged.
const ex1TargetWorld = makeWorld(
  15, 10,
  2, 7, 'down',
  [[4,2],[4,3],[4,4],[3,1],[1,2]],
  [],
  [],
);

// Ex2: Kara eats the whole row (including the one she starts on), turns
// at the right mushroom, eats back, halts at the left mushroom in q4.
// Ends at (1,4) facing left, no leaves, mushrooms intact at (0,4) + (14,4).
const ex2TargetWorld = makeWorld(
  15, 10,
  1, 4, 'left',
  [],
  [[0,4],[14,4]],
  [],
);

// Ex3 Forest Circler: never halts, just orbits forever. We flag it
// `noCheckTarget` and set target = initial so the data model stays
// uniform without forcing the student to "reach" anything.
const ex3TargetWorld = ex3World;

// Ex4: Mushroom Pusher. Kara pushes the mushroom from (4,4) rightwards.
// The leaf at (7,4) signals "stop now" via onLeaf. The mushroom ends
// at (8,4) (one cell past where the leaf was) and Kara at (7,4) right
// after running removeLeaf. Leaf is gone.
const ex4TargetWorld = makeWorld(
  15, 10,
  7, 4, 'right',
  [],
  [[8,4]],
  [],
);

// ── Exports ───────────────────────────────────────────────────────────────────

import {
  EX1_BLOCKS, EX1_PYTHON,
  EX2_BLOCKS, EX2_PYTHON,
  EX3_BLOCKS, EX3_PYTHON,
  EX4_BLOCKS, EX4_PYTHON,
} from './exampleSolutions.js';

// Each example is a self-contained Challenge object (matches the same
// shape as user-authored challenges in store.js). Loading an example
// from the header dropdown installs it as a one-challenge "book" so the
// student gets the same Run / pass-fail / Show-solution flow as a real
// challenge file.
//
// IDs use the `builtin:` prefix to avoid collisions with user-generated
// guids.
function makeExampleChallenge({ id, name, world, fsm, blocks, python, notesByMode, targetWorld, noCheckTarget }) {
  return {
    id, guid: id, name, mode: 'blocks',
    // `notes` is the default rendering — Blocks mode, since that's the
    // mode the example loads in. App.jsx swaps in the mode-specific
    // variant from `notesByMode` whenever appMode changes, so the
    // text always describes what's in front of the student.
    notes: notesByMode.blocks,
    notesByMode,
    allowModeChange: true,
    initialWorld: world,
    targetWorld,
    intermediateCheckpoints: [],
    starter:  { fsm: null, blocks: null, python: '' },
    solution: { fsm, blocks, python },
    solutionAvailableToStudents: true,
    noCheckTarget: !!noCheckTarget,
  };
}

export const EXAMPLES = [
  makeExampleChallenge({
    id: 'builtin:ex1',
    name: '1. Left-Turn Pathfinder  ⭐',
    world: ex1World, fsm: ex1Fsm,
    blocks: EX1_BLOCKS, python: EX1_PYTHON,
    notesByMode: { fsm: ex1NotesFsm, blocks: ex1NotesBlocks, python: ex1NotesPython },
    targetWorld: ex1TargetWorld,
  }),
  makeExampleChallenge({
    id: 'builtin:ex2',
    name: '2. Row Harvester  ⭐⭐',
    world: ex2World, fsm: ex2Fsm,
    blocks: EX2_BLOCKS, python: EX2_PYTHON,
    notesByMode: { fsm: ex2NotesFsm, blocks: ex2NotesBlocks, python: ex2NotesPython },
    targetWorld: ex2TargetWorld,
  }),
  makeExampleChallenge({
    id: 'builtin:ex3',
    name: '3. Forest Circler  ⭐⭐⭐',
    world: ex3World, fsm: ex3Fsm,
    blocks: EX3_BLOCKS, python: EX3_PYTHON,
    notesByMode: { fsm: ex3NotesFsm, blocks: ex3NotesBlocks, python: ex3NotesPython },
    targetWorld: ex3TargetWorld,
    noCheckTarget: true,
  }),
  makeExampleChallenge({
    id: 'builtin:ex4',
    name: '4. Mushroom Pusher  ⭐⭐⭐⭐',
    world: ex4World, fsm: ex4Fsm,
    blocks: EX4_BLOCKS, python: EX4_PYTHON,
    notesByMode: { fsm: ex4NotesFsm, blocks: ex4NotesBlocks, python: ex4NotesPython },
    targetWorld: ex4TargetWorld,
  }),
];

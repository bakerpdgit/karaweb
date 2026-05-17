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

export const INTRO_NOTES = `## Welcome to KaraWeb

**Kara** is a ladybug living in a rectangular world. She can sense her immediate surroundings and take one action per step.

## The World

Kara's world contains three types of objects:

- **Tree 🌲** — An impassable obstacle. Kara cannot walk into a tree.
- **Mushroom 🍄** — Kara can push mushrooms by walking into them, provided the cell behind is free.
- **Leaf 🍀** — Kara can pick up leaves using the *Remove Leaf* action.

## Kara's Sensors

At each step Kara reads five boolean sensors:

- **treeFront** — Is there a tree directly ahead?
- **treeLeft** — Is there a tree immediately to the left?
- **treeRight** — Is there a tree immediately to the right?
- **mushroomFront** — Is there a mushroom directly ahead?
- **onLeaf** — Is Kara standing on a leaf?

## The FSM is a Mealy Machine

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

const ex1Notes = `## Example 1: Left-Turn Pathfinder

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

const ex2Notes = `## Example 2: Row Harvester

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

const ex3Notes = `## Example 3: Forest Circler

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

const ex4Notes = `## Example 4: Mushroom Pusher

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

// ── Exports ───────────────────────────────────────────────────────────────────

export const EXAMPLES = [
  {
    id: 'ex1',
    name: '1. Left-Turn Pathfinder  ⭐',
    world: ex1World,
    fsm: ex1Fsm,
    notes: ex1Notes,
  },
  {
    id: 'ex2',
    name: '2. Row Harvester  ⭐⭐',
    world: ex2World,
    fsm: ex2Fsm,
    notes: ex2Notes,
  },
  {
    id: 'ex3',
    name: '3. Forest Circler  ⭐⭐⭐',
    world: ex3World,
    fsm: ex3Fsm,
    notes: ex3Notes,
  },
  {
    id: 'ex4',
    name: '4. Mushroom Pusher  ⭐⭐⭐⭐',
    world: ex4World,
    fsm: ex4Fsm,
    notes: ex4Notes,
  },
];

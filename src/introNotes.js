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

# Welcome — meet Kara

**karaweb** is a browser-based programming environment for
secondary-school pupils, inspired by the classic
[Kara the Ladybug](http://www.swisseduc.ch/compscience/karatojava/kara/)
teaching tool from ETH Zürich. Pupils write small programs that
move a ladybird around a grid world picking up leaves, dodging
trees and mushrooms, and reaching target positions.

## The Kara world

Kara lives on a rectangular grid. Each cell can hold any
combination of:

- **A tree** — Kara can't enter the cell
- **A mushroom** — Kara can push it one square if the cell
  beyond is empty
- **A leaf** — Kara can pick it up, put it down, or just walk
  over it

Kara herself stands on one cell and faces one of four
directions (up, right, down, left). Her facing matters: she
always moves forward, and her "tree to my left?" sensor
depends on which way she's pointing.

## Three programming modes

Every program — whether ad-hoc or part of a challenge book —
is written in one of three modes, chosen by the teacher:

| Mode       | What it is                                                             | Best for                          |
| ---------- | ---------------------------------------------------------------------- | --------------------------------- |
| **FSM**    | A finite-state machine drawn as bubbles + arrows, with guards on edges | Youngest pupils, intro to logic   |
| **Blocks** | Blockly drag-and-drop, generates Python under the hood                 | KS3, transitioning to text code   |
| **Python** | Real Python via Pyodide running in the browser                         | KS4+, "the real thing"            |

All three modes drive the **same** Kara world and use the
**same** auto-marking — so a challenge built for Blocks works
in Python too if you let the pupil switch mode.

## Try it now

The fastest way to feel how karaweb works:

1. Click **⚡ Examples** in the header
2. Pick something simple like "Collect leaves in a line"
3. Press the green **▶ Run** button and watch Kara go

Then read [Ad-hoc challenges](?tutorial=adhoc) to learn how
to use this with your class without setting up anything else,
or jump straight to [Challenge books](?tutorial=challenge-books)
for the structured-task workflow.

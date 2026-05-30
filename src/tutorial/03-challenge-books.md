# Challenge books — the core concept

A **challenge book** is a single `.json` file holding one or more
ordered **challenges**. Each challenge bundles everything the
pupil needs to attempt one task, and everything karaweb needs to
automatically mark whether they succeeded.

## What's inside one challenge

| Field                   | What it is                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------- |
| **Name**                | Shown to the pupil in the challenge list                                            |
| **Mode**                | One of FSM / Blocks / Python (per-challenge choice)                                 |
| **Initial world**       | The exact world the pupil starts with                                               |
| **Intermediate checkpoints** | Ordered world snapshots the pupil's program must pass through (optional)     |
| **Target world**        | The world the program must end on                                                   |
| **Task instructions**   | Free-form markdown shown in the Notes panel — what you want the pupil to do        |
| **Starter code**        | A program the pupil starts with (could be empty, a skeleton, or a partial solution) |
| **Solution code**       | Your reference solution (optional; can be hidden or visible)                        |
| **Configuration**       | Code-size limits, allowed blocks, orientation rules, … (see chapter 4)              |

## How auto-marking works

When the pupil presses **▶ Run**, karaweb watches the world as
their program executes. After the program halts:

1. If the **target world** matches the current world → ✅ pass
2. If any **intermediate checkpoints** were skipped → ❌ fail
   (with a hint about which checkpoint was missed)
3. Otherwise → ❌ fail (target not reached)

Matching is cell-by-cell exact: same trees, same mushrooms, same
leaves, same Kara position. By default Kara's final facing
direction also has to match — you can relax that per challenge
(see [Configuring challenges](?tutorial=configuring)).

## Linear sequence, free order

The pupil sees the full list of challenges in the book and can
jump between them in any order. Challenges aren't gated — a
pupil who's stuck on #3 can skip ahead to #4. This is
deliberately pupil-controlled.

## Single-mode vs multi-mode books

By default a challenge is **locked** to the mode you set: a
Blocks challenge is solved in Blocks, period. You can opt in to
**allow mode change** per challenge — the pupil then sees a
mode-switcher and can try the same task in FSM, Blocks, or
Python. Useful for revision or stretch tasks.

## Editing a book

Click **⚡ Examples → Build my own** (or open an existing book
with **📁 Open** then click **Editing challenges**) to enter the
challenge editor. There the world editor on the left edits the
**currently-selected checkpoint**, the program editor on the
right edits the **starter or solution code**, and the sidebar
lets you add / reorder / delete challenges.

Next: [Configuring challenges](?tutorial=configuring) for all
the per-challenge options in depth, or
[Saving & sharing](?tutorial=saving-sharing) once your book is
ready to hand out.

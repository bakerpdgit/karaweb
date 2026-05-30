# Configuring challenges in depth

Once you're in the **Editing challenges** view, the per-challenge
control row sits above the world + program editors. Every
option here is per-challenge — you can have a strict Python
challenge next to a free-form Blocks one in the same book.

## The basics

| Control | What it does |
| ------- | ------------ |
| **Name** | Shown in the pupil's challenge list. Rename anytime |
| **Mode** | FSM / Blocks / Python — the mode this challenge is solved in |
| **Allow mode change** | If ticked, the pupil sees a mode switcher and can attempt the task in any mode. Off by default |
| **Enforce code limit** | Caps how much code the pupil can add beyond the starter (see below) |
| **Ignore Kara's final orientation** | When ticked, Kara's final facing direction is ignored — only her position + the cell contents have to match |
| **End on target not required** | When ticked, Kara just needs to pass through the target during execution; she doesn't have to end there. Default off — strict end-on-target match |
| **Allowed blocks…** | Opens a modal for restricting which Blockly blocks the pupil can use (Blocks mode only — see below) |

## Painting the worlds

The world editor on the left edits the **currently-selected
checkpoint**. The checkpoint bar above it lets you switch
between **Initial → (intermediates) → Target**, and to add /
remove intermediate checkpoints. To paint a cell click it; the
**Tools** strip lets you pick what you're laying down (tree,
mushroom, leaf, Kara, or eraser).

Tip: build the **target** world first, then duplicate it back
to the initial via the checkpoint bar's copy actions, then edit
the initial to whatever state Kara starts from. Often quicker
than building both from scratch.

## Notes (task instructions)

The **Notes** tab on the right of the editor shell holds the
markdown task description shown to the pupil. Headings, lists,
bold/italic, and a few other essentials render — keep it
short, the pupil reads this every attempt.

## Starter and solution code

The editor row toggles between **Starter** and **Solution**.

- **Starter** is what the pupil sees when they open the
  challenge. It can be empty (pupil starts from scratch), a
  skeleton (function signatures, a `while True:` loop), or even
  a near-complete program ("fix the bug").
- **Solution** is your reference answer. It's optional. If you
  fill one in, you choose:
  - **Visible** — the pupil can press **Show solution** to view
    it (after they've solved it themselves, or as a hint at the
    teacher's discretion)
  - **Hidden** — the pupil never sees the solution. It still
    lives in the file but is encrypted with the public key from
    your keydetails, so only you can decrypt it later (useful
    if you share the book with another teacher and want them
    to focus on writing their own answers)

## Code-size limits

Tick **Enforce code limit** to set per-mode caps:

| Mode | Cap |
| ---- | --- |
| Blocks | Maximum extra blocks beyond the starter |
| FSM    | Maximum extra states and transitions beyond the starter |
| Python | Maximum extra tokens beyond the starter |

The pupil sees a "X / N" counter at all times and is blocked
from adding more when the cap is hit.

## Allowed blocks (Blocks mode)

By default the pupil sees the full Blockly toolbox. Click
**Allowed blocks…** to restrict it — for example "solve this
without `if`" or "no math operations". The dialog lists every
toggleable block grouped by category, with **All** / **None**
shortcuts per category. Disallowed blocks vanish from the
toolbox entirely; the pupil sees no special message about
which were removed.

The teacher's own editor toolbox is also filtered when working
on this challenge's starter / solution — re-enable a block in
the dialog if you need it temporarily.

Variables and Functions categories are dynamic flyouts and
can't be toggled individually.

## Relaxing the final-state match

- **End on target not required** — by default Kara must end
  the program **on** the target world (position, cell contents,
  and facing). When ticked, Kara just needs to **pass through**
  the target during execution at some point; she can then keep
  moving and the program can halt elsewhere. Useful for
  challenges where the natural solution is a loop or
  continuous motion. Intermediate checkpoints still have to be
  touched in order either way.
- **Ignore Kara's final orientation** relaxes the final-state
  match further: position and cell contents still have to match
  the target, but Kara can be facing any direction.

Next: [Saving & sharing your book](?tutorial=saving-sharing).

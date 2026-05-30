# Cloud save — how it works

Cloud save is the optional feature that lets pupils submit
attempts directly from their browser to a backend **you
control**, where you can later view and mark them. There's no
karaweb-controlled server in the middle — your data goes to
your account on your chosen backend.

## The end-to-end encryption story

karaweb is designed so that nobody but **you** ever sees the
pupil's actual work — not the backend vendor, not the school
IT department, not karaweb's developers.

It works like this:

1. You generate a **keydetails file** (one per teacher). This
   holds an RSA-OAEP keypair: a **public key** and a
   **private key**.
2. The public key is embedded in every challenge book you
   distribute. It's safe to share — it can only **encrypt**,
   never **decrypt**.
3. When a pupil submits, their browser **encrypts** the
   submission using that public key, then sends the encrypted
   blob to the backend.
4. The backend stores the ciphertext. It can't decrypt it.
5. When you open the **Analyse** tab, your browser fetches the
   ciphertext, **decrypts** it with your private key (held
   only on your device), and shows the results.

If the backend is compromised — server hacked, vendor goes
rogue, IT admin gets curious — the attacker sees encrypted
blobs they can't read.

## Class lists + anonymised user numbers

Pupils don't log in with names. Instead, you build a **class
list** (in the Class List tab of the editor): just a list of
usernames you choose. karaweb deterministically derives a
**6-digit user code** from each username + a class-code salt
("PDB25-26-Y10A" or similar).

You hand each pupil their username + their 6-digit code (the
export button generates a printable `.txt`). They enter both
when they sign in to the book.

## The class mask

When the pupil submits, **only the 6-digit code** travels to
the backend — never the username. The backend sees rows like
`code=472901, challenge=foo, passed=true` and has no way to
know which child that is.

In the **Analyse** tab, you pick a **class mask** — your
locally-stored class list. karaweb uses it to translate codes
back to usernames in the on-screen grid. The translation
happens in your browser; the username never leaves your
device.

This means:

- A submitted result that doesn't match any code in your
  class list shows as "unknown" — useful for spotting typos
  or somebody using a code that wasn't issued
- If you lose your class list, results are unreadable to you
  too — the codes alone don't tell you who anyone is
- A different teacher loading the same book sees codes only,
  unless you share your class list with them

## What pupils see vs what you see

| Pupil | You |
| ----- | --- |
| Their own progress (✅ / ❌) | The whole class's progress grid |
| Their own latest submission code | The decrypted full code of every submission |
| Their username + 6-digit code | Class-mask-mapped names + codes side by side |
| Nothing about other pupils | Per-challenge submission timestamps, last-changed flags |

## When NOT to use cloud save

- Ad-hoc lessons where you don't need to mark anything
- One-off practice during revision week
- Demos and trial lessons where you haven't set up a
  backend yet

You can mix and match — your book can omit the cloud-save
block entirely and pupils work without submitting. Add it
when you're ready.

Next: [Backend setup](?tutorial=backends).

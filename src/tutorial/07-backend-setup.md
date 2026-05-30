# Backend setup

You have a choice of two backends for cloud-save submissions.
You pick one per book (or per teacher; same choice usually
applies to everything you make).

## Google Drive (Apps Script) — recommended for most schools

A small Google Apps Script you deploy under **your own Google
account**, which writes submissions to a Google Sheet in your
own Drive.

**Pros**

- Free, no third-party signup
- Data sits in your school Google Workspace (familiar IT
  surface)
- Spreadsheet view of raw results is sometimes useful

**Cons**

- Apps Script setup involves pasting code into the
  script.google.com editor and deploying as a Web App
- Apps Script quotas can throttle very large classes (rare in
  practice)

**Walkthrough**: Cloud Save tab → **Google Drive** → click
through the wizard. It generates a script for you with your
public key baked in, you paste it into a fresh Apps Script
project, deploy as Web App, and paste the deployment URL back
into karaweb. ~5 minutes once you've done it once.

## Codehooks — recommended if Apps Script isn't an option

A serverless JavaScript backend at codehooks.io (free tier
generous enough for most schools).

**Pros**

- Web-UI signup, project creation, deploy — no script editor
- Slightly faster student-facing performance
- Built-in admin dashboard for inspecting (encrypted) rows

**Cons**

- Another external account to manage
- Free-tier limits exist (very rarely hit in school usage)

**Walkthrough**: Cloud Save tab → **Codehooks** → wizard
guides you through signup + project URL paste. Same ~5 minute
setup.

## Turnstile bot protection (you don't have to do anything)

Both backends front their write endpoints with **Cloudflare
Turnstile** — invisible CAPTCHA proving the request came from
a real browser, not a script flood. The widget loads
automatically; pupils see a small badge briefly. You don't
configure anything.

The verification secret lives only in a small Cloudflare
Worker that the backends call server-to-server. See the
[School IT appendix](?tutorial=school-it) for why this URL
doesn't need to be on the school allowlist.

## Optional: password-protect your keydetails

When you generate keydetails you can tick **Password-protect**.
This encrypts your **private key** with an 8-character
password. If your keydetails file leaks (lost laptop, accidental
share), the attacker still can't decrypt submissions without
the password.

- You're prompted for the password the first time per session
  it's needed
- You can later **Add**, **Change**, or **Remove** the
  password from the Teacher Keys tab — the public key never
  changes, so books and backends keep working
- **There is no password reset.** Lose it and you lose the
  ability to read submissions. Write it down somewhere safe

## Rate limits + practical considerations

Both backends apply per-class submission caps and short
burst-rate limits to protect against rogue scripts. In normal
use a class of 30 hitting Submit at the same time will be
fine. If a pupil sees a "queued" indicator briefly, their
submission was rate-limited and will retry automatically when
the cap clears.

## Switching backends

You can switch backends between books (or even regenerate the
cloud-save block for an existing book) — your keydetails
keypair is reused either way, so previously-submitted results
remain decryptable as long as you keep the same keydetails.

Next: [Appendix — School IT](?tutorial=school-it).

# Appendix — School IT / firewall configuration

A short summary you can hand to your school's IT department.
For the canonical, always-up-to-date version with verification
links into the source code, send them to
<https://github.com/bakerpdgit/karaweb/blob/main/SCHOOL-IT.md>.

karaweb is a static single-page app — there is **no
karaweb-side server collecting student data**. Origins below
are either Cloudflare's Turnstile widget, a CDN serving public
static assets, or the cloud-save backend your school has
chosen.

## Required to use the app at all

| Origin | Purpose |
| --- | --- |
| `karaweb.classinteractives.co.uk` | The app itself |
| `challenges.cloudflare.com` | Cloudflare Turnstile bot-check widget |
| `cdn.jsdelivr.net` | Pyodide (Python runtime) + Monaco (code editor), pinned versions |

Blocking any of these prevents the app from loading or
prevents Python / Blocks mode from working.

## Required only if you use cloud-save

karaweb works fully offline. Cloud save is optional. If you
use it, one of the following needs to be reachable depending
on which backend your book uses:

| Origin | When |
| --- | --- |
| `script.google.com` / `script.googleusercontent.com` | Google Drive / Apps Script backend |
| `<teacher-project>.api.codehooks.io` | Codehooks backend |

In both cases the submission payload is end-to-end encrypted
(RSA-OAEP). The receiving server stores ciphertext only; only
the teacher can decrypt.

## Analytics (blocking these is fine)

karaweb loads a single Google Analytics 4 tag for aggregate
traffic stats. Blocking it has no effect on functionality.

| Origin |
| --- |
| `www.googletagmanager.com` |
| `*.google-analytics.com` |

## Optional — only for GitHub-hosted challenge files

| Origin | When |
| --- | --- |
| `raw.githubusercontent.com` / `gist.githubusercontent.com` | Teacher distributes a book via a `?challenges=…` deep-link |

## What karaweb does NOT contact

- No tracking SDKs beyond the one GA4 tag
- No advertising networks
- No social-login providers
- **`karaweb-turnstile-proxy.bakerpd.workers.dev`** is sometimes
  visible in audit logs but is **never connected to from the
  student's browser** — it's the server-to-server Turnstile
  verification path called by the cloud-save backend's
  servers, not by students

## Privacy summary

- Student work stays on the student's device until the
  student finishes a challenge and the teacher has enabled
  cloud-save
- Submissions are encrypted in the browser using the
  teacher's public key before being sent
- No karaweb-controlled server receives student data
- The app stores progress in `localStorage` / `sessionStorage`
  on the student's device only

## Verification

For the canonical list with source-code links proving each
origin's role, see
<https://github.com/bakerpdgit/karaweb/blob/main/SCHOOL-IT.md>.
The open-source code at
<https://github.com/bakerpdgit/karaweb> implements exactly
what's described.

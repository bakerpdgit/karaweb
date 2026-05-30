# karaweb — School IT allowlist

For school IT administrators. **Audience: you decide what to allow
through the web filter.** This page lists every third-party origin a
student's browser contacts when using
[karaweb.classinteractives.co.uk](https://karaweb.classinteractives.co.uk),
what each is for, and what data it sees. Nothing here is hidden —
the open-source code at
<https://github.com/bakerpdgit/karaweb> implements exactly what's
described.

karaweb is a browser-based programming environment for school pupils
(a re-implementation of the _Kara the Ladybug_ educational tool with
Blockly, Python, and finite-state-machine modes). It is a static
single-page app — there is no karaweb-side server collecting student
data. Everything else listed below is either a CDN serving public
static assets or a teacher-chosen cloud-save backend that receives
encrypted submissions.

---

## Required to use the app at all

| Origin                            | Purpose                                                                                                                                                                             | What it sees                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `karaweb.classinteractives.co.uk` | The app itself (HTML, JS, CSS, service worker)                                                                                                                                      | Standard static-asset requests; no PII                                                                                         |
| `challenges.cloudflare.com`       | [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) bot-check widget loaded on every page; produces a single-use token submitted with cloud-save uploads           | Cloudflare's bot-detection signals (browser fingerprint, timing). No PII, no student work content                              |
| `cdn.jsdelivr.net`                | Static CDN for two pinned third-party libraries:<br>• Pyodide WebAssembly Python runtime — `/pyodide/v0.28.0/full/*`<br>• Monaco code editor — `/npm/monaco-editor@0.55.1/min/vs/*` | Standard HTTPS GETs for immutable, version-pinned JavaScript / WASM files. Same CDN used by Microsoft, jQuery, Bootstrap, etc. |

Blocking any of these will prevent the app from loading or prevent
Python / Blocks mode from working.

---

## Required only if your teacher uses cloud-save

karaweb works fully offline (Blockly + Python + FSM all run in the
browser). Cloud-save is an optional teacher-controlled feature for
submitting completed exercises to a results spreadsheet. There are
two backends; your teacher picks one and embeds the URL into the
challenges file they distribute.

| Origin                                               | When                                                                                                          | What it sees                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `script.google.com` → `script.googleusercontent.com` | Teacher chose the **Google Drive / Apps Script** backend                                                      | An encrypted submission blob (RSA-OAEP envelope). The teacher's Google account stores it; only the teacher can decrypt it with their private key |
| `<teacher-project>.api.codehooks.io`                 | Teacher chose the **Codehooks** backend (the `<teacher-project>` subdomain is visible in the challenges file) | Same encrypted submission blob, stored in the teacher's Codehooks project                                                                        |

In both cases the submission **payload is end-to-end encrypted**.
The receiving server stores ciphertext only; the decryption key is
held on the teacher's device.

---

## Analytics (blocking these is fine — doesn't break the app)

karaweb loads a single Google Analytics 4 tag so the maintainer can
see aggregate traffic levels (page views, country, browser).
Blocking the analytics origins below has no effect on app
functionality — students can still use every feature.

| Origin                                                          | Purpose                                                                  | What it sees                                                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `www.googletagmanager.com`                                      | Loads the GA4 script (`gtag.js`) — see `index.html`                      | Standard CDN GET                                                                                                                                                                                          |
| `*.google-analytics.com` (typically `region1.google-analytics.com`) | Receives page-view / session pings from `gtag.js`                        | Standard GA4 telemetry: page URL, referrer, anonymised IP / country, browser+device, GA-issued client ID cookie. **No student work content, no submissions data, no PII collected by karaweb's own code** |

There is **no other** analytics, telemetry, or tracking SDK in the
app (no Facebook pixel, no Hotjar, no third-party feature-flag
services, no error-reporting telemetry).

---

## Optional — only if a teacher uses GitHub-hosted challenge files

| Origin                                                     | When                                                                                       | What it sees                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `raw.githubusercontent.com` / `gist.githubusercontent.com` | Teacher distributes a challenges book via a GitHub URL using the `?challenges=…` deep-link | One HTTPS GET for a public, plain-text JSON file. No upload, no auth |

---

## What karaweb does NOT contact

Worth saying explicitly:

- **No tracking SDKs beyond a single Google Analytics 4 tag** (see
  the Analytics section above for details) — no Facebook pixel, no
  Hotjar, no error-reporting telemetry, no feature-flag services
- **No advertising networks**
- **No social-login providers** — no Google / Microsoft / Apple
  sign-in for students; the only "login" is a per-class
  teacher-issued name + code stored locally in the browser
- **The Turnstile verification proxy** — a small Cloudflare Worker
  that holds the Turnstile verification secret. Both cloud-save
  backends (Google Apps Script and Codehooks) call it
  _server-to-server_ from their own servers when verifying a
  submission's bot-check token. The **student's browser never
  connects to it**, so allowing or blocking it on the school
  network has no effect on students. It lives on the
  `classinteractives.co.uk` zone at
  `https://karaweb.classinteractives.co.uk/api/verify-turnstile`,
  so it shares the same hostname as the app itself — only the path
  differs

---

## Privacy summary

- Student work stays on the student's device until the student
  finishes a challenge and the teacher has enabled cloud-save
- Submissions are encrypted in the browser using the teacher's
  public key before being sent
- No karaweb-controlled server receives student data
- The app stores progress in `localStorage` / `sessionStorage` on
  the student's device only

---

## Verification

The source of truth for each origin above is the open-source code:

- `www.googletagmanager.com` / `*.google-analytics.com` — [index.html](https://github.com/bakerpdgit/karaweb/blob/main/index.html) (the only GA tag in the codebase; grep for `gtag` to confirm)
- `challenges.cloudflare.com` — [src/utils/turnstile.js](https://github.com/bakerpdgit/karaweb/blob/main/src/utils/turnstile.js)
- `cdn.jsdelivr.net` (Pyodide) — [public/pyodide-worker.js](https://github.com/bakerpdgit/karaweb/blob/main/public/pyodide-worker.js)
- `cdn.jsdelivr.net` (Monaco) — pinned via `@monaco-editor/react` (see [package.json](https://github.com/bakerpdgit/karaweb/blob/main/package.json))
- `script.google.com` — [src/utils/googleDrive/googleDriveClient.js](https://github.com/bakerpdgit/karaweb/blob/main/src/utils/googleDrive/googleDriveClient.js)
- `*.api.codehooks.io` — [src/utils/codehooksClient.js](https://github.com/bakerpdgit/karaweb/blob/main/src/utils/codehooksClient.js)
- GitHub raw — [src/utils/normaliseChallengesUrl.js](https://github.com/bakerpdgit/karaweb/blob/main/src/utils/normaliseChallengesUrl.js)

Questions or to request additional information: Via Github Contact

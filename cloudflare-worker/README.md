# karaweb Turnstile proxy (Cloudflare Worker)

A 100-line Worker that holds the Cloudflare Turnstile **secret key**
server-side so that the per-class Apps Scripts shipped to teachers do
not embed it in client-reachable code.

The Worker is called server-to-server from each teacher's deployed
Apps Script via `UrlFetchApp.fetch(...)`. The student's browser
renders the Turnstile widget using only the **site key** (public).

## Routes

```
POST  /api/verify-turnstile   body: { "tkn": "<token>" }
                              → { success: bool, errors?: [...] }
```

## One-time setup

```powershell
npm i -g wrangler
wrangler login

# from karaweb repo root:
cd cloudflare-worker
wrangler secret put TURNSTILE_SECRET_KEY
# paste your Cloudflare Turnstile *secret* key when prompted

wrangler deploy
```

After deploy, edit `wrangler.toml` to uncomment the `[[routes]]` block
with your real zone/hostname (e.g. `karaweb.classinteractives.co.uk`),
then `wrangler deploy` again.

## Local development

```powershell
wrangler dev
# Worker listens on http://127.0.0.1:8787
```

Point the KaraWeb dev app at the local Worker by setting
`VITE_TURNSTILE_PROXY_URL=http://127.0.0.1:8787` in `.env.local`.

The Apps Script you deploy for dev testing should hardcode the same URL
inside `__VERIFY_PROXY_URL__` (generated for you by the wizard's
**Download dev script** button when `VITE_SKIP_TURNSTILE=true`).

## Smoke test

```powershell
curl -X POST https://karaweb.classinteractives.co.uk/api/verify-turnstile `
  -H "Content-Type: application/json" `
  -d '{\"tkn\":\"clearly-fake-token\"}'
# Expect: { "success": false, "errors": ["invalid-input-response"] }
```

# Codehooks.io Backend Setup

This guide is for setting up the optional cloud submission backend for Unitester. The main Unitester website is still a static HTML/CSS/JS site; Codehooks is only used for the API/database that receives encrypted student submissions.

The important split is:

- **On your local development machine:** you run `npm`, `coho`, and deploy the backend code in `codehooks-backend/`.
- **On the Codehooks website/Studio:** you create or inspect the Codehooks project, view logs/data, and manage settings visually if preferred.
- **In the deployed Unitester website:** students and teachers call the Codehooks API through `codehooks_config.json`.

## 1. Install And Log In To Codehooks CLI

Run these commands in PowerShell on your local development machine. You can run them from any folder.

```powershell
npm i -g codehooks
coho login
```

`coho` is the Codehooks command-line tool. The longer `codehooks` command usually works too, but this documentation uses `coho`.

The login command opens a browser. When it says authentication is complete, close the browser tab and return to PowerShell.

## 2. Create Or Link A Codehooks Project

You need one Codehooks project and one space/environment. The usual starter space is `dev`.

Choose one route:

### Option A: You Already Created A Project In Codehooks Studio

Use this if you created a project on the Codehooks website.

1. Find the project name in Codehooks Studio. It is the short project id/name used in URLs, for example `unitester-submissions-a1b2`.
2. In PowerShell, go to this repository's backend folder:

   ```powershell
   cd C:\Users\baker\Documents\Githubs\unitester\codehooks-backend
   ```

   If you are already in the repository root, this shorter command is enough:

   ```powershell
   cd codehooks-backend
   ```

3. Link this local folder to the existing Codehooks project:

   ```powershell
   coho init --empty --projectname YOUR_PROJECT_NAME --space dev
   ```

   Replace `YOUR_PROJECT_NAME` with the project name from Codehooks Studio.

This creates the local Codehooks project config file in `codehooks-backend/`. Without that local config, `coho deploy` does not know which Codehooks project/space to deploy to.

### Option B: Create A New Project From The CLI

Use this if you have not created a Codehooks project yet.

```powershell
cd codehooks-backend
coho create unitester --here --empty
```

If Codehooks adds a random suffix, use the full generated project name in later commands. It shows your the name for the project in the response to the create command.

## 3. Install Backend Dependencies

Still in `codehooks-backend/`, run:

```powershell
npm install
```

This installs the backend dependency `codehooks-js`. It does not install anything into the static Unitester website.

## 4. Check The Linked Project

Run:

```powershell
coho info --projectname YOUR_PROJECT_NAME --space dev --examples
```

This confirms the project/space exists and usually prints example API URLs. Your Unitester API base URL will be:

```text
https://YOUR_PROJECT_NAME.api.codehooks.io/dev
```

If your Codehooks plan supports additional spaces and you later deploy to a `prod` space instead, the URL becomes:

```text
https://YOUR_PROJECT_NAME.api.codehooks.io/prod
```

Use the exact project name and space you are deploying to.

## 5. Deploy The Backend

“Deploy `codehooks-backend`” means: from your **local** `codehooks-backend/` folder, upload the backend JavaScript in `index.js` to your Codehooks project/space.

Run this from:

```text
\codehooks-backend
```

Command:

```powershell
npm run deploy -- --projectname YOUR_PROJECT_NAME --space dev
```

Or directly:

```powershell
coho deploy --projectname YOUR_PROJECT_NAME --space dev
```

For the live site, use a locked space with origin checks and Turnstile enabled. If your Codehooks plan supports additional spaces, create a separate `prod` space:

```powershell
coho add --projectname YOUR_PROJECT_NAME --space prod
coho deploy --projectname YOUR_PROJECT_NAME --space prod
```

If Codehooks says you need a PRO subscription to add spaces, keep using `dev` as your live space and lock that `dev` space down instead. That is the current setup for `unitester-owyr`.

After a successful deploy, the backend routes are:

```text
GET  https://YOUR_PROJECT_NAME.api.codehooks.io/SPACE/api/public/health
POST https://YOUR_PROJECT_NAME.api.codehooks.io/SPACE/api/public/submissions
GET  https://YOUR_PROJECT_NAME.api.codehooks.io/SPACE/api/public/submissions/:submissionGuid
POST https://YOUR_PROJECT_NAME.api.codehooks.io/SPACE/api/public/teacher/challenge
POST https://YOUR_PROJECT_NAME.api.codehooks.io/SPACE/api/public/teacher/session
GET  https://YOUR_PROJECT_NAME.api.codehooks.io/SPACE/api/public/teacher/submissions/:testId
DELETE https://YOUR_PROJECT_NAME.api.codehooks.io/SPACE/api/public/teacher/submissions/:submissionGuid
```

Replace `SPACE` with `dev` or `prod`.

## 6. Fix For `undefined.api.codehooks.io/undefined`

If deploy fails with something like:

```text
https://undefined.api.codehooks.io/undefined/_A_D_M_deploy
```

the CLI is logged in, but the current folder is not linked to a Codehooks project/space.

Fix it:

```powershell
coho init --empty --projectname YOUR_PROJECT_NAME --space dev
coho deploy --projectname YOUR_PROJECT_NAME --space dev
```

If you are unsure of the project name, run:

```powershell
coho account
```

or look in Codehooks Studio at https://account.codehooks.io.

## 7. Configure Unitester Frontend

Back in the repository root:

```powershell
copy codehooks_config.template.json codehooks_config.json
```

Edit `codehooks_config.json`:

```json
{
  "apiBaseUrl": "https://YOUR_PROJECT_NAME.api.codehooks.io/dev",
  "turnstileSiteKey": "1x00000000000000000000AA",
  "turnstileRequired": true
}
```

For the live site, use whichever locked space you are actually deploying. If you have a paid plan with a `prod` space:

```json
{
  "apiBaseUrl": "https://YOUR_PROJECT_NAME.api.codehooks.io/prod",
  "turnstileSiteKey": "YOUR_CLOUDFLARE_TURNSTILE_SITE_KEY",
  "turnstileRequired": true
}
```

If your plan only has `dev`, keep the URL as `/dev` and lock the `dev` environment variables before real student use.

`codehooks_config.json` must be present on the public website, so commit and deploy the live version. It contains only public frontend configuration: the Codehooks API base URL and the Cloudflare Turnstile **site key**. Do not put the Turnstile secret key, teacher private key, Codehooks API tokens, or any other secret in this file.

## 8. Configure CORS And Referrer Checks

Run these from any folder. Replace `YOUR_PROJECT_NAME` and the space name if needed.

For the locked live space:

```powershell
coho set-env ALLOWED_ORIGINS "https://unitest.classinteractives.co.uk" --projectname YOUR_PROJECT_NAME --space LIVE_SPACE
coho set-env DISABLE_ORIGIN_CHECKS false --projectname YOUR_PROJECT_NAME --space LIVE_SPACE
```

Use `LIVE_SPACE` as `prod` if you have created a production space, or `dev` if your Codehooks plan only has the starter space.

For first local testing only, you can temporarily disable the origin/referrer checks:

```powershell
coho set-env DISABLE_ORIGIN_CHECKS true --projectname YOUR_PROJECT_NAME --space dev
```

Turn it back to `false` before real student use.

This setting only affects the Codehooks server. It does not change whether the browser shows Cloudflare Turnstile.

## 9. Configure Cloudflare Turnstile

Turnstile is Cloudflare’s free bot check.

1. Go to the Cloudflare dashboard.
2. Open **Turnstile**.
3. Create a widget for `unitest.classinteractives.co.uk`.
4. Copy the **site key** into `codehooks_config.json` as `turnstileSiteKey`.
5. Copy the **secret key** into Codehooks as an encrypted environment variable:

   ```powershell
   coho set-env TURNSTILE_SECRET_KEY "YOUR_TURNSTILE_SECRET_KEY" --projectname YOUR_PROJECT_NAME --space LIVE_SPACE --encrypted
   coho set-env TURNSTILE_REQUIRED true --projectname YOUR_PROJECT_NAME --space LIVE_SPACE
   ```

For local testing, Cloudflare provides dummy keys. Put this in `codehooks_config.json`:

```json
{
  "turnstileSiteKey": "1x00000000000000000000AA"
}
```

And set the matching dummy secret in Codehooks:

```powershell
coho set-env TURNSTILE_SECRET_KEY "1x0000000000000000000000000000000AA" --projectname YOUR_PROJECT_NAME --space dev --encrypted
coho set-env TURNSTILE_REQUIRED true --projectname YOUR_PROJECT_NAME --space dev
```

If you need to test without Turnstile while wiring the UI:

```powershell
coho set-env TURNSTILE_REQUIRED false --projectname YOUR_PROJECT_NAME --space dev
```

Also set the local browser config to skip rendering the Turnstile widget:

```json
{
  "apiBaseUrl": "https://YOUR_PROJECT_NAME.api.codehooks.io/dev",
  "turnstileSiteKey": "YOUR_SITE_KEY_OR_TEST_KEY",
  "turnstileRequired": false
}
```

Use the exact spelling `TURNSTILE_REQUIRED` in Codehooks and remove any misspelled duplicate variable so there is only one setting to reason about.

If the browser console shows Cloudflare Turnstile error `110200` on localhost, the most likely cause is that `codehooks_config.json` still has `"turnstileRequired": true` with a production site key that is not valid for localhost. Either set `"turnstileRequired": false` for local testing, or use Cloudflare's localhost-compatible test site key.

## 10. Configure Teacher Private-Key Cloud Fetch

The Analyse page fetches cloud submissions by proving it can decrypt a short-lived Codehooks challenge with `keydetails.txt`.

Store the teacher public key in Codehooks. From the repository root:

```powershell
$publicKeyB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content .\publickey.txt -Raw)))
coho set-env TEACHER_PUBLIC_KEY_B64 $publicKeyB64 --projectname YOUR_PROJECT_NAME --space LIVE_SPACE
```

Again, use `LIVE_SPACE` as `prod` if you have one, otherwise use `dev`.

The backend encrypts each challenge with this public key. The browser decrypts the challenge with the private key that Analyse already has after unlock, then Codehooks issues a short-lived session token held only in browser memory.

Without `TEACHER_PUBLIC_KEY_B64`, students can still submit, but Analyse cannot fetch cloud submissions because Codehooks cannot create a private-key challenge.

Analyse can also permanently delete a cloud submission when the teacher enables that option in the settings dialog. Deletion uses the same private-key session token as cloud fetches and deletes by `submissionGuid`.

## 11. Quick Smoke Tests

Health check:

```powershell
Invoke-WebRequest `
  -Uri "https://YOUR_PROJECT_NAME.api.codehooks.io/LIVE_SPACE/api/public/health" `
  -Headers @{ Origin = "https://unitest.classinteractives.co.uk" } `
  -UseBasicParsing
```

Expected: HTTP 200 and JSON containing `"status":"ok"`.

Teacher submissions without a private-key session:

```powershell
Invoke-WebRequest `
  -Uri "https://YOUR_PROJECT_NAME.api.codehooks.io/LIVE_SPACE/api/public/teacher/submissions/001" `
  -Headers @{ Origin = "https://unitest.classinteractives.co.uk" } `
  -UseBasicParsing
```

Expected: unauthorized.

Teacher challenge creation:

```powershell
Invoke-WebRequest `
  -Method POST `
  -Uri "https://YOUR_PROJECT_NAME.api.codehooks.io/LIVE_SPACE/api/public/teacher/challenge" `
  -Headers @{ Origin = "https://unitest.classinteractives.co.uk" } `
  -ContentType "application/json" `
  -Body "{}" `
  -UseBasicParsing
```

Expected: HTTP 200 and an encrypted challenge. The browser completes the remaining session step after decrypting that challenge with `keydetails.txt`.

## 12. What Codehooks Stores

The Codehooks NoSQL collection is called `submissions`.

Readable fields:

- `_id`
- `schemaVersion`
- `testId`
- `submissionGuid`
- `submittedAt`
- `receivedAt`

Encrypted fields:

- `teacherPayload`
- `reviewPayload`

Codehooks does **not** store plaintext usernames, answers, IP hashes, user-agent strings, or username hashes.

Student-downloaded result files are different from cloud records. The current downloaded file is a v4 student-owned review copy: its answers are encrypted locally with AES-GCM using a key derived from the student's username, while the submission GUID and basic test metadata remain readable. This lets the student reopen the file later if browser state is cleared, but they must type the same username. The cloud `teacherPayload` remains encrypted with the teacher public key, and the cloud `reviewPayload` is encrypted client-side with a key derived from the random submission GUID. Analyse accepts older teacher-encrypted downloaded files, v3 clear student-owned files, and current v4 username-encrypted files. For v4 uploads, Analyse derives the key from the text after the last underscore in the filename before `.txt`.

## 13. Automatic Data Retention Cleanup

Cloud submissions are retained for two years from the server-side `receivedAt` timestamp. When a teacher successfully fetches cloud submissions from Analyse, Codehooks first removes any `submissions` records older than two years. It also clears expired teacher challenge and session records.

This is deliberately done server-side after the teacher private-key session has been validated. It does not rely on student browsers and it does not inspect encrypted payload contents.

## Useful References

- Codehooks CLI: https://codehooks.io/docs/cli
- Codehooks quickstart: https://codehooks.io/docs/quickstart-cli
- Codehooks routes: https://codehooks.io/docs/rest-api-app-routes
- Codehooks auth hooks: https://codehooks.io/docs/authhooks
- Codehooks database: https://codehooks.io/docs/nosql-database-api
- Codehooks encrypted env vars: https://codehooks.io/docs/application-secrets
- Turnstile client widget: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- Turnstile server validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Turnstile test keys: https://developers.cloudflare.com/turnstile/troubleshooting/testing/

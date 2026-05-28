# Quick Start

## Local Static App

Serve the repository over HTTP, then open `index.html`.

```bash
npx http-server . -p 8080
```

The app can still run without cloud storage. If `codehooks_config.json` is missing, result files download locally and cloud submission is skipped.

## Enable Codehooks Storage

1. Install and log in to the Codehooks CLI:
   ```powershell
   npm i -g codehooks
   coho login
   ```
2. Create a Codehooks project in Codehooks Studio or with `coho create`.
3. Link the local backend folder to that project:
   ```powershell
   cd C:\Users\baker\Documents\Githubs\unitester\codehooks-backend
   coho init --empty --projectname YOUR_PROJECT_NAME --space dev
   npm install
   coho deploy --projectname YOUR_PROJECT_NAME --space dev
   ```
4. Copy `codehooks_config.template.json` to `codehooks_config.json` in the repo root.
5. Set `apiBaseUrl` to `https://YOUR_PROJECT_NAME.api.codehooks.io/dev`.
6. Commit and deploy `codehooks_config.json` with the live static site. It is public frontend config, not a secret.
7. Follow `CODEHOOKS_SETUP.md` for Turnstile, CORS/referrer checks, and teacher private-key cloud fetch. The backend must have `TEACHER_PUBLIC_KEY_B64` set from `publickey.txt`.

If deploy mentions `undefined.api.codehooks.io/undefined`, the backend folder has not been linked with `coho init` yet.

## Student Flow

Students complete a test, pass Turnstile when configured, and download a result file. The current downloaded v4 file is a student-owned review copy encrypted with a key derived from the student's username, so the student must enter the same username to review directly from the file later. Cloud copies remain encrypted separately.

## Teacher Flow

Open `analyse.html`, unlock with `keydetails.txt`, select a test, then either fetch cloud submissions or add saved result files. Cloud fetch now uses a private-key challenge. Analyse can parse older teacher-encrypted result files, v3 clear student-owned files, and current v4 username-encrypted files. For v4 uploads, Analyse derives the result-file key from the text after the last underscore in the filename before `.txt`.

The cogwheel on Analyse contains grid settings: hide names, duplicate handling, right/wrong versus selected-choice display, and whether removing a cloud row should permanently delete it from Codehooks.

When a teacher fetches cloud submissions, the backend also performs housekeeping: submission records with a server `receivedAt` timestamp older than two years are deleted, along with expired teacher challenge/session records.

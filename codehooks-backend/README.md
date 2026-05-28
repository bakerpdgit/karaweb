# KaraWeb Cloud Save backend

This folder contains the codehooks.io backend that receives anonymous
challenge results from students and serves them back (encrypted) to
teachers who can prove possession of the matching class private key.

Full setup instructions are presented inline in the KaraWeb app's
**Cloud Save** tab. This README is a quick CLI reference.

## Quick start

```powershell
npm i -g codehooks
coho login

cd codehooks-backend
npm install

# Link to an existing project or create a new one:
coho init --empty --projectname YOUR_PROJECT_NAME --space dev

# Deploy:
npm run deploy -- --projectname YOUR_PROJECT_NAME --space dev

# Lock down (replace ORIGIN with your KaraWeb deploy URL):
coho set-env ALLOWED_ORIGINS "https://your-karaweb-site.example" --projectname YOUR_PROJECT_NAME --space dev
coho set-env DISABLE_ORIGIN_CHECKS false --projectname YOUR_PROJECT_NAME --space dev
coho set-env TURNSTILE_SECRET_KEY "YOUR_TURNSTILE_SECRET_KEY" --projectname YOUR_PROJECT_NAME --space dev --encrypted
coho set-env TURNSTILE_REQUIRED true --projectname YOUR_PROJECT_NAME --space dev
```

The deployed API base URL is:

```
https://YOUR_PROJECT_NAME.api.codehooks.io/dev
```

Paste that into the KaraWeb **Cloud Save** tab and click **Test & register class**.

## Endpoints

| Method | Path                                              | Purpose                                           |
| ------ | ------------------------------------------------- | ------------------------------------------------- |
| GET    | `/api/public/health`                              | Liveness check                                    |
| POST   | `/api/public/class/register`                      | Register or update a class (trust-on-first-use)   |
| POST   | `/api/public/teacher/challenge`                   | Begin challenge-response auth for a class         |
| POST   | `/api/public/teacher/session`                     | Complete auth, receive a 2-hour bearer token      |
| POST   | `/api/public/results`                             | Student submits an encrypted result               |
| GET    | `/api/public/teacher/results/:classCode`          | Teacher fetches all encrypted results for a class |
| DELETE | `/api/public/teacher/results/:classCode/:recordId`| Teacher removes a single result                   |

## Data retention

Results are kept for 2 years from `receivedAt`. Each successful teacher
fetch first removes any results older than that, plus expired teacher
challenges/sessions.

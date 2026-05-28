# Unitester Codehooks Backend

Run Codehooks commands from this folder:

```powershell
cd C:\Users\baker\Documents\Githubs\unitester\codehooks-backend
```

If you already created a project in Codehooks Studio, link this folder before deploying:

```powershell
coho init --empty --projectname YOUR_PROJECT_NAME --space dev
npm install
coho deploy --projectname YOUR_PROJECT_NAME --space dev
```

If `coho deploy` mentions `undefined.api.codehooks.io/undefined`, this folder is not linked to a project/space yet. Run `coho init --empty --projectname YOUR_PROJECT_NAME --space dev` and retry.

Full setup instructions are in `../CODEHOOKS_SETUP.md`.

Required live environment variables include:

- `ALLOWED_ORIGINS`
- `DISABLE_ORIGIN_CHECKS=false`
- `TURNSTILE_REQUIRED=true`
- encrypted `TURNSTILE_SECRET_KEY`
- `TEACHER_PUBLIC_KEY_B64` generated from `../publickey.txt`

Teacher cloud fetches trigger housekeeping: submissions older than two years by server `receivedAt` timestamp are removed, and expired teacher challenge/session records are cleared.

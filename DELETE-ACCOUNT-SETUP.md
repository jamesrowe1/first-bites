# First Bites — self-service account deletion

This patch makes **Settings → Privacy & account → Delete my account** delete the currently signed-in Supabase Auth user immediately after the user types `DELETE`.

## Why an Edge Function is required

Deleting an Auth user requires Supabase's server-only admin API and a secret/service-role key. That key must never be placed in React, Vite environment variables, GitHub, or the Android app. The Edge Function runs inside Supabase and receives Supabase's secret key through its protected server environment.

## 1. Run the SQL deletion-support migration

Open `supabase/account-deletion-support.sql`, copy all of it, and run it once in **Supabase → SQL Editor**. It is safe to run again if you already ran the earlier privacy patch version.

The trigger runs immediately before the Auth user is deleted. It:

- removes food logs and favorites attributed to the deleting user;
- transfers any household they own to the oldest remaining member;
- deletes an owned household if no other member remains;
- allows normal foreign-key cascades to remove their profile and memberships.

## 2. Deploy the `delete-account` Edge Function

### Option A — Supabase Dashboard

1. Open **Supabase → Edge Functions**.
2. Create a function named exactly `delete-account`.
3. Replace the generated code with the contents of `supabase/functions/delete-account/index.ts`.
4. Deploy the function.
5. Keep JWT verification enabled. Do not make this a public/no-JWT function.

Supabase provides `SUPABASE_URL` and its server secret keys automatically to hosted Edge Functions. You do not need to put a service-role/secret key in this repository.

### Option B — CLI (Git Bash)

From the First Bites repository:

```bash
npx supabase login
npx supabase link --project-ref honfqodxixljcmlavpxe
npx supabase functions deploy delete-account --use-api
```

If the local Supabase project has never been initialized, run `npx supabase init` first. Do not run `supabase db reset` against your production project.

## 3. Test locally against production Supabase

Run:

```bash
npm run dev
```

Create a disposable test account, join/create a disposable household, then use **Settings → Privacy & account → Delete my account**. Type `DELETE`.

After deletion:

- the app should return to the signed-out screen;
- the test user should disappear from **Supabase → Authentication → Users**;
- their First Bites profile/membership should be gone;
- shared household ownership should transfer if applicable.

Do not use your real account for the first deletion test.

## 4. Publish the web changes

```bash
git add .
git commit -m "Add self-service account deletion"
git push
```

Vercel will deploy the React/public-page changes. The Edge Function is deployed separately to Supabase.

## Public deletion URL for Google Play

Keep using:

`https://first-bites-roan.vercel.app/delete-account/`

The page now tells signed-in users to delete directly in the app and keeps email as the fallback for someone who cannot sign in.

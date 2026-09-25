# First Bites

A mobile-first React PWA for families to track a child's foods, favorites, allergen exposures, reactions, and food history. This version supports **multiple individual users**, **multiple households**, and **multiple children**.

## What v0.2 adds

- Individual accounts instead of one shared login
- Google sign-in through Supabase Auth
- Email/password sign-in and sign-up
- Household creation and invite codes
- Multiple caregivers in one household
- Multiple children per household
- Shared child food history and favorites
- `logged_by` attribution so you can see which caregiver recorded an entry
- Supabase Row Level Security so users can only access households they belong to

## 1. Requirements

Use Node 22+ (Node 24 is also fine) and Git.

```powershell
node -v
npm -v
git --version
```

## 2. Install locally

Create the project folder and extract this project into it, then:

```powershell
cd $HOME\Documents\first-bites
npm install
```

The multi-user version requires Supabase configuration before the app can be used.

## 3. Create a Supabase project

1. Go to https://supabase.com/dashboard and create a project.
2. In the Supabase dashboard, open **SQL Editor**.
3. Open `supabase/schema.sql` from this project.
4. Copy the entire file into the SQL Editor and run it once.

The v0.2 schema intentionally uses new table names such as `child_food_logs` and `child_favorites`. If you previously ran the old single-user starter SQL, those old tables can remain; v0.2 does not use them.

## 4. Connect React to Supabase

Copy the example environment file:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Fill in:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Use the **publishable** browser key, not a secret/service-role key.

Restart the dev server after changing `.env.local`:

```powershell
npm run dev
```

Then open the local URL Vite shows, normally `http://localhost:5173`.

## 5. Email/password accounts

Email/password login works through Supabase Auth. Depending on your Supabase Auth settings, new users may need to confirm their email before signing in.

The first user should:

1. Create an account.
2. Choose **Create a family**.
3. Name the household.
4. Add the first child.
5. Go to **Settings** and copy the household invite code.

A second caregiver should:

1. Create their own First Bites account.
2. Choose **Join a family**.
3. Enter the invite code.

Both accounts will then see the same children and shared food history.

## 6. Enable Google sign-in

The React code already contains the **Continue with Google** button. Google must be enabled in Supabase before it works.

### In Google Cloud / Google Auth Platform

1. Create or select a Google Cloud project.
2. Open **Google Auth Platform** and configure the app's Audience / Branding as needed.
3. Under **Data Access / Scopes**, make sure the standard OpenID profile scopes needed by Supabase are present.
4. Under **Clients**, create an OAuth client and choose **Web application**.
5. Add this authorized JavaScript origin while developing:

```text
http://localhost:5173
```

6. In Supabase, open **Authentication → Sign In / Providers → Google** and copy the callback URL shown there.
7. Add that Supabase callback URL to Google's **Authorized redirect URIs**.
8. Copy the Google Client ID and Client Secret into the Google provider settings in Supabase and enable the provider.

### In Supabase URL configuration

In **Authentication → URL Configuration**:

- Add `http://localhost:5173` as an allowed redirect URL during development.
- After deployment, add your production HTTPS URL too.

The app uses `window.location.origin` as the OAuth return location, so each origin you use must be allowed by Supabase.

## 7. How household security works

The app stores data like this:

```text
User account
   ↓
Household membership
   ↓
Child
   ↓
Food logs / favorites / allergen progress
```

Supabase Row Level Security checks household membership at the database level. A signed-in user can only read child data for a household they belong to.

The household invite code is used only to add the signed-in user to that household. Household creation and joining are handled by controlled database functions in `supabase/schema.sql`.

## 8. GitHub

Initialize the project:

```powershell
git init
git add .
git commit -m "Initial multi-user First Bites app"
git branch -M main
```

Make sure `.env.local` is not listed by `git status`; it is already excluded in `.gitignore`.

If you use GitHub CLI:

```powershell
gh auth login
gh repo create first-bites --private --source=. --remote=origin --push
```

Or create an empty private repository on GitHub and then:

```powershell
git remote add origin https://github.com/YOURUSERNAME/first-bites.git
git push -u origin main
```

## 9. Production build

```powershell
npm run build
npm run preview
```

The production build is created in `dist/`.

## 10. Deploy and install on Android

Deploy the GitHub repository to a static host such as Vercel. Add the same two environment variables to the host:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Then add the production URL to both Supabase Auth's allowed redirect URLs and Google's authorized JavaScript origins.

On Android, open the deployed HTTPS site in Chrome and choose **Install app** or **Add to Home screen**.

## Important security note

Never put a Supabase service-role key, database password, or Google Client Secret in `.env.local` or React code. The browser should only receive the Supabase project URL and publishable key. The Google Client Secret belongs in Supabase's provider settings.

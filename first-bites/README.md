# First Bites

A private, mobile-first React PWA for tracking baby foods, reactions, allergens, favorites, and progress. Designed to install on Android and optionally sync between two phones through Supabase.

## What is included

- Installable PWA
- Mobile-first bottom navigation
- Searchable starter food library
- Food logging and history
- 100-food progress counter
- Allergen exposure summary
- Favorites
- Baby profile
- Local demo mode when Supabase is not configured
- Shared cloud mode when Supabase is configured

## 1. Requirements

Install Node.js 22 LTS or newer, Git, and optionally GitHub CLI (`gh`).

Check:

```powershell
node -v
npm -v
git --version
gh --version
```

## 2. Install locally

From the project folder:

```powershell
npm install
npm run dev
```

Open the URL Vite prints (normally http://localhost:5173).

## 3. Set up Supabase sync

1. Create a Supabase project.
2. Open SQL Editor and run everything in `supabase/schema.sql`.
3. In the Supabase project, open **Connect** and copy the **Project URL** and **Publishable key**.
4. Copy `.env.example` to `.env.local`:

```powershell
Copy-Item .env.example .env.local
```

5. Edit `.env.local`:

```text
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

6. Restart the dev server.
7. Create one family account in First Bites. Use that same login on both phones.

`.env.local` is ignored by Git and should not be committed.

## 4. Build

```powershell
npm run build
npm run preview
```

## 5. Put it on GitHub

Using GitHub CLI:

```powershell
git init
git add .
git commit -m "Initial First Bites app"
git branch -M main
gh auth login
gh repo create first-bites --private --source=. --remote=origin --push
```

Or create an empty repository named `first-bites` on github.com, then:

```powershell
git init
git add .
git commit -m "Initial First Bites app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/first-bites.git
git push -u origin main
```

## 6. Deploy it

Recommended: connect the GitHub repo to Vercel or Netlify. Add these environment variables in the hosting dashboard:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Then deploy. On Android, open the deployed HTTPS site in Chrome, tap ⋮, then **Install app** / **Add to Home screen**.

## Safety

This app is for family record-keeping. Food preparation and allergen notes are general references, not a substitute for advice from a pediatrician or feeding professional. Always supervise eating and follow individualized medical guidance for allergies or feeding concerns.

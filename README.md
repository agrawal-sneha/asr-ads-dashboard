# ASR Ad-Library Brand Finder

A dashboard that turns the metapi.io → exclusion-filter → classify → image pipeline into a web app.
Enter keywords + a start date, click **Run discovery**, and get a deduped table of **net-new D2C brands**
(not on your exclusion list, spam/foreign/non-prospect pages removed), each classified into one of your 26
categories, with the ad creative image and a one-click CSV export.

## How it works
- **`app/api/scrape/route.ts`** — a serverless function. For one keyword it creates a metapi task, polls until
  done, and returns the ads. The **metapi API key lives only here** (`process.env.METAPI_KEY`) — never in the browser.
- **`lib/pipeline.ts`** — the exclusion matching (exact + substring + brand-base variants), spam/non-prospect/foreign
  filters, 26-category keyword classifier, dedupe, and CSV builder. Runs in the browser after the ads come back.
- **`app/page.tsx`** — the dashboard. It fires one `/api/scrape` request per keyword (4 at a time) so no single
  serverless call exceeds Vercel's timeout, aggregates the ads, filters/classifies them, and renders the table.
- **Exclusion list** is pasted into the UI and saved in your browser (`localStorage`). Update it any time —
  no redeploy needed. (Tip: keep it in sync with your "universal list" sheet.)

## Run locally (needs Node 18+)
```bash
cp .env.local.example .env.local      # put your real METAPI_KEY in it
npm install
npm run dev                            # http://localhost:3000
```

## Deploy to Vercel — option A: Git (recommended)
1. Push this folder to a new GitHub repo:
   ```bash
   git init && git add -A && git commit -m "ASR ad-library dashboard"
   gh repo create asr-ads-dashboard --private --source=. --push
   ```
2. Go to vercel.com → **Add New → Project** → import the repo.
3. In **Settings → Environment Variables**, add `METAPI_KEY` = your `mk_live_...` key.
4. **Deploy.** Done.

## Deploy to Vercel — option B: CLI
```bash
npm i -g vercel
vercel                       # log in + link the project
vercel env add METAPI_KEY    # paste your key (Production + Preview)
vercel --prod
```

## Notes & limits
- **Function timeout:** each keyword scrape is capped at ~50s and `maxDuration = 60`. Vercel Hobby allows 60s; if a
  metapi task is slow it returns 0 ads for that keyword rather than failing the run.
- **metapi quota:** each keyword pulls up to `count` ads against your plan's monthly record limit. The dashboard
  shows how many ads were scanned. If you hit `quota_exceeded`, the run returns fewer/zero brands.
- **Images:** ad creatives are Facebook CDN (`scontent…fbcdn.net`) URLs and **expire in ~2–4 weeks**. Download the
  CSV / re-host them if you need them long-term.
- **Access:** the deployed URL can run scrapes against your metapi quota. For an internal tool, protect it with
  [Vercel Authentication](https://vercel.com/docs/security/deployment-protection) (Settings → Deployment Protection)
  or put it behind a password.

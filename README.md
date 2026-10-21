# Review Saathi

Review Saathi is a multi-tenant QR review SaaS for local businesses. Customers submit ratings, tags and optional private feedback. Review drafts are editable and are never auto-posted to Google.

## Stack

- Next.js App Router and TypeScript
- Supabase Auth, Postgres and server-side admin access
- OpenAI draft generation with a deterministic fallback
- QR generation with `qrcode`
- Optional Upstash Redis rate limiting
- Vercel Cron for subscription expiry and retention maintenance

## Local development

1. Install Node.js LTS.
2. Copy `.env.example` to `.env.local` and fill in Supabase values.
3. Run the database setup described in `supabase/README.md`.
4. Install and start the app:

```bash
npm install
npm run dev
```

For QR testing from a phone on the same Wi-Fi, run `npm run dev:lan` and set `NEXT_PUBLIC_SITE_URL` to the computer's LAN URL.

## Main routes

- `/` — marketing page
- `/login`, `/forgot-password`, `/change-password` — authentication
- `/onboarding` — client setup
- `/r/[slug]` — public QR review flow
- `/client/dashboard`, `/client/qr`, `/client/reviews`, `/client/renew`, `/client/settings` — client workspace
- `/admin` — Super Admin workspace

## First Super Admin

For production, set `INITIAL_SUPER_ADMIN_EMAIL` and run:

```bash
npm run seed:superadmin
```

This sends a Supabase invite and allows the administrator to set a password securely. The seed is one-time and refuses to create a second Super Admin.

For local-only password seeding, use `seed:superadmin:local` only with `ALLOW_LOCAL_ADMIN_PASSWORD_SEED=true`. Never enable that flag in production.

## Database

The authoritative fresh-install schema is `supabase/final_schema.sql`. It includes the complete schema, starter plans, RLS, security grants, performance indexes, dashboard stats function and renewal/retention constraints. For a new project, run only that file. Existing-project guidance is documented in `supabase/README.md`.

## Production deployment

Recommended hosting:

- **Web app:** Vercel
- **Database and authentication:** Supabase
- **Optional rate limiting:** Upstash Redis
- **AI drafts:** OpenAI API

Vercel is recommended because this is already a Next.js app and `vercel.json` configures the daily cron endpoint. Add all values from `.env.example` to Vercel project settings, set `NEXT_PUBLIC_SITE_URL` to the production HTTPS URL, and redeploy after changing environment variables.

For a Windows-only private deployment, `start-review-saathi.bat` builds the production app and starts it on the LAN. It is not a replacement for a public HTTPS deployment.

## Retention and cron

The daily cron endpoint is `/api/cron/daily` and must receive the configured `CRON_SECRET` bearer token. It expires subscriptions, archives disabled clients after 90 days, and permanently purges operational data after 365 days from disablement.

## Handover checklist

- Apply the documented SQL order to the production Supabase project.
- Add production environment variables to Vercel; never upload `.env.local`.
- Run the Super Admin seed once.
- Verify login, onboarding, QR review submission, renewal approval, plan editing and the daily cron.
- Keep the Supabase service key and OpenAI key server-side only.
- Review Supabase backups and retention settings before launch.

## Verification commands

```bash
npm run typecheck
npm run build
```

# Supabase setup and migrations

## New project

Run these files once in the Supabase SQL Editor, in this order:

1. `final_schema.sql` — complete authoritative schema, policies, security grants, performance indexes, dashboard aggregation function, starter plans, retention index and one-pending-renewal constraint.
2. `production_final.sql` — production hardening, location/branch management, per-location QR links, facilities and required RPCs.

Then configure Supabase Auth URLs for the production app and run the Super Admin seed from the project README.

## Existing project

This handover contains one authoritative SQL file for a fresh project. For an existing database, take a Supabase backup and compare `final_schema.sql` with the current database before applying any changes; do not run it blindly over an existing installation.

## Retention behavior

For an existing project, run only `production_final.sql` in the Supabase SQL Editor. It combines hardening, plan cleanup, multi-location support, location-specific QR mapping and all required RPCs. The migration backfills each existing tenant with a default location and keeps the current tenant slug working.

- Disabled clients remain restorable and visible in the archive workflow for 90 days.
- The daily cron marks the tenant as archived by setting `deleted_at`; operational data is still retained.
- At 365 days after disablement, scans, private feedback and renewal requests are purged. Profile PII is anonymized, subscriptions are cancelled, auth users are removed, and an audit event is retained.

## Security notes

The browser never receives the Supabase service key. Server routes use it for controlled admin operations and public QR writes. Keep RLS enabled and set a strong `CRON_SECRET`.

## Password reset email

Password resets use a server-generated Supabase recovery link sent through Gmail SMTP. Configure `GMAIL_SMTP_USER` and `GMAIL_SMTP_APP_PASSWORD`; the production URL ending in `/auth/callback` must also be allowed in Supabase **Authentication → URL Configuration → Redirect URLs**.

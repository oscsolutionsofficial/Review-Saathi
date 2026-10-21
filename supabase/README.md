# Supabase setup and migrations

## New project

Run only this file once in the Supabase SQL Editor:

`final_schema.sql` — complete authoritative schema, policies, security grants, performance indexes, dashboard aggregation function, starter plans, retention index and one-pending-renewal constraint.

Then configure Supabase Auth URLs for the production app and run the Super Admin seed from the project README.

## Existing project

This handover contains one authoritative SQL file for a fresh project. For an existing database, take a Supabase backup and compare `final_schema.sql` with the current database before applying any changes; do not run it blindly over an existing installation.

## Retention behavior

- Disabled clients remain restorable and visible in the archive workflow for 90 days.
- The daily cron marks the tenant as archived by setting `deleted_at`; operational data is still retained.
- At 365 days after disablement, scans, private feedback and renewal requests are purged. Profile PII is anonymized, subscriptions are cancelled, auth users are removed, and an audit event is retained.

## Security notes

The browser never receives the Supabase service key. Server routes use it for controlled admin operations and public QR writes. Keep RLS enabled and set a strong `CRON_SECRET`.

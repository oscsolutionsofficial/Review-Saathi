-- Review Saathi - final fresh database schema
-- Run this file once on a new Supabase project.
-- Admin mutations and public review writes must use server-side routes.

create extension if not exists pgcrypto;

do $$ begin
  create type public.tenant_status as enum ('active', 'disabled', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('superadmin', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('active', 'expired', 'cancelled', 'disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.renewal_status as enum ('pending', 'replied', 'paid', 'completed', 'rejected');
exception when duplicate_object then null; end $$;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]{6,12}$'),
  status public.tenant_status not null default 'active',
  onboarding_completed boolean not null default false,
  disabled_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  owner_name text,
  place_id text,
  business_type text,
  city text,
  logo_url text,
  languages text[] not null default array['English']::text[],
  services text[] not null default '{}'::text[],
  staff text[] not null default '{}'::text[],
  custom_tags text[] not null default '{}'::text[],
  brand_color text not null default '#075f62' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  owner_whatsapp text,
  owner_email text,
  welcome_message text,
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  role public.user_role not null default 'client',
  must_change_password boolean not null default true,
  password_changed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 2 and 80),
  price numeric(10,2) not null check (price >= 0),
  duration_days integer not null default 30 check (duration_days > 0),
  max_locations integer not null default 1 check (max_locations > 0),
  max_scans_per_month integer not null default 500 check (max_scans_per_month >= 0),
  max_ai_drafts_per_month integer not null default 250 check (max_ai_drafts_per_month >= 0),
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  start_date date not null,
  end_date date not null,
  status public.subscription_status not null default 'active',
  custom_price numeric(10,2) check (custom_price is null or custom_price >= 0),
  custom_limits jsonb,
  notes text,
  reminder_7d_sent boolean not null default false,
  reminder_3d_sent boolean not null default false,
  reminder_1d_sent boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.renewal_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_plan_id uuid references public.plans(id) on delete set null,
  message text,
  status public.renewal_status not null default 'pending',
  admin_reply text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.payments_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount numeric(10,2) not null check (amount >= 0),
  mode text not null check (mode in ('UPI', 'bank', 'cash')),
  reference_no text,
  paid_on date not null default current_date,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  tags text[] not null default '{}'::text[],
  language text not null default 'English',
  copied boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.private_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rating integer check (rating is null or rating between 1 and 5),
  message text not null check (length(trim(message)) between 1 and 5000),
  contact text,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index one_superadmin_only
  on public.users (role) where role = 'superadmin';
create unique index one_active_subscription_per_tenant
  on public.subscriptions (tenant_id) where status = 'active';
create index tenants_status_created_at_idx on public.tenants (status, created_at desc);
create index tenants_disabled_at_idx on public.tenants (disabled_at) where disabled_at is not null;
create index subscriptions_end_date_status_idx on public.subscriptions (end_date, status);
create index renewals_status_created_at_idx on public.renewal_requests (status, created_at desc);
create unique index one_pending_renewal_per_tenant
  on public.renewal_requests (tenant_id) where status = 'pending';
create index payments_tenant_paid_on_idx on public.payments_log (tenant_id, paid_on desc);
create index scans_tenant_created_at_idx on public.scans (tenant_id, created_at desc);
create index audit_created_at_idx on public.audit_log (created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

create trigger tenants_set_updated_at before update on public.tenants
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger plans_set_updated_at before update on public.plans
for each row execute function public.set_updated_at();

create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public
as $$ select tenant_id from public.users where id = auth.uid() $$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.users where id = auth.uid() and role = 'superadmin'
) $$;

revoke all on function public.current_tenant_id() from public;
revoke all on function public.is_superadmin() from public;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.is_superadmin() to authenticated;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.users enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.renewal_requests enable row level security;
alter table public.payments_log enable row level security;
alter table public.scans enable row level security;
alter table public.private_feedback enable row level security;
alter table public.audit_log enable row level security;
alter table public.settings enable row level security;

create policy tenants_select_own on public.tenants for select to authenticated
using (id = public.current_tenant_id());

create policy profiles_select_own on public.profiles for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy profiles_update_own on public.profiles for update to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy users_select_own on public.users for select to authenticated
using (id = auth.uid() or tenant_id = public.current_tenant_id());

create policy plans_select_active on public.plans for select to anon, authenticated
using (is_active = true);

create policy subscriptions_select_own on public.subscriptions for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy renewals_select_own on public.renewal_requests for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy renewals_insert_own on public.renewal_requests for insert to authenticated
with check (tenant_id = public.current_tenant_id());

create policy payments_select_own on public.payments_log for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy scans_select_own on public.scans for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy feedback_select_own on public.private_feedback for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy audit_select_own on public.audit_log for select to authenticated
using (tenant_id = public.current_tenant_id());

-- No anonymous INSERT policies are created for scans or feedback.
-- Public routes write through the server-only Supabase secret key after validation/rate limiting.

insert into public.plans
  (name, price, duration_days, max_scans_per_month, max_ai_drafts_per_month, features)
values
  ('Starter', 499, 30, 500, 250, '{"qr":true,"basic_reports":true}'),
  ('Growth', 999, 30, 1000, 500, '{"qr":true,"basic_reports":true,"languages":true,"private_feedback":true,"detailed_dashboard":true}'),
  ('Business', 1999, 30, 5000, 2500, '{"qr":true,"multiple_locations":true,"team_access":true,"priority_support":true}')
on conflict (name) do nothing;

-- Production performance indexes and dashboard aggregation.
create index private_feedback_tenant_created_at_idx
  on public.private_feedback (tenant_id, created_at desc);
create index private_feedback_tenant_rating_idx
  on public.private_feedback (tenant_id, rating);
create index users_tenant_id_idx on public.users (tenant_id);
create index subscriptions_tenant_status_idx
  on public.subscriptions (tenant_id, status);
create index subscriptions_status_end_date_idx
  on public.subscriptions (status, end_date);
create index audit_tenant_created_at_idx
  on public.audit_log (tenant_id, created_at desc);

create or replace function public.get_tenant_dashboard_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'total_scans', (select count(*) from public.scans where tenant_id = public.current_tenant_id()),
    'feedback_count', (select count(*) from public.private_feedback where tenant_id = public.current_tenant_id()),
    'rating_counts', coalesce((
      select jsonb_agg(jsonb_build_object('rating', rating, 'count', count_value) order by rating desc)
      from (
        select rating, count(*)::int as count_value
        from public.scans
        where tenant_id = public.current_tenant_id()
        group by rating
      ) grouped
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_tenant_dashboard_stats() to authenticated;

-- Restore the privileges required by Supabase API roles after a fresh public schema.
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant select on public.plans to anon, authenticated;
grant select on public.tenants, public.profiles, public.users, public.subscriptions,
  public.renewal_requests, public.payments_log, public.scans,
  public.private_feedback, public.audit_log to authenticated;
grant update on public.profiles to authenticated;
grant insert on public.renewal_requests to authenticated;

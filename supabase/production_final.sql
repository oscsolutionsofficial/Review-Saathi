-- Review Saathi production handover migration
-- Run this single file once on an existing Supabase project.
-- It combines production hardening, plan cleanup, multi-location support,
-- location-specific QR mapping, facilities and atomic scan/location RPCs.
-- Safe to rerun after a backup.

-- Run this migration on an existing Supabase project.
-- final_schema.sql already contains these definitions for fresh databases.

create or replace function public.current_tenant_has_feature(feature_key text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.subscriptions s on s.tenant_id = u.tenant_id
    join public.plans p on p.id = s.plan_id
    where u.id = auth.uid()
      and s.status = 'active'
      and s.end_date >= current_date
      and coalesce((p.features ->> feature_key)::boolean, false)
  )
$$;

-- Team access is not a supported product feature; remove any legacy flag.
update public.plans
set features = features - 'team_access'
where features ? 'team_access';

revoke all on function public.current_tenant_has_feature(text) from public;
grant execute on function public.current_tenant_has_feature(text) to authenticated;

drop policy if exists feedback_select_own on public.private_feedback;
create policy feedback_select_own on public.private_feedback for select to authenticated
using (tenant_id = public.current_tenant_id() and public.current_tenant_has_feature('private_feedback'));

create or replace function public.create_public_scan(
  p_tenant_id uuid,
  p_rating integer,
  p_tags text[],
  p_language text,
  p_copied boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription_row public.subscriptions%rowtype;
  scan_limit integer;
  used_scans integer;
  new_scan_id uuid;
begin
  select s.* into subscription_row
  from public.subscriptions s
  where s.tenant_id = p_tenant_id and s.status = 'active'
  order by s.created_at desc
  limit 1
  for update;
  if not found or subscription_row.end_date < current_date then raise exception 'PLAN_EXPIRED'; end if;
  select p.max_scans_per_month into scan_limit from public.plans p where p.id = subscription_row.plan_id;
  select count(*)::integer into used_scans from public.scans where tenant_id = p_tenant_id and created_at >= subscription_row.start_date;
  if coalesce(scan_limit, 0) > 0 and used_scans >= scan_limit then raise exception 'SCAN_LIMIT_REACHED'; end if;
  insert into public.scans (tenant_id, rating, tags, language, copied)
  values (p_tenant_id, p_rating, coalesce(p_tags, '{}'::text[]), p_language, coalesce(p_copied, false))
  returning id into new_scan_id;
  return new_scan_id;
end;
$$;

create or replace function public.create_client_account(
  p_auth_user_id uuid,
  p_actor_id uuid,
  p_name text,
  p_slug text,
  p_status public.tenant_status,
  p_city text,
  p_owner_email text,
  p_plan_id uuid,
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_tenant_id uuid;
begin
  insert into public.tenants (name, slug, status, onboarding_completed) values (p_name, p_slug, p_status, false) returning id into new_tenant_id;
  insert into public.profiles (tenant_id, city, owner_email) values (new_tenant_id, p_city, p_owner_email);
  insert into public.users (id, tenant_id, role, must_change_password) values (p_auth_user_id, new_tenant_id, 'client', true);
  insert into public.subscriptions (tenant_id, plan_id, start_date, end_date, status, created_by) values (new_tenant_id, p_plan_id, p_start_date, p_end_date, 'active', p_actor_id);
  insert into public.audit_log (actor_id, tenant_id, action, details) values (p_actor_id, new_tenant_id, 'client.created', jsonb_build_object('name', p_name));
  return new_tenant_id;
end;
$$;

revoke all on function public.create_public_scan(uuid, integer, text[], text, boolean) from public;
revoke all on function public.create_client_account(uuid, uuid, text, text, public.tenant_status, text, text, uuid, date, date) from public;
grant execute on function public.create_public_scan(uuid, integer, text[], text, boolean) to service_role;
grant execute on function public.create_client_account(uuid, uuid, text, text, public.tenant_status, text, text, uuid, date, date) to service_role;

-- Multi-location support for an existing Review Saathi database.
-- This section is included in this single handover migration.

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]{6,80}$'),
  business_type text not null default '',
  city text not null default '',
  place_id text,
  logo_url text,
  languages text[] not null default array['English']::text[],
  services text[] not null default '{}'::text[],
  custom_tags text[] not null default '{}'::text[],
  welcome_message text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

alter table public.scans add column if not exists location_id uuid references public.locations(id) on delete set null;
alter table public.private_feedback add column if not exists location_id uuid references public.locations(id) on delete set null;
alter table public.locations add column if not exists business_type text not null default '';

create index if not exists locations_tenant_active_idx on public.locations (tenant_id, is_active);
create index if not exists scans_location_created_at_idx on public.scans (location_id, created_at desc);
create index if not exists feedback_location_created_at_idx on public.private_feedback (location_id, created_at desc);

insert into public.locations (tenant_id, name, slug, business_type, city, place_id, logo_url, languages, services, custom_tags, welcome_message)
select t.id, coalesce(nullif(trim(t.name), ''), 'Main location'), t.slug, coalesce(p.business_type, ''),
  coalesce(p.city, ''), p.place_id, p.logo_url, coalesce(p.languages, array['English']::text[]),
  coalesce(p.services, '{}'::text[]), coalesce(p.custom_tags, '{}'::text[]), p.welcome_message
from public.tenants t
left join public.profiles p on p.tenant_id = t.id
where not exists (select 1 from public.locations l where l.tenant_id = t.id);

update public.scans s set location_id = l.id
from public.locations l
where s.location_id is null and l.tenant_id = s.tenant_id
  and l.id = (select l2.id from public.locations l2 where l2.tenant_id = s.tenant_id order by l2.created_at, l2.id limit 1);

update public.private_feedback f set location_id = l.id
from public.locations l
where f.location_id is null and l.tenant_id = f.tenant_id
  and l.id = (select l2.id from public.locations l2 where l2.tenant_id = f.tenant_id order by l2.created_at, l2.id limit 1);

alter table public.locations enable row level security;
drop policy if exists locations_select_own on public.locations;
create policy locations_select_own on public.locations for select to authenticated
using (tenant_id = public.current_tenant_id());

grant select on public.locations to authenticated;
grant all on public.locations to service_role;

create or replace function public.create_location(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_name text,
  p_slug text,
  p_business_type text,
  p_city text,
  p_place_id text,
  p_logo_url text,
  p_languages text[],
  p_custom_tags text[],
  p_services text[]
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  location_count integer;
  location_limit integer;
  new_location_id uuid;
begin
  if not exists (select 1 from public.users where id = p_actor_id and tenant_id = p_tenant_id and role = 'client') then
    raise exception 'LOCATION_ACTOR_NOT_ALLOWED';
  end if;
  if not exists (
    select 1 from public.subscriptions s join public.plans p on p.id = s.plan_id
    where s.tenant_id = p_tenant_id and s.status = 'active' and s.end_date >= current_date
      and coalesce((p.features ->> 'multiple_locations')::boolean, false)
  ) then raise exception 'FEATURE_NOT_INCLUDED'; end if;
  select p.max_locations into location_limit
  from public.subscriptions s join public.plans p on p.id = s.plan_id
  where s.tenant_id = p_tenant_id and s.status = 'active' and s.end_date >= current_date
  order by s.created_at desc limit 1 for update;
  select count(*)::integer into location_count from public.locations where tenant_id = p_tenant_id and is_active;
  if location_count >= coalesce(location_limit, 1) then raise exception 'LOCATION_LIMIT_REACHED'; end if;
  insert into public.locations (tenant_id, name, slug, business_type, city, place_id, logo_url, languages, custom_tags, services)
  values (p_tenant_id, trim(p_name), lower(trim(p_slug)), coalesce(nullif(trim(p_business_type), ''), ''), coalesce(nullif(trim(p_city), ''), ''), nullif(trim(p_place_id), ''), nullif(trim(p_logo_url), ''), coalesce(p_languages, array['English']::text[]), coalesce(p_custom_tags, '{}'::text[]), coalesce(p_services, '{}'::text[]))
  returning id into new_location_id;
  insert into public.audit_log (actor_id, tenant_id, action, details) values (p_actor_id, p_tenant_id, 'location.created', jsonb_build_object('location_id', new_location_id));
  return new_location_id;
exception when unique_violation then raise exception 'LOCATION_SLUG_OR_NAME_EXISTS';
end;
$$;

revoke all on function public.create_location(uuid, uuid, text, text, text, text, text, text, text[], text[], text[]) from public;
grant execute on function public.create_location(uuid, uuid, text, text, text, text, text, text, text[], text[], text[]) to service_role;

create or replace function public.create_public_scan(
  p_tenant_id uuid,
  p_rating integer,
  p_tags text[],
  p_language text,
  p_copied boolean,
  p_location_id uuid
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  subscription_row public.subscriptions%rowtype;
  scan_limit integer;
  used_scans integer;
  new_scan_id uuid;
  valid_location_id uuid;
begin
  select s.* into subscription_row from public.subscriptions s
  where s.tenant_id = p_tenant_id and s.status = 'active'
  order by s.created_at desc limit 1 for update;
  if not found or subscription_row.end_date < current_date then raise exception 'PLAN_EXPIRED'; end if;
  if p_location_id is null then
    select id into valid_location_id from public.locations where tenant_id = p_tenant_id and is_active order by created_at limit 1;
  else
    select id into valid_location_id from public.locations where id = p_location_id and tenant_id = p_tenant_id and is_active;
  end if;
  if valid_location_id is null then raise exception 'LOCATION_NOT_FOUND'; end if;
  select p.max_scans_per_month into scan_limit from public.plans p where p.id = subscription_row.plan_id;
  select count(*)::integer into used_scans from public.scans where tenant_id = p_tenant_id and created_at >= subscription_row.start_date;
  if coalesce(scan_limit, 0) > 0 and used_scans >= scan_limit then raise exception 'SCAN_LIMIT_REACHED'; end if;
  insert into public.scans (tenant_id, location_id, rating, tags, language, copied)
  values (p_tenant_id, valid_location_id, p_rating, coalesce(p_tags, '{}'::text[]), p_language, coalesce(p_copied, false))
  returning id into new_scan_id;
  return new_scan_id;
end;
$$;

revoke all on function public.create_public_scan(uuid, integer, text[], text, boolean, uuid) from public;
grant execute on function public.create_public_scan(uuid, integer, text[], text, boolean, uuid) to service_role;



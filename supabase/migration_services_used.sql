-- Run once on an existing production database before deploying the new review flow.
alter table public.scans
  add column if not exists services_used text[] not null default '{}'::text[];

create or replace function public.create_public_scan(
  p_tenant_id uuid,
  p_rating integer,
  p_tags text[],
  p_services_used text[],
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
  insert into public.scans (tenant_id, location_id, rating, tags, services_used, language, copied)
  values (p_tenant_id, valid_location_id, p_rating, coalesce(p_tags, '{}'::text[]), coalesce(p_services_used, '{}'::text[]), p_language, coalesce(p_copied, false))
  returning id into new_scan_id;
  return new_scan_id;
end;
$$;

revoke all on function public.create_public_scan(uuid, integer, text[], text[], text, boolean, uuid) from public;
grant execute on function public.create_public_scan(uuid, integer, text[], text[], text, boolean, uuid) to service_role;

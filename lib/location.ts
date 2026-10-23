import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolvePublicLocation(admin: SupabaseClient, slug: string) {
  const { data: location } = await admin
    .from("locations")
    .select("id,tenant_id,name,slug,business_type,city,place_id,logo_url,languages,services,custom_tags,welcome_message,is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (location) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("id,name,status,slug")
      .eq("id", location.tenant_id)
      .maybeSingle();
    if (tenant?.status === "active") {
      if (location.logo_url) return { tenant, location };
      const { data: profile } = await admin.from("profiles").select("logo_url").eq("tenant_id", tenant.id).maybeSingle();
      return { tenant, location: { ...location, logo_url: profile?.logo_url || null } };
    }
  }
  const { data: tenant } = await admin.from("tenants").select("id,name,status,slug").eq("slug", slug).maybeSingle();
  if (!tenant || tenant.status !== "active") return null;
  const { data: profile } = await admin.from("profiles").select("business_type,city,place_id,logo_url,languages,services,custom_tags,welcome_message").eq("tenant_id", tenant.id).maybeSingle();
  return { tenant, location: { id: null, tenant_id: tenant.id, name: tenant.name, slug: tenant.slug, ...profile, is_active: true } };
}

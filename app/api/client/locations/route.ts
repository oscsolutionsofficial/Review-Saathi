import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantPlanAccess, hasPlanFeature } from "@/lib/plan-access";

async function getClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      error: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  const admin = createSupabaseAdmin();
  const { data: member } = await admin
    .from("users")
    .select("tenant_id,role")
    .eq("id", user.id)
    .maybeSingle();
  if (member?.role !== "client" || !member.tenant_id)
    return {
      error: NextResponse.json(
        { error: "Client account required." },
        { status: 403 },
      ),
    };
  return { user, tenantId: member.tenant_id, admin };
}

export async function GET() {
  const auth = await getClient();
  if (auth.error) return auth.error;
  const { data, error } = await auth.admin
    .from("locations")
    .select(
      "id,name,slug,business_type,city,place_id,logo_url,languages,services,custom_tags,is_active,created_at",
    )
    .eq("tenant_id", auth.tenantId)
    .order("is_active", { ascending: false })
    .order("created_at");
  if (error) {
    console.error("Locations load failed", error);
    const migrationPending =
      error.code === "42703" ||
      error.code === "42P01" ||
      /business_type|locations.*does not exist/i.test(error.message || "");
    return NextResponse.json(
      {
        error: migrationPending
          ? "Locations database migration is pending. Run supabase/production_final.sql in Supabase SQL Editor, then restart the app."
          : "Unable to load locations.",
      },
      { status: 500 },
    );
  }
  const access = await getTenantPlanAccess(auth.admin, auth.tenantId);
  const activeCount = (data ?? []).filter((item) => item.is_active).length;
  return NextResponse.json({ locations: data ?? [], canCreate: hasPlanFeature(access, "multiple_locations") && activeCount < Number(access.plan?.max_locations || 1), maxLocations: Number(access.plan?.max_locations || 1) });
}

export async function POST(request: Request) {
  const auth = await getClient();
  if (auth.error) return auth.error;
  const access = await getTenantPlanAccess(auth.admin, auth.tenantId);
  if (!hasPlanFeature(access, "multiple_locations"))
    return NextResponse.json(
      { error: "Multiple locations are not included in your plan." },
      { status: 403 },
    );
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    business_type?: string;
    city?: string;
    place_id?: string;
    logo_url?: string;
    languages?: string[];
    services?: string[];
    custom_tags?: string[];
  } | null;
  const name = String(body?.name || "")
    .trim()
    .slice(0, 120);
  if (name.length < 2)
    return NextResponse.json(
      { error: "A valid location name is required." },
      { status: 400 },
    );
  const slug = `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 12) || "location"
  }${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`.slice(0, 80);
  const { data: id, error } = await auth.admin.rpc("create_location", {
    p_tenant_id: auth.tenantId,
    p_actor_id: auth.user.id,
    p_name: name,
    p_slug: slug,
    p_business_type: String(body?.business_type || "").trim(),
    p_city: String(body?.city || "").trim(),
    p_place_id: String(body?.place_id || "").trim(),
    p_logo_url: /^https?:\/\//i.test(String(body?.logo_url || ""))
      ? String(body?.logo_url).trim()
      : "",
    p_languages:
      Array.isArray(body?.languages) && body.languages.length
        ? body.languages.slice(0, 20)
        : ["English"],
    p_custom_tags: Array.isArray(body?.custom_tags)
      ? body.custom_tags.slice(0, 20)
      : [],
    p_services: Array.isArray(body?.services) ? body.services.slice(0, 20) : [],
  });
  if (error) {
    if (error.message.includes("FEATURE_NOT_INCLUDED"))
      return NextResponse.json(
        { error: "Multiple locations are not included in your plan." },
        { status: 403 },
      );
    if (error.message.includes("LOCATION_LIMIT_REACHED"))
      return NextResponse.json(
        { error: "Your plan location limit is complete." },
        { status: 402 },
      );
    return NextResponse.json(
      { error: "Unable to create location." },
      { status: 500 },
    );
  }
  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await getClient();
  if (auth.error) return auth.error;
  const access = await getTenantPlanAccess(auth.admin, auth.tenantId);
  if (!hasPlanFeature(access, "multiple_locations")) return NextResponse.json({ error: "Multiple locations are not included in your plan." }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: string; slug?: string; name?: string; business_type?: string; city?: string; place_id?: string; logo_url?: string; languages?: string[]; services?: string[]; custom_tags?: string[]; is_active?: boolean } | null;
  const id = String(body?.id || "");
  if (body?.is_active === true) {
    const { count } = await auth.admin.from("locations").select("id", { count: "exact", head: true }).eq("tenant_id", auth.tenantId).eq("is_active", true);
    if ((count ?? 0) >= Number(access.plan?.max_locations || 1)) return NextResponse.json({ error: "Your plan location limit is complete." }, { status: 402 });
    const { error } = await auth.admin.from("locations").update({ is_active: true }).eq("id", id).eq("tenant_id", auth.tenantId);
    if (error) return NextResponse.json({ error: "Unable to restore location." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const name = String(body?.name || "").trim().slice(0, 120);
  if (!id || name.length < 2) return NextResponse.json({ error: "A valid location id and name are required." }, { status: 400 });
  const { error } = await auth.admin.from("locations").update({ name, business_type: String(body?.business_type || "").trim(), city: String(body?.city || "").trim(), place_id: String(body?.place_id || "").trim() || null, logo_url: /^https?:\/\//i.test(String(body?.logo_url || "")) ? String(body?.logo_url).trim() : null, languages: Array.isArray(body?.languages) && body.languages.length ? body.languages.slice(0, 20) : ["English"], services: Array.isArray(body?.services) ? body.services.slice(0, 20) : [], custom_tags: Array.isArray(body?.custom_tags) ? body.custom_tags.slice(0, 20) : [] }).eq("id", id).eq("tenant_id", auth.tenantId);
  if (error) return NextResponse.json({ error: "Unable to update location." }, { status: 500 });
  if (body?.slug) revalidateTag(`public-review-config:${body.slug}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await getClient();
  if (auth.error) return auth.error;
  const access = await getTenantPlanAccess(auth.admin, auth.tenantId);
  if (!hasPlanFeature(access, "multiple_locations")) return NextResponse.json({ error: "Multiple locations are not included in your plan." }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: string } | null;
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "A location id is required." }, { status: 400 });
  const { count } = await auth.admin.from("locations").select("id", { count: "exact", head: true }).eq("tenant_id", auth.tenantId).eq("is_active", true);
  if ((count ?? 0) <= 1) return NextResponse.json({ error: "At least one active location must remain." }, { status: 400 });
  const { error } = await auth.admin.from("locations").update({ is_active: false }).eq("id", id).eq("tenant_id", auth.tenantId);
  if (error) return NextResponse.json({ error: "Unable to disable location." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

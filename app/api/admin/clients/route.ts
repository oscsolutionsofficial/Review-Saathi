import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/supabase/require-super-admin";

const clientSchema = z.object({
  name: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(100),
  plan: z.string().trim().min(2).max(80),
  status: z.enum(["Active", "Expiring", "Disabled"]),
  owner: z.string().trim().email().max(320),
});
const createClientSchema = clientSchema.extend({ password: z.string().min(12).max(128) });

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: Request) {
  try { return await handleGetClients(request); }
  catch (error) {
    console.error("Admin clients request failed", error);
    return noStore(NextResponse.json({ error: "Unable to load client accounts. Please try again." }, { status: 500 }));
  }
}

async function handleGetClients(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;
  const { adminClient } = auth;

  const view = new URL(request.url).searchParams.get("view") === "archived" ? "archived" : "active";
  let query = adminClient
    .from("tenants")
    .select("id,name,status,disabled_at,deleted_at,profiles(owner_email,city),subscriptions(status,end_date,plans(name)),scans(id)");
  query = view === "archived" ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) return noStore(NextResponse.json({ error: "Unable to load client accounts." }, { status: 500 }));

  const clients = (data ?? []).map((tenant) => {
    const profile = Array.isArray(tenant.profiles) ? tenant.profiles[0] : tenant.profiles;
    const subscription = Array.isArray(tenant.subscriptions) ? tenant.subscriptions.find((item) => item.status === "active") ?? tenant.subscriptions[0] : tenant.subscriptions;
    const plan = Array.isArray(subscription?.plans) ? subscription?.plans[0] : subscription?.plans;
    const endDate = subscription?.end_date ? new Date(`${subscription.end_date}T00:00:00`) : null;
    const daysRemaining = endDate ? Math.ceil((endDate.getTime() - Date.now()) / 86400000) : null;
    const status = tenant.status === "disabled" ? "Disabled" : daysRemaining !== null && daysRemaining <= 7 ? "Expiring" : "Active";
    return {
      id: tenant.id,
      name: tenant.name,
      city: profile?.city ?? "—",
      plan: plan?.name ?? "Unassigned",
      status,
      scans: Array.isArray(tenant.scans) ? tenant.scans.length : 0,
      owner: profile?.owner_email ?? "—",
      renewal: subscription?.end_date ?? "Not set",
    };
  });
  return noStore(NextResponse.json({ clients }));
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;
  const { adminClient, user } = auth;
  const parsed = createClientSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please provide valid client details and a temporary password of at least 12 characters." }, { status: 400 });
  const input = parsed.data;
  const { data: plan, error: planError } = await adminClient.from("plans").select("id,duration_days").eq("name", input.plan).eq("is_active", true).maybeSingle();
  if (planError || !plan) return NextResponse.json({ error: "The selected plan is not available. Please create or activate this plan first." }, { status: 400 });
  const slugPrefix = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 8) || "client";
  const slug = `${slugPrefix}${crypto.randomUUID().replaceAll("-", "").slice(0, 4)}`.slice(0, 12);

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({ email: input.owner, password: input.password, email_confirm: true });
  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message.toLowerCase().includes("already") ? "This owner email is already registered." : process.env.NODE_ENV === "development" && authError ? `Unable to create the client login: ${authError.message}` : "Unable to create the client login." }, { status: 400 });
  }
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.duration_days);
  const { data: createdTenantId, error: accountError } = await adminClient.rpc("create_client_account", {
    p_auth_user_id: authUser.user.id,
    p_actor_id: user.id,
    p_name: input.name,
    p_slug: slug,
    p_status: input.status === "Disabled" ? "disabled" : "active",
    p_city: input.city,
    p_owner_email: input.owner,
    p_plan_id: plan.id,
    p_start_date: startDate.toISOString().slice(0, 10),
    p_end_date: endDate.toISOString().slice(0, 10),
  });
  if (accountError || !createdTenantId) {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(authUser.user.id);
    if (cleanupError) console.error("Failed to clean up auth user after client creation failure", cleanupError);
    return NextResponse.json({ error: process.env.NODE_ENV === "development" && accountError ? `Unable to create the client account: ${accountError.message}` : "Unable to create the client account." }, { status: 500 });
  }
  return noStore(NextResponse.json({ ok: true }, { status: 201 }));
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;
  const { adminClient, user } = auth;
  const body = await request.json().catch(() => null) as { id?: string } & Partial<z.infer<typeof clientSchema>> | null;
  if (!body?.id) return NextResponse.json({ error: "Client id is required." }, { status: 400 });
  if ((body as { restore?: boolean }).restore) {
    const { data, error } = await adminClient.from("tenants").update({ status: "active", disabled_at: null, deleted_at: null, updated_at: new Date().toISOString() }).eq("id", body.id).select("id").maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Unable to restore the client account." }, { status: 500 });
    await adminClient.from("audit_log").insert({ actor_id: user.id, tenant_id: body.id, action: "client.restored", details: {} });
    return noStore(NextResponse.json({ ok: true }));
  }
  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please provide valid client details." }, { status: 400 });
  const nextStatus = parsed.data.status === "Disabled" ? "disabled" : "active";
  const { data: tenant, error: tenantError } = await adminClient.from("tenants").update({ name: parsed.data.name, status: nextStatus, disabled_at: nextStatus === "disabled" ? undefined : null, deleted_at: nextStatus === "disabled" ? undefined : null, updated_at: new Date().toISOString() }).eq("id", body.id).select("id").maybeSingle();
  if (tenantError || !tenant) return NextResponse.json({ error: process.env.NODE_ENV === "development" && tenantError ? `Unable to update the client account: ${tenantError.message}` : "Unable to update the client account." }, { status: 500 });
  const { error: profileError } = await adminClient.from("profiles").upsert({ tenant_id: body.id, city: parsed.data.city, owner_email: parsed.data.owner });
  if (profileError) return NextResponse.json({ error: process.env.NODE_ENV === "development" ? `Unable to update the client profile: ${profileError.message}` : "Unable to update the client profile." }, { status: 500 });
  const { data: plan, error: planError } = await adminClient.from("plans").select("id,duration_days").eq("name", parsed.data.plan).eq("is_active", true).maybeSingle();
  if (planError || !plan) return NextResponse.json({ error: "The selected plan is not available." }, { status: 400 });
  const { data: currentSubscription } = await adminClient.from("subscriptions").select("id,start_date").eq("tenant_id", body.id).eq("status", "active").maybeSingle();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.duration_days);
  const subscriptionPayload = { plan_id: plan.id, end_date: endDate.toISOString().slice(0, 10), status: "active" as const };
  const { error: subscriptionError } = currentSubscription
    ? await adminClient.from("subscriptions").update(subscriptionPayload).eq("id", currentSubscription.id)
    : await adminClient.from("subscriptions").insert({ tenant_id: body.id, plan_id: plan.id, start_date: new Date().toISOString().slice(0, 10), end_date: endDate.toISOString().slice(0, 10), status: "active", created_by: user.id });
  if (subscriptionError) return NextResponse.json({ error: process.env.NODE_ENV === "development" ? `Unable to update the client subscription: ${subscriptionError.message}` : "Unable to update the client subscription." }, { status: 500 });
  await adminClient.from("audit_log").insert({ actor_id: user.id, tenant_id: body.id, action: "client.updated", details: { name: parsed.data.name } });
  return noStore(NextResponse.json({ ok: true }));
}

export async function DELETE(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;
  const { adminClient, user } = auth;
  const body = await request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Client id is required." }, { status: 400 });
  const { error } = await adminClient.from("tenants").update({ status: "disabled", disabled_at: new Date().toISOString(), deleted_at: null, updated_at: new Date().toISOString() }).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Unable to delete the client account." }, { status: 500 });
  await adminClient.from("audit_log").insert({ actor_id: user.id, tenant_id: body.id, action: "client.disabled", details: {} });
  return noStore(NextResponse.json({ ok: true }));
}

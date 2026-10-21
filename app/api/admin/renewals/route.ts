import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/supabase/require-super-admin";

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null) as { id?: string; status?: string; reply?: string } | null;
  if (!body?.id || !["approved", "rejected", "replied"].includes(body.status || "")) return NextResponse.json({ error: "A renewal id and valid status are required." }, { status: 400 });
  const { data: renewal, error: renewalError } = await auth.adminClient.from("renewal_requests").select("id,tenant_id,requested_plan_id").eq("id", body.id).maybeSingle();
  if (renewalError || !renewal) return NextResponse.json({ error: "Renewal request not found." }, { status: 404 });
  // The database enum uses `completed`; the admin UI uses the clearer `approved` label.
  const storedStatus = body.status === "approved" ? "completed" : body.status;
  const { error } = await auth.adminClient.from("renewal_requests").update({ status: storedStatus, admin_reply: String(body.reply || "").slice(0, 1000), resolved_at: storedStatus === "replied" ? null : new Date().toISOString() }).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Unable to update renewal request." }, { status: 500 });
  if (body.status === "approved" && renewal.requested_plan_id) {
    const { data: plan } = await auth.adminClient.from("plans").select("duration_days").eq("id", renewal.requested_plan_id).maybeSingle();
    if (plan) {
      const startDate = new Date();
      const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + Number(plan.duration_days || 30));
      const { data: subscription } = await auth.adminClient.from("subscriptions").select("id").eq("tenant_id", renewal.tenant_id).eq("status", "active").maybeSingle();
      const payload = { plan_id: renewal.requested_plan_id, status: "active", start_date: startDate.toISOString().slice(0, 10), end_date: endDate.toISOString().slice(0, 10) };
      if (subscription) await auth.adminClient.from("subscriptions").update(payload).eq("id", subscription.id);
      else await auth.adminClient.from("subscriptions").insert({ tenant_id: renewal.tenant_id, ...payload, created_by: auth.user.id });
    }
  }
  await auth.adminClient.from("audit_log").insert({ actor_id: auth.user.id, tenant_id: renewal.tenant_id, action: `renewal.${body.status}`, details: { renewal_id: body.id } });
  return NextResponse.json({ ok: true });
}

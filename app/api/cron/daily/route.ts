import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createSupabaseAdmin(); const today = new Date();
  const { data: expiring } = await admin.from("subscriptions").select("id,tenant_id,end_date").eq("status", "active").lte("end_date", new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10));
  const { data: expired } = await admin.from("subscriptions").update({ status: "expired" }).eq("status", "active").lt("end_date", today.toISOString().slice(0, 10)).select("tenant_id");
  const archiveBefore = new Date(today); archiveBefore.setDate(archiveBefore.getDate() - 90);
  const purgeBefore = new Date(today); purgeBefore.setDate(purgeBefore.getDate() - 365);
  const { data: archived } = await admin.from("tenants").update({ deleted_at: today.toISOString(), updated_at: today.toISOString() }).eq("status", "disabled").is("deleted_at", null).not("disabled_at", "is", null).lte("disabled_at", archiveBefore.toISOString()).select("id");
  const { data: purgeCandidates } = await admin.from("tenants").select("id").eq("status", "disabled").not("deleted_at", "is", null).lte("disabled_at", purgeBefore.toISOString()).limit(100);
  let purged = 0;
  for (const tenant of purgeCandidates ?? []) {
    await admin.from("scans").delete().eq("tenant_id", tenant.id);
    await admin.from("private_feedback").delete().eq("tenant_id", tenant.id);
    await admin.from("renewal_requests").delete().eq("tenant_id", tenant.id);
    await admin.from("subscriptions").update({ status: "cancelled", notes: "Operational data purged after retention period." }).eq("tenant_id", tenant.id);
    await admin.from("profiles").update({ owner_name: null, place_id: null, business_type: null, city: null, logo_url: null, languages: [], services: [], staff: [], custom_tags: [], owner_whatsapp: null, owner_email: null, welcome_message: null }).eq("tenant_id", tenant.id);
    await admin.from("tenants").update({ name: `Deleted business ${tenant.id.slice(0, 8)}`, slug: `del${tenant.id.replaceAll("-", "").slice(0, 9)}`, onboarding_completed: false, updated_at: today.toISOString() }).eq("id", tenant.id);
    const { data: users } = await admin.from("users").select("id").eq("tenant_id", tenant.id);
    for (const user of users ?? []) await admin.auth.admin.deleteUser(user.id);
    await admin.from("audit_log").insert({ tenant_id: tenant.id, action: "client.data_purged", details: { reason: "365_day_retention" } });
    purged += 1;
  }
  return NextResponse.json({ ok: true, expiring: expiring?.length ?? 0, expired: expired?.length ?? 0, archived: archived?.length ?? 0, purged });
}

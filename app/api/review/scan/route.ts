import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { reviewScanSchema } from "@/lib/validation";
import { allowRequestDistributed, requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!await allowRequestDistributed(`scan:${requestIp(request)}`, 30, 60_000)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = reviewScanSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid scan" }, { status: 400 });
  const admin = createSupabaseAdmin();
  const { data: tenant } = await admin.from("tenants").select("id,status").eq("slug", parsed.data.slug).maybeSingle();
  if (!tenant || tenant.status !== "active") return NextResponse.json({ error: "Business is not active" }, { status: 404 });
  if (!parsed.data.scanId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: subscription } = await admin.from("subscriptions").select("start_date,end_date,status,plans(max_scans_per_month)").eq("tenant_id", tenant.id).eq("status", "active").maybeSingle();
    const plan = Array.isArray(subscription?.plans) ? subscription?.plans[0] : subscription?.plans;
    const { count: usedScans } = await admin.from("scans").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).gte("created_at", subscription?.start_date || "1900-01-01");
    const limit = Number(plan?.max_scans_per_month || 0);
    if (!subscription || (subscription.end_date && subscription.end_date < today)) return NextResponse.json({ error: "Your plan has expired. Please renew to continue collecting scans." }, { status: 402 });
    if (limit > 0 && (usedScans ?? 0) >= limit) return NextResponse.json({ error: "Your monthly scan limit is complete. Please renew or upgrade your plan." }, { status: 402 });
  }
  let scanId = parsed.data.scanId;
  if (scanId) {
    const { data: updated, error } = await admin.from("scans").update({ rating: parsed.data.rating, tags: parsed.data.tags, language: parsed.data.language, copied: parsed.data.copied }).eq("id", scanId).eq("tenant_id", tenant.id).select("id").maybeSingle();
    if (error || !updated) return NextResponse.json({ error: "Could not update scan" }, { status: 500 });
  } else {
    const { data: created, error } = await admin.from("scans").insert({ tenant_id: tenant.id, rating: parsed.data.rating, tags: parsed.data.tags, language: parsed.data.language, copied: parsed.data.copied }).select("id").single();
    if (error || !created) return NextResponse.json({ error: "Could not save scan" }, { status: 500 });
    scanId = created.id;
  }
  if (parsed.data.privateFeedback) {
    const { error } = await admin.from("private_feedback").insert({ tenant_id: tenant.id, rating: parsed.data.rating, message: parsed.data.privateFeedback });
    if (error) return NextResponse.json({ error: "Scan saved, but private feedback could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, scanId });
}

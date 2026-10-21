import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/supabase/require-super-admin";

function cleanFeatures(value: unknown) {
  if (!Array.isArray(value)) return {};
  return Object.fromEntries(value.map(item => String(item).trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean).map(key => [key, true]));
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) return auth.error;
    const body = await request.json();
    const id = String(body?.id || "");
    const name = String(body?.name || "").trim();
    const price = Number(body?.price);
    const durationDays = Number(body?.duration_days);
    const maxLocations = Number(body?.max_locations);
    const maxScans = Number(body?.max_scans_per_month);
    const maxAiDrafts = Number(body?.max_ai_drafts_per_month);
    if (!id || !name || !Number.isFinite(price) || price < 0 || !Number.isInteger(durationDays) || durationDays < 1 || !Number.isInteger(maxLocations) || maxLocations < 1 || !Number.isInteger(maxScans) || maxScans < 1 || !Number.isInteger(maxAiDrafts) || maxAiDrafts < 0) {
      return NextResponse.json({ error: "Please enter valid plan details." }, { status: 400 });
    }
    const { data, error } = await auth.adminClient.from("plans").update({ name: name.slice(0, 80), price, duration_days: durationDays, max_locations: maxLocations, max_scans_per_month: maxScans, max_ai_drafts_per_month: maxAiDrafts, features: cleanFeatures(body?.features), is_active: Boolean(body?.is_active) }).eq("id", id).select("id,name,price,duration_days,max_scans_per_month,max_ai_drafts_per_month,max_locations,features,is_active,created_at").single();
    if (error) return NextResponse.json({ error: "Unable to update plan." }, { status: 500 });
    await auth.adminClient.from("audit_log").insert({ actor_id: auth.user.id, action: "plan.updated", details: { plan_id: id } });
    return NextResponse.json({ plan: data });
  } catch (error) {
    console.error("Admin plan update failed", error);
    return NextResponse.json({ error: "Unable to update plan." }, { status: 500 });
  }
}

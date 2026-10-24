import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantPlanAccess, hasPlanFeature } from "@/lib/plan-access";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const admin = createSupabaseAdmin();
  const { data: member } = await admin.from("users").select("tenant_id,role").eq("id", user.id).maybeSingle();
  if (member?.role !== "client" || !member.tenant_id)
    return NextResponse.json({ error: "Client account required." }, { status: 403 });
  const access = await getTenantPlanAccess(admin, member.tenant_id);
  const { data: setting } = await admin.from("settings").select("value").eq("key", "support_whatsapp").maybeSingle();
  const number = typeof setting?.value === "string" ? setting.value : String(setting?.value?.number || "");
  return NextResponse.json({ priority: hasPlanFeature(access, "priority_support"), whatsapp: number.replace(/\D/g, "") });
}

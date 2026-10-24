import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/supabase/require-super-admin";

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null) as { whatsapp?: string } | null;
  const whatsapp = String(body?.whatsapp || "").replace(/[^0-9]/g, "");
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15))
    return NextResponse.json({ error: "Enter a valid WhatsApp number with country code." }, { status: 400 });
  const { error } = await auth.adminClient.from("settings").upsert({ key: "support_whatsapp", value: whatsapp, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Unable to save WhatsApp support number." }, { status: 500 });
  await auth.adminClient.from("audit_log").insert({ actor_id: auth.user.id, action: "support.whatsapp.updated", details: { configured: Boolean(whatsapp) } });
  return NextResponse.json({ whatsapp });
}

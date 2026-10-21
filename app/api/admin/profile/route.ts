import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/supabase/require-super-admin";

function noStore(response: NextResponse) { response.headers.set("Cache-Control", "private, no-store"); return response; }

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;
  const { data } = await auth.adminClient.from("settings").select("value").eq("key", "admin_profile").maybeSingle();
  return noStore(NextResponse.json({ email: auth.user.email || "", displayName: data?.value?.display_name || "Super Admin" }));
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null) as { displayName?: string } | null;
  const displayName = String(body?.displayName || "").trim().slice(0, 80);
  if (displayName.length < 2) return NextResponse.json({ error: "Display name must contain at least 2 characters." }, { status: 400 });
  const { error } = await auth.adminClient.from("settings").upsert({ key: "admin_profile", value: { display_name: displayName }, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Unable to update admin profile." }, { status: 500 });
  await auth.adminClient.from("audit_log").insert({ actor_id: auth.user.id, action: "admin.profile.updated", details: { display_name: displayName } });
  return noStore(NextResponse.json({ displayName }));
}

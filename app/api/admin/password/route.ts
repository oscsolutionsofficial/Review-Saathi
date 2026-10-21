import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/supabase/require-super-admin";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null) as { password?: string; confirmPassword?: string } | null;
  const password = String(body?.password || "");
  const confirmPassword = String(body?.confirmPassword || "");
  if (password.length < 12 || password !== confirmPassword) {
    return NextResponse.json({ error: "Password must be at least 12 characters and both values must match." }, { status: 400 });
  }

  const sessionClient = await createSupabaseServerClient();
  const { error } = await sessionClient.auth.updateUser({ password });
  if (error) return NextResponse.json({ error: "Unable to change password. Please try again." }, { status: 400 });

  await auth.adminClient.from("audit_log").insert({ actor_id: auth.user.id, action: "admin.password.updated", details: {} });
  return noStore(NextResponse.json({ success: true }));
}

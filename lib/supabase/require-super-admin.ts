import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireSuperAdmin() {
  const sessionClient = await createSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };

  const adminClient = createSupabaseAdmin();
  const { data: member, error } = await adminClient.from("users").select("role").eq("id", user.id).maybeSingle();
  if (error || member?.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Super Admin access required." }, { status: 403 }) };
  }

  return { user, adminClient };
}

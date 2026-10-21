import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const email = String(form.get("email") ?? ""); const password = String(form.get("password") ?? "");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return NextResponse.redirect(new URL("/login?error=invalid", request.url));
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const admin = createSupabaseAdmin();
    const { data: member, error: memberError } = await admin.from("users").select("role,must_change_password").eq("id", userId ?? "").maybeSingle();
    if (memberError) return NextResponse.redirect(new URL("/login?error=server", request.url));
    if (!member) { await supabase.auth.signOut(); return NextResponse.redirect(new URL("/login?error=invalid", request.url)); }
    if (process.env.SUPER_ADMIN_ONLY_LOGIN === "true" && member?.role !== "superadmin") {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=admin_only", request.url));
    }
    if (member.role === "client" && member.must_change_password) return NextResponse.redirect(new URL("/change-password", request.url), { status: 303 });
    return NextResponse.redirect(new URL(member.role === "superadmin" ? "/admin" : "/client/dashboard", request.url), { status: 303 });
  } catch {
    return NextResponse.redirect(new URL("/login?error=configuration", request.url));
  }
}

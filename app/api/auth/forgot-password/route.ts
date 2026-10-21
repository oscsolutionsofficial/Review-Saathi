import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) { const form = await request.formData(); const supabase = await createSupabaseServerClient(); await supabase.auth.resetPasswordForEmail(String(form.get("email") ?? ""), { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/change-password` }); return NextResponse.redirect(new URL("/login?reset=sent", request.url)); }

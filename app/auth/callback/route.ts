import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");

  if (!code && !tokenHash) return NextResponse.redirect(new URL("/login?error=reset_invalid", request.url));

  const supabase = await createSupabaseServerClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "recovery" });

  if (error) return NextResponse.redirect(new URL("/login?error=reset_invalid", request.url));
  return NextResponse.redirect(new URL("/change-password", request.url));
}

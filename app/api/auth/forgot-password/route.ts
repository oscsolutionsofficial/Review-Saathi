import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGmailFallbackConfigured, sendPasswordResetEmail } from "@/lib/email";
import { allowRequestDistributed, rateLimitHash, requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const [ipAllowed, emailAllowed] = await Promise.all([
    allowRequestDistributed(`reset:ip:${requestIp(request)}`, 3, 15 * 60_000),
    allowRequestDistributed(`reset:email:${rateLimitHash(email)}`, 3, 15 * 60_000),
  ]);
  if (!ipAllowed || !emailAllowed) return NextResponse.redirect(new URL("/login?error=rate_limited", request.url), { status: 303 });
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;
  if (!isGmailFallbackConfigured()) return NextResponse.redirect(new URL("/login?error=reset_failed", request.url), { status: 303 });
  const admin = createSupabaseAdmin();
  const { data, error: linkError } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
  const hashedToken = data?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    console.error("Could not generate password reset link", linkError);
    return NextResponse.redirect(new URL("/login?error=reset_failed", request.url), { status: 303 });
  }
  try {
    const recoveryLink = `${redirectTo}?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;
    await sendPasswordResetEmail(email, recoveryLink);
    return NextResponse.redirect(new URL("/login?reset=sent", request.url), { status: 303 });
  } catch (sendError) {
    console.error("Gmail password reset email failed", sendError);
    return NextResponse.redirect(new URL("/login?error=reset_failed", request.url), { status: 303 });
  }
}

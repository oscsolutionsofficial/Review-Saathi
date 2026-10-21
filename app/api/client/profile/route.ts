import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData(); const supabase = await createSupabaseServerClient();
  const returnPath = String(form.get("return_to") ?? "").startsWith("/client/") ? String(form.get("return_to")) : "/client/dashboard";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  const admin = createSupabaseAdmin();
  const { data: member, error: memberError } = await admin.from("users").select("tenant_id").eq("id", user.id).maybeSingle();
  if (memberError) return NextResponse.redirect(new URL(`${returnPath}?error=save`, request.url), { status: 303 });
  if (!member?.tenant_id) return NextResponse.redirect(new URL("/onboarding?error=no-tenant", request.url), { status: 303 });
  const name = String(form.get("name") ?? "").trim();
  const businessType = String(form.get("business_type") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const logoUrl = String(form.get("logo_url") ?? "").trim();
  if (name.length < 2 || businessType.length < 2 || city.length < 2) return NextResponse.redirect(new URL(`${returnPath}?error=required`, request.url), { status: 303 });
  const splitList = (value: FormDataEntryValue | null, fallback: string[] = []) => String(value ?? "").split(",").map(item => item.trim()).filter(Boolean).slice(0, 20);
  const languages = splitList(form.get("languages"), ["English"]);
  const services = splitList(form.get("services"));
  const customTags = splitList(form.get("custom_tags"));
  const { error: tenantError } = await admin.from("tenants").update({ name, onboarding_completed: true }).eq("id", member.tenant_id);
  if (tenantError) return NextResponse.redirect(new URL(`${returnPath}?error=save`, request.url), { status: 303 });
  const { error: profileError } = await admin.from("profiles").upsert({ tenant_id: member.tenant_id, place_id: String(form.get("place_id") ?? "").trim() || null, logo_url: /^https?:\/\//i.test(logoUrl) ? logoUrl : null, business_type: businessType, city, languages: languages.length ? languages : ["English"], services, custom_tags: customTags, welcome_message: String(form.get("welcome_message") ?? "").trim() || null }, { onConflict: "tenant_id" });
  if (profileError) return NextResponse.redirect(new URL(`${returnPath}?error=save`, request.url), { status: 303 });
  return NextResponse.redirect(new URL(`${returnPath}?saved=1`, request.url), { status: 303 });
}

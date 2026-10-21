import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const { data: member } = await supabase.from("users").select("tenant_id").eq("id", user.id).maybeSingle();
  if (!member?.tenant_id) return NextResponse.redirect(new URL("/client/renew?error=account", request.url));
  const { data: pending } = await supabase.from("renewal_requests").select("id").eq("tenant_id", member.tenant_id).eq("status", "pending").limit(1);
  if (pending?.length) return NextResponse.redirect(new URL("/client/renew?error=pending", request.url));
  const { error } = await supabase.from("renewal_requests").insert({ tenant_id: member.tenant_id, requested_plan_id: String(form.get("plan_id") || "") || null, message: String(form.get("message") || "Renewal requested by client.").slice(0, 1000) });
  return NextResponse.redirect(new URL(`/client/renew?${error ? "error=save" : "requested=1"}`, request.url));
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createReviewQrDataUrl } from "@/lib/qr";

export async function GET() {
  const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: member } = await supabase.from("users").select("tenant_id,tenants(slug)").eq("id", user.id).single();
  const tenant = Array.isArray(member?.tenants) ? member.tenants[0] : member?.tenants;
  if (!tenant?.slug) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json({ slug: tenant.slug, dataUrl: await createReviewQrDataUrl(tenant.slug) });
}

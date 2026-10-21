import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createReviewDrafts } from "@/lib/ai";
import { reviewDraftSchema } from "@/lib/validation";
import { allowRequestDistributed, requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!await allowRequestDistributed(`draft:${requestIp(request)}`, 10, 60_000)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = reviewDraftSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid review details" }, { status: 400 });
  const admin = createSupabaseAdmin();
  const { data: tenant } = await admin.from("tenants").select("id,status").eq("slug", parsed.data.slug).maybeSingle();
  if (!tenant || tenant.status !== "active") return NextResponse.json({ error: "Business is not active" }, { status: 404 });
  const { data: profile } = await admin.from("profiles").select("business_type,city").eq("tenant_id", tenant.id).maybeSingle();
  try {
    const drafts = await createReviewDrafts({ businessType: profile?.business_type ?? "local business", city: profile?.city ?? "", rating: parsed.data.rating, tags: parsed.data.tags, language: parsed.data.language });
    return NextResponse.json({ draft: drafts[0], drafts });
  } catch {
    return NextResponse.json({ error: "The review draft could not be created. Please try again." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createReviewDrafts } from "@/lib/ai";
import { reviewDraftSchema } from "@/lib/validation";
import { allowRequestDistributed, requestIp } from "@/lib/rate-limit";
import { getTenantPlanAccess, hasPlanFeature } from "@/lib/plan-access";
import { resolvePublicLocation } from "@/lib/location";

export async function POST(request: Request) {
  if (
    !(await allowRequestDistributed(`draft:${requestIp(request)}`, 10, 60_000))
  )
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = reviewDraftSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid review details" },
      { status: 400 },
    );
  const admin = createSupabaseAdmin();
  const resolved = await resolvePublicLocation(admin, parsed.data.slug);
  if (!resolved)
    return NextResponse.json(
      { error: "Business is not active" },
      { status: 404 },
    );
  const { tenant, location } = resolved;
  const access = await getTenantPlanAccess(admin, tenant.id);
  if (!access.active)
    return NextResponse.json(
      { error: "This business plan is inactive. Please contact the business." },
      { status: 402 },
    );
  if (
    parsed.data.language !== "English" &&
    !hasPlanFeature(access, "languages")
  )
    return NextResponse.json(
      { error: "This plan supports English review drafts only." },
      { status: 403 },
    );
  const { data: profile } = await admin
    .from("profiles")
    .select("business_type,city")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  try {
    const drafts = await createReviewDrafts({
      businessType: location.business_type || profile?.business_type || "local business",
      city: location.city || profile?.city || "",
      rating: parsed.data.rating,
      tags: parsed.data.tags,
      language: parsed.data.language,
    });
    return NextResponse.json({ draft: drafts[0], drafts });
  } catch {
    return NextResponse.json(
      { error: "The review draft could not be created. Please try again." },
      { status: 503 },
    );
  }
}

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createReviewDrafts } from "@/lib/ai";
import { reviewDraftSchema } from "@/lib/validation";
import { allowRequestDistributed, requestIp } from "@/lib/rate-limit";
import { getTenantPlanAccess, hasPlanFeature } from "@/lib/plan-access";
import { resolvePublicLocation } from "@/lib/location";
import { getAllowedReviewLanguages } from "@/lib/review-languages";

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
  const configuredServices = Array.isArray(location.services) ? location.services : [];
  const servicesUsed = parsed.data.servicesUsed.filter((service) => configuredServices.includes(service));
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
  const allowedLanguages = getAllowedReviewLanguages(
    resolved.location.languages,
    hasPlanFeature(access, "languages"),
  );
  if (!allowedLanguages.includes(parsed.data.language as (typeof allowedLanguages)[number]))
    return NextResponse.json(
      { error: "This language is not enabled for this business." },
      { status: 403 },
    );
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("start_date,plans(max_scans_per_month)")
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const plan = Array.isArray(subscription?.plans)
    ? subscription?.plans[0]
    : subscription?.plans;
  const scanLimit = Number(plan?.max_scans_per_month || 0);
  if (subscription?.start_date && scanLimit > 0) {
    const { count: usedScans } = await admin
      .from("scans")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .gte("created_at", subscription.start_date);
    if ((usedScans ?? 0) >= scanLimit)
      return NextResponse.json(
        {
          error:
            "Your scan limit is complete. Please renew or upgrade your plan to continue scanning.",
        },
        { status: 402 },
      );
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("business_type,city")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  try {
    const drafts = await createReviewDrafts({
      businessName: location.name || tenant.name,
      businessType: location.business_type || profile?.business_type || "local business",
      city: location.city || profile?.city || "",
      rating: parsed.data.rating,
      tags: parsed.data.tags,
      servicesUsed,
      language: parsed.data.language,
      length: parsed.data.length,
    });
    return NextResponse.json({ draft: drafts[0], drafts });
  } catch {
    return NextResponse.json(
      { error: "The review draft could not be created. Please try again." },
      { status: 503 },
    );
  }
}

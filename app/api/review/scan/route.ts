import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { reviewScanSchema } from "@/lib/validation";
import { allowRequestDistributed, requestIp } from "@/lib/rate-limit";
import { getTenantPlanAccess, hasPlanFeature } from "@/lib/plan-access";
import { resolvePublicLocation } from "@/lib/location";
import { getAllowedReviewLanguages } from "@/lib/review-languages";

export async function POST(request: Request) {
  if (
    !(await allowRequestDistributed(`scan:${requestIp(request)}`, 30, 60_000))
  )
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = reviewScanSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid scan" }, { status: 400 });
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
      { error: "This plan supports English reviews only." },
      { status: 403 },
    );
  const allowedLanguages = getAllowedReviewLanguages(
    location.languages,
    hasPlanFeature(access, "languages"),
  );
  if (!allowedLanguages.includes(parsed.data.language as (typeof allowedLanguages)[number]))
    return NextResponse.json(
      { error: "This language is not enabled for this business." },
      { status: 403 },
    );
  if (
    parsed.data.privateFeedback &&
    !hasPlanFeature(access, "private_feedback")
  )
    return NextResponse.json(
      { error: "Private feedback is not included in this plan." },
      { status: 403 },
    );
  let scanId = parsed.data.scanId;
  if (scanId) {
    let updateQuery = admin
      .from("scans")
      .update({
        rating: parsed.data.rating,
        tags: parsed.data.tags,
        language: parsed.data.language,
        copied: parsed.data.copied,
      })
      .eq("id", scanId)
      .eq("tenant_id", tenant.id);
    if (location.id) updateQuery = updateQuery.eq("location_id", location.id);
    const { data: updated, error } = await updateQuery
      .select("id")
      .maybeSingle();
    if (error || !updated)
      return NextResponse.json(
        { error: "Could not update scan" },
        { status: 500 },
      );
  } else {
    const rpcArgs = {
      p_tenant_id: tenant.id,
      p_rating: parsed.data.rating,
      p_tags: parsed.data.tags,
      p_language: parsed.data.language,
      p_copied: parsed.data.copied,
      ...(location.id ? { p_location_id: location.id } : {}),
    };
    const { data: created, error } = await admin.rpc("create_public_scan", rpcArgs);
    if (error) {
      if (error.message.includes("PLAN_EXPIRED"))
        return NextResponse.json(
          {
            error:
              "Your plan has expired. Please renew to continue collecting scans.",
          },
          { status: 402 },
        );
      if (error.message.includes("SCAN_LIMIT_REACHED"))
        return NextResponse.json(
          {
            error:
              "Your scan limit is complete. Please renew or upgrade your plan to continue scanning.",
          },
          { status: 402 },
        );
      return NextResponse.json(
        { error: "Could not save scan" },
        { status: 500 },
      );
    }
    scanId = created as string;
  }
  if (parsed.data.privateFeedback) {
    const feedbackPayload = { tenant_id: tenant.id, rating: parsed.data.rating, message: parsed.data.privateFeedback, ...(location.id ? { location_id: location.id } : {}) };
    const { error } = await admin.from("private_feedback").insert(feedbackPayload);
    if (error)
      return NextResponse.json(
        { error: "Scan saved, but private feedback could not be saved." },
        { status: 500 },
      );
  }
  return NextResponse.json({ ok: true, scanId });
}

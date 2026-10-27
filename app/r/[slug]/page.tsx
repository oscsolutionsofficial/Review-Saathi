import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import ReviewForm from "./review-form";
import { getTenantPlanAccess, hasPlanFeature } from "@/lib/plan-access";
import { resolvePublicLocation } from "@/lib/location";
import { getAllowedReviewLanguages } from "@/lib/review-languages";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loadReviewConfig = unstable_cache(
    async () => {
      const admin = createSupabaseAdmin();
      const resolved = await resolvePublicLocation(admin, slug);
      if (!resolved) return null;
      const access = await getTenantPlanAccess(admin, resolved.tenant.id);
      return { tenant: resolved.tenant, profile: resolved.location, access };
    },
    ["public-review-config", slug],
    { revalidate: 60, tags: [`public-review-config:${slug}`] },
  );
  const config = await loadReviewConfig();
  const tenant = config?.tenant;
  if (!tenant || tenant.status !== "active") return notFound();
  const profile = config.profile;
  const languages = getAllowedReviewLanguages(
    profile?.languages,
    Boolean(config.access && hasPlanFeature(config.access, "languages")),
  );
  const logoUrl = profile?.logo_url
    ? `/api/public/logo?url=${encodeURIComponent(profile.logo_url)}`
    : "";
  return (
    <ReviewForm
      slug={slug}
      businessName={profile?.name || tenant.name}
      city={profile?.city ?? ""}
      logoUrl={logoUrl}
      languages={languages}
      services={profile?.services?.length ? profile.services : []}
      tags={
        profile?.custom_tags?.length
          ? profile.custom_tags
          : profile?.services?.length
            ? profile.services
            : [
          "Great food",
          "Good service",
          "Clean place",
          "Nice ambience",
          "Friendly staff",
              ]
      }
      placeId={profile?.place_id ?? ""}
      allowPrivateFeedback={Boolean(
        config.access && hasPlanFeature(config.access, "private_feedback"),
      )}
    />
  );
}

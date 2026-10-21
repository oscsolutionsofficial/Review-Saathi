import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import ReviewForm from "./review-form";

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loadReviewConfig = unstable_cache(async () => {
    const admin = createSupabaseAdmin();
    const { data: tenant } = await admin.from("tenants").select("id,name,status").eq("slug", slug).maybeSingle();
    if (!tenant || tenant.status !== "active") return null;
    const { data: profile } = await admin.from("profiles").select("city,logo_url,brand_color,languages,custom_tags,place_id").eq("tenant_id", tenant.id).maybeSingle();
    return { tenant, profile };
  }, ["public-review-config", slug], { revalidate: 60 });
  const config = await loadReviewConfig();
  const tenant = config?.tenant;
  if (!tenant || tenant.status !== "active") return notFound();
  const profile = config.profile;
  const languages = Array.from(new Set([...(profile?.languages ?? []), "English", "Hindi", "Hinglish", "Rajasthani", "Gujarati"]));
  const logoUrl = profile?.logo_url ? `/api/public/logo?url=${encodeURIComponent(profile.logo_url)}` : "";
  return <ReviewForm slug={slug} businessName={tenant.name} city={profile?.city ?? ""} logoUrl={logoUrl} languages={languages} tags={profile?.custom_tags ?? ["Great food", "Good service", "Clean place", "Nice ambience", "Friendly staff"]} placeId={profile?.place_id ?? ""} />;
}

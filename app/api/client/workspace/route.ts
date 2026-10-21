import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try { return await handleWorkspaceRequest(request); }
  catch (error) {
    console.error("Workspace request failed", error);
    return NextResponse.json({ error: "Unable to load workspace data. Please try again." }, { status: 500 });
  }
}

async function handleWorkspaceRequest(request: Request) {
  const tab = new URL(request.url).searchParams.get("tab") || "dashboard";
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: member } = await supabase.from("users").select("tenant_id,role").eq("id", user.id).maybeSingle();
  if (member?.role !== "client" || !member.tenant_id) return NextResponse.json({ error: "Client account required." }, { status: 403 });
  const tenantId = member.tenant_id;
  const { data: tenant } = await supabase.from("tenants").select("name,status,slug").eq("id", tenantId).maybeSingle();
  if (!tenant) return NextResponse.json({ error: "Business account not found." }, { status: 404 });
  const today = new Date().toISOString().slice(0, 10);
  if (tab === "dashboard") {
    const [{ data: profile }, { data: subscription }, { data: stats }, { data: recent }] = await Promise.all([
      supabase.from("profiles").select("business_type,city").eq("tenant_id", tenantId).maybeSingle(),
      supabase.from("subscriptions").select("start_date,end_date,status,plans(name,price,max_scans_per_month)").eq("tenant_id", tenantId).eq("status", "active").maybeSingle(),
      supabase.rpc("get_tenant_dashboard_stats"),
      supabase.from("scans").select("rating,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(5),
    ]);
    const dashboardStats = stats ?? await (async () => {
      const [{ count: totalScans }, { count: feedbackCount }, counts] = await Promise.all([
        supabase.from("scans").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("private_feedback").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        Promise.all([1, 2, 3, 4, 5].map(rating => supabase.from("scans").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("rating", rating))),
      ]);
      return { total_scans: totalScans ?? 0, feedback_count: feedbackCount ?? 0, rating_counts: counts.map((item, index) => ({ rating: index + 1, count: item.count ?? 0 })) };
    })();
    const ratingCounts = Array.from({ length: 5 }, (_, index) => (dashboardStats?.rating_counts || []).find((item: { rating: number; count: number }) => item.rating === 5 - index)?.count ?? 0);
    const plan = Array.isArray(subscription?.plans) ? subscription?.plans[0] : subscription?.plans;
    const { count: usedScans } = await supabase.from("scans").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", subscription?.start_date || "1900-01-01");
    const limit = Number(plan?.max_scans_per_month || 0);
    const expired = Boolean(subscription?.end_date && subscription.end_date < today);
    return NextResponse.json({ tenant, profile, subscription, usage: { used: usedScans ?? 0, limit, remaining: Math.max(limit - (usedScans ?? 0), 0), expired, canScan: Boolean(subscription && !expired && (limit <= 0 || (usedScans ?? 0) < limit)) }, totalScans: dashboardStats?.total_scans ?? 0, feedbackCount: dashboardStats?.feedback_count ?? 0, recent: recent ?? [], ratingCounts });
  }
  if (tab === "reviews") {
    const page = Math.max(Number(new URL(request.url).searchParams.get("page") || 1), 1);
    const pageSize = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit") || 20), 1), 20);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const [{ data: scans }, { data: feedback }] = await Promise.all([
      supabase.from("scans").select("rating,tags,language,copied,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).range(from, to),
      supabase.from("private_feedback").select("rating,message,contact,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).range(from, to),
    ]);
    return NextResponse.json({ tenant, scans: scans ?? [], feedback: feedback ?? [], page, pageSize, hasMoreScans: (scans ?? []).length === pageSize, hasMoreFeedback: (feedback ?? []).length === pageSize });
  }
  if (tab === "qr") {
    const { data: profile } = await supabase.from("profiles").select("business_type,city").eq("tenant_id", tenantId).maybeSingle();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
    const reviewPath = tenant.slug ? `/r/${tenant.slug}` : "";
    const response = NextResponse.json({ tenant, profile, dataUrl: "", reviewPath, publicReviewUrl: reviewPath ? `${siteUrl}${reviewPath}` : "" });
    response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
    return response;
  }
  if (tab === "renew") {
    const [{ data: plans }, { data: current }, { data: pending }] = await Promise.all([
      supabase.from("plans").select("id,name,price,duration_days,max_scans_per_month,features").eq("is_active", true).order("price"),
      supabase.from("subscriptions").select("start_date,end_date,status,plans(id,name,price,max_scans_per_month)").eq("tenant_id", tenantId).eq("status", "active").maybeSingle(),
      supabase.from("renewal_requests").select("status,created_at,requested_plan_id").eq("tenant_id", tenantId).eq("status", "pending").order("created_at", { ascending: false }).limit(1),
    ]);
    const currentPlan = Array.isArray(current?.plans) ? current?.plans[0] : current?.plans;
    const { count: usedScans } = await supabase.from("scans").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", current?.start_date || "1900-01-01");
    const limit = Number(currentPlan?.max_scans_per_month || 0);
    const expired = Boolean(current?.end_date && current.end_date < today);
    return NextResponse.json({ tenant, plans: plans ?? [], current, pending: pending?.[0] ?? null, usage: { used: usedScans ?? 0, limit, remaining: Math.max(limit - (usedScans ?? 0), 0), expired, canScan: Boolean(current && !expired && (limit <= 0 || (usedScans ?? 0) < limit)) } });
  }
  if (tab === "settings") {
    const { data: profile } = await supabase.from("profiles").select("business_type,city,place_id,logo_url,languages,services,custom_tags,welcome_message").eq("tenant_id", tenantId).maybeSingle();
    return NextResponse.json({ tenant, profile });
  }
  return NextResponse.json({ error: "Unknown workspace tab." }, { status: 400 });
}

import type { SupabaseClient } from "@supabase/supabase-js";

export const PLAN_FEATURE_KEYS = [
  "qr",
  "basic_reports",
  "languages",
  "private_feedback",
  "detailed_dashboard",
  "multiple_locations",
  "priority_support",
] as const;

export type PlanFeature = (typeof PLAN_FEATURE_KEYS)[number];

type PlanRow = {
  id: string;
  name: string;
  features: Record<string, boolean> | null;
  max_ai_drafts_per_month: number;
  max_locations: number;
};

export type TenantPlanAccess = {
  active: boolean;
  plan: PlanRow | null;
  features: Record<string, boolean>;
};

export async function getTenantPlanAccess(admin: SupabaseClient, tenantId: string): Promise<TenantPlanAccess> {
  const { data } = await admin
    .from("subscriptions")
    .select("status,end_date,plans(id,name,features,max_ai_drafts_per_month,max_locations)")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan = Array.isArray(data?.plans) ? data?.plans[0] : data?.plans;
  const active = Boolean(data && plan && data.end_date >= new Date().toISOString().slice(0, 10));
  return { active, plan: active ? (plan as PlanRow) : null, features: active ? ((plan?.features || {}) as Record<string, boolean>) : {} };
}

export function hasPlanFeature(access: TenantPlanAccess, feature: PlanFeature) {
  return access.active && access.features[feature] === true;
}


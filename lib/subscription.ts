export type SubscriptionStatus = "active" | "expired" | "cancelled" | "disabled";

export function isSubscriptionLive(status: SubscriptionStatus, endDate: string, graceDays = 5) {
  if (status === "disabled" || status === "cancelled") return false;
  const end = new Date(endDate).getTime();
  return Date.now() <= end + graceDays * 86400000;
}

export function getSubscriptionLabel(status: SubscriptionStatus, endDate: string) {
  if (status === "active" && new Date(endDate).getTime() < Date.now() + 7 * 86400000) return "expiring_soon";
  return status;
}

import type { SupabaseClient } from "@supabase/supabase-js";

export async function activateSubscription(admin: SupabaseClient, input: { tenantId: string; planId: string; startDate: string; endDate: string; amount: number; createdBy: string }) {
  await admin.from("subscriptions").update({ status: "expired" }).eq("tenant_id", input.tenantId).eq("status", "active");
  const { data, error } = await admin.from("subscriptions").insert({ tenant_id: input.tenantId, plan_id: input.planId, start_date: input.startDate, end_date: input.endDate, status: "active", created_by: input.createdBy }).select().single();
  if (error) throw error;
  await admin.from("audit_log").insert({ actor_id: input.createdBy, tenant_id: input.tenantId, action: "subscription_activated", details: { plan_id: input.planId, amount: input.amount } });
  return data;
}

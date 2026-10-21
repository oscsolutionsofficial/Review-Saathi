import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/supabase/require-super-admin";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) return auth.error;
    const { adminClient } = auth;

    const [plansResult, renewalsResult, paymentsResult, auditResult, settingsResult] = await Promise.all([
      adminClient.from("plans").select("id,name,price,duration_days,max_scans_per_month,max_ai_drafts_per_month,max_locations,features,is_active,created_at").order("price", { ascending: true }),
      adminClient.from("renewal_requests").select("id,tenant_id,requested_plan_id,message,status,admin_reply,created_at,resolved_at,tenants(name),plans:requested_plan_id(name)").order("created_at", { ascending: false }),
      adminClient.from("payments_log").select("id,tenant_id,subscription_id,amount,mode,reference_no,paid_on,created_at,tenants(name)").order("paid_on", { ascending: false }),
      adminClient.from("audit_log").select("id,actor_id,tenant_id,action,details,created_at,tenants(name)").order("created_at", { ascending: false }).limit(100),
      adminClient.from("settings").select("key,value,updated_at").order("key", { ascending: true }),
    ]);

    const failed = [plansResult, renewalsResult, paymentsResult, auditResult, settingsResult].find(result => result.error);
    if (failed?.error) return noStore(NextResponse.json({ error: "Unable to load the admin workspace data." }, { status: 500 }));

    const seenPendingTenants = new Set<string>();
    const renewalRows = (renewalsResult.data ?? []).filter((row: any) => {
      if (row.status !== "pending") return true;
      if (seenPendingTenants.has(row.tenant_id)) return false;
      seenPendingTenants.add(row.tenant_id);
      return true;
    }).map((row: any) => ({
      id: row.id,
      business: Array.isArray(row.tenants) ? row.tenants[0]?.name : row.tenants?.name,
      plan: Array.isArray(row.plans) ? row.plans[0]?.name : row.plans?.name,
      message: row.message || "No message provided",
      status: row.status,
      received: row.created_at,
      reply: row.admin_reply || "",
    }));
    const paymentRows = (paymentsResult.data ?? []).map((row: any) => ({
      id: row.id,
      business: Array.isArray(row.tenants) ? row.tenants[0]?.name : row.tenants?.name,
      amount: Number(row.amount),
      mode: row.mode,
      reference: row.reference_no || "—",
      paidOn: row.paid_on,
    }));
    const auditRows = (auditResult.data ?? []).map((row: any) => ({
      id: row.id,
      action: row.action,
      business: Array.isArray(row.tenants) ? row.tenants[0]?.name : row.tenants?.name,
      details: row.details || {},
      createdAt: row.created_at,
    }));
    const settings = Object.fromEntries((settingsResult.data ?? []).map((row: any) => [row.key, row.value]));

    return noStore(NextResponse.json({
      plans: plansResult.data ?? [],
      renewals: renewalRows,
      payments: paymentRows,
      audit: auditRows,
      settings,
      metrics: {
        pendingRenewals: renewalRows.filter(row => row.status === "pending").length,
        totalPayments: paymentRows.reduce((sum, row) => sum + row.amount, 0),
        paymentsReceived: paymentRows.length,
      },
    }));
  } catch (error) {
    console.error("Admin workspace request failed", error);
    return noStore(NextResponse.json({ error: "Unable to load the admin workspace data." }, { status: 500 }));
  }
}

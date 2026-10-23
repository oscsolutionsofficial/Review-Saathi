"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPlanPeriodLabel, getPlanPeriodSuffix } from "@/lib/plan-period";

type Client = {
  id: string;
  name: string;
  city: string;
  plan: string;
  status: "Active" | "Expiring" | "Disabled";
  scans: number;
  owner: string;
  renewal: string;
};
type Tab =
  | "Overview"
  | "Clients"
  | "Plans"
  | "Renewals"
  | "Payments"
  | "Audit log"
  | "Settings";
type Workspace = {
  plans: any[];
  renewals: any[];
  payments: any[];
  audit: any[];
  settings: Record<string, any>;
  metrics: {
    pendingRenewals: number;
    totalPayments: number;
    paymentsReceived: number;
  };
};
const tabs: Tab[] = [
  "Overview",
  "Clients",
  "Plans",
  "Renewals",
  "Payments",
  "Audit log",
  "Settings",
];
const emptyWorkspace: Workspace = {
  plans: [],
  renewals: [],
  payments: [],
  audit: [],
  settings: {},
  metrics: { pendingRenewals: 0, totalPayments: 0, paymentsReceived: 0 },
};

function tabFromPath(path: string): Tab {
  const route = path.split("/")[2];
  return (
    (
      {
        clients: "Clients",
        plans: "Plans",
        renewals: "Renewals",
        payments: "Payments",
        "audit-log": "Audit log",
        settings: "Settings",
      } as Record<string, Tab>
    )[route] ?? "Overview"
  );
}
function tabRoute(tab: Tab) {
  return (
    {
      Overview: "",
      Clients: "clients",
      Plans: "plans",
      Renewals: "renewals",
      Payments: "payments",
      "Audit log": "audit-log",
      Settings: "settings",
    } as Record<Tab, string>
  )[tab];
}
function date(value?: string) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "Not set";
}
function money(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}
async function json(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

function StatusDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = [
    { value: "all", label: "All statuses" },
    { value: "Active", label: "Active" },
    { value: "Expiring", label: "Expiring" },
    { value: "Disabled", label: "Disabled" },
  ];
  const selected =
    options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="status-dropdown" ref={rootRef}>
      <button
        type="button"
        className="status-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.label}</span>
        <span className="status-dropdown-chevron" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div
          className="status-dropdown-menu"
          role="listbox"
          aria-label="Client status"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? "selected" : ""}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminConsole() {
  const pathname = usePathname() || "/admin";
  const [active, setActive] = useState<Tab>(() => tabFromPath(pathname));
  const [clients, setClients] = useState<Client[]>([]);
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState({
    displayName: "Super Admin",
    email: "",
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [clientView, setClientView] = useState<"active" | "archived">("active");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);
  const [planSelected, setPlanSelected] = useState<any | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  async function load(force = false) {
    if (!force) setLoading(true);
    setError("");
    if (force) setRefreshing(true);
    try {
      const [clientResponse, workspaceResponse] = await Promise.all([
        fetch(`/api/admin/clients?view=${clientView}`, { cache: "no-store" }),
        fetch("/api/admin/workspace", { cache: "no-store" }),
      ]);
      const [clientData, workspaceData] = await Promise.all([
        json(clientResponse),
        json(workspaceResponse),
      ]);
      setClients(clientData.clients || []);
      setWorkspace(workspaceData);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load admin data.",
      );
    } finally {
      if (!force) setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => {
    void load();
  }, [clientView]);
  useEffect(() => {
    fetch("/api/admin/profile", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setProfile({
          displayName: data.displayName || "Super Admin",
          email: data.email || "",
        });
        const name = document.querySelector<HTMLElement>(
          ".console-user > span:first-child",
        );
        const avatar = document.querySelector<HTMLElement>(".admin-avatar");
        if (name) name.textContent = data.displayName || "Super Admin";
        if (avatar)
          avatar.textContent = String(data.displayName || "SA")
            .split(/\s+/)
            .map((part: string) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    setActive(tabFromPath(pathname));
  }, [pathname]);
  useEffect(() => {
    function closeProfile(event: MouseEvent) {
      const account = document.querySelector<HTMLElement>(
        ".app-page:not(.client-console-page) .console-user",
      );
      if (account && !account.contains(event.target as Node))
        setProfileOpen(false);
    }
    document.addEventListener("mousedown", closeProfile);
    return () => document.removeEventListener("mousedown", closeProfile);
  }, []);

  function navigate(tab: Tab) {
    const target = tab === "Overview" ? "/admin" : `/admin/${tabRoute(tab)}`;
    window.history.pushState({}, "", target);
    setActive(tab);
    setMobileOpen(false);
    setProfileOpen(false);
  }
  async function saveClient(form: FormData) {
    try {
      const payload = {
        id: selected?.id,
        name: String(form.get("name")),
        city: String(form.get("city")),
        plan: String(form.get("plan")),
        status: String(form.get("status")),
        owner: String(form.get("owner")),
        ...(modal === "add" ? { password: String(form.get("password")) } : {}),
      };
      const response = await fetch("/api/admin/clients", {
        method: modal === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await json(response);
      setModal(null);
      setSelected(null);
      setNotice(modal === "edit" ? "Client updated." : "Client created.");
      await load();
    } catch (reason) {
      setNotice(
        reason instanceof Error ? reason.message : "Unable to save client.",
      );
    }
  }
  async function removeClient(client: Client) {
    if (!window.confirm(`Disable ${client.name}?`)) return;
    try {
      await json(
        await fetch("/api/admin/clients", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: client.id }),
        }),
      );
      setNotice("Client disabled.");
      await load();
    } catch (reason) {
      setNotice(
        reason instanceof Error ? reason.message : "Unable to disable client.",
      );
    }
  }
  async function restoreClient(client: Client) {
    try {
      await json(
        await fetch("/api/admin/clients", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: client.id, restore: true }),
        }),
      );
      setNotice("Client restored.");
      await load();
    } catch (reason) {
      setNotice(
        reason instanceof Error ? reason.message : "Unable to restore client.",
      );
    }
  }
  const filtered = useMemo(
    () =>
      clients.filter(
        (item) =>
          `${item.name} ${item.city} ${item.plan}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (status === "all" || item.status === status),
      ),
    [clients, search, status],
  );
  const content = loading ? (
    <Loading />
  ) : error ? (
    <ErrorState message={error} retry={load} />
  ) : (
    <>
      {active === "Overview" && (
        <Overview clients={clients} workspace={workspace} go={navigate} />
      )}
      {active === "Clients" && (
        <Clients
          clients={filtered}
          search={search}
          setSearch={setSearch}
          status={status}
          setStatus={setStatus}
          view={clientView}
          toggleView={() => {
            setClientView((view) =>
              view === "active" ? "archived" : "active",
            );
            setStatus("all");
          }}
          add={() => {
            setSelected(null);
            setModal("add");
          }}
          edit={(client) => {
            setSelected(client);
            setModal("edit");
          }}
          remove={removeClient}
          restore={restoreClient}
        />
      )}
      {active === "Plans" && (
        <Plans plans={workspace.plans} edit={(plan) => setPlanSelected(plan)} />
      )}
      {active === "Renewals" && (
        <Renewals rows={workspace.renewals} refresh={load} />
      )}
      {active === "Payments" && (
        <Payments rows={workspace.payments} metrics={workspace.metrics} />
      )}
      {active === "Audit log" && <Audit rows={workspace.audit} />}
      {active === "Settings" && (
        <Settings settings={workspace.settings} profile={profile} />
      )}
    </>
  );
  return (
    <main className="app-page">
      <header className="console-header">
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          ☰
        </button>
        <Link className="brand" href="/">
          <span className="brand-mark">▦</span>
          <span>Review Saathi</span>
        </Link>
        <span className="header-page-title">{active}</span>
        <button
          type="button"
          className={`admin-refresh-button ${refreshing ? "is-refreshing" : ""}`}
          onClick={() => void load(true)}
          disabled={refreshing}
          aria-label="Refresh current admin page data"
        >
          {refreshing ? "Updating..." : "Refresh"}
        </button>
        <div className="console-user">
          <span>{profile.displayName}</span>
          <button
            className="admin-avatar"
            onClick={() => setProfileOpen((open) => !open)}
            aria-label="Open account menu"
          >
            {String(profile.displayName || "SA")
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </button>
          {profileOpen && (
            <div className="profile-menu">
              <strong>{profile.displayName}</strong>
              <small>{profile.email || "Super Admin"}</small>
              <Link
                href="/admin/settings"
                onClick={() => setProfileOpen(false)}
              >
                View profile
              </Link>
              <a href="/api/auth/logout">Sign out</a>
            </div>
          )}
        </div>
      </header>
      <button
        className={`mobile-nav-backdrop ${mobileOpen ? "open" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-label="Close navigation"
      />
      <div className="console-layout">
        <aside className={`console-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
          <div className="console-side-brand">
            <span className="brand-mark">▦</span>
            <div>
              <strong>Review Saathi</strong>
              <small>Admin workspace</small>
            </div>
            <button
              className="mobile-nav-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              ×
            </button>
          </div>
          <nav className="console-nav">
            {tabs.map((tab) => (
              <button
                key={tab}
                className={active === tab ? "active" : ""}
                onClick={() => navigate(tab)}
              >
                <span>
                  {
                    (
                      {
                        Overview: "⌂",
                        Clients: "♙",
                        Plans: "▤",
                        Renewals: "↻",
                        Payments: "₹",
                        "Audit log": "◷",
                        Settings: "⚙",
                      } as Record<Tab, string>
                    )[tab]
                  }
                </span>
                {tab}
                <em>
                  {tab === "Renewals" ? workspace.metrics.pendingRenewals : ""}
                </em>
              </button>
            ))}
          </nav>
          <div className="console-sidebar-foot">
            <span>Need help?</span>
            <strong>Contact support →</strong>
          </div>
        </aside>
        <section className="console-main">
          <div className="console-topline">
            <div>
              <div className="breadcrumb">Workspace / {active}</div>
              <h1>{active}</h1>
              <p>{description(active)}</p>
            </div>
            {(active === "Overview" || active === "Clients") && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSelected(null);
                  setModal("add");
                }}
              >
                ＋ Add client
              </button>
            )}
          </div>
          {notice && (
            <div className="console-notice" role="status">
              {notice}
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
          {content}
        </section>
      </div>
      {modal && (
        <ClientModal
          type={modal}
          client={selected}
          plans={workspace.plans}
          onCancel={() => setModal(null)}
          onSave={saveClient}
        />
      )}{" "}
      {planSelected && (
        <PlanModal
          plan={planSelected}
          onCancel={() => setPlanSelected(null)}
          onSaved={async () => {
            setPlanSelected(null);
            setNotice("Plan updated everywhere.");
            await load();
          }}
        />
      )}
    </main>
  );
}

function description(tab: Tab) {
  return {
    Overview: "A clear view of your platform health and daily work.",
    Clients: "Create, edit, pause and manage every business account.",
    Plans: "Live pricing, limits and active subscription plans.",
    Renewals: "Review renewal requests from client accounts.",
    Payments: "Track recorded payments from the database.",
    "Audit log": "Every important admin action, visible and traceable.",
    Settings: "Manage platform defaults and operational preferences.",
  }[tab];
}
function Loading() {
  return (
    <div className="data-loading">
      <div className="admin-loading-spinner" />
      <p>Loading platform data…</p>
    </div>
  );
}
function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="data-error">
      <h2>Could not load platform data</h2>
      <p>{message}</p>
      <button className="btn btn-primary" onClick={retry}>
        Retry
      </button>
    </div>
  );
}
function Overview({
  clients,
  workspace,
  go,
}: {
  clients: Client[];
  workspace: Workspace;
  go: (tab: Tab) => void;
}) {
  const active = clients.filter((c) => c.status === "Active").length;
  const expiring = clients.filter((c) => c.status === "Expiring").length;
  const scans = clients.reduce((sum, c) => sum + c.scans, 0);
  const planCounts = clients.reduce<Record<string, number>>((out, c) => {
    out[c.plan] = (out[c.plan] || 0) + 1;
    return out;
  }, {});
  const max = Math.max(...clients.map((c) => c.scans), 1);
  return (
    <>
      <div className="admin-kpis">
        <Kpi
          label="Active clients"
          value={active}
          trend="From active accounts"
          tone="green"
        />
        <Kpi
          label="Expiring soon"
          value={expiring}
          trend="Next 7 days"
          tone="orange"
        />
        <Kpi
          label="Pending renewals"
          value={workspace.metrics.pendingRenewals}
          trend="Open renewals to review"
          tone="orange"
        />
        <Kpi
          label="Total scans"
          value={scans.toLocaleString()}
          trend="Across loaded accounts"
          tone="green"
        />
      </div>
      <div className="console-grid">
        <div className="console-card large">
          <div className="card-heading">
            <div>
              <h3>Platform activity</h3>
              <p>Scan volume by client account</p>
            </div>
            <span className="chart-summary">
              {clients.length} {clients.length === 1 ? "client" : "clients"}
            </span>
          </div>
          <div className="activity-chart">
            <div className="chart-grid">
              <span>{max.toLocaleString()}</span>
              <span>{Math.round(max * 0.75).toLocaleString()}</span>
              <span>{Math.round(max * 0.5).toLocaleString()}</span>
              <span>{Math.round(max * 0.25).toLocaleString()}</span>
              <span>0</span>
            </div>
            <div className="chart-bars">
              {clients.slice(0, 12).map((client) => (
                <i
                  key={client.id}
                  style={{
                    height: `${Math.max((client.scans / max) * 100, 4)}%`,
                  }}
                  title={`${client.name}: ${client.scans} scans`}
                >
                  <b>{client.scans}</b>
                  <span>{client.name}</span>
                </i>
              ))}
            </div>
          </div>
        </div>
        <div className="console-card">
          <div className="card-heading">
            <div>
              <h3>Plan mix</h3>
              <p>Current client accounts</p>
            </div>
            <span className="chart-summary">{clients.length} total</span>
          </div>
          <PlanMix planCounts={planCounts} total={clients.length} />
        </div>
      </div>
      <div className="console-grid lower">
        <div className="console-card">
          <div className="card-heading">
            <h3>Recent activity</h3>
            <button className="text-button" onClick={() => go("Audit log")}>
              View audit log →
            </button>
          </div>
          <p className="muted">
            {workspace.audit.length
              ? `${workspace.audit.length} audit events are available.`
              : "No audit events recorded yet."}
          </p>
        </div>
        <div className="console-card">
          <div className="card-heading">
            <h3>Needs attention</h3>
            <button className="text-button" onClick={() => go("Renewals")}>
              Open renewals →
            </button>
          </div>
          <p className="muted">
            {workspace.metrics.pendingRenewals
              ? `${workspace.metrics.pendingRenewals} renewal request(s) need review.`
              : "No pending renewals."}
          </p>
        </div>
      </div>
    </>
  );
}
function Kpi({
  label,
  value,
  trend,
  tone,
}: {
  label: string;
  value: string | number;
  trend: string;
  tone: string;
}) {
  return (
    <div className="admin-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={tone}>{trend}</small>
    </div>
  );
}
function PlanMix({
  planCounts,
  total,
}: {
  planCounts: Record<string, number>;
  total: number;
}) {
  const entries = Object.entries(planCounts).filter(([, count]) => count > 0);
  const colors = ["#087f80", "#f5a32e", "#7b8b96", "#c36a7c", "#5e6dcc"];
  let cursor = 0;
  const stops = entries.length
    ? entries
        .map(([name, count], index) => {
          const start = cursor;
          cursor += (count / Math.max(total, 1)) * 100;
          return `${colors[index % colors.length]} ${start}% ${cursor}%`;
        })
        .join(", ")
    : "#e0e7e4 0 100%";
  return (
    <div className="donut-wrap">
      <div
        className="donut"
        style={{
          background: `radial-gradient(circle at center, var(--white) 0 57%, transparent 58%), conic-gradient(${stops})`,
        }}
      >
        <strong>{total}</strong>
        <span>{total === 1 ? "client" : "clients"}</span>
      </div>
      {entries.length ? (
        <div className="legend">
          {entries.map(([plan, count], index) => (
            <span key={plan}>
              <i
                className="dot"
                style={{ background: colors[index % colors.length] }}
              />
              <span>{plan}</span>
              <b>{count}</b>
            </span>
          ))}
        </div>
      ) : (
        <p className="muted">No client plans yet.</p>
      )}
    </div>
  );
}
function Clients({
  clients,
  search,
  setSearch,
  status,
  setStatus,
  view,
  toggleView,
  add,
  edit,
  remove,
  restore,
}: {
  clients: Client[];
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  view: "active" | "archived";
  toggleView: () => void;
  add: () => void;
  edit: (client: Client) => void;
  remove: (client: Client) => void;
  restore: (client: Client) => void;
}) {
  return (
    <div className="console-card">
      <div className="table-toolbar">
        <div>
          <h3>
            {view === "archived" ? "Archived clients" : "All clients"}{" "}
            <span>{clients.length}</span>
          </h3>
          <p>
            {view === "archived"
              ? "Clients archived after 90 days of inactivity."
              : "Live client accounts from Supabase."}
          </p>
        </div>
        <div className="toolbar-actions">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
          />
          <StatusDropdown value={status} onChange={setStatus} />
          <button className="archive-toggle" onClick={toggleView}>
            {view === "archived" ? "← Active clients" : "View archive"}
          </button>
        </div>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Location</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Scans</th>
              <th>Renewal</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td>
                  <div className="client-business-cell">
                    <strong>{client.name}</strong>
                    <small>{client.owner}</small>
                  </div>
                </td>
                <td>{client.city}</td>
                <td>{client.plan}</td>
                <td>
                  <span
                    className={`status-pill ${client.status.toLowerCase()}`}
                  >
                    {client.status}
                  </span>
                </td>
                <td>{client.scans.toLocaleString()}</td>
                <td>{client.renewal}</td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => edit(client)}>Edit</button>
                    {client.status === "Disabled" ? (
                      <button onClick={() => restore(client)}>Restore</button>
                    ) : (
                      <button className="danger" onClick={() => remove(client)}>
                        Disable
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!clients.length && (
          <div className="empty-state">
            <h3>No clients found</h3>
            <p>Create or adjust the filters to see live accounts.</p>
            <button className="btn btn-primary" onClick={add}>
              Add client
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
function Plans({ plans, edit }: { plans: any[]; edit: (plan: any) => void }) {
  return (
    <div className="plan-management">
      <div className="plan-intro">
        <div>
          <h3>Manage subscription plans</h3>
          <p>
            Update prices, limits and offers here. Changes appear on client
            renewal screens immediately.
          </p>
        </div>
      </div>
      <div className="plan-cards">
        {plans.map((plan) => (
          <article className="managed-plan" key={plan.id}>
            <div className="managed-plan-heading">
              <div>
                <h3>{plan.name}</h3>
                <p>
                  {plan.max_locations || 1} location(s) ·{" "}
                  {Number(plan.max_scans_per_month || 0).toLocaleString()}{" "}
                  scans/{getPlanPeriodLabel(plan.duration_days)}
                </p>
              </div>
              <button className="action-button" onClick={() => edit(plan)}>
                Edit plan
              </button>
            </div>
            <strong>
              {money(plan.price)}
              <small>{getPlanPeriodSuffix(plan.duration_days)}</small>
            </strong>
            <ul>
              {Object.entries(plan.features || {})
                .filter(([, value]) => Boolean(value))
                .map(([key]) => (
                  <li key={key}>✓ {key.replaceAll("_", " ")}</li>
                ))}
            </ul>
            <div className="managed-plan-footer">
              <span
                className={`status-pill ${plan.is_active ? "active" : "disabled"}`}
              >
                {plan.is_active ? "Active" : "Disabled"}
              </span>
              <button
                className="btn btn-outline btn-small"
                onClick={() => edit(plan)}
              >
                Edit details
              </button>
            </div>
          </article>
        ))}
      </div>
      {!plans.length && (
        <Empty
          title="No plans found"
          text="Create plans in Supabase to display them here."
        />
      )}
    </div>
  );
}
function Renewals({
  rows,
  refresh,
}: {
  rows: any[];
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function update(id: string, status: string) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch("/api/admin/renewals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Unable to update renewal.");
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to update renewal.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="console-card">
      <div className="table-toolbar">
        <div>
          <h3>
            Renewal requests <span>{rows.length}</span>
          </h3>
          <p>Live requests submitted by client accounts.</p>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Requested plan</th>
              <th>Message</th>
              <th>Received</th>
              <th>Status</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.business || "Unknown"}</td>
                <td>{row.plan || "—"}</td>
                <td>{row.message}</td>
                <td>{date(row.received)}</td>
                <td>
                  <span className={`status-pill ${row.status}`}>
                    {row.status}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    {row.status === "pending" ? (
                      <>
                        <button
                          disabled={busy === row.id}
                          onClick={() => void update(row.id, "approved")}
                        >
                          {busy === row.id ? "Saving…" : "Approve"}
                        </button>
                        <button
                          className="danger"
                          disabled={busy === row.id}
                          onClick={() => void update(row.id, "rejected")}
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="muted">Managed</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty
            title="No renewal requests"
            text="Requests will appear here when clients submit them."
          />
        )}
      </div>
    </div>
  );
}
function Payments({
  rows,
  metrics,
}: {
  rows: any[];
  metrics: Workspace["metrics"];
}) {
  return (
    <>
      <div className="admin-kpis">
        <Kpi
          label="Revenue recorded"
          value={money(metrics.totalPayments)}
          trend="From payment records"
          tone="green"
        />
        <Kpi
          label="Payments received"
          value={metrics.paymentsReceived}
          trend="Live database count"
          tone="green"
        />
        <Kpi
          label="Pending payments"
          value="—"
          trend="No payment status table"
          tone="orange"
        />
        <Kpi
          label="Average payment"
          value={
            metrics.paymentsReceived
              ? money(metrics.totalPayments / metrics.paymentsReceived)
              : money(0)
          }
          trend="Calculated from records"
          tone="green"
        />
      </div>
      <div className="console-card">
        <div className="table-toolbar">
          <div>
            <h3>Payment history</h3>
            <p>Live records from payments_log.</p>
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Reference</th>
                <th>Paid on</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.business || "Unknown"}</td>
                  <td>{money(row.amount)}</td>
                  <td>{row.mode}</td>
                  <td>{row.reference}</td>
                  <td>{date(row.paidOn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty
              title="No payments recorded"
              text="Payment records will appear here after they are added."
            />
          )}
        </div>
      </div>
    </>
  );
}
function Audit({ rows }: { rows: any[] }) {
  return (
    <div className="console-card">
      <div className="table-toolbar">
        <div>
          <h3>
            Audit log <span>{rows.length}</span>
          </h3>
          <p>Live platform events from audit_log.</p>
        </div>
      </div>
      <div className="audit-list">
        {rows.map((row) => (
          <div className="timeline-item" key={row.id}>
            <span className="timeline-dot" />
            <div>
              <strong>{row.action}</strong>
              <small>
                {row.business ? `${row.business} · ` : ""}
                {date(row.createdAt)}
              </small>
            </div>
          </div>
        ))}
        {!rows.length && (
          <Empty
            title="No audit events"
            text="Admin activity will be recorded here."
          />
        )}
      </div>
    </div>
  );
}
function Settings({
  settings,
  profile,
}: {
  settings: Record<string, any>;
  profile: { displayName: string; email: string };
}) {
  const [name, setName] = useState(profile.displayName);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to save profile.");
      const headerName = document.querySelector<HTMLElement>(
        ".console-user > span:first-child",
      );
      const avatar = document.querySelector<HTMLElement>(".admin-avatar");
      if (headerName) headerName.textContent = name;
      if (avatar)
        avatar.textContent = name
          .split(/\\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
      setMessage("Profile updated everywhere.");
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "Unable to save profile.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordMessage("");
    if (password.length < 12 || password !== confirmPassword) {
      setPasswordMessage(
        "Use at least 12 characters and make both passwords match.",
      );
      return;
    }
    setPasswordSaving(true);
    try {
      const response = await fetch("/api/admin/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Unable to change password.");
      setPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password changed successfully.");
    } catch (reason) {
      setPasswordMessage(
        reason instanceof Error ? reason.message : "Unable to change password.",
      );
    } finally {
      setPasswordSaving(false);
    }
  }
  const entries = Object.entries(settings).filter(
    ([key]) => key !== "admin_profile",
  );
  return (
    <div className="admin-settings-layout">
      <section className="console-card admin-profile-card">
        <div className="card-heading">
          <div>
            <h3>Admin profile</h3>
            <p>Update the name shown across the admin workspace.</p>
          </div>
          <span className="settings-card-icon">SA</span>
        </div>
        <form onSubmit={save}>
          <div className="field">
            <label htmlFor="admin-display-name">Display name</label>
            <input
              id="admin-display-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="field">
            <label htmlFor="admin-email">
              Email address <span className="readonly-label">Read-only</span>
            </label>
            <input
              id="admin-email"
              value={profile.email || "Not available"}
              readOnly
            />
          </div>
          <div className="settings-form-footer">
            <span className="muted">
              Email changes are disabled for account safety.
            </span>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
          {message && (
            <p className="settings-save-message" role="status">
              {message}
            </p>
          )}
        </form>
      </section>
      <section className="console-card password-card">
        <div className="card-heading">
          <div>
            <h3>Change password</h3>
            <p>Use a strong password with at least 12 characters.</p>
          </div>
          <span className="settings-card-icon">•••</span>
        </div>
        <form onSubmit={changePassword}>
          <div className="field">
            <label htmlFor="admin-new-password">New password</label>
            <input
              id="admin-new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={12}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="admin-confirm-password">Confirm new password</label>
            <input
              id="admin-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={12}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="settings-form-footer">
            <span className="muted">
              You will stay signed in after changing it.
            </span>
            <button className="btn btn-primary" disabled={passwordSaving}>
              {passwordSaving ? "Updating..." : "Change password"}
            </button>
          </div>
          {passwordMessage && (
            <p className="settings-save-message" role="status">
              {passwordMessage}
            </p>
          )}
        </form>
      </section>
      <section className="console-card platform-settings-card">
        <div className="card-heading">
          <div>
            <h3>Platform settings</h3>
            <p>Operational defaults currently active for the platform.</p>
          </div>
          <span className="status-pill active">Live</span>
        </div>
        {entries.length ? (
          <div className="platform-setting-list">
            {entries.map(([key, value]) => {
              const label = key
                .replaceAll("_", " ")
                .replace(/\\b\\w/g, (letter) => letter.toUpperCase());
              const display =
                typeof value === "object" && value !== null
                  ? Object.entries(value)
                      .map(
                        ([childKey, childValue]) =>
                          String(childKey).replaceAll("_", " ") +
                          ": " +
                          childValue,
                      )
                      .join(" · ")
                  : String(value);
              return (
                <div className="platform-setting-item" key={key}>
                  <div>
                    <strong>{label}</strong>
                    <small>
                      {key === "grace_days"
                        ? "Extra days allowed after plan expiry."
                        : "Stored platform preference."}
                    </small>
                  </div>
                  <span>{display}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            title="No platform settings"
            text="Add settings records in Supabase to manage them here."
          />
        )}
      </section>
      <section className="console-card security-card">
        <div className="card-heading">
          <div>
            <h3>Security</h3>
            <p>Authentication and access are enforced server-side.</p>
          </div>
          <span className="security-shield">check</span>
        </div>
        <div className="security-status">
          <div>
            <strong>Super Admin access</strong>
            <small>{profile.email || "Authenticated account"}</small>
          </div>
          <span className="status-pill active">Enabled</span>
        </div>
        <p className="security-note">
          Only authenticated super admins can change platform settings and
          manage client accounts.
        </p>
      </section>
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function ClientModal({
  type,
  client,
  plans,
  onCancel,
  onSave,
}: {
  type: "add" | "edit";
  client: Client | null;
  plans: any[];
  onCancel: () => void;
  onSave: (form: FormData) => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <h2>{type === "edit" ? "Edit client" : "Add a client"}</h2>
            <p>Client details are saved to Supabase.</p>
          </div>
          <button onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>
        <form action={onSave}>
          <div className="field">
            <label>Business name</label>
            <input name="name" defaultValue={client?.name} required />
          </div>
          <div className="field">
            <label>Owner email</label>
            <input
              name="owner"
              type="email"
              defaultValue={client?.owner}
              required
            />
          </div>
          {type === "add" && (
            <div className="field">
              <label>Temporary password</label>
              <input name="password" type="password" minLength={12} required />
            </div>
          )}
          <div className="modal-fields">
            <div className="field">
              <label>City</label>
              <input name="city" defaultValue={client?.city} required />
            </div>
            <div className="field">
              <label>Plan</label>
              <select name="plan" defaultValue={client?.plan || plans[0]?.name}>
                {plans.map((plan) => (
                  <option key={plan.id}>{plan.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Status</label>
            <select name="status" defaultValue={client?.status || "Active"}>
              <option>Active</option>
              <option>Expiring</option>
              <option>Disabled</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-light" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {type === "edit" ? "Save changes" : "Create client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const PLAN_FEATURE_OPTIONS = [
  ["qr", "QR review collection"],
  ["basic_reports", "Basic reports"],
  ["languages", "Multiple languages"],
  ["private_feedback", "Private feedback"],
  ["detailed_dashboard", "Detailed dashboard"],
  ["multiple_locations", "Multiple locations"],
  ["priority_support", "Priority support"],
] as const;

function PlanModal({
  plan,
  onCancel,
  onSaved,
}: {
  plan: any;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const features = form.getAll("features").map((value) => String(value));
    try {
      const response = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: plan.id,
          name: form.get("name"),
          price: form.get("price"),
          duration_days: form.get("duration_days"),
          max_locations: form.get("max_locations"),
          max_scans_per_month: form.get("max_scans_per_month"),
          max_ai_drafts_per_month: form.get("max_ai_drafts_per_month"),
          features,
          is_active: form.get("is_active") === "on",
        }),
      });
      await json(response);
      await onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save plan.",
      );
    } finally {
      setSaving(false);
    }
  }
  const selectedFeatures = plan.features || {};
  return (
    <div className="modal-backdrop">
      <div className="modal plan-modal" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <h2>Edit {plan.name}</h2>
            <p>
              Changes made here will apply everywhere, including pricing and
              client offers.
            </p>
          </div>
          <button onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={save}>
          <div className="modal-fields">
            <div className="field">
              <label>Plan name</label>
              <input name="name" defaultValue={plan.name} required />
            </div>
            <div className="field">
              <label>Plan price (₹)</label>
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={plan.price}
                required
              />
            </div>
          </div>
          <div className="modal-fields">
            <div className="field">
              <label>Duration (days)</label>
              <input
                name="duration_days"
                type="number"
                min="1"
                defaultValue={plan.duration_days || 30}
                required
              />
            </div>
            <div className="field">
              <label>Locations</label>
              <input
                name="max_locations"
                type="number"
                min="1"
                defaultValue={plan.max_locations || 1}
                required
              />
            </div>
          </div>
          <div className="modal-fields">
            <div className="field">
              <label>Scans per plan period</label>
              <input
                name="max_scans_per_month"
                type="number"
                min="1"
                defaultValue={plan.max_scans_per_month || 500}
                required
              />
            </div>
            <div className="field">
              <label>AI drafts per plan period</label>
              <input
                name="max_ai_drafts_per_month"
                type="number"
                min="0"
                defaultValue={plan.max_ai_drafts_per_month || 0}
                required
              />
            </div>
          </div>
          <fieldset className="field">
            <legend>Plan features</legend>
            <div className="feature-toggle-grid">
              {PLAN_FEATURE_OPTIONS.map(([key, label]) => (
                <label className="checkbox-field" key={key}>
                  <input
                    name="features"
                    value={key}
                    type="checkbox"
                    defaultChecked={Boolean(selectedFeatures[key])}
                  />{" "}
                  {label}
                </label>
              ))}
            </div>
            <span className="field-help">
              Select only the features included in this plan.
            </span>
          </fieldset>
          <label className="checkbox-field">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked={plan.is_active}
            />{" "}
            Available for new requests
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-light" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

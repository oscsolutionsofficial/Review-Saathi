"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { getPlanPeriodLabel, getPlanPeriodSuffix } from "@/lib/plan-period";
import { SUPPORTED_REVIEW_LANGUAGES } from "@/lib/review-languages";

type Tab = "dashboard" | "reviews" | "qr" | "locations" | "renew" | "settings";
type WorkspaceData = Record<string, any>;

const tabs: Array<[Tab, string, string]> = [
  ["dashboard", "⌂", "Dashboard"],
  ["reviews", "☆", "Reviews & feedback"],
  ["qr", "▦", "QR code"],
  ["renew", "↻", "Renewal"],
  ["settings", "⚙", "Business profile"],
];
tabs.splice(3, 0, ["locations", "⌖", "Locations"]);
const cache = new Map<Tab, WorkspaceData>();
const pending = new Map<Tab, Promise<WorkspaceData>>();

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      error: response.ok
        ? "The server returned an invalid response."
        : `Server error (${response.status}). Please try again.`,
    };
  }
}

function tabFromPath(path: string): Tab {
  const value = path.split("/")[2] as Tab;
  return tabs.some(([key]) => key === value) ? value : "dashboard";
}

async function getTabData(tab: Tab, force = false) {
  const existing = force ? undefined : cache.get(tab);
  if (existing) return existing;
  const running = pending.get(tab);
  if (running) return running;
  const request = fetch(
    tab === "locations"
      ? "/api/client/locations"
      : `/api/client/workspace?tab=${tab}`,
    {
      cache: "no-store",
    },
  )
    .then(async (response) => {
      const body = await readJson(response);
      if (!response.ok)
        throw new Error(body.error || "Unable to load this page.");
      cache.set(tab, body);
      return body;
    })
    .finally(() => pending.delete(tab));
  pending.set(tab, request);
  return request;
}

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "";
}
function dateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("en-IN") : "";
}
function average(counts: number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  return total
    ? (
        counts.reduce((sum, count, index) => sum + count * (5 - index), 0) /
        total
      ).toFixed(1)
    : "0.0";
}

export default function ClientConsole({ initialTab }: { initialTab: Tab }) {
  const [active, setActive] = useState<Tab>(initialTab);
  const [data, setData] = useState<WorkspaceData | null>(
    () => cache.get(initialTab) || null,
  );
  const [loading, setLoading] = useState(!cache.has(initialTab));
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  async function load(tab: Tab, force = false) {
    const cached = force ? undefined : cache.get(tab);
    setError("");
    setData((current) => cached || (force ? current : null));
    setLoading(!cached && !force);
    if (force) setRefreshing(true);
    try {
      setData(await getTabData(tab, force));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load this page.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function navigate(tab: Tab) {
    if (tab === active) {
      setOpen(false);
      return;
    }
    window.history.pushState(
      {},
      "",
      tab === "dashboard" ? "/client/dashboard" : `/client/${tab}`,
    );
    setActive(tab);
    setOpen(false);
    void load(tab);
  }

  useEffect(() => {
    void load(initialTab);
    const onPopState = () => {
      const next = tabFromPath(window.location.pathname);
      setActive(next);
      void load(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // initialTab is the server-selected entry route; navigation is handled by popstate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node))
        setAccountOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const tenant = data?.tenant || cache.get("dashboard")?.tenant;
  const businessName = tenant?.name || "Business workspace";
  const avatar =
    businessName
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0])
      .join("")
      .toUpperCase() || "RS";

  return (
    <main className="app-page client-console-page">
      <header className="console-header client-console-header">
        <button
          className="mobile-menu-toggle"
          aria-label="Open navigation"
          onClick={() => setOpen(true)}
        >
          ☰
        </button>
        <span className="brand">
          <span className="brand-mark">▦</span>
          <span>Review Saathi</span>
        </span>
        <span className="header-page-title">
          {tabs.find(([key]) => key === active)?.[2]}
        </span>
        <button
          className={`client-refresh-button ${refreshing ? "is-refreshing" : ""}`}
          type="button"
          onClick={() => void load(active, true)}
          disabled={refreshing}
          aria-label="Refresh current page data"
        >
          {refreshing ? "Updating..." : "Refresh"}
        </button>
        <div className="console-user client-account" ref={accountRef}>
          <button
            className="client-account-trigger"
            aria-label="Open account menu"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen((value) => !value)}
          >
            <span>{businessName}</span>
            <span className="client-avatar">{avatar}</span>
          </button>
          {accountOpen && (
            <div className="client-account-menu">
              <strong>{businessName}</strong>
              <small>
                {tenant?.status === "active" ? "Active" : "Disabled"}
              </small>
              <button
                onClick={() => {
                  setAccountOpen(false);
                  navigate("settings");
                }}
              >
                Business profile
              </button>
              <a href="/api/auth/logout">Sign out</a>
            </div>
          )}
        </div>
      </header>
      <button
        className={`mobile-nav-backdrop ${open ? "open" : ""}`}
        aria-label="Close navigation"
        onClick={() => setOpen(false)}
      />
      <div className="console-layout client-console-layout">
        <aside
          className={`console-sidebar client-console-sidebar ${open ? "mobile-open" : ""}`}
        >
          <div className="console-side-brand">
            <span className="brand-mark">▦</span>
            <div>
              <strong>{businessName}</strong>
              <small>Review Saathi</small>
            </div>
            <button
              className="mobile-nav-close"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <nav className="console-nav client-console-nav">
            {tabs.map(([key, icon, label]) => (
              <button
                key={key}
                className={active === key ? "active" : ""}
                onClick={() => navigate(key)}
                onMouseEnter={() => {
                  void getTabData(key).catch(() => undefined);
                }}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </nav>
          <div className="console-sidebar-foot">
            <span>Need help?</span>
            <strong>Contact support →</strong>
          </div>
        </aside>
        <section className="console-main client-console-main">
          {loading && !data ? (
            <div className="data-loading" aria-live="polite">
              <span className="admin-loading-spinner" />
              <strong>
                Loading{" "}
                {tabs.find(([key]) => key === active)?.[2].toLowerCase()}…
              </strong>
            </div>
          ) : error ? (
            <div className="client-error" role="alert">
              <strong>{error}</strong>
              <button
                className="btn btn-outline"
                onClick={() => void load(active)}
              >
                Try again
              </button>
            </div>
          ) : (
            <TabContent tab={active} data={data || {}} navigate={navigate} />
          )}
        </section>
      </div>
    </main>
  );
}

function TabContent({
  tab,
  data,
  navigate,
}: {
  tab: Tab;
  data: WorkspaceData;
  navigate: (tab: Tab) => void;
}) {
  if (tab === "dashboard") return <Dashboard data={data} />;
  if (tab === "reviews") return <Reviews data={data} />;
  if (tab === "qr") return <Qr data={data} />;
  if (tab === "locations") return <Locations data={data} />;
  if (tab === "renew") return <Renew data={data} />;
  return <Settings data={data} navigate={navigate} />;
}

function Heading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="client-page-heading">
      <div>
        <span className="client-breadcrumb">Workspace / {title}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Dashboard({ data }: { data: WorkspaceData }) {
  const counts = (data.ratingCounts || [0, 0, 0, 0, 0]) as number[];
  const total = data.totalScans || 0;
  const plan = Array.isArray(data.subscription?.plans)
    ? data.subscription?.plans[0]
    : data.subscription?.plans;
  return (
    <>
      <Heading
        title="Dashboard"
        description="Monitor your customer feedback and review activity."
        action={<span className="pill pill-green">{total} scans tracked</span>}
      />
      <div className="client-stats">
        <div>
          <small>QR scans</small>
          <strong>{total}</strong>
          <span>Live account data</span>
        </div>
        <div>
          <small>Average rating</small>
          <strong>{average(counts)}</strong>
          <span>{total ? "Based on collected ratings" : "No ratings yet"}</span>
        </div>
        <div>
          <small>Private feedback</small>
          <strong>{data.feedbackCount || 0}</strong>
          <span>Customer messages</span>
        </div>
        <div>
          <small>Current plan</small>
          <strong>{plan?.name || "Not selected"}</strong>
          <span>
            {data.subscription?.end_date
              ? `Active until ${date(data.subscription.end_date)}`
              : "Contact your administrator"}
          </span>
        </div>
      </div>
      <div className="client-dashboard-grid">
        <section className="client-card">
          <div className="client-card-heading">
            <div>
              <h2>Rating overview</h2>
              <p>
                {data.profile?.business_type || "Your business"}
                {data.profile?.city ? ` · ${data.profile.city}` : ""}
              </p>
            </div>
            <span className="muted">{total} ratings</span>
          </div>
          {total ? (
            counts.map((count, index) => (
              <div className="rating-row" key={index}>
                <span>{5 - index} ★</span>
                <div>
                  <i
                    style={{ width: `${Math.round((count / total) * 100)}%` }}
                  />
                </div>
                <small>{Math.round((count / total) * 100)}%</small>
              </div>
            ))
          ) : (
            <Empty
              title="No rating activity yet"
              text="Share your QR code to start collecting feedback."
            />
          )}
        </section>
        <section className="client-card">
          <div className="client-card-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Latest scans received through your QR code.</p>
            </div>
          </div>
          {data.recent?.length ? (
            data.recent.map((row: any, index: number) => (
              <div
                className="client-activity"
                key={`${row.created_at}-${index}`}
              >
                <span className="activity-dot" />
                <div>
                  <strong>{row.rating} star rating received</strong>
                  <small>{dateTime(row.created_at)}</small>
                </div>
              </div>
            ))
          ) : (
            <Empty
              title="Your activity will appear here"
              text="Customers can scan your dynamic QR code anytime."
            />
          )}
        </section>
      </div>
    </>
  );
}
function Reviews({ data }: { data: WorkspaceData }) {
  const [scans, setScans] = useState<any[]>(data.scans || []);
  const [feedback, setFeedback] = useState<any[]>(data.feedback || []);
  const [page, setPage] = useState(Number(data.page || 1));
  const [hasMore, setHasMore] = useState(
    Boolean(data.hasMoreScans || data.hasMoreFeedback),
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const ratings = scans.length;
  useEffect(() => {
    setScans(data.scans || []);
    setFeedback(data.feedback || []);
    setPage(Number(data.page || 1));
    setHasMore(Boolean(data.hasMoreScans || data.hasMoreFeedback));
  }, [data]);
  useEffect(() => {
    const loadMore = async () => {
      if (
        loadingMore ||
        !hasMore ||
        window.scrollY + window.innerHeight <
          document.documentElement.scrollHeight - 260
      )
        return;
      setLoadingMore(true);
      try {
        const response = await fetch(
          `/api/client/workspace?tab=reviews&page=${page + 1}&limit=20`,
          { cache: "no-store" },
        );
        const next = await response.json();
        if (!response.ok)
          throw new Error(next.error || "Unable to load more reviews.");
        setScans((current) => [...current, ...(next.scans || [])]);
        setFeedback((current) => [...current, ...(next.feedback || [])]);
        setPage(next.page || page + 1);
        setHasMore(Boolean(next.hasMoreScans || next.hasMoreFeedback));
      } finally {
        setLoadingMore(false);
      }
    };
    const onScroll = () => {
      void loadMore();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasMore, loadingMore, page]);
  return (
    <>
      <Heading
        title="Reviews & feedback"
        description="See ratings and private customer messages collected through your QR code."
      />
      <div className="client-stats">
        <div>
          <small>Total ratings loaded</small>
          <strong>{ratings}</strong>
          <span>Scroll to load more</span>
        </div>
        <div>
          <small>Average rating</small>
          <strong>
            {ratings
              ? (
                  scans.reduce((sum: number, row: any) => sum + row.rating, 0) /
                  ratings
                ).toFixed(1)
              : "0.0"}
          </strong>
          <span>{ratings ? "Based on loaded ratings" : "No ratings yet"}</span>
        </div>
        <div>
          <small>Private feedback</small>
          <strong>{feedback.length}</strong>
          <span>Private customer messages</span>
        </div>
        <div>
          <small>Drafts copied</small>
          <strong>{scans.filter((row: any) => row.copied).length}</strong>
          <span>Review drafts copied</span>
        </div>
      </div>
      <section className="client-card">
        <div className="client-card-heading">
          <div>
            <h2>Recent ratings</h2>
            <p>20 ratings load at a time. Scroll down for older ratings.</p>
          </div>
          <span className="pill pill-green">{ratings} loaded</span>
        </div>
        {scans.length ? (
          scans.map((row: any, index: number) => (
            <div
              className="client-review-row"
              key={`${row.created_at}-${index}`}
            >
              <strong className="review-stars">
                {"★".repeat(row.rating)}
                <span>{"★".repeat(5 - row.rating)}</span>
              </strong>
              <div>
                <strong>{row.rating} out of 5</strong>
                <small>
                  {row.tags?.length ? row.tags.join(", ") : "No tags selected"}{" "}
                  · {row.language || "English"}
                </small>
              </div>
              <time>{dateTime(row.created_at)}</time>
            </div>
          ))
        ) : (
          <Empty
            title="No ratings yet"
            text="Your collected customer ratings will appear here."
          />
        )}
      </section>
      <section
        className="client-card private-feedback-card"
        style={{ marginTop: 18 }}
      >
        <div className="client-card-heading">
          <div>
            <h2>Private feedback</h2>
            <p>
              Customers can share problems or suggestions directly with the
              business. This is not posted publicly.
            </p>
          </div>
          <span className="private-feedback-badge">Owner only</span>
        </div>
        {feedback.length ? (
          feedback.map((row: any, index: number) => (
            <div
              className="client-feedback-row"
              key={`${row.created_at}-${index}`}
            >
              <div>
                <strong>
                  {row.rating
                    ? `${row.rating} star rating`
                    : "Customer message"}
                </strong>
                <p>{row.message}</p>
                <small>
                  {row.contact || "No contact shared"} ·{" "}
                  {dateTime(row.created_at)}
                </small>
              </div>
            </div>
          ))
        ) : (
          <div className="private-feedback-empty">
            <div className="private-feedback-icon">✦</div>
            <div>
              <strong>No private feedback yet</strong>
              <span>
                When a customer wants to report an issue or share a suggestion
                privately, it will appear here for the business owner.
              </span>
            </div>
          </div>
        )}
      </section>
      {loadingMore && (
        <p className="load-more-status">Loading older ratings…</p>
      )}
      {!hasMore && ratings > 0 && (
        <p className="load-more-status">
          You’ve reached the end of the ratings.
        </p>
      )}
    </>
  );
}
function Qr({ data }: { data: WorkspaceData }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url =
    data.publicReviewUrl ||
    (data.reviewPath ? `${origin}${data.reviewPath}` : "");
  useEffect(() => {
    if (!url) {
      setQrDataUrl("");
      return;
    }
    void QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#075f62", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [url]);
  const qrImage = qrDataUrl || data.dataUrl;
  return (
    <>
      <Heading
        title="QR code"
        description="Use one dynamic QR code to collect customer feedback."
      />
      <div className="client-qr-grid">
        <section className="client-card client-qr-card">
          <div className="client-card-heading">
            <div>
              <h2>{data.tenant?.name || "Business"}</h2>
              <p>
                {[data.profile?.business_type, data.profile?.city]
                  .filter(Boolean)
                  .join(" · ") || "Business review page"}
              </p>
            </div>
            <span className="pill pill-green">Live</span>
          </div>
          {qrImage ? (
            <img
              className="client-qr-image"
              src={qrImage}
              alt="Business review QR code"
            />
          ) : (
            <Empty
              title="QR code unavailable"
              text="Complete your business profile first."
            />
          )}
          <p className="client-qr-url">{url || "No review link available"}</p>
          <div className="client-form-actions">
            <button
              className="btn btn-primary"
              disabled={!qrImage}
              onClick={() => {
                const link = document.createElement("a");
                link.href = qrImage;
                link.download = "review-qr.png";
                link.click();
              }}
            >
              Download QR
            </button>
            <button
              className="btn btn-outline"
              disabled={!url}
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </section>
        <section className="client-card">
          <div className="client-card-heading">
            <div>
              <h2>How to use your QR</h2>
              <p>Place it where customers can easily scan it.</p>
            </div>
          </div>
          <div className="client-qr-tips">
            <div>
              <strong>1. Display it</strong>
              <span>
                Use it at your counter, reception desk, table or packaging.
              </span>
            </div>
            <div>
              <strong>2. Invite feedback</strong>
              <span>Ask customers to scan and share their experience.</span>
            </div>
            <div>
              <strong>3. Keep it active</strong>
              <span>
                The same QR link stays valid when your profile changes.
              </span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
function Renew({ data }: { data: WorkspaceData }) {
  const current = Array.isArray(data.current?.plans)
    ? data.current?.plans[0]
    : data.current?.plans;
  const usage = data.usage || {
    used: 0,
    limit: 0,
    remaining: 0,
    expired: false,
    canScan: false,
  };
  const exhausted = usage.expired || (usage.limit > 0 && usage.remaining <= 0);
  const usagePercent =
    usage.limit > 0
      ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
      : 0;
  const statusText = data.pending
    ? "Request pending"
    : exhausted
      ? "Action required"
      : data.current?.status === "active"
        ? "Active"
        : "Setup required";
  return (
    <>
      <Heading
        title="Plan & renewal"
        description="Track your current plan, scan usage and renew or upgrade whenever you need."
      />
      <section
        className={`client-card current-plan-card ${exhausted ? "plan-expired" : ""}`}
      >
        <div className="current-plan-main">
          <span className="eyebrow">Current plan</span>
          <h2>{current?.name || "No active plan"}</h2>
          <p>
            {data.current?.end_date
              ? `${usage.expired ? "Expired on" : "Active until"} ${date(data.current.end_date)}`
              : "Choose a plan to get started."}
          </p>
          <div className="plan-usage">
            <div className="plan-usage-heading">
              <strong>Scan usage</strong>
              <span>
                {usage.limit > 0
                  ? `${usage.used} used · ${usage.remaining} left`
                  : "No scan limit configured"}
              </span>
            </div>
            {usage.limit > 0 && (
              <>
                <div className="plan-usage-track">
                  <i style={{ width: `${usagePercent}%` }} />
                </div>
                <small>
                  {usagePercent}% of {usage.limit.toLocaleString("en-IN")} scans
                  used
                </small>
              </>
            )}
          </div>
        </div>
        <span
          className={`pill ${data.pending ? "pill-orange" : exhausted ? "pill-red" : "pill-green"}`}
        >
          {statusText}
        </span>
      </section>
      {exhausted && !data.pending && (
        <div className="renewal-alert">
          <strong>
            {usage.expired
              ? "Your plan has expired."
              : "Your scan limit is complete."}
          </strong>
          <span>
            Renew your current plan or choose a bigger plan to start scanning
            again.
          </span>
        </div>
      )}
      <div className="client-plan-grid">
        {(data.plans || []).map((plan: any) => {
          const period = getPlanPeriodLabel(plan.duration_days);
          const features = plan.features
            ? Object.keys(plan.features)
                .filter((key) => plan.features[key])
                .slice(0, 6)
            : [];
          const selected = current?.name === plan.name;
          const canRequest = !data.pending && (!selected || exhausted);
          return (
            <form
              className={`client-plan-card ${selected ? "selected" : ""}`}
              key={plan.id}
              action="/api/client/renew"
              method="post"
            >
              <input type="hidden" name="plan_id" value={plan.id} />
              <span className="eyebrow">
                {selected ? "Current plan" : "Available plan"}
              </span>
              <h2>{plan.name}</h2>
              <strong className="client-plan-price">
                ₹{Number(plan.price).toLocaleString("en-IN")}
                <small>{getPlanPeriodSuffix(plan.duration_days)}</small>
              </strong>
              <span className="plan-limit">
                {Number(plan.max_scans_per_month || 0).toLocaleString("en-IN")}{" "}
                scans / {period}
              </span>
              <ul>
                {features.map((feature) => (
                  <li key={feature}>{feature.replaceAll("_", " ")}</li>
                ))}
              </ul>
              <button
                className={selected ? "btn btn-primary" : "btn btn-outline"}
                disabled={!canRequest}
                type="submit"
              >
                {data.pending
                  ? "Request pending"
                  : selected
                    ? exhausted
                      ? "Renew now"
                      : "Renew after limit"
                    : "Request this plan"}
              </button>
            </form>
          );
        })}
      </div>
    </>
  );
}
function Locations({ data }: { data: WorkspaceData }) {
  const [locations, setLocations] = useState<any[]>(data.locations || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const maxLocations = Number(data.maxLocations || 1);
  const canCreateLocation = locations.filter((location) => location.is_active !== false).length < maxLocations;
  useEffect(() => {
    let cancelled = false;
    void Promise.all((locations || []).map(async (location) => [location.id, await QRCode.toDataURL(`${window.location.origin}/r/${location.slug}`, { width: 220, margin: 2, errorCorrectionLevel: "M" })] as const))
      .then(entries => { if (!cancelled) setQrImages(Object.fromEntries(entries)); })
      .catch(() => { if (!cancelled) setQrImages({}); });
    return () => { cancelled = true; };
  }, [locations]);
  async function createLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/client/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          business_type: form.get("business_type"),
          city: form.get("city"),
          place_id: form.get("place_id"),
          logo_url: form.get("logo_url"),
          services: String(form.get("services") || "").split(",").map(item => item.trim()).filter(Boolean),
          custom_tags: String(form.get("custom_tags") || "").split(",").map(item => item.trim()).filter(Boolean),
        }),
      });
      const body = await readJson(response);
      if (!response.ok)
        throw new Error(body.error || "Unable to create location.");
      const refreshed = await fetch("/api/client/locations", {
        cache: "no-store",
      });
      const next = await readJson(refreshed);
      setLocations(next.locations || []);
      event.currentTarget.reset();
      setShowCreateForm(false);
      setMessage("Location created. Its QR link is ready.");
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "Unable to create location.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/client/locations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: editing.id, slug: editing.slug, name: form.get("name"), business_type: form.get("business_type"), city: form.get("city"), place_id: form.get("place_id"), logo_url: form.get("logo_url"), languages: String(form.get("languages") || "English").split(",").map(item => item.trim()).filter(Boolean), services: String(form.get("services") || "").split(",").map(item => item.trim()).filter(Boolean), custom_tags: String(form.get("custom_tags") || "").split(",").map(item => item.trim()).filter(Boolean) }) });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.error || "Unable to update location.");
      const refreshed = await fetch("/api/client/locations", { cache: "no-store" });
      const next = await readJson(refreshed); setLocations(next.locations || []); setEditing(null); setMessage("Location updated.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Unable to update location."); }
    finally { setSaving(false); }
  }
  async function disableLocation(location: any) {
    if (!window.confirm(`Archive ${location.name}? Existing scans and reports will remain safe.`)) return;
    setMessage("");
    const response = await fetch("/api/client/locations", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: location.id }) });
    const body = await readJson(response);
    if (!response.ok) { setMessage(body.error || "Unable to disable location."); return; }
    setLocations(current => current.filter(item => item.id !== location.id)); setMessage("Location archived. Existing data was kept.");
  }
  async function restoreLocation(location: any) {
    setMessage("");
    const response = await fetch("/api/client/locations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: location.id, is_active: true }) });
    const body = await readJson(response);
    if (!response.ok) { setMessage(body.error || "Unable to restore location."); return; }
    const refreshed = await fetch("/api/client/locations", { cache: "no-store" });
    const next = await readJson(refreshed); setLocations(next.locations || []); setMessage("Location restored.");
  }
  return (
    <>
      <Heading
        title="Locations"
        description="Manage branches and create a separate review QR for each location."
      />
      <div className="client-card">
        <div className="client-card-heading">
          <div>
            <h2>Your locations</h2>
            <p>
              {locations.length} location(s) configured
              {data.maxLocations ? ` · limit ${data.maxLocations}` : ""}
            </p>
          </div>
          <span className="pill pill-green">
            {canCreateLocation ? "Available" : "Limit reached"}
          </span>
        </div>
        {locations.map((location) => (
          <div className="location-item" key={location.id}>
            <span className="activity-dot" />
            <div className="location-item-main">
              <div className="location-title-row">
                <div>
                  <strong>{location.name}</strong>
                  <span className={`location-status ${location.is_active ? "location-status-active" : "location-status-archived"}`}>{location.is_active ? "Active" : "Archived"}</span>
                  <small>{location.business_type || "Business location"}{location.city ? ` · ${location.city}` : ""}</small>
                </div>
              <div className="location-actions">
                <button className="btn btn-light btn-small" type="button" onClick={() => { setMessage(""); setEditing(location); }}>Edit</button>
                {location.is_active ? <button className="btn btn-light btn-small btn-danger-soft" type="button" onClick={() => void disableLocation(location)}>Archive</button> : <button className="btn btn-light btn-small btn-restore" type="button" onClick={() => void restoreLocation(location)}>Restore</button>}
              </div>
              </div>
              {location.is_active && qrImages[location.id] && (
                <div className="location-qr-row">
                  <img className="client-qr-image" src={qrImages[location.id]} alt={`${location.name} review QR`} />
                  <div className="location-qr-info"><a className="btn btn-outline" href={qrImages[location.id]} download={`${location.slug}-review-qr.png`}>Download QR</a><small>Public review link</small><code>/r/{location.slug}</code></div>
                </div>
              )}
              <small>
                {location.city || "No city"} · /r/{location.slug}
              </small>
            </div>
          </div>
        ))}
        {!locations.length && (
          <Empty
            title="No locations yet"
            text="Add your first branch to create location-specific QR links."
          />
        )}
      </div>
      {editing && (
        <div className="location-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
        <form className="client-card client-settings-form location-editor-modal" onSubmit={saveLocation}>
          <div className="client-card-heading"><div><h2>Edit {editing.name}</h2><p>Update branch details without changing its public QR link.</p></div><button className="btn btn-light" type="button" onClick={() => setEditing(null)}>Cancel</button></div>
          <div className="client-form-grid"><Field id="edit-location-name" name="name" label="Location name" value={editing.name || ""} required/><Field id="edit-location-type" name="business_type" label="Business type" value={editing.business_type || ""} required/><Field id="edit-location-city" name="city" label="City / area" value={editing.city || ""} required/><Field id="edit-location-place-id" name="place_id" label="Google Place ID or review link" value={editing.place_id || ""}/><Field id="edit-location-logo" name="logo_url" label="Branch logo URL" value={editing.logo_url || ""} wide/><LanguagePicker name="languages" label="Review languages" value={editing.languages || ["English"]} wide/><Field id="edit-location-services" name="services" label="Facilities / services" value={(editing.services || []).join(", ")} wide/><Field id="edit-location-tags" name="custom_tags" label="Review tags" value={(editing.custom_tags || []).join(", ")} wide/></div>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save location"}</button>
        </form>
        </div>
      )}
      {canCreateLocation && !showCreateForm && (
        <button className="btn btn-primary location-add-button" type="button" onClick={() => { setMessage(""); setShowCreateForm(true); }}>+ Add location</button>
      )}
      {canCreateLocation && showCreateForm && (
        <div className="location-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreateForm(false); }}>
        <form
          className="client-card client-settings-form location-editor-modal"
          onSubmit={createLocation}
        >
          <div className="client-card-heading">
            <div>
              <h2>Add location</h2>
              <p>
                Each location gets its own public review link and QR identity.
              </p>
            </div>
            <button className="btn btn-light" type="button" onClick={() => setShowCreateForm(false)}>Cancel</button>
          </div>
          <div className="client-form-grid">
            <Field
              id="location-name"
              name="name"
              label="Location name"
              value=""
              required
            />
            <Field id="location-type" name="business_type" label="Business type" value="" required/>
            <Field
              id="location-city"
              name="city"
              label="City / area"
              value=""
              required
            />
            <Field
              id="location-place-id"
              name="place_id"
              label="Google Place ID or review link"
              value=""
            />
            <Field id="location-logo" name="logo_url" label="Branch logo URL" value="" wide/>
            <Field id="location-services" name="services" label="Facilities / services" value="" wide/>
            <Field id="location-tags" name="custom_tags" label="Review tags" value="" wide/>
          </div>
          {message && (
            <p className="form-error" role="alert">
              {message}
            </p>
          )}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create location"}
          </button>
        </form>
        </div>
      )}
      {message && !canCreateLocation && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
    </>
  );
}

function Settings({
  data,
  navigate,
}: {
  data: WorkspaceData;
  navigate: (tab: Tab) => void;
}) {
  const profile = data.profile || {};
  return (
    <>
      <Heading
        title="Business profile"
        description="Manage the information used on your review page and customer review drafts."
      />
      <form
        className="client-card client-settings-form"
        action="/api/client/profile"
        method="post"
      >
        <input type="hidden" name="return_to" value="/client/settings" />
        <div className="client-form-grid">
          <Field
            id="business-name"
            name="name"
            label="Business name"
            value={data.tenant?.name || ""}
            required
          />
          <Field
            id="business-type"
            name="business_type"
            label="Business type"
            value={profile.business_type || ""}
            required
          />
          <Field
            id="city"
            name="city"
            label="City / area"
            value={profile.city || ""}
            required
          />
          <Field
            id="place-id"
            name="place_id"
            label="Google Business link or Place ID"
            value={profile.place_id || ""}
          />
          <Field
            id="logo-url"
            name="logo_url"
            label="Logo image URL"
            value={profile.logo_url || ""}
          />
          <LanguagePicker
            name="languages"
            label="Review languages"
            value={profile.languages || ["English"]}
          />
          <Field
            id="custom-tags"
            name="custom_tags"
            label="Review tags"
            value={(profile.custom_tags || []).join(", ")}
          />
          <Field
            id="services"
            name="services"
            label="What do customers value?"
            value={(profile.services || []).join(", ")}
            wide
          />
          <div className="field span-2">
            <label htmlFor="welcome-message">
              Welcome message <span className="optional-label">Optional</span>
            </label>
            <textarea
              id="welcome-message"
              name="welcome_message"
              rows={4}
              defaultValue={profile.welcome_message || ""}
            />
          </div>
        </div>
        <div className="client-form-actions">
          <button className="btn btn-primary" type="submit">
            Save profile
          </button>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => navigate("qr")}
          >
            View QR code
          </button>
        </div>
      </form>
    </>
  );
}
function LanguagePicker({
  name,
  label,
  value,
  wide,
}: {
  name: string;
  label: string;
  value: string[];
  wide?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(
    value.length ? value : ["English"],
  );
  return (
    <div className={`field language-picker ${wide ? "span-2" : ""}`}>
      <span className="field-label">{label}</span>
      <input type="hidden" name={name} value={selected.join(", ")} />
      <div className="language-picker-options" aria-label={label}>
        {SUPPORTED_REVIEW_LANGUAGES.map((language) => {
          const checked = selected.includes(language);
          return (
            <label className={`language-choice ${checked ? "selected" : ""}`} key={language}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  setSelected((current) => {
                    if (checked) {
                      const next = current.filter((item) => item !== language);
                      return next.length ? next : ["English"];
                    }
                    return [...current, language];
                  });
                }}
              />
              <span>{language}</span>
            </label>
          );
        })}
      </div>
      <small className="field-help">Select all languages your customers can use.</small>
    </div>
  );
}

function Field({
  id,
  name,
  label,
  value,
  required,
  wide,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`field ${wide ? "span-2" : ""}`}>
      <label htmlFor={id}>
        {label}
        {!required && <span className="optional-label">Optional</span>}
      </label>
      <input id={id} name={name} required={required} defaultValue={value} />
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="client-empty">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

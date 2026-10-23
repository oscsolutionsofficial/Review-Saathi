import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanPeriodLabel, getPlanPeriodSuffix } from "@/lib/plan-period";

export const dynamic = "force-dynamic";

const industries = ["Cafés & Restaurants", "Retail Shops", "Salons & Spas", "Clinics & Hospitals", "Service Providers"];
const faqs = [
  ["✓", "Is this allowed by Google?", "Yes. Customers write and submit their own honest reviews."],
  ["□", "What is private feedback?", "Private feedback lets owners hear concerns without hiding public reviews."],
  ["⚙", "Does Review Saathi post reviews automatically?", "No. Customers always review, edit and submit the review themselves."],
  ["⌖", "Can I use one QR for multiple locations?", "Yes. Business plans support multiple locations and separate reporting."],
  ["文", "Can customers write in Hindi?", "Yes. Review flows support English, Hindi, Hinglish, Rajasthani and Gujarati."],
  ["↻", "Can I cancel or renew my plan?", "Yes. You can renew or change your plan from your account workspace."],
];

type PublicPlan = { id: string; name: string; price: number; duration_days: number; max_scans_per_month: number; features: Record<string, boolean> | null };

async function getPublicPlans(): Promise<PublicPlan[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("plans").select("id,name,price,duration_days,max_scans_per_month,features").eq("is_active", true).order("price", { ascending: true });
    if (error) return [];
    return (data || []) as PublicPlan[];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const plans = await getPublicPlans();
  return <main className="app-shell">
    <div className="topbar"><div className="container"><nav className="nav"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">▦</span><span className="brand-copy"><strong>Review Saathi</strong><small>Real Reviews. Real Growth.</small></span></Link><div className="nav-links"><a className="active" href="#home">Home</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></div><div className="nav-actions"><Link className="btn btn-outline btn-small" href="/login">Login</Link></div></nav></div></div>
    <section className="hero" id="home"><div className="hero-card"><div className="hero-copy"><div className="hero-kicker"><span className="kicker-dot" aria-hidden="true">✦</span>For local businesses</div><h1>Good service<br />deserves a<br /><em>good review.</em></h1><p>Turn happy customers into authentic Google reviews with a simple QR code at your counter.</p><div className="hero-actions"><a className="btn btn-primary" href="#contact">Book a demo <span aria-hidden="true">→</span></a><a className="btn btn-light" href="#how-it-works"><span className="play-icon">▶</span> See how it works</a></div><div className="hero-features"><div><span>▦</span><strong>Easy QR scan</strong><small>No app required</small></div><div><span>★</span><strong>More Google reviews</strong><small>Build your reputation</small></div><div><span>⌁</span><strong>Grow your business</strong><small>Better visibility</small></div><div><span>♢</span><strong>Safe &amp; secure</strong><small>Your data is protected</small></div></div></div><div className="hero-visual" aria-label="Review Saathi cafe review QR and phone preview"><div className="visual-note">Simple Scan<br /><b>Big Impact</b><span>↘</span></div><div className="qr-card" /><div className="phone" /></div></div><div className="industry-strip trusted-strip"><span>Trusted by local businesses across India</span>{industries.map(item => <i key={item}>{item}</i>)}</div></section>
    <section className="trust-section" id="how-it-works"><div className="section-container trust-layout"><div className="trust-intro"><span className="section-label">Trust &amp; transparency</span><h2>Reviews stay in your <em>customers&apos; hands.</em></h2><p>We believe in genuine reviews, written by real customers. You stay in control, and so do they.</p></div><div className="trust-card trust-card-good"><div className="trust-card-title"><span>✓</span><h3>What we do</h3></div><ul><li>Help customers write in their own words</li><li>Let customers edit before posting</li><li>Show owners scans and private feedback</li></ul></div><div className="trust-card trust-card-limit"><div className="trust-card-title"><span>⊘</span><h3>What we don&apos;t do</h3></div><ul><li>Never post on a customer&apos;s behalf</li><li>No review gating</li><li>No paid reviews or rating promises</li></ul></div></div></section>
    <section className="section-container pricing-section" id="pricing"><div className="pricing-heading"><div><span className="section-label">Simple pricing</span><h2>Choose the plan that fits your business.</h2></div><p>Start small, grow when you are ready.</p></div><div className="pricing-grid">{plans.length ? plans.map((plan, index) => { const period = getPlanPeriodLabel(plan.duration_days); const features = Object.keys(plan.features || {}).filter(key => plan.features?.[key]).slice(0, 5); return <article className={`price-card ${index === 1 ? "popular" : ""}`} key={plan.id}>{index === 1 && <span className="eyebrow">Most popular</span>}<h3>{plan.name}</h3><div className="price">₹{Number(plan.price).toLocaleString("en-IN")}<small>{getPlanPeriodSuffix(plan.duration_days)}</small></div><p className="muted">{Number(plan.max_scans_per_month || 0).toLocaleString("en-IN")} scans included per {period}.</p><ul>{features.map(feature => <li key={feature}>{feature.replaceAll("_", " ")}</li>)}</ul><Link className={index === 1 ? "btn btn-primary" : "btn btn-outline"} href="/login">Choose {plan.name}</Link></article>; }) : <div className="empty-state"><h3>Plans are being updated</h3><p>Current plans will appear here shortly.</p></div>}</div></section>
    <section className="faq-section" id="faq"><div className="section-container faq-layout"><div className="faq-intro"><span className="section-label">FAQ</span><h2>Questions, <em>answered.</em></h2><p>Everything you need to know about Review Saathi.</p><span className="faq-swoosh">〰</span></div><div className="faq-grid">{faqs.map(([icon, question, answer]) => <details className="faq-item" key={question}><summary><span className="faq-icon">{icon}</span><strong>{question}</strong><span className="faq-arrow">⌄</span></summary><p>{answer}</p></details>)}</div></div></section>
    <section className="cta-section" id="contact"><div className="cta-inner"><div className="cta-icon">↗</div><div><h2>Ready to make reviews easier?</h2><p>Start with one QR at your counter.</p></div><a className="btn btn-cta-light" href="mailto:hello@reviewsaathi.in">Book a demo <span>→</span></a><a className="btn btn-cta-outline" href="https://wa.me/919506779393?text=Hello%20Review%20Saathi%2C%20mujhe%20aapke%20review%20solution%20ke%20baare%20mein%20baat%20karni%20hai." target="_blank" rel="noreferrer">WhatsApp par baat karein</a></div></section><footer className="container footer"><span>© 2026 Review Saathi</span><span>Real customers. Real feedback. Better businesses.</span></footer>
  </main>;
}

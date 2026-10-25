import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getPlanPeriodLabel, getPlanPeriodSuffix } from "@/lib/plan-period";

export const revalidate = 60;

const industries = ["Cafés & Restaurants", "Retail Shops", "Salons & Spas", "Clinics & Hospitals", "Service Providers"];
const faqs = [
  ["✓", "Is this allowed by Google?", "Yes. Customers write and submit their own honest reviews."],
  ["□", "What is private feedback?", "Private feedback lets owners hear concerns without hiding public reviews."],
  ["⚙", "Does Review Saathi post reviews automatically?", "No. Customers always review, edit and submit the review themselves."],
  ["⌖", "Can I use one QR for multiple locations?", "Yes. Business plans support multiple locations and separate reporting."],
      ["文", "Can customers write in Hindi?", "Yes. Review flows support eight languages, including English, Hindi, Hinglish, Rajasthani, Gujarati, Punjabi, Marathi and Bengali."],
  ["↻", "Can I cancel or renew my plan?", "Yes. You can renew or change your plan from your account workspace."],
];

type PublicPlan = { id: string; name: string; price: number; duration_days: number; max_scans_per_month: number; features: Record<string, boolean> | null };

async function getPublicPlans(): Promise<PublicPlan[]> {
  try {
    const loadPlans = unstable_cache(
      async () => {
        const supabase = createSupabaseAdmin();
        const { data, error } = await supabase
          .from("plans")
          .select("id,name,price,duration_days,max_scans_per_month,features")
          .eq("is_active", true)
          .order("price", { ascending: true });
        if (error) return [];
        return (data || []) as PublicPlan[];
      },
      ["public-plans"],
      { revalidate: 60 },
    );
    return await loadPlans();
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const plans = await getPublicPlans();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://reviewsaathiv1.vercel.app";
  const faqStructuredData = faqs.map(([, question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  }));
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "Review Saathi", url: siteUrl, description: "Customer feedback and honest Google review collection for local businesses." },
      { "@type": "WebSite", "@id": `${siteUrl}/#website`, url: siteUrl, name: "Review Saathi", publisher: { "@id": `${siteUrl}/#organization` } },
      { "@type": "SoftwareApplication", name: "Review Saathi", applicationCategory: "BusinessApplication", operatingSystem: "Web", url: siteUrl, description: "AI-assisted customer feedback and honest Google review collection for local businesses.", offers: plans.map((plan) => ({ "@type": "Offer", name: plan.name, price: Number(plan.price), priceCurrency: "INR", url: `${siteUrl}/#pricing` })) },
      { "@type": "FAQPage", mainEntity: faqStructuredData },
    ],
  };
  return <main className="app-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <div className="topbar"><div className="container"><nav className="nav"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">▦</span><span className="brand-copy"><strong>Review Saathi</strong><small>Real Reviews. Real Growth.</small></span></Link><div className="nav-links"><a className="active" href="#home">Home</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a><a href="#contact-us">Contact</a></div><div className="nav-actions"><Link className="btn btn-outline btn-small" href="/login">Login</Link></div></nav></div></div>
    <section className="hero" id="home"><div className="hero-card"><div className="hero-copy"><div className="hero-kicker"><span className="kicker-dot" aria-hidden="true">✦</span>For local businesses</div><h1>AI-powered Google review assistant for local business growth</h1><p>Review Saathi uses AI to turn each customer’s real rating and experience into a natural, editable review draft. Collect genuine Google reviews, understand private feedback and build stronger local visibility—without automatic posting or hiding negative feedback.</p><div className="hero-actions"><a className="btn btn-primary" href="#contact">Book a demo <span aria-hidden="true">→</span></a><a className="btn btn-light" href="#how-it-works"><span className="play-icon">▶</span> See how it works</a></div><div className="hero-features"><div><span>▦</span><strong>Easy QR scan</strong><small>No app required</small></div><div><span>★</span><strong>Honest Google reviews</strong><small>Customers stay in control</small></div><div><span>⌁</span><strong>Grow your business</strong><small>Understand your customers</small></div><div><span>♢</span><strong>Safe &amp; secure</strong><small>Your data is protected</small></div></div></div><div className="hero-visual" aria-label="Review Saathi cafe review QR and phone preview"><div className="visual-note">Simple Scan<br /><b>Big Impact</b><span>↘</span></div><div className="qr-card" /><div className="phone" /></div></div><div className="industry-strip trusted-strip"><span>Trusted by local businesses across India</span>{industries.map(item => <i key={item}>{item}</i>)}</div></section>
    <section className="trust-section" id="how-it-works"><div className="section-container trust-layout"><div className="trust-intro"><span className="section-label">Trust &amp; transparency</span><h2>Reviews stay in your <em>customers&apos; hands.</em></h2><p>We believe in genuine reviews, written by real customers. You stay in control, and so do they.</p></div><div className="trust-card trust-card-good"><div className="trust-card-title"><span>✓</span><h3>What we do</h3></div><ul><li>Help customers write in their own words</li><li>Let customers edit before posting</li><li>Show owners scans and private feedback</li></ul></div><div className="trust-card trust-card-limit"><div className="trust-card-title"><span>⊘</span><h3>What we don&apos;t do</h3></div><ul><li>Never post on a customer&apos;s behalf</li><li>No review gating</li><li>No paid reviews or rating promises</li></ul></div></div></section>
    <section className="ai-growth-section"><div className="section-container ai-growth-grid"><div><span className="section-label">AI + real customer insight</span><h2>Help customers share honestly. Help businesses <em>grow locally.</em></h2><p>AI creates editable review drafts from the customer’s own rating and experience. Businesses get genuine feedback they can act on, helping improve customer trust and local search visibility over time.</p></div><div className="ai-growth-cards"><article><strong>01</strong><h3>AI review drafts</h3><p>Natural, multilingual drafts based only on what the customer shares.</p></article><article><strong>02</strong><h3>Customer control</h3><p>Customers edit and submit their own review on Google.</p></article><article><strong>03</strong><h3>Business growth signals</h3><p>Private feedback and review activity reveal where the experience can improve.</p></article></div></div></section>
    <section className="section-container pricing-section" id="pricing"><div className="pricing-heading"><div><span className="section-label">Simple pricing</span><h2>Choose the plan that fits your business.</h2></div><p>Start small, grow when you are ready.</p></div><div className="pricing-grid">{plans.length ? plans.map((plan, index) => { const period = getPlanPeriodLabel(plan.duration_days); const features = Object.keys(plan.features || {}).filter(key => plan.features?.[key]).slice(0, 5); return <article className={`price-card ${index === 1 ? "popular" : ""}`} key={plan.id}>{index === 1 && <span className="eyebrow">Most popular</span>}<h3>{plan.name}</h3><div className="price">₹{Number(plan.price).toLocaleString("en-IN")}<small>{getPlanPeriodSuffix(plan.duration_days)}</small></div><p className="muted">{Number(plan.max_scans_per_month || 0).toLocaleString("en-IN")} scans included per {period}.</p><ul>{features.map(feature => <li key={feature}>{feature.replaceAll("_", " ")}</li>)}</ul><Link className={index === 1 ? "btn btn-primary" : "btn btn-outline"} href="/login">Choose {plan.name}</Link></article>; }) : <div className="empty-state"><h3>Plans are being updated</h3><p>Current plans will appear here shortly.</p></div>}</div></section>
    <section className="faq-section" id="faq"><div className="section-container faq-layout"><div className="faq-intro"><span className="section-label">FAQ</span><h2>Questions, <em>answered.</em></h2><p>Everything you need to know about Review Saathi.</p><span className="faq-swoosh">〰</span></div><div className="faq-grid">{faqs.map(([icon, question, answer]) => <details className="faq-item" key={question}><summary><span className="faq-icon">{icon}</span><strong>{question}</strong><span className="faq-arrow">⌄</span></summary><p>{answer}</p></details>)}</div></div></section>
    <section className="contact-section" id="contact-us"><div className="section-container contact-grid"><div className="contact-copy"><span className="section-label">Talk to Review Saathi</span><h2>Ready to turn customer feedback into <em>business growth?</em></h2><p>Tell us about your business, locations and review goals. Our team will help you choose the right QR feedback setup.</p><div className="contact-links"><a href="mailto:oscsolutions.official@gmail.com"><strong>Email our team</strong><span>oscsolutions.official@gmail.com</span></a><a href="https://wa.me/919506779393?text=Hello%20Review%20Saathi%2C%20I%20want%20to%20know%20more%20about%20your%20AI%20review%20assistant." target="_blank" rel="noreferrer"><strong>WhatsApp us</strong><span>Get a quick response</span></a></div></div><div className="contact-card contact-simple-card"><div className="contact-icon">✦</div><h3>Let&apos;s build better customer experiences.</h3><p>Whether you run one location or several, we can help you set up QR-based feedback and honest review collection.</p><div className="contact-actions"><a className="btn btn-primary" href="mailto:oscsolutions.official@gmail.com">Email us <span aria-hidden="true">→</span></a><a className="btn btn-outline" href="https://wa.me/919506779393?text=Hello%20Review%20Saathi%2C%20I%20want%20to%20know%20more%20about%20your%20AI%20review%20assistant." target="_blank" rel="noreferrer">Chat on WhatsApp</a></div></div></div></section>
    <section className="cta-section" id="contact"><div className="cta-inner"><div className="cta-icon">↗</div><div><h2>Ready to make reviews easier?</h2><p>Start with one QR at your counter.</p></div><a className="btn btn-cta-light" href="mailto:oscsolutions.official@gmail.com">Book a demo <span>→</span></a><a className="btn btn-cta-outline" href="https://wa.me/919506779393?text=Hello%20Review%20Saathi%2C%20mujhe%20aapke%20review%20solution%20ke%20baare%20mein%20baat%20karni%20hai." target="_blank" rel="noreferrer">WhatsApp par baat karein</a></div></section><footer className="container footer"><span>© 2026 Review Saathi</span><span>Real customers. Real feedback. Better businesses.</span></footer>
  </main>;
}

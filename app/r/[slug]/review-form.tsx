"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  slug: string;
  businessName: string;
  city: string;
  logoUrl: string;
  languages: string[];
  services: string[];
  tags: string[];
  placeId: string;
  allowPrivateFeedback: boolean;
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      /* LAN HTTP fallback */
    }
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "true");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.focus();
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) {
    const manualCopy = window.prompt(
      "Clipboard access is blocked on this local HTTP address. Press Ctrl+A, then Ctrl+C to copy your review:",
      value,
    );
    if (manualCopy === null)
      throw new Error(
        "Review copy cancelled. Please copy the draft before opening Google.",
      );
  }
}

export default function ReviewForm({
  slug,
  businessName,
  city,
  logoUrl,
  languages,
  services,
  tags,
  placeId,
  allowPrivateFeedback,
}: Props) {
  const [rating, setRating] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [servicesOpenUp, setServicesOpenUp] = useState(false);
  const [language, setLanguage] = useState(languages[0] ?? "English");
  const [drafts, setDrafts] = useState<string[]>([]);
  const [selectedDraft, setSelectedDraft] = useState(0);
  const [privateFeedback, setPrivateFeedback] = useState("");
  const [scanId, setScanId] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [scanLimitReached, setScanLimitReached] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [languageOpenUp, setLanguageOpenUp] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const serviceMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = document.querySelector<HTMLLabelElement>(
      'label[for="private-feedback"]',
    )?.parentElement;
    if (field) field.hidden = !allowPrivateFeedback;
  }, [allowPrivateFeedback]);

  useEffect(() => {
    function closeLanguageMenu(event: MouseEvent) {
      const target = event.target as Node;
      if (!languageMenuRef.current?.contains(target))
        setLanguageOpen(false);
      if (!serviceMenuRef.current?.contains(target)) setServicesOpen(false);
    }
    document.addEventListener("mousedown", closeLanguageMenu);
    return () => document.removeEventListener("mousedown", closeLanguageMenu);
  }, []);

  async function generateDraft() {
    if (!rating) {
      setError("Please select a rating before creating review drafts.");
      return;
    }
    if (loading || scanLimitReached) return;
    setLoading(true);
    setError("");
    // Always start a new generation from the first returned draft. Reset this
    // before the request as well as after it so an old selection can never be
    // carried into the new draft set while the request is in flight.
    setSelectedDraft(0);
    setDrafts([]);
    try {
      const response = await fetch("/api/review/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, rating, tags: selected, servicesUsed: selectedServices, language }),
      });
      const data = await response.json();
      if (!response.ok || !data.drafts?.length)
        throw new Error(
          data.error || "The review drafts could not be created.",
        );
      setDrafts(data.drafts);
      setSelectedDraft(0);
      const scanResponse = await fetch("/api/review/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          rating,
          tags: selected,
          servicesUsed: selectedServices,
          language,
          copied: false,
        }),
      });
      const scanData = await scanResponse.json();
      if (!scanResponse.ok || !scanData.scanId) {
        setDrafts([]);
        setScanId("");
        if (scanResponse.status === 402 && scanData.error?.toLowerCase().includes("scan limit")) {
          setScanLimitReached(true);
        }
        throw new Error(
          scanData.error || "Your scan could not be started. Please try again.",
        );
      }
      setScanId(scanData.scanId);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyAndOpen() {
    const draft = drafts[selectedDraft]?.trim();
    if (!draft || posting) return;
    setPosting(true);
    setError("");
    try {
      await copyText(draft);
      const response = await fetch("/api/review/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          scanId: scanId || undefined,
          rating,
          tags: selected,
          language,
          copied: true,
          privateFeedback: allowPrivateFeedback
            ? privateFeedback.trim() || undefined
            : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not save your review activity.");
      if (!placeId.trim())
        throw new Error(
          "This business has not connected its Google review link yet. Please contact the business.",
        );
      const googleUrl = /^https?:\/\//i.test(placeId)
        ? placeId
        : `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId.trim())}`;
      const target = window.open(googleUrl, "_blank", "noopener,noreferrer");
      if (!target) window.location.assign(googleUrl);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not continue to Google.",
      );
    } finally {
      setPosting(false);
    }
  }

  return (
    <main className="review-shell">
      <div className="review-card">
        <div className="review-business">
          {logoUrl && !logoFailed ? (
            <img
              className="review-logo-image"
              src={logoUrl}
              alt={`${businessName} logo`}
              referrerPolicy="no-referrer"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="review-logo" aria-label={`${businessName} logo`}>
              🌿
            </div>
          )}
          <h1>{businessName}</h1>
          <p>{city ? `${city} · ` : ""}Tell us about your visit</p>
        </div>
        <label className="rating-label">How was your visit?</label>
        <div className={`rating ${error && !rating ? "rating-error" : ""}`} aria-label="Choose a rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              type="button"
              aria-label={`${value} stars`}
              className={value <= rating ? "active" : ""}
              key={value}
              onClick={() => {
                setRating(value);
                setError("");
                setSelectedDraft(0);
                setDrafts([]);
                setScanId("");
              }}
            >
              {value <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
        <div className="rating-label">
          What did you like?{" "}
          <span className="muted">(Select all that apply)</span>
        </div>
        <div className="review-tags">
          {tags.map((tag) => (
            <button
              type="button"
              key={tag}
              className={`review-tag ${selected.includes(tag) ? "active" : ""}`}
              onClick={() =>
                setSelected((current) =>
                  current.includes(tag)
                    ? current.filter((item) => item !== tag)
                    : [...current, tag],
                )
              }
            >
              {tag}
            </button>
          ))}
        </div>
        {services.length > 0 && (
          <div className="field">
            <label htmlFor="review-services">Which service did you use? <span className="muted">(Select up to 3)</span></label>
            <div className="language-select service-checklist" ref={serviceMenuRef}>
              <button
                className="language-select-trigger"
                id="review-services"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={servicesOpen}
                onClick={(event) => {
                  const nextOpen = !servicesOpen;
                  if (nextOpen) {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const spaceAbove = rect.top;
                    setServicesOpenUp(spaceBelow < 360 && spaceAbove > spaceBelow);
                  }
                  setServicesOpen(nextOpen);
                }}
              >
                <span className="service-summary">
                  {selectedServices.length === 1
                    ? selectedServices[0]
                    : selectedServices.length
                      ? `${selectedServices.length} services selected`
                      : "Select services"}
                </span>
                <span className={`language-chevron ${servicesOpen ? "open" : ""}`} aria-hidden="true">⌄</span>
              </button>
              {servicesOpen && (
                <div className={`language-options service-options ${servicesOpenUp ? "open-up" : ""}`} role="listbox" aria-labelledby="review-services" aria-multiselectable="true">
                  {services.map((service) => {
                    const checked = selectedServices.includes(service);
                    return (
                      <button
                        className={`language-option ${checked ? "selected" : ""}`}
                        key={service}
                        type="button"
                        role="option"
                        aria-selected={checked}
                        disabled={!checked && selectedServices.length >= 3}
                        onClick={() => setSelectedServices((current) => checked ? current.filter((item) => item !== service) : [...current, service])}
                      >
                        <span>{service}</span>
                        <span className={`service-check ${checked ? "checked" : ""}`} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="review-language">Choose review language</label>
          <div className="language-select" ref={languageMenuRef}>
            <button
              className="language-select-trigger"
              id="review-language"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={languageOpen}
              onClick={(event) => {
                const nextOpen = !languageOpen;
                if (nextOpen) {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const spaceBelow = window.innerHeight - rect.bottom;
                  const spaceAbove = rect.top;
                  setLanguageOpenUp(spaceBelow < 360 && spaceAbove > spaceBelow);
                }
                setLanguageOpen(nextOpen);
              }}
            >
              <span>{language}</span>
              <span className={`language-chevron ${languageOpen ? "open" : ""}`} aria-hidden="true">⌄</span>
            </button>
            {languageOpen && (
              <div className={`language-options ${languageOpenUp ? "open-up" : ""}`} role="listbox" aria-labelledby="review-language">
                {languages.map((item) => (
                  <button
                    className={`language-option ${language === item ? "selected" : ""}`}
                    key={item}
                    type="button"
                    role="option"
                    aria-selected={language === item}
                    onClick={() => {
                      setLanguage(item);
                      setLanguageOpen(false);
                      setSelectedDraft(0);
                      setDrafts([]);
                      setScanId("");
                    }}
                  >
                    <span>{item}</span>
                    {language === item && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {error && (
          <div className="auth-alert" role="alert">
            {error}
          </div>
        )}
        <button
          className="btn btn-outline"
          type="button"
          disabled={loading || posting || scanLimitReached}
          onClick={generateDraft}
        >
          {loading ? "Creating 3 drafts…" : "Create 3 review drafts"}
        </button>
        {drafts.length > 0 && (
          <>
            <div className="rating-label draft-heading">
              Choose a draft <span className="muted">(you can edit it)</span>
            </div>
            <div className="draft-options">
              {drafts.map((item, index) => (
                <button
                  type="button"
                  className={`draft-option ${selectedDraft === index ? "selected" : ""}`}
                  key={`${item}-${index}`}
                  onClick={() => setSelectedDraft(index)}
                >
                  <span>Draft {index + 1}</span>
                  <p>{item}</p>
                </button>
              ))}
            </div>
            <textarea
              className="draft-box"
              value={drafts[selectedDraft] || ""}
              onChange={(event) =>
                setDrafts((current) =>
                  current.map((item, index) =>
                    index === selectedDraft ? event.target.value : item,
                  ),
                )
              }
              rows={5}
            />
            <div className="field">
              <label htmlFor="private-feedback">
                Private feedback <span className="muted">(Optional)</span>
              </label>
              <textarea
                id="private-feedback"
                value={privateFeedback}
                onChange={(event) => setPrivateFeedback(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Tell the business what they can improve."
              />
            </div>
            <button
              className="btn btn-primary"
              type="button"
              disabled={posting}
              onClick={copyAndOpen}
            >
              {posting ? "Opening Google…" : "Copy and open Google review ↗"}
            </button>
          </>
        )}
        <div className="review-footer">
          Your review is never submitted automatically. You can edit it before
          posting on Google.
          <br />
          Private feedback is shared only with the business.
        </div>
      </div>
    </main>
  );
}

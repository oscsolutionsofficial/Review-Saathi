"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  slug: string;
  businessName: string;
  city: string;
  logoUrl: string;
  languages: string[];
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
  tags,
  placeId,
  allowPrivateFeedback,
}: Props) {
  const [rating, setRating] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
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
  const languageMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = document.querySelector<HTMLLabelElement>(
      'label[for="private-feedback"]',
    )?.parentElement;
    if (field) field.hidden = !allowPrivateFeedback;
  }, [allowPrivateFeedback]);

  useEffect(() => {
    function closeLanguageMenu(event: MouseEvent) {
      if (!languageMenuRef.current?.contains(event.target as Node))
        setLanguageOpen(false);
    }
    document.addEventListener("mousedown", closeLanguageMenu);
    return () => document.removeEventListener("mousedown", closeLanguageMenu);
  }, []);

  async function generateDraft() {
    if (!rating || loading || scanLimitReached) return;
    setLoading(true);
    setError("");
    setDrafts([]);
    try {
      const response = await fetch("/api/review/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, rating, tags: selected, language }),
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
        <div className="rating" aria-label="Choose a rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              type="button"
              aria-label={`${value} stars`}
              className={value <= rating ? "active" : ""}
              key={value}
              onClick={() => {
                setRating(value);
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
        <div className="field">
          <label htmlFor="review-language">Choose review language</label>
          <div className="language-select" ref={languageMenuRef}>
            <button
              className="language-select-trigger"
              id="review-language"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={languageOpen}
              onClick={() => setLanguageOpen((open) => !open)}
            >
              <span>{language}</span>
              <span className={`language-chevron ${languageOpen ? "open" : ""}`} aria-hidden="true">⌄</span>
            </button>
            {languageOpen && (
              <div className="language-options" role="listbox" aria-labelledby="review-language">
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
          disabled={!rating || loading || posting || scanLimitReached}
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

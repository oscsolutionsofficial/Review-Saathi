export const SUPPORTED_REVIEW_LANGUAGES = [
  "English",
  "Hindi",
  "Hinglish",
  "Rajasthani",
  "Gujarati",
  "Punjabi",
  "Marathi",
  "Bengali",
] as const;

export function getAllowedReviewLanguages(
  configuredLanguages: unknown,
  supportsMultipleLanguages: boolean,
) {
  if (!supportsMultipleLanguages) return ["English"];
  const configured = Array.isArray(configuredLanguages)
    ? configuredLanguages
        .map((language) => String(language).trim())
        .filter((language): language is (typeof SUPPORTED_REVIEW_LANGUAGES)[number] =>
          SUPPORTED_REVIEW_LANGUAGES.includes(language as (typeof SUPPORTED_REVIEW_LANGUAGES)[number]),
        )
    : [];
  return Array.from(new Set(configured.length ? configured : ["English"]));
}

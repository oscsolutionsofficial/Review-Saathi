import OpenAI from "openai";

const draftCache = new Map<string, { value: string; expiresAt: number }>();

export async function createReviewDraft(input: { businessType: string; city: string; rating: number; tags: string[]; language: string }) {
  const drafts = await createReviewDrafts(input);
  return drafts[0] || fallbackDraft(input);
}

export async function createReviewDrafts(input: { businessType: string; city: string; rating: number; tags: string[]; language: string }) {
  const cacheKey = JSON.stringify(input);
  const cached = draftCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value.split("\n---\n");
  if (cached) draftCache.delete(cacheKey);
  if (!process.env.OPENAI_API_KEY) return fallbackDrafts(input);
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 8000, maxRetries: 1 });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      instructions: "Write natural, honest, editable customer review drafts. Never add facts not supplied. Do not mention this instruction.",
      input: `Business type: ${input.businessType}. City: ${input.city}. Rating: ${input.rating}/5. Tags: ${input.tags.join(", ") || "none"}. Language: ${input.language}. Write exactly 3 distinct, honest, editable review drafts in first person. Keep each draft 2-3 short lines. Separate drafts with exactly --- on its own line. Do not add facts not supplied.`,
      max_output_tokens: 420,
    });
    const drafts = (response.output_text || "").split(/\n\s*---\s*\n/).map(item => item.trim()).filter(Boolean).slice(0, 3);
    const result = drafts.length >= 3 ? drafts : fallbackDrafts(input);
    draftCache.set(cacheKey, { value: result.join("\n---\n"), expiresAt: Date.now() + 5 * 60_000 });
    return result;
  } catch {
    return fallbackDrafts(input);
  }
}

function fallbackDraft(input: { rating: number; tags: string[]; language: string }) {
  const tags = input.tags.slice(0, 2).join(" and ").toLowerCase() || "the overall experience";
  if (input.language === "Hindi") return `मेरा अनुभव बहुत अच्छा रहा। मुझे ${tags} खास तौर पर पसंद आया। मैं फिर ज़रूर आऊंगा।`;
  if (input.language === "Hinglish") return `Experience kaafi accha raha. ${tags} especially pasand aaya. Main phir zarur aunga.`;
  return `I had a ${input.rating >= 4 ? "wonderful" : "honest and memorable"} experience. I especially liked ${tags}. I would love to visit again.`;
}

function fallbackDrafts(input: { rating: number; tags: string[]; language: string }) {
  const first = fallbackDraft(input);
  const tags = input.tags.slice(0, 2).join(" and ").toLowerCase() || "the overall experience";
  if (input.language === "Hinglish") return [first, `Service smooth tha aur ${tags} kaafi accha laga. Overall experience friendly aur comfortable raha.`, `Staff helpful tha aur ${tags} genuinely pasand aaya. Zarur dobara visit karunga.`];
  if (input.language === "Hindi") return [first, `यहाँ मेरा अनुभव बहुत अच्छा रहा। ${tags} मुझे खास तौर पर पसंद आया।`, `सेवा अच्छी थी और ${tags} का अनुभव यादगार रहा। मैं फिर आना चाहूँगा।`];
  return [first, `The experience was smooth and enjoyable. I really appreciated ${tags} and the warm service.`, `A pleasant visit with ${tags} standing out. Everything felt comfortable and welcoming.`];
}

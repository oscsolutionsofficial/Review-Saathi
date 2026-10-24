import OpenAI from "openai";

type DraftInput = { businessType: string; city: string; rating: number; tags: string[]; language: string };

export async function createReviewDraft(input: DraftInput) {
  const drafts = await createReviewDrafts(input);
  return drafts[0] || fallbackDraft(input);
}

export async function createReviewDrafts(input: DraftInput) {
  if (!process.env.OPENAI_API_KEY) return fallbackDrafts(input);
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 8000, maxRetries: 1 });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      instructions: "Write three distinct, natural and editable customer review drafts from the supplied customer experience only. The drafts must be honest, personal and useful, never promotional or exaggerated. Never invent facts, staff names, products, prices, offers, facilities, events or outcomes. Do not mention AI, this instruction, ranking, SEO or Google detection.",
      input: `Business type: ${input.businessType}. City: ${input.city || "not provided"}. Customer rating: ${input.rating}/5. Customer-selected details: ${input.tags.join(", ") || "none"}. Required language: ${input.language}.

Write exactly 3 different first-person drafts. Every draft must be entirely in the required language and use the supplied details naturally. Reflect the rating honestly: do not call a low-rated visit wonderful, and do not add praise that the customer did not provide. Keep each draft 2-3 short, conversational sentences. Vary the opening, sentence rhythm and what detail is emphasized; avoid repeated templates, generic filler, keyword stuffing, emojis and identical conclusions. Make each draft sound like a different real customer while staying within the same facts. Separate drafts with exactly --- on its own line.`,
      max_output_tokens: 420,
    });
    const drafts = (response.output_text || "").split(/\n\s*---\s*\n/).map(item => item.trim()).filter(Boolean).slice(0, 3);
    return drafts.length >= 3 ? drafts : fallbackDrafts(input);
  } catch {
    return fallbackDrafts(input);
  }
}

function fallbackDraft(input: DraftInput) {
  const tags = input.tags.slice(0, 2).join(" and ").toLowerCase() || "the overall experience";
  if (input.language === "Hindi") return `मेरा अनुभव बहुत अच्छा रहा। मुझे ${tags} खास तौर पर पसंद आया। मैं फिर ज़रूर आऊंगा।`;
  if (input.language === "Hinglish") return `Experience kaafi accha raha. ${tags} especially pasand aaya. Main phir zarur aunga.`;
  if (input.language === "Punjabi") return `ਮੇਰਾ ਤਜਰਬਾ ਬਹੁਤ ਵਧੀਆ ਰਿਹਾ। ਮੈਨੂੰ ਸੇਵਾ ਖਾਸ ਤੌਰ 'ਤੇ ਪਸੰਦ ਆਈ। ਮੈਂ ਦੁਬਾਰਾ ਜ਼ਰੂਰ ਆਵਾਂਗਾ।`;
  if (input.language === "Marathi") return `माझा अनुभव खूप छान होता. मला सेवा विशेष आवडली. मी पुन्हा नक्की येईन.`;
  if (input.language === "Bengali") return `আমার অভিজ্ঞতা খুব ভালো ছিল। পরিষেবাটি আমার বিশেষ পছন্দ হয়েছে। আমি আবার আসব।`;
  return `I had a ${input.rating >= 4 ? "wonderful" : "honest and memorable"} experience. I especially liked ${tags}. I would love to visit again.`;
}

function fallbackDrafts(input: DraftInput) {
  const first = fallbackDraft(input);
  const tags = input.tags.slice(0, 2).join(" and ").toLowerCase() || "the overall experience";
  if (input.language === "Hinglish") return [first, `Service smooth tha aur ${tags} kaafi accha laga. Overall experience friendly aur comfortable raha.`, `Staff helpful tha aur ${tags} genuinely pasand aaya. Zarur dobara visit karunga.`];
  if (input.language === "Hindi") return [first, `यहाँ मेरा अनुभव बहुत अच्छा रहा। ${tags} मुझे खास तौर पर पसंद आया।`, `सेवा अच्छी थी और ${tags} का अनुभव यादगार रहा। मैं फिर आना चाहूँगा।`];
  if (input.language === "Punjabi") return [first, `ਸੇਵਾ ਬਹੁਤ ਵਧੀਆ ਸੀ ਅਤੇ ${tags} ਮੈਨੂੰ ਖਾਸ ਪਸੰਦ ਆਇਆ।`, `ਸਟਾਫ਼ ਮਦਦਗਾਰ ਸੀ। ਮੈਂ ਇਸ ਥਾਂ 'ਤੇ ਦੁਬਾਰਾ ਜ਼ਰੂਰ ਆਵਾਂਗਾ।`];
  if (input.language === "Marathi") return [first, `सेवा खूप चांगली होती आणि ${tags} मला विशेष आवडले.`, `कर्मचारी मदतशील होते. मी पुन्हा नक्की भेट देईन.`];
  if (input.language === "Bengali") return [first, `পরিষেবা খুব ভালো ছিল এবং ${tags} আমার বিশেষ পছন্দ হয়েছে।`, `কর্মীরা খুব সহায়ক ছিলেন। আমি আবার আসব।`];
  return [first, `The experience was smooth and enjoyable. I really appreciated ${tags} and the warm service.`, `A pleasant visit with ${tags} standing out. Everything felt comfortable and welcoming.`];
}

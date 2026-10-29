import OpenAI from "openai";

type DraftInput = { businessName: string; businessType: string; city: string; rating: number; tags: string[]; servicesUsed: string[]; language: string };

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
      instructions: "Write three distinct, natural and editable customer review drafts from the supplied customer experience only. Use simple, everyday Indian English as commonly written by customers in India. Keep the language easy, clear and conversational, with short sentences and familiar words. Avoid high-level vocabulary, formal textbook English, foreign-sounding expressions, dramatic phrases and polished advertising language. The drafts must sound human, honest, personal and useful, never promotional or exaggerated. Use only the service and experience details explicitly selected by the customer. Do not add related assumptions or details such as completion time, updates, guidance, communication, component quality, warranty, after-sales support, environmental benefits or bill amounts unless that exact experience detail was selected. Never invent facts, staff names, products, prices, offers, facilities, events or outcomes. Mention the business name or services only naturally when relevant; never turn the review into an advertisement or keyword list. Do not mention AI, this instruction, ranking, SEO or Google detection.",
      input: `Business name: ${input.businessName}. Business type: ${input.businessType}. City: ${input.city || "not provided"}. Services used by the customer: ${input.servicesUsed.join(", ") || "not specified"}. Customer rating: ${input.rating}/5. Customer-selected experience details: ${input.tags.join(", ") || "none"}. Required language: ${input.language}.

Write exactly 3 different first-person drafts. Every draft must be entirely in the required language and use the supplied details naturally. Include the service used when provided, and naturally mention at least two of the customer's selected experience details; if three or fewer details were selected, use all of them. Turn the details into a specific, useful customer experience rather than listing keywords. Rating-tone rules are mandatory: for a 4 or 5 star rating, every draft must be clearly positive, appreciative, satisfied and recommendation-ready. Use positive wording such as excellent, smooth, professional, reliable, helpful, impressive, happy, satisfied, highly recommend or equivalent natural wording in the required language. Do not include complaints, criticism, disappointment, poor service, problems, warnings, reservations, hesitation, unmet expectations, shortcomings or any negative wording. Do not use contrastive phrases such as "but", "however", "although", "could be better", "not what I expected" or idioms containing "can't"/"cannot" in a 4 or 5 star review. Never add environmental benefits, bill amounts, percentages, dramatic/significant results, guarantees or other outcomes unless the customer explicitly supplied them. Say only that the selected experience happened; do not exaggerate it. For a 1 or 2 star rating, reflect the customer's dissatisfaction honestly. For 3 stars, use a balanced and neutral tone. Never invent facts or praise that the customer did not provide. Keep each draft 2-3 short, conversational sentences with a natural opening, a concrete experience detail and a warm closing. Vary the opening, sentence rhythm and what detail is emphasized; avoid repeated templates, generic filler, keyword stuffing, emojis and identical conclusions. Make each draft sound like a different real customer while staying within the same facts. Separate drafts with exactly --- on its own line.`,
      max_output_tokens: 420,
    });
    const drafts = (response.output_text || "").split(/\n\s*---\s*\n/).map(item => item.trim()).filter(Boolean).slice(0, 3);
    return drafts.length >= 3 && draftsMatchRatingTone(drafts, input.rating)
      ? drafts
      : fallbackDrafts(input);
  } catch {
    return fallbackDrafts(input);
  }
}

function draftsMatchRatingTone(drafts: string[], rating: number) {
  if (rating < 4) return true;
  const negativeTerms = [
    "bad", "poor", "worst", "disappoint", "disappointed", "disappointing",
    "complaint", "problem", "issue", "rude", "slow", "dirty", "avoid",
    "not satisfied", "not fully satisfied", "not happy", "could be better",
    "could have been better", "room for improvement", "not what i expected",
    "did not meet", "didn't meet", "unfortunately", "however", "although",
    "but the", "yet the", "displeased", "unsatisfactory", "dissatisfied",
    "drawback", "downside", "shortcoming", "lack of", "not recommend",
    "would not recommend", "never again",
    "can't say enough", "cannot say enough", "can't recommend enough",
    "cannot recommend enough", "significant savings", "dramatically",
    "green future", "greener future", "environmentally friendly",
    "couldn't be happier", "couldnt be happier", "couldn't recommend",
    "if you're considering", "if you are considering", "make the switch",
    "to anyone looking", "to anyone considering", "without hesitation",
    "didn't take", "did not take", "kept me informed", "informed throughout",
    "not good", "ไม่ดี", "खराब", "बुरा", "निराश", "समस्या", "बकवास",
    "bekaar", "kharab", "ganda", "nirash", "problem", "complaint",
  ];
  const text = drafts.join(" ").toLowerCase();
  return !negativeTerms.some((term) => text.includes(term));
}

function fallbackDraft(input: DraftInput) {
  const tags = input.tags.slice(0, 2).join(" and ").toLowerCase() || "the overall experience";
  const services = input.servicesUsed.slice(0, 2).join(" and ");
  const serviceText = services ? ` for ${services}, and I was happy with the experience.` : "";
  if (input.language === "Hindi") return `मेरा अनुभव बहुत अच्छा रहा। मुझे ${tags} खास तौर पर पसंद आया। मैं फिर ज़रूर आऊंगा।`;
  if (input.language === "Hinglish") return `Experience kaafi accha raha. ${tags} especially pasand aaya. Main phir zarur aunga.`;
  if (input.language === "Punjabi") return `ਮੇਰਾ ਤਜਰਬਾ ਬਹੁਤ ਵਧੀਆ ਰਿਹਾ। ਮੈਨੂੰ ਸੇਵਾ ਖਾਸ ਤੌਰ 'ਤੇ ਪਸੰਦ ਆਈ। ਮੈਂ ਦੁਬਾਰਾ ਜ਼ਰੂਰ ਆਵਾਂਗਾ।`;
  if (input.language === "Marathi") return `माझा अनुभव खूप छान होता. मला सेवा विशेष आवडली. मी पुन्हा नक्की येईन.`;
  if (input.language === "Bengali") return `আমার অভিজ্ঞতা খুব ভালো ছিল। পরিষেবাটি আমার বিশেষ পছন্দ হয়েছে। আমি আবার আসব।`;
  const business = input.businessName || "the team";
  if (input.rating >= 4) {
    return `I had an excellent experience with ${business}${serviceText} The team was professional, and I especially appreciated ${tags}. I would happily recommend them.`;
  }
  return `I had an honest and memorable experience with ${business}${serviceText} I especially noticed ${tags}.`;
}

function fallbackDrafts(input: DraftInput) {
  const first = fallbackDraft(input);
  const business = input.businessName || "the team";
  const service = input.servicesUsed[0] || "service";
  const details = input.tags.slice(0, 3).map((tag) => tag.toLowerCase());
  const tags = details.length === 3
    ? `${details[0]}, ${details[1]}, and ${details[2]}`
    : details.join(" and ") || "the overall experience";
  if (input.language === "Hinglish") return [first, `Service smooth tha aur ${tags} kaafi accha laga. Overall experience friendly aur comfortable raha.`, `Staff helpful tha aur ${tags} genuinely pasand aaya. Zarur dobara visit karunga.`];
  if (input.language === "Hindi") return [first, `यहाँ मेरा अनुभव बहुत अच्छा रहा। ${tags} मुझे खास तौर पर पसंद आया।`, `सेवा अच्छी थी और ${tags} का अनुभव यादगार रहा। मैं फिर आना चाहूँगा।`];
  if (input.language === "Punjabi") return [first, `ਸੇਵਾ ਬਹੁਤ ਵਧੀਆ ਸੀ ਅਤੇ ${tags} ਮੈਨੂੰ ਖਾਸ ਪਸੰਦ ਆਇਆ।`, `ਸਟਾਫ਼ ਮਦਦਗਾਰ ਸੀ। ਮੈਂ ਇਸ ਥਾਂ 'ਤੇ ਦੁਬਾਰਾ ਜ਼ਰੂਰ ਆਵਾਂਗਾ।`];
  if (input.language === "Marathi") return [first, `सेवा खूप चांगली होती आणि ${tags} मला विशेष आवडले.`, `कर्मचारी मदतशील होते. मी पुन्हा नक्की भेट देईन.`];
  if (input.language === "Bengali") return [first, `পরিষেবা খুব ভালো ছিল এবং ${tags} আমার বিশেষ পছন্দ হয়েছে।`, `কর্মীরা খুব সহায়ক ছিলেন। আমি আবার আসব।`];
  if (input.rating >= 4) {
    return [
      `I got ${service} done by ${business}. The team was professional, and I am happy with ${tags}. I would happily recommend them.`,
      `I had a very good experience with ${business} for ${service}. The installation was professional, and I am happy with ${tags}. I would recommend them.`,
      `${business} did a good job with my ${service}. I liked ${tags}, and I would choose their service again.`,
    ];
  }
  return [
    first,
    `My experience with ${business} for ${service} was straightforward. I appreciated ${tags}.`,
    `I appreciated the ${service} experience with ${business}, especially ${tags}.`,
  ];
}

import { z } from "zod";

export const reviewDraftSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), rating: z.number().int().min(1).max(5), tags: z.array(z.string().trim().min(1).max(60)).max(10), language: z.enum(["English", "Hindi", "Hinglish", "Rajasthani", "Gujarati"]) });
export const reviewScanSchema = reviewDraftSchema.extend({ scanId: z.string().uuid().optional(), copied: z.boolean().default(false), privateFeedback: z.string().trim().max(1000).optional() });

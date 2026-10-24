import { z } from "zod";
import { SUPPORTED_REVIEW_LANGUAGES } from "@/lib/review-languages";

export const reviewDraftSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), rating: z.number().int().min(1).max(5), tags: z.array(z.string().trim().min(1).max(60)).max(10), language: z.enum(SUPPORTED_REVIEW_LANGUAGES) });
export const reviewScanSchema = reviewDraftSchema.extend({ scanId: z.string().uuid().optional(), copied: z.boolean().default(false), privateFeedback: z.string().trim().max(1000).optional() });

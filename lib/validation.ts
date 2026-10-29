import { z } from "zod";
import { SUPPORTED_REVIEW_LANGUAGES } from "@/lib/review-languages";

export const REVIEW_LENGTHS = ["short", "standard", "detailed"] as const;
export type ReviewLength = (typeof REVIEW_LENGTHS)[number];

export const reviewDraftSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), rating: z.number().int().min(1).max(5), tags: z.array(z.string().trim().min(1).max(60)).max(10), servicesUsed: z.array(z.string().trim().min(1).max(120)).max(3).default([]), language: z.enum(SUPPORTED_REVIEW_LANGUAGES), length: z.enum(REVIEW_LENGTHS).default("standard") });
export const reviewScanSchema = reviewDraftSchema.extend({ scanId: z.string().uuid().optional(), copied: z.boolean().default(false), privateFeedback: z.string().trim().max(1000).optional() });

import { z } from 'zod';

export const submitReviewSchema = z.object({
  reviewerId: z.string().min(1, 'داور را انتخاب کنید'),
  comment: z.string().max(500).optional(),
});

export const decideReviewSchema = z.object({
  comment: z.string().max(500).optional(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type DecideReviewInput = z.infer<typeof decideReviewSchema>;

import { z } from 'zod';

const slugSchema = z
  .string()
  .min(2, 'شناسه حداقل ۲ نویسه است')
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'شناسه باید لاتین، کوچک و خط‌تیره‌دار باشد');

export const kbSchema = z.object({
  title: z.string().min(2, 'عنوان حداقل ۲ نویسه است').max(120),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
  visibility: z.enum(['private', 'internal', 'public']),
});

export type KbInput = z.infer<typeof kbSchema>;

export const categorySchema = z.object({
  title: z.string().min(2, 'عنوان حداقل ۲ نویسه است').max(120),
  slug: slugSchema,
  description: z.string().max(2000).optional(),
  parentId: z.string().optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;

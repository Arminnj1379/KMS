import { z } from 'zod';

const slugSchema = z
  .string()
  .min(2, 'شناسه حداقل ۲ نویسه است')
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'شناسه باید لاتین، کوچک و خط‌تیره‌دار باشد');

export const articleMetaSchema = z.object({
  title: z.string().min(2, 'عنوان حداقل ۲ نویسه است').max(200),
  slug: slugSchema,
  summary: z.string().max(500).optional(),
  categoryId: z.string().optional(),
  tags: z.string().max(500).optional(),
});

/** Comma-separated tags input → trimmed name list (max 20). */
export function parseTagNames(input?: string): string[] {
  if (!input) return [];
  const names = input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(names)].slice(0, 20);
}

export type ArticleMetaInput = z.infer<typeof articleMetaSchema>;

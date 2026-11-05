import { NotFoundException } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { Model, Types } from 'mongoose';
import type { Article } from '../../common/mongo/schemas/article.schema';
import type { ArticleVersion } from '../../common/mongo/schemas/article-version.schema';
import type { Category } from '../../common/mongo/schemas/category.schema';
import type { Tag } from '../../common/mongo/schemas/tag.schema';
import { ArticlesService, searchVariants, stemPersianToken } from '../articles/articles.service';
import type { KnowledgeBasesService } from '../knowledge-bases/knowledge-bases.service';
import { SearchService } from './search.service';

const ORG = '000000000000000000000010';
const ALI = '0000000000000000000000a1';
const KB = '0000000000000000000000c1';
const KB2 = '0000000000000000000000c2';

const oid = (hex: string): Types.ObjectId => new Types.ObjectId(hex);

// SAFETY: test-only stub of Mongoose's chainable Query API.
interface ChainStub<T> {
  lean: jest.Mock<Promise<T>>;
  sort: jest.Mock<ChainStub<T>>;
  skip: jest.Mock<ChainStub<T>>;
  limit: jest.Mock<ChainStub<T>>;
  session: jest.Mock<ChainStub<T>>;
}

function q<T>(value: T): ChainStub<T> {
  const stub = {} as ChainStub<T>;
  stub.lean = jest.fn().mockResolvedValue(value);
  stub.sort = jest.fn().mockReturnValue(stub);
  stub.skip = jest.fn().mockReturnValue(stub);
  stub.limit = jest.fn().mockReturnValue(stub);
  stub.session = jest.fn().mockReturnValue(stub);
  return stub;
}

function makeModelMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  };
}

type ModelMock = ReturnType<typeof makeModelMock>;

const articleDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: oid('0000000000000000000000d1'),
  organizationId: oid(ORG),
  knowledgeBaseId: oid(KB),
  categoryId: null,
  authorId: oid(ALI),
  title: 'راهنمای شروع',
  slug: 'getting-started',
  summary: 'خلاصه',
  contentJson: { type: 'doc' },
  contentText: 'متن کامل راهنما',
  contentHtml: null,
  status: 'published',
  version: 1,
  viewCount: 0,
  tagIds: [],
  attachments: [],
  publishedAt: new Date(),
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

interface Deps {
  search: SearchService;
  articles: ModelMock;
  tags: ModelMock;
  kbs: {
    accessibleKbIds: jest.Mock;
    requireAccess: jest.Mock;
    titlesByIds: jest.Mock;
  };
}

function makeDeps(): Deps {
  const articles = makeModelMock();
  const versions = makeModelMock();
  const tags = makeModelMock();
  const cats = makeModelMock();
  const kbs = {
    accessibleKbIds: jest.fn().mockResolvedValue([oid(KB), oid(KB2)]),
    requireAccess: jest.fn().mockImplementation(async (_o: string, _u: string, _r: string, kb: string) => ({
      kbId: /^[0-9a-f]{24}$/i.test(kb) ? new Types.ObjectId(kb) : oid(KB),
      role: 'contributor',
      isOrgAdmin: false,
    })),
    titlesByIds: jest
      .fn()
      .mockResolvedValue(new Map([[KB, { title: 'KB یک', slug: 'kb-1' }], [KB2, { title: 'KB دو', slug: 'kb-2' }]])),
  };
  const svc = new ArticlesService(
    { startSession: jest.fn() } as unknown as Connection,
    articles as unknown as Model<Article>,
    versions as unknown as Model<ArticleVersion>,
    tags as unknown as Model<Tag>,
    cats as unknown as Model<Category>,
    makeModelMock() as unknown as Model<import('../../common/mongo/schemas/workflow-history.schema').WorkflowHistory>,
    kbs as unknown as KnowledgeBasesService,
    { write: jest.fn().mockResolvedValue(undefined) } as unknown as import('../audit-logs/audit-logs.service').AuditLogsService,
  );
  return { search: new SearchService(svc), articles, tags, kbs };
}

describe('SearchService (Mongo provider)', () => {
  it('blank query returns an empty page without touching the DB', async () => {
    const d = makeDeps();
    const res = await d.search.search(ORG, ALI, 'member', { q: '  ' } as never);
    expect(res).toEqual({ items: [], total: 0, page: 1, pageSize: 20, mode: 'text' });
    expect(d.articles.find).not.toHaveBeenCalled();
  });

  it('no accessible KBs returns empty without querying articles', async () => {
    const d = makeDeps();
    d.kbs.accessibleKbIds.mockResolvedValue([]);
    const res = await d.search.search(ORG, ALI, 'member', { q: 'راهنما' } as never);
    expect(res.total).toBe(0);
    expect(d.articles.find).not.toHaveBeenCalled();
  });

  it('$text hits return in relevance mode with KB labels + snippet', async () => {
    const d = makeDeps();
    d.articles.countDocuments.mockResolvedValue(2);
    d.articles.find.mockReturnValue(q([articleDoc(), articleDoc({ _id: oid('0000000000000000000000d2') })]));
    d.tags.find.mockReturnValue(q([]));
    const res = await d.search.search(ORG, ALI, 'member', { q: 'راهنما' } as never);
    expect(res.mode).toBe('text');
    expect(res.total).toBe(2);
    expect(res.items).toHaveLength(2);
    const first = res.items[0]!;
    expect(first.kbTitle).toBe('KB یک');
    expect(first.kbSlug).toBe('kb-1');
    expect(first.snippet).toBe('خلاصه');
    // Org isolation: filter is org-scoped + KB-scoped.
    const filter = d.articles.find.mock.calls[0][0] as Record<string, unknown>;
    expect((filter['organizationId'] as Types.ObjectId).toHexString()).toBe(ORG);
    expect(filter['knowledgeBaseId']).toEqual({ $in: [oid(KB), oid(KB2)] });
    expect(filter['$text']).toEqual({ $search: 'راهنما' });
    expect(d.kbs.accessibleKbIds).toHaveBeenCalledWith(ORG, ALI, 'member');
  });

  it('empty $text results fall back to regex (partial Persian tokens)', async () => {
    const d = makeDeps();
    d.articles.countDocuments.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    d.articles.find.mockReturnValueOnce(q([])).mockReturnValueOnce(q([articleDoc()]));
    d.tags.find.mockReturnValue(q([]));
    const res = await d.search.search(ORG, ALI, 'member', { q: 'راهنم' } as never);
    expect(res.mode).toBe('regex');
    expect(res.total).toBe(1);
    const filter = d.articles.find.mock.calls[1][0] as Record<string, unknown>;
    expect(Array.isArray(filter['$or'])).toBe(true);
    expect(filter['$text']).toBeUndefined();
  });

  it('$text operator errors fall through to regex instead of 500', async () => {
    const d = makeDeps();
    d.articles.countDocuments.mockRejectedValueOnce(new Error('BadValue')).mockResolvedValue(1);
    d.articles.find.mockReturnValue(q([articleDoc()]));
    d.tags.find.mockReturnValue(q([]));
    const res = await d.search.search(ORG, ALI, 'member', { q: '-foo' } as never);
    expect(res.mode).toBe('regex');
    expect(res.items).toHaveLength(1);
  });

  it('kbId filter narrows scope; foreign KB maps to 404', async () => {
    const d = makeDeps();
    d.articles.countDocuments.mockResolvedValue(1);
    d.articles.find.mockReturnValue(q([articleDoc()]));
    d.tags.find.mockReturnValue(q([]));
    const res = await d.search.search(ORG, ALI, 'member', { q: 'راهنما', kbId: KB } as never);
    expect(res.total).toBe(1);
    const filter = d.articles.find.mock.calls[0][0] as Record<string, unknown>;
    expect(filter['knowledgeBaseId']).toEqual({ $in: [oid(KB)] });

    d.kbs.requireAccess.mockResolvedValueOnce({ kbId: oid('0000000000000000000000ff'), role: null });
    await expect(
      d.search.search(ORG, ALI, 'member', { q: 'راهنما', kbId: '0000000000000000000000ff' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unknown tag slug returns empty; status filter passes through', async () => {
    const d = makeDeps();
    d.tags.findOne.mockReturnValue(q(null));
    const res = await d.search.search(ORG, ALI, 'member', { q: 'راهنما', tag: 'nope' } as never);
    expect(res.total).toBe(0);
    expect(d.articles.find).not.toHaveBeenCalled();

    d.tags.findOne.mockReturnValue(q({ _id: oid('0000000000000000000000aa') }));
    d.articles.countDocuments.mockResolvedValue(0);
    d.articles.find.mockReturnValue(q([])).mockReturnValue(q([]));
    d.tags.find.mockReturnValue(q([]));
    await d.search.search(ORG, ALI, 'member', { q: 'راهنما', status: 'published' } as never);
    const filter = d.articles.find.mock.calls[0][0] as Record<string, unknown>;
    expect(filter['status']).toBe('published');
  });

  it('affixed Persian query falls back with stemmed variants', async () => {
    const d = makeDeps();
    d.articles.countDocuments.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    d.articles.find.mockReturnValueOnce(q([])).mockReturnValueOnce(q([articleDoc()]));
    d.tags.find.mockReturnValue(q([]));
    const res = await d.search.search(ORG, ALI, 'member', { q: 'راهنمای' } as never);
    expect(res.mode).toBe('regex');
    expect(res.total).toBe(1);
    const filter = d.articles.find.mock.calls[1][0] as Record<string, unknown>;
    const ors = filter['$or'] as { title?: RegExp; summary?: RegExp; contentText?: RegExp }[];
    expect(ors.length).toBeGreaterThan(3);
    const sources = ors.flatMap((c) =>
      [c.title, c.summary, c.contentText].filter(Boolean).map((r) => (r as RegExp).source),
    );
    // The stemmed form must be among the queried patterns.
    expect(sources.some((s) => s.includes('راهنما'))).toBe(true);
    expect(filter['$text']).toBeUndefined();
  });
});

describe('searchVariants (Phase 10 Persian recall)', () => {
  it('strips the relative-ی: راهنمای → راهنما', () => {
    expect(searchVariants('راهنمای')).toContain('راهنما');
  });

  it('strips ZWNJ plurals: کتاب‌ها → کتاب', () => {
    expect(searchVariants('کتاب‌ها')).toContain('کتاب');
  });

  it('never mangles short words: علی stays intact', () => {
    expect(stemPersianToken('علی')).toBe('علی');
    expect(searchVariants('علی')).toEqual(['علی']);
  });

  it('unifies Arabic chars and ZWNJ spellings', () => {
    const variants = searchVariants('مي‌شود');
    expect(variants).toContain('میشود');
  });

  it('caps variants at 5 and keeps raw first', () => {
    const variants = searchVariants('راهنمای');
    expect(variants[0]).toBe('راهنمای');
    expect(variants.length).toBeLessThanOrEqual(5);
    expect(new Set(variants).size).toBe(variants.length);
  });
});

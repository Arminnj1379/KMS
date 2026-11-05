import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { Model, Types } from 'mongoose';
import type { Article } from '../../common/mongo/schemas/article.schema';
import type { ArticleVersion } from '../../common/mongo/schemas/article-version.schema';
import type { Category } from '../../common/mongo/schemas/category.schema';
import type { Tag } from '../../common/mongo/schemas/tag.schema';
import { ArticlesService } from './articles.service';
import { KnowledgeBasesService } from '../knowledge-bases/knowledge-bases.service';

const ORG = '000000000000000000000010';
const ALI = '0000000000000000000000a1';
const SARA = '0000000000000000000000b2';
const KB = '0000000000000000000000c1';

const oid = (hex: string): Types.ObjectId => new Types.ObjectId(hex);

// SAFETY: test-only stub of Mongoose's chainable Query API + aggregate/distinct.
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
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
    countDocuments: jest.fn(),
    distinct: jest.fn(),
    aggregate: jest.fn(),
  };
}

type ModelMock = ReturnType<typeof makeModelMock>;

function makeTx() {
  return {
    startSession: jest.fn().mockResolvedValue({
      withTransaction: jest.fn(async (fn: (s: unknown) => Promise<unknown>) => fn({})),
      endSession: jest.fn(),
    }),
  } as unknown as Connection;
}

function makeKbsMock(role: string | null) {
  return {
    requireAccess: jest.fn().mockResolvedValue({ kbId: oid(KB), role, isOrgAdmin: role === 'org-admin' }),
    requireManager: jest.fn().mockImplementation((access: { role: string | null }) => {
      if (access.role !== 'manager' && access.role !== 'org-admin') {
        throw new ForbiddenException('دسترسی غیرمجاز');
      }
    }),
  } as unknown as KnowledgeBasesService;
}

interface Deps {
  svc: ArticlesService;
  kbs: { requireAccess: jest.Mock; requireManager: jest.Mock };
  articles: ModelMock;
  versions: ModelMock;
  tags: ModelMock;
  cats: ModelMock;
}

function makeDeps(role: string | null): Deps {
  const articles = makeModelMock();
  const versions = makeModelMock();
  const tags = makeModelMock();
  const cats = makeModelMock();
  const kbs = makeKbsMock(role);
  const history = makeModelMock();
  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  const svc = new ArticlesService(
    makeTx(),
    articles as unknown as Model<Article>,
    versions as unknown as Model<ArticleVersion>,
    tags as unknown as Model<Tag>,
    cats as unknown as Model<Category>,
    history as unknown as Model<import('../../common/mongo/schemas/workflow-history.schema').WorkflowHistory>,
    kbs,
    audit as unknown as import('../audit-logs/audit-logs.service').AuditLogsService,
  );
  return { svc, kbs: kbs as unknown as { requireAccess: jest.Mock; requireManager: jest.Mock }, articles, versions, tags, cats };
}

const docJson = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'سلام' }] }] };

const articleDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: oid('0000000000000000000000d1'),
  organizationId: oid(ORG),
  knowledgeBaseId: oid(KB),
  categoryId: null,
  authorId: oid(ALI),
  title: 'A',
  slug: 'a',
  summary: null,
  contentJson: docJson,
  contentText: 'سلام',
  contentHtml: null,
  status: 'draft',
  version: 1,
  viewCount: 0,
  tagIds: [],
  attachments: [],
  publishedAt: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('Article rules', () => {
  it('reader cannot create articles (403)', async () => {
    const d = makeDeps('reader');
    await expect(
      d.svc.create(ORG, SARA, 'member', 'kb', { title: 'T', slug: 't', contentJson: docJson }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(d.articles.create).not.toHaveBeenCalled();
  });

  it('contributor can create; invalid Tiptap doc rejected (422)', async () => {
    const d = makeDeps('contributor');
    await expect(
      d.svc.create(ORG, SARA, 'member', 'kb', { title: 'T', slug: 't', contentJson: { type: 'paragraph' } }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    const created = articleDoc();
    d.articles.create.mockResolvedValue({ toObject: () => created });
    const res = await d.svc.create(ORG, SARA, 'member', 'kb', { title: 'T', slug: 't', contentJson: docJson });
    expect(res.slug).toBe('a');
    expect(d.articles.create).toHaveBeenCalled();
  });

  it('duplicate slug per KB maps to 409', async () => {
    const d = makeDeps('manager');
    const dup = Object.assign(new Error('dup'), { code: 11000 });
    d.articles.create.mockRejectedValue(dup);
    await expect(
      d.svc.create(ORG, ALI, 'member', 'kb', { title: 'T', slug: 't', contentJson: docJson }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stale version yields 409 with current document', async () => {
    const d = makeDeps('contributor');
    d.articles.findOneAndUpdate.mockReturnValue(q(null));
    d.articles.findOne.mockReturnValue(q(articleDoc({ version: 3, title: 'New' })));
    d.tags.find.mockReturnValue(q([]));
    try {
      await d.svc.update(ORG, SARA, 'member', 'kb', '0000000000000000000000d1', { version: 1, title: 'Stale' });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      const body = (error as ConflictException).getResponse() as { current: { version: number } };
      expect(body.current.version).toBe(3);
    }
  });

  it('matching version updates and bumps version', async () => {
    const d = makeDeps('contributor');
    d.articles.findOne.mockReturnValue(q(articleDoc({ version: 1 })));
    d.articles.findOneAndUpdate.mockReturnValue(q(articleDoc({ version: 2, title: 'Upd' })));
    d.tags.find.mockReturnValue(q([]));
    const res = await d.svc.update(ORG, SARA, 'member', 'kb', '0000000000000000000000d1', { version: 1, title: 'Upd' });
    expect(res.version).toBe(2);
    expect(d.articles.findOneAndUpdate).toHaveBeenCalled();
  });

  it('publish requires draft/in_review (422 otherwise)', async () => {
    const d = makeDeps('manager');
    d.articles.findOne.mockReturnValue(q(articleDoc({ status: 'published', version: 2 })));
    await expect(d.svc.publish(ORG, ALI, 'member', 'kb', 'a')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    d.articles.findOne.mockReturnValue(q(articleDoc({ status: 'draft', version: 2 })));
    d.articles.findOneAndUpdate.mockReturnValue(q(articleDoc({ status: 'published', version: 3 })));
    d.tags.find.mockReturnValue(q([]));
    const res = await d.svc.publish(ORG, ALI, 'member', 'kb', 'a');
    expect(res.status).toBe('published');
  });

  it('missing article resolves to 404', async () => {
    const d = makeDeps('manager');
    d.articles.findOne.mockReturnValue(q(null));
    await expect(d.svc.findOne(ORG, ALI, 'member', 'kb', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('category from another KB is rejected (404)', async () => {
    const d = makeDeps('manager');
    d.cats.findOne.mockReturnValue(q(null));
    await expect(
      d.svc.create(ORG, ALI, 'member', 'kb', {
        title: 'T',
        slug: 't',
        contentJson: docJson,
        categoryId: '0000000000000000000000ff',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update with changelog stores an immutable snapshot', async () => {
    const d = makeDeps('contributor');
    d.articles.findOne.mockReturnValue(q(articleDoc({ version: 1 })));
    d.articles.findOneAndUpdate.mockReturnValue(q(articleDoc({ version: 2, title: 'Upd' })));
    d.tags.find.mockReturnValue(q([]));
    d.versions.create.mockResolvedValue({});
    const res = await d.svc.update(ORG, SARA, 'member', 'kb', '0000000000000000000000d1', {
      version: 1,
      title: 'Upd',
      changelog: 'بازبینی اول',
    });
    expect(res.version).toBe(2);
    expect(d.versions.create).toHaveBeenCalledTimes(1);
  });

  it('plain autosave (no changelog) stores no snapshot', async () => {
    const d = makeDeps('contributor');
    d.articles.findOne.mockReturnValue(q(articleDoc({ version: 1 })));
    d.articles.findOneAndUpdate.mockReturnValue(q(articleDoc({ version: 2, title: 'Upd' })));
    d.tags.find.mockReturnValue(q([]));
    await d.svc.update(ORG, SARA, 'member', 'kb', '0000000000000000000000d1', { version: 1, title: 'Upd' });
    expect(d.versions.create).not.toHaveBeenCalled();
  });

  it('publish transition stores a snapshot', async () => {
    const d = makeDeps('manager');
    d.articles.findOne.mockReturnValue(q(articleDoc({ status: 'draft', version: 2 })));
    d.articles.findOneAndUpdate.mockReturnValue(q(articleDoc({ status: 'published', version: 3 })));
    d.tags.find.mockReturnValue(q([]));
    d.versions.create.mockResolvedValue({});
    const res = await d.svc.publish(ORG, ALI, 'member', 'kb', 'a');
    expect(res.status).toBe('published');
    expect(d.versions.create).toHaveBeenCalledTimes(1);
  });

  it('attach rejects duplicates (409) and detach of unknown link (404)', async () => {
    const d = makeDeps('manager');
    const docId = '0000000000000000000000e1';
    d.articles.findOne.mockReturnValue(q(articleDoc({ attachments: [] })));
    d.articles.findOneAndUpdate.mockReturnValue(
      q(articleDoc({ attachments: [{ documentId: oid(docId), createdBy: oid(ALI), createdAt: new Date() }] })),
    );
    d.tags.find.mockReturnValue(q([]));
    const res = await d.svc.attachDocument(ORG, ALI, 'member', 'kb', 'a', {
      documentId: oid(docId),
      createdBy: oid(ALI),
    });
    expect(res.attachments).toHaveLength(1);
    d.articles.findOne.mockReturnValue(
      q(articleDoc({ attachments: [{ documentId: oid(docId), createdBy: oid(ALI), createdAt: new Date() }] })),
    );
    await expect(
      d.svc.attachDocument(ORG, ALI, 'member', 'kb', 'a', { documentId: oid(docId), createdBy: oid(ALI) }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(d.svc.detachDocument(ORG, ALI, 'member', 'kb', 'a', '0000000000000000000000ff')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reader cannot attach documents (403)', async () => {
    const d = makeDeps('reader');
    d.articles.findOne.mockReturnValue(q(articleDoc()));
    await expect(
      d.svc.attachDocument(ORG, SARA, 'member', 'kb', 'a', { documentId: oid('0000000000000000000000e1'), createdBy: oid(SARA) }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

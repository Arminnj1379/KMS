import { ConflictException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import type { ArticleVersion } from '../../common/mongo/schemas/article-version.schema';
import { ArticleVersionsService } from './article-versions.service';
import type { ArticlesService } from '../articles/articles.service';
import { diffLines } from './diff.util';

const oid = (hex: string): Types.ObjectId => new Types.ObjectId(hex);
const AID = '0000000000000000000000d1';
const ALI = '0000000000000000000000a1';

function q<T>(value: T) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

function makeVersionModel() {
  return { find: jest.fn(), findOne: jest.fn(), create: jest.fn() };
}

function makeArticles(mode: 'read' | 'write', articleOverrides: Record<string, unknown> = {}) {
  const article = {
    _id: oid(AID),
    organizationId: oid('000000000000000000000010'),
    knowledgeBaseId: oid('0000000000000000000000c1'),
    categoryId: null,
    authorId: oid(ALI),
    title: 'A',
    slug: 'a',
    summary: null,
    contentJson: { type: 'doc', content: [] },
    contentText: 'line1\nline2',
    attachments: [],
    version: 2,
    ...articleOverrides,
  };
  return {
    requireReadableArticle: jest.fn().mockResolvedValue({ article, access: { role: 'manager' } }),
    requireWriterArticle: jest
      .fn()
      .mockImplementation(async () => {
        if (mode !== 'write') {
          const { ForbiddenException } = await import('@nestjs/common');
          throw new ForbiddenException('دسترسی غیرمجاز');
        }
        return { article, access: { role: 'manager' } };
      }),
    update: jest.fn().mockResolvedValue({ id: 'x', version: 3 }),
    __article: article,
  };
}

describe('diffLines', () => {
  it('reports changed middle as del/add with shared edges', () => {
    const hunks = diffLines('a\nb\nc', 'a\nB\nc');
    expect(hunks.map((h) => h.type)).toEqual(['same', 'del', 'add', 'same']);
  });

  it('identical texts yield a single same hunk', () => {
    const hunks = diffLines('a\nb', 'a\nb');
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.type).toBe('same');
  });
});

describe('ArticleVersionsService', () => {
  it('lists snapshots oldest-first for readers', async () => {
    const versions = makeVersionModel();
    const articles = makeArticles('read');
    const svc = new ArticleVersionsService(
      versions as unknown as Model<ArticleVersion>,
      articles as unknown as ArticlesService,
    );
    versions.find.mockReturnValue({ sort: jest.fn().mockReturnValue(q([{ _id: oid(AID), articleId: oid(AID), version: 1, title: 'A', summary: null, contentJson: {}, contentText: 'x', changelog: null, createdBy: oid(ALI), createdAt: new Date() }])) });
    const rows = await svc.list('org', ALI, 'member', 'kb', 'a');
    expect(rows).toHaveLength(1);
    expect(versions.find).toHaveBeenCalledWith({ articleId: oid(AID) });
  });

  it('findOne maps missing snapshots to 404', async () => {
    const versions = makeVersionModel();
    const articles = makeArticles('read');
    const svc = new ArticleVersionsService(
      versions as unknown as Model<ArticleVersion>,
      articles as unknown as ArticlesService,
    );
    versions.findOne.mockReturnValue(q(null));
    await expect(svc.findOne('org', ALI, 'member', 'kb', 'a', 9)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('duplicate snapshot for the same version maps to 409', async () => {
    const versions = makeVersionModel();
    const articles = makeArticles('write');
    const svc = new ArticleVersionsService(
      versions as unknown as Model<ArticleVersion>,
      articles as unknown as ArticlesService,
    );
    versions.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(svc.snapshotCurrent('org', ALI, 'member', 'kb', 'a', 'note')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('restore of a missing snapshot is 404; existing snapshot restores as a new version', async () => {
    const versions = makeVersionModel();
    const articles = makeArticles('write');
    const svc = new ArticleVersionsService(
      versions as unknown as Model<ArticleVersion>,
      articles as unknown as ArticlesService,
    );
    versions.findOne.mockReturnValue(q(null));
    await expect(svc.restore('org', ALI, 'member', 'kb', 'a', 1)).rejects.toBeInstanceOf(NotFoundException);
    versions.findOne.mockReturnValue(
      q({ _id: oid(AID), articleId: oid(AID), version: 1, title: 'Old', summary: null, contentJson: { type: 'doc' }, contentText: 'old', changelog: 'v1', createdBy: oid(ALI), createdAt: new Date() }),
    );
    const res = await svc.restore('org', ALI, 'member', 'kb', 'a', 1);
    expect(articles.update).toHaveBeenCalledWith(
      'org',
      ALI,
      'member',
      'kb',
      'a',
      expect.objectContaining({ version: 2, title: 'Old' }),
    );
    expect(res).toEqual({ id: 'x', version: 3 });
  });

  it('diff reports title change and line hunks', async () => {
    const versions = makeVersionModel();
    const articles = makeArticles('read');
    const svc = new ArticleVersionsService(
      versions as unknown as Model<ArticleVersion>,
      articles as unknown as ArticlesService,
    );
    versions.findOne
      .mockReturnValueOnce(q({ version: 1, title: 'A', summary: null, contentText: 'l1\nl2', changelog: null, createdAt: new Date() }))
      .mockReturnValueOnce(q({ version: 2, title: 'B', summary: null, contentText: 'l1\nL2', changelog: 'x', createdAt: new Date() }));
    const res = await svc.diff('org', ALI, 'member', 'kb', 'a', 1, 2);
    expect(res.titleChanged).toBe(true);
    expect(res.hunks.some((h) => h.type === 'add')).toBe(true);
  });
});

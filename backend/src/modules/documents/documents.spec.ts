import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import type { KmsDocument } from '../../common/mongo/schemas/document.schema';
import { DocumentsService } from './documents.service';
import type { ArticlesService } from '../articles/articles.service';
import type { StorageService } from '../../common/storage/storage.service';

const ORG = '000000000000000000000010';
const ALI = '0000000000000000000000a1';
const DOC = '0000000000000000000000e1';
const oid = (hex: string): Types.ObjectId => new Types.ObjectId(hex);

function q<T>(value: T) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

function makeDocumentModel() {
  return { create: jest.fn(), find: jest.fn(), findOne: jest.fn(), countDocuments: jest.fn() };
}

function makeStorage(head: { sizeBytes: number; mime: string } | null, driver: 's3' | 'local' = 'local') {
  return {
    driver,
    presignPut: jest.fn().mockResolvedValue({ uploadUrl: 'documents/upload/key', expiresIn: 900 }),
    presignGet: jest.fn().mockResolvedValue({ url: 'https://s3/signed', expiresIn: 300 }),
    head: jest.fn().mockResolvedValue(head),
    saveBytes: jest.fn().mockImplementation(async (_o: string, _k: string, data: Buffer) => data.length),
    openReadStream: jest.fn(),
    isHealthy: jest.fn().mockResolvedValue(true),
  };
}

function makeArticles() {
  return {
    attachDocument: jest.fn().mockResolvedValue({}),
    detachDocument: jest.fn().mockResolvedValue(undefined),
    listAttachmentLinks: jest.fn().mockResolvedValue([]),
  };
}

function makeSvc(storageHead: { sizeBytes: number; mime: string } | null, driver: 's3' | 'local' = 'local') {
  const documents = makeDocumentModel();
  const storage = makeStorage(storageHead, driver);
  const articles = makeArticles();
  const svc = new DocumentsService(
    documents as unknown as Model<KmsDocument>,
    storage as unknown as StorageService,
    articles as unknown as ArticlesService,
  );
  return { svc, documents, storage, articles };
}

const docRow = () => ({
  _id: oid(DOC),
  organizationId: oid(ORG),
  uploaderId: oid(ALI),
  objectKey: 'abc123',
  filename: 'a.pdf',
  mime: 'application/pdf',
  sizeBytes: 10,
  checksumSha256: null,
  createdAt: new Date(),
});

describe('DocumentsService', () => {
  it('upload-intent rejects disallowed mime and oversize payloads', async () => {
    const { svc } = makeSvc(null);
    await expect(
      svc.uploadIntent(ORG, ALI, { filename: 'x.exe', mime: 'application/octet-stream', sizeBytes: 10 }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      svc.uploadIntent(ORG, ALI, { filename: 'big.pdf', mime: 'application/pdf', sizeBytes: 26 * 1024 * 1024 }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('upload-intent mints a key and presigned target', async () => {
    const { svc, storage } = makeSvc(null);
    const res = await svc.uploadIntent(ORG, ALI, { filename: 'a.pdf', mime: 'application/pdf', sizeBytes: 100 });
    expect(res.objectKey).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(storage.presignPut).toHaveBeenCalledWith(res.objectKey, 'application/pdf');
  });

  it('local sink rejects empty and oversize bodies', async () => {
    const { svc } = makeSvc(null);
    await expect(svc.saveLocalBytes(ORG, 'abc123', Buffer.alloc(0), 'application/pdf')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    await expect(
      svc.saveLocalBytes(ORG, 'abc123', Buffer.alloc(26 * 1024 * 1024), 'application/pdf'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('confirm without uploaded bytes is 422', async () => {
    const { svc } = makeSvc(null);
    await expect(svc.confirm(ORG, ALI, 'member', { objectKey: 'abc123' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('confirm rejects size mismatch and half article links', async () => {
    const { svc } = makeSvc({ sizeBytes: 100, mime: 'application/pdf' });
    await expect(
      svc.confirm(ORG, ALI, 'member', { objectKey: 'abc123', sizeBytes: 99 }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      svc.confirm(ORG, ALI, 'member', { objectKey: 'abc123', kbId: 'kb' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('confirm duplicate objectKey maps to 409', async () => {
    const { svc, documents } = makeSvc({ sizeBytes: 10, mime: 'application/pdf' });
    documents.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(svc.confirm(ORG, ALI, 'member', { objectKey: 'abc123' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('cross-org document access resolves to 404', async () => {
    const { svc, documents } = makeSvc({ sizeBytes: 10, mime: 'application/pdf' });
    documents.findOne.mockReturnValue(q(null));
    await expect(svc.findOne(ORG, DOC)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.attachExisting(ORG, ALI, 'member', 'kb', 'a', DOC)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listArticleAttachments enriches in link order and skips orphans', async () => {
    const { svc, documents, articles } = makeSvc(null);
    const other = '0000000000000000000000e2';
    articles.listAttachmentLinks.mockResolvedValue([
      { documentId: DOC, createdBy: ALI, createdAt: new Date() },
      { documentId: other, createdBy: ALI, createdAt: new Date() },
    ]);
    documents.find.mockReturnValue(q([docRow()]));
    const rows = await svc.listArticleAttachments(ORG, ALI, 'member', 'kb', 'a');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.filename).toBe('a.pdf');
  });
});

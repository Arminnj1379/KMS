import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { KmsDocument } from '../../common/mongo/schemas/document.schema';
import { throwConflictIfDuplicate } from '../../common/mongo/mongo-errors';
import { toObjectIdOrNull } from '../../common/mongo/object-id';
import { StorageService } from '../../common/storage/storage.service';
import { ArticlesService } from '../articles/articles.service';
import {
  ALLOWED_MIMES,
  MAX_FILE_SIZE_BYTES,
  OBJECT_KEY_PATTERN,
} from './documents.constants';
import type { ConfirmDocumentDto, ListDocumentsQuery, UploadIntentDto } from './dto/documents.dto';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type DocumentLean = {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  uploaderId: Types.ObjectId;
  objectKey: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  checksumSha256: string | null;
  createdAt: Date;
};

/**
 * Org-scoped document library + article attachment links (D-007/D-017).
 * Bytes live in object storage; rows are retained after unlink (audit).
 * Depends on ArticlesService (direction: documents → articles).
 */
@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(KmsDocument.name) private readonly documentModel: Model<KmsDocument>,
    private readonly storage: StorageService,
    private readonly articles: ArticlesService,
  ) {}

  private toDto(d: DocumentLean, downloadUrl?: string) {
    return {
      id: d._id.toHexString(),
      filename: d.filename,
      mime: d.mime,
      sizeBytes: d.sizeBytes,
      uploaderId: d.uploaderId.toHexString(),
      createdAt: d.createdAt,
      ...(downloadUrl ? { downloadUrl } : {}),
    };
  }

  private assertAllowedMime(mime: string): void {
    if (!ALLOWED_MIMES.has(mime)) {
      throw new UnprocessableEntityException('نوع فایل مجاز نیست');
    }
  }

  /** Step 1 of 2: validate + mint a server-side key + presigned PUT target. */
  async uploadIntent(orgId: string, _userId: string, dto: UploadIntentDto) {
    const mime = dto.mime.trim();
    this.assertAllowedMime(mime);
    if (!Number.isInteger(dto.sizeBytes) || dto.sizeBytes < 1 || dto.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new UnprocessableEntityException('حجم فایل باید بین ۱ بایت و ۲۵ مگابایت باشد');
    }
    const filename = dto.filename.trim();
    if (!filename) throw new BadRequestException('نام فایل الزامی است');
    const objectKey = randomUUID().replace(/-/g, '');
    if (!OBJECT_KEY_PATTERN.test(objectKey)) throw new BadRequestException('کلید فایل معتبر نیست');
    const { uploadUrl, expiresIn } = await this.storage.presignPut(objectKey, mime);
    return { objectKey, uploadUrl, expiresIn, mime, sizeBytes: dto.sizeBytes };
  }

  /** Local-driver byte sink (S3 clients PUT straight to the presigned URL). */
  async saveLocalBytes(orgId: string, objectKey: string, data: Buffer, contentType: string | undefined) {
    if (!OBJECT_KEY_PATTERN.test(objectKey)) throw new NotFoundException('فایل یافت نشد');
    if (data.length === 0) throw new UnprocessableEntityException('بدنه فایل خالی است');
    if (data.length > MAX_FILE_SIZE_BYTES) {
      throw new UnprocessableEntityException('حجم فایل باید بین ۱ بایت و ۲۵ مگابایت باشد');
    }
    const mime = (contentType ?? 'application/octet-stream').split(';')[0]?.trim() ?? 'application/octet-stream';
    this.assertAllowedMime(mime);
    const orgObjectId = toObjectIdOrNull(orgId);
    if (!orgObjectId) throw new NotFoundException('سازمان یافت نشد');
    const sizeBytes = await this.storage.saveBytes(orgId, objectKey, data, mime);
    return { objectKey, sizeBytes, mime };
  }

  /** Step 2 of 2: verify bytes exist, then insert the document row. */
  async confirm(orgId: string, userId: string, orgRole: string, dto: ConfirmDocumentDto) {
    const orgObjectId = toObjectIdOrNull(orgId);
    const uploaderObjectId = toObjectIdOrNull(userId);
    if (!orgObjectId || !uploaderObjectId) throw new NotFoundException('سازمان یافت نشد');
    const filename = (dto.filename ?? '').trim() || dto.objectKey;
    const head = await this.storage.head(dto.objectKey, orgId);
    if (!head) {
      throw new UnprocessableEntityException('فایل روی ذخیره‌سازی یافت نشد؛ ابتدا فایل را آپلود کنید');
    }
    const mime = (dto.mime ?? head.mime).trim();
    this.assertAllowedMime(mime);
    const sizeBytes = dto.sizeBytes ?? head.sizeBytes;
    if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new UnprocessableEntityException('حجم فایل باید بین ۱ بایت و ۲۵ مگابایت باشد');
    }
    if (dto.sizeBytes !== undefined && dto.sizeBytes !== head.sizeBytes) {
      throw new UnprocessableEntityException('حجم اعلام‌شده با فایل آپلودشده مطابقت ندارد');
    }
    if ((dto.kbId !== undefined) !== (dto.articleId !== undefined)) {
      throw new UnprocessableEntityException('اتصال به مقاله نیازمند هر دو شناسه kbId و articleId است');
    }
    let created: DocumentLean;
    try {
      const row = await this.documentModel.create({
        organizationId: orgObjectId,
        uploaderId: uploaderObjectId,
        objectKey: dto.objectKey,
        filename,
        mime,
        sizeBytes,
        checksumSha256: null,
      });
      created = row.toObject() as unknown as DocumentLean;
    } catch (error) {
      throwConflictIfDuplicate(error, 'این فایل قبلاً ثبت شده است');
      throw error;
    }
    if (dto.kbId !== undefined && dto.articleId !== undefined) {
      // Document row is retained even if the attach fails (audit-friendly).
      await this.articles.attachDocument(orgId, userId, orgRole, dto.kbId, dto.articleId, {
        documentId: created._id,
        createdBy: uploaderObjectId,
      });
    }
    return this.toDto(created);
  }

  async list(orgId: string, query: ListDocumentsQuery) {
    const orgObjectId = toObjectIdOrNull(orgId);
    if (!orgObjectId) return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
    const filter: Record<string, unknown> = { organizationId: orgObjectId };
    if (query.search) {
      filter['filename'] = { $regex: escapeRegExp(query.search.trim()), $options: 'i' };
    }
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const [total, rows] = await Promise.all([
      this.documentModel.countDocuments(filter),
      this.documentModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    ]);
    return {
      items: (rows as unknown as DocumentLean[]).map((r) => this.toDto(r)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(orgId: string, documentId: string) {
    const doc = await this.requireOrgDocument(orgId, documentId);
    const downloadUrl = await this.downloadUrlFor(doc);
    return this.toDto(doc, downloadUrl);
  }

  async openFile(orgId: string, documentId: string) {
    const doc = await this.requireOrgDocument(orgId, documentId);
    const { stream, mime, sizeBytes } = await this.storage.openReadStream(doc.objectKey, orgId);
    return { stream, mime, sizeBytes, filename: doc.filename };
  }

  async downloadUrlFor(doc: DocumentLean): Promise<string> {
    if (this.storage.driver === 's3') {
      const { url } = await this.storage.presignGet(doc.objectKey);
      return url;
    }
    return `documents/${doc._id.toHexString()}/file`;
  }

  private async requireOrgDocument(orgId: string, documentId: string): Promise<DocumentLean> {
    const orgObjectId = toObjectIdOrNull(orgId);
    const docObjectId = toObjectIdOrNull(documentId);
    if (!orgObjectId || !docObjectId) throw new NotFoundException('فایل یافت نشد');
    const doc = (await this.documentModel
      .findOne({ _id: docObjectId, organizationId: orgObjectId })
      .lean()) as unknown as DocumentLean | null;
    if (!doc) throw new NotFoundException('فایل یافت نشد');
    return doc;
  }

  /** Enriched attachment list for an article (read permission via ArticlesService). */
  async listArticleAttachments(orgId: string, userId: string, orgRole: string, kbId: string, articleId: string) {
    const links = await this.articles.listAttachmentLinks(orgId, userId, orgRole, kbId, articleId);
    if (links.length === 0) return [];
    const orgObjectId = toObjectIdOrNull(orgId);
    if (!orgObjectId) throw new NotFoundException('سازمان یافت نشد');
    const ids = links.map((l) => new Types.ObjectId(l.documentId));
    const rows = (await this.documentModel
      .find({ _id: { $in: ids }, organizationId: orgObjectId })
      .lean()) as unknown as DocumentLean[];
    const byId = new Map(rows.map((r) => [r._id.toHexString(), r]));
    const out: (ReturnType<DocumentsService['toDto']> & { attachedBy: string; attachedAt: Date })[] = [];
    for (const link of links) {
      const doc = byId.get(link.documentId);
      if (!doc) continue;
      out.push({ ...this.toDto(doc), attachedBy: link.createdBy, attachedAt: link.createdAt });
    }
    return out;
  }

  async attachExisting(
    orgId: string,
    userId: string,
    orgRole: string,
    kbId: string,
    articleId: string,
    documentId: string,
  ) {
    const doc = await this.requireOrgDocument(orgId, documentId);
    const actorObjectId = toObjectIdOrNull(userId);
    if (!actorObjectId) throw new NotFoundException('کاربر یافت نشد');
    await this.articles.attachDocument(orgId, userId, orgRole, kbId, articleId, {
      documentId: doc._id,
      createdBy: actorObjectId,
    });
    return { ...this.toDto(doc), attachedBy: actorObjectId.toHexString(), attachedAt: new Date() };
  }

  async detach(orgId: string, userId: string, orgRole: string, kbId: string, articleId: string, documentId: string) {
    await this.articles.detachDocument(orgId, userId, orgRole, kbId, articleId, documentId);
  }

  /** SHA-256 helper for future checksum backfill (stored on confirm when cheap). */
  hashBytes(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }
}

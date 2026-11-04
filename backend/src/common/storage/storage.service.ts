import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StorageConfig } from './storage.config';

export interface ObjectHead {
  sizeBytes: number;
  mime: string;
}

const PUT_TTL_SECONDS = 900;
const GET_TTL_SECONDS = 300;

/**
 * Object-storage abstraction (D-007). Two drivers behind one seam:
 * - `s3`: AWS SDK v3 against MinIO (compose) or AWS S3 (prod). Client PUTs
 *   bytes directly to the presigned URL; the server never proxies uploads.
 * - `local`: filesystem fallback for environments where MinIO is unreachable
 *   (registry-blocked sandboxes, offline laptops). The client PUTs bytes to a
 *   same-origin `documents/upload/:key` endpoint; confirm/download stream
 *   through the API. Never use `local` with more than one API replica.
 */
@Injectable()
export class StorageService {
  private readonly s3: S3Client | null;

  constructor(private readonly config: StorageConfig) {
    this.s3 =
      config.STORAGE_DRIVER === 's3'
        ? new S3Client({
            endpoint: config.S3_ENDPOINT,
            region: config.S3_REGION,
            credentials: {
              accessKeyId: config.S3_ACCESS_KEY,
              secretAccessKey: config.S3_SECRET_KEY,
            },
            forcePathStyle: config.S3_FORCE_PATH_STYLE,
          })
        : null;
  }

  get driver(): 's3' | 'local' {
    return this.config.STORAGE_DRIVER;
  }

  private fail(): never {
    throw new ServiceUnavailableException('سرویس ذخیره‌سازی در دسترس نیست');
  }

  private dirFor(orgId: string): string {
    return path.resolve(process.cwd(), this.config.UPLOADS_DIR, orgId);
  }

  private filePathFor(orgId: string, objectKey: string): string {
    return path.join(this.dirFor(orgId), `${objectKey}.bin`);
  }

  private metaPathFor(orgId: string, objectKey: string): string {
    return path.join(this.dirFor(orgId), `${objectKey}.meta.json`);
  }

  /**
   * Returns where the client must PUT the bytes. S3 → absolute presigned URL;
   * local → API-relative path (same axios client, auth header included).
   */
  async presignPut(objectKey: string, mime: string): Promise<{ uploadUrl: string; expiresIn: number }> {
    if (this.s3) {
      try {
        const url = await getSignedUrl(
          this.s3,
          new PutObjectCommand({
            Bucket: this.config.S3_BUCKET,
            Key: objectKey,
            ContentType: mime,
          }),
          { expiresIn: PUT_TTL_SECONDS },
        );
        return { uploadUrl: url, expiresIn: PUT_TTL_SECONDS };
      } catch {
        this.fail();
      }
    }
    return { uploadUrl: `documents/upload/${objectKey}`, expiresIn: PUT_TTL_SECONDS };
  }

  /** Null when the object does not exist; 503 when storage is unreachable. */
  async head(objectKey: string, orgId?: string): Promise<ObjectHead | null> {
    if (this.s3) {
      try {
        const res = await this.s3.send(new HeadObjectCommand({ Bucket: this.config.S3_BUCKET, Key: objectKey }));
        return { sizeBytes: res.ContentLength ?? 0, mime: res.ContentType ?? 'application/octet-stream' };
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          ((error as { name?: string }).name === 'NotFound' ||
            (error as { name?: string }).name === 'NoSuchKey' ||
            (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
        ) {
          return null;
        }
        this.fail();
      }
    }
    if (!orgId) return null;
    try {
      const [stat, meta] = await Promise.all([
        fs.promises.stat(this.filePathFor(orgId, objectKey)),
        fs.promises.readFile(this.metaPathFor(orgId, objectKey), 'utf8'),
      ]);
      const mime = (JSON.parse(meta) as { mime?: unknown }).mime;
      return { sizeBytes: stat.size, mime: typeof mime === 'string' ? mime : 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  /** S3 presigned GET (5 min TTL). Local driver serves via `documents/:id/file` instead. */
  async presignGet(objectKey: string): Promise<{ url: string; expiresIn: number }> {
    if (!this.s3) {
      throw new ServiceUnavailableException('در این حالت ذخیره‌سازی، لینک مستقیم پشتیبانی نمی‌شود');
    }
    try {
      const url = await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.config.S3_BUCKET, Key: objectKey }),
        { expiresIn: GET_TTL_SECONDS },
      );
      return { url, expiresIn: GET_TTL_SECONDS };
    } catch {
      this.fail();
    }
  }

  /** Local-driver upload target: persists raw bytes (+mime sidecar). S3 driver rejects. */
  async saveBytes(orgId: string, objectKey: string, data: Buffer, mime: string): Promise<number> {
    if (this.s3) {
      throw new ServiceUnavailableException('آپلود مستقیم فقط در حالت ذخیره‌سازی محلی پشتیبانی می‌شود');
    }
    const dir = this.dirFor(orgId);
    await fs.promises.mkdir(dir, { recursive: true });
    await Promise.all([
      fs.promises.writeFile(this.filePathFor(orgId, objectKey), data),
      fs.promises.writeFile(
        this.metaPathFor(orgId, objectKey),
        JSON.stringify({ mime, sizeBytes: data.length, createdAt: new Date().toISOString() }),
      ),
    ]);
    return data.length;
  }

  /** Opens a readable stream for `documents/:id/file` (both drivers; S3 is proxied to avoid CORS). */
  async openReadStream(
    objectKey: string,
    orgId: string,
  ): Promise<{ stream: NodeJS.ReadableStream; mime: string; sizeBytes: number }> {
    if (this.s3) {
      try {
        const res = await this.s3.send(new GetObjectCommand({ Bucket: this.config.S3_BUCKET, Key: objectKey }));
        const body = res.Body as NodeJS.ReadableStream | undefined;
        if (!body) this.fail();
        return {
          stream: body,
          mime: res.ContentType ?? 'application/octet-stream',
          sizeBytes: res.ContentLength ?? 0,
        };
      } catch {
        this.fail();
      }
    }
    const info = await this.head(objectKey, orgId);
    if (!info) {
      throw new ServiceUnavailableException('فایل روی ذخیره‌سازی یافت نشد');
    }
    return { stream: fs.createReadStream(this.filePathFor(orgId, objectKey)), mime: info.mime, sizeBytes: info.sizeBytes };
  }

  async isHealthy(): Promise<boolean> {
    if (this.s3) {
      try {
        await this.s3.send(new HeadBucketCommand({ Bucket: this.config.S3_BUCKET }));
        return true;
      } catch {
        return false;
      }
    }
    try {
      await fs.promises.mkdir(path.resolve(process.cwd(), this.config.UPLOADS_DIR), { recursive: true });
      await fs.promises.access(path.resolve(process.cwd(), this.config.UPLOADS_DIR), fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
}

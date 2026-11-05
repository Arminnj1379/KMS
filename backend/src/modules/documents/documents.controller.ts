import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { MAX_FILE_SIZE_BYTES } from './documents.constants';
import { DocumentsService } from './documents.service';
import { ConfirmDocumentDto, ListDocumentsQuery, UploadIntentDto } from './dto/documents.dto';

async function readRawBody(req: Request, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += buf.length;
    if (total > maxBytes) {
      throw new UnprocessableEntityException('حجم فایل باید بین ۱ بایت و ۲۵ مگابایت باشد');
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function contentDisposition(filename: string): string {
  const safe = filename.replace(/["\r\n]/g, '_');
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('upload-intent')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Step 1: validate + mint upload target (any org member)' })
  intent(@CurrentUser() me: AuthenticatedUser, @Body() dto: UploadIntentDto) {
    return this.documents.uploadIntent(me.orgId, me.userId, dto);
  }

  @Put('upload/:key')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Local-driver byte sink (S3 clients PUT to the presigned URL instead)' })
  async uploadLocal(
    @CurrentUser() me: AuthenticatedUser,
    @Param('key') key: string,
    @Req() req: Request,
    @Headers('content-type') contentType: string | undefined,
  ) {
    const data = await readRawBody(req, MAX_FILE_SIZE_BYTES + 1024);
    return this.documents.saveLocalBytes(me.orgId, key, data, contentType);
  }

  @Post('confirm')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Step 2: verify bytes + create the document row (optionally attach)' })
  confirm(@CurrentUser() me: AuthenticatedUser, @Body() dto: ConfirmDocumentDto) {
    return this.documents.confirm(me.orgId, me.userId, me.orgRole, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Org document library (paginated, filename search)' })
  list(@CurrentUser() me: AuthenticatedUser, @Query() query: ListDocumentsQuery) {
    return this.documents.list(me.orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Document metadata + download URL (org-scoped)' })
  findOne(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    return this.documents.findOne(me.orgId, id);
  }

  @Get(':id/file')
  @ApiOperation({ summary: 'Stream document bytes (both storage drivers)' })
  async file(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string, @Res() res: Response) {
    const { stream, mime, sizeBytes, filename } = await this.documents.openFile(me.orgId, id);
    res.setHeader('Content-Type', mime);
    if (sizeBytes > 0) res.setHeader('Content-Length', String(sizeBytes));
    res.setHeader('Content-Disposition', contentDisposition(filename));
    (stream as NodeJS.ReadableStream & { pipe: (dst: Response) => void }).pipe(res);
  }
}

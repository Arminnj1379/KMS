import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';

interface ErrorEnvelope {
  statusCode: number;
  message: string;
  code: string;
  requestId?: string;
  /**
   * Phase 11: the optimistic-concurrency 409 carries the current document
   * so the editor can offer reload/overwrite. The filter preserves it —
   * without this the transport silently drops `current` and the conflict
   * dialog degrades to a generic error.
   */
  current?: unknown;
}

/**
 * Sanitized error envelope. 4xx messages pass through (they are safe,
 * validator-produced); 500s are collapsed to a generic message so stack
 * traces and SQL details never reach clients. Full error is logged by pino.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<Request & { id?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'خطای داخلی سرور';
    let code = 'INTERNAL';
    let current: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as { message?: unknown; code?: unknown; current?: unknown };
        if (Array.isArray(b.message)) message = b.message.join('؛ ');
        else if (typeof b.message === 'string') message = b.message;
        if (typeof b.code === 'string') code = b.code;
        if (status === HttpStatus.CONFLICT && 'current' in b) current = b.current;
      }
      if (!code || code === 'INTERNAL') {
        code =
          status === 400
            ? 'BAD_REQUEST'
            : status === 401
              ? 'UNAUTHORIZED'
              : status === 403
                ? 'FORBIDDEN'
                : status === 404
                  ? 'NOT_FOUND'
                  : status === 409
                    ? 'CONFLICT'
                    : status === 422
                      ? 'UNPROCESSABLE'
                      : status === 429
                        ? 'RATE_LIMITED'
                        : 'HTTP_ERROR';
      }
      if (status >= 500) {
        message = 'خطای داخلی سرور';
        code = 'INTERNAL';
      }
    }

    const envelope: ErrorEnvelope = {
      statusCode: status,
      message,
      code,
      requestId: request.id,
      ...(current !== undefined ? { current } : {}),
    };
    response.status(status).json(envelope);
  }
}

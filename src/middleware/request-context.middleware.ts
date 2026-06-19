import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { ulid } from 'ulid';
import { DEFAULT_REQUEST_ID_HEADER, LOGGING_OPTIONS } from '../constants';
import { LoggingModuleOptions } from '../types';
import { requestContext } from '../context/als';

/**
 * Middleware que abre el contexto AsyncLocalStorage de cada request.
 *
 * - Lee el header de correlación; si no existe, genera un ULID (id ordenable
 *   por tiempo) y lo escribe de vuelta en req/res.
 * - Corre `next()` dentro de requestContext.run(), de modo que TODO el
 *   procesamiento del request (incluidos awaits y llamadas salientes) tiene
 *   acceso al mismo request_id.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly header: string;

  constructor(@Inject(LOGGING_OPTIONS) options: LoggingModuleOptions) {
    this.header = (options.requestIdHeader || DEFAULT_REQUEST_ID_HEADER).toLowerCase();
  }

  use(req: any, res: any, next: (err?: any) => void): void {
    const existing = req?.headers?.[this.header];
    const id = typeof existing === 'string' && existing.length > 0 ? existing : ulid();

    if (req?.headers) {
      req.headers[this.header] = id;
    }
    if (res && typeof res.setHeader === 'function' && !res.headersSent) {
      res.setHeader(this.header, id);
    }

    requestContext.run({ requestId: id }, () => next());
  }
}

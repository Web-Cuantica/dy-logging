import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { getRequestId } from '../context/als';

/**
 * Filtro global de excepciones. Loguea de forma estructurada (err con
 * type/message/stack, http y request_id) y responde un JSON consistente.
 *
 * - status >= 500  -> log nivel error (con stack)
 * - status 4xx     -> log nivel warn
 *
 * Se registra automaticamente desde LoggingModule.forRoot() salvo que pases
 * registerGlobalExceptionFilter: false.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext('ExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<any>();
    const res = ctx.getResponse<any>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload: Record<string, unknown> = {
      http: {
        method: req?.method,
        url: req?.url,
        status_code: status,
      },
      request_id: getRequestId(),
    };
    // Pasamos el Error real bajo `err`: el serializador estandar de pino
    // produce type/message/stack correctos.
    payload.err =
      exception instanceof Error ? exception : { message: String(exception) };

    if (status >= 500) {
      this.logger.error(payload, 'Unhandled exception');
    } else {
      this.logger.warn(payload, 'Handled exception');
    }

    // Respuesta consistente al cliente (sin filtrar el stack).
    const body = isHttp
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    if (res && typeof res.status === 'function') {
      res
        .status(status)
        .json(typeof body === 'string' ? { statusCode: status, message: body } : body);
    }
  }
}

import { Injectable, Scope } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

export type LogAttributes = Record<string, unknown>;

/**
 * Logger ergonomico: mensaje PRIMERO, atributos en un objeto plano DESPUES.
 * Evita el patron `{ data: {} }` y el orden invertido de pino.
 *
 *   this.logger.info('Recibo aprobado', {
 *     eco: '12346A4',
 *     sales_order: 1345678,
 *     client: 'ACME Corp',
 *   });
 *
 * Los atributos quedan al tope del JSON, asi filtras en DataDog como
 * @eco, @sales_order, @client.
 *
 * Es TRANSIENT: cada clase que lo inyecta recibe su propia instancia, por lo
 * que setContext() identifica de que clase viene el log.
 *
 * Nombres reservados a EVITAR como llaves (los usa la infraestructura):
 * level, status, time, message, service, env, version, request_id, dd, req, res,
 * responseTime, context, err.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class DyLogger {
  constructor(private readonly logger: PinoLogger) {}

  /** Identifica el origen del log (tipicamente el nombre de la clase). */
  setContext(context: string): void {
    this.logger.setContext(context);
  }

  trace(message: string, attrs?: LogAttributes): void {
    this.logger.trace(attrs ?? {}, message);
  }

  debug(message: string, attrs?: LogAttributes): void {
    this.logger.debug(attrs ?? {}, message);
  }

  info(message: string, attrs?: LogAttributes): void {
    this.logger.info(attrs ?? {}, message);
  }

  warn(message: string, attrs?: LogAttributes): void {
    this.logger.warn(attrs ?? {}, message);
  }

  /**
   * error y fatal aceptan un objeto de atributos O un Error directamente
   * (se serializa type/message/stack bajo `err` via el serializador de pino).
   */
  error(message: string, attrsOrError?: LogAttributes | Error): void {
    this.logger.error(this.normalize(attrsOrError), message);
  }

  fatal(message: string, attrsOrError?: LogAttributes | Error): void {
    this.logger.fatal(this.normalize(attrsOrError), message);
  }

  private normalize(input?: LogAttributes | Error): LogAttributes {
    if (!input) {
      return {};
    }
    if (input instanceof Error) {
      return { err: input };
    }
    return input;
  }
}

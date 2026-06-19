import pino from 'pino';
import { ulid } from 'ulid';
import { getRequestId, getUser } from '../context/als';
import { getDatadogTraceIds } from '../dd-trace/dd-trace.util';
import { DEFAULT_REDACT_CENSOR, DEFAULT_REDACT_PATHS } from './redact';
import { createHealthIgnore, DEFAULT_HEALTH_PATHS } from '../sampling/health-sampling';
import { LoggingModuleOptions } from '../types';
import { DEFAULT_HEALTH_SAMPLE_RATE, DEFAULT_REQUEST_ID_HEADER } from '../constants';

/** Nivel por defecto segun ambiente (se sobreescribe con options.level o LOG_LEVEL). */
const ENV_DEFAULT_LEVEL: Record<string, string> = {
  local: 'debug',
  dev: 'debug',
  development: 'debug',
  qa: 'info',
  staging: 'info',
  uat: 'info',
  prod: 'info',
  production: 'info',
};

export function resolveLevel(opts: LoggingModuleOptions): string {
  if (opts.level) {
    return opts.level;
  }
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  const env = (opts.env || process.env.DD_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  return ENV_DEFAULT_LEVEL[env] ?? 'info';
}

/**
 * Construye las opciones de pino-http. El log resultante sigue los ATRIBUTOS
 * ESTANDAR de DataDog (timestamp, status, logger.name, http.*, network.client.ip,
 * duration en ns, error.kind/message/stack) para que el panel de DataDog
 * encienda sus secciones automaticamente. Los campos de negocio quedan planos.
 */
export function buildPinoHttpOptions(opts: LoggingModuleOptions): Record<string, unknown> {
  const headerName = (opts.requestIdHeader || DEFAULT_REQUEST_ID_HEADER).toLowerCase();
  // Unified tagging de DataDog: DD_SERVICE/DD_ENV/DD_VERSION mandan, asi logs,
  // traces y metricas comparten las mismas etiquetas. Caen a SERVICE_NAME /
  // NODE_ENV / APP_VERSION y, por ultimo, a los de package.json.
  const service =
    opts.serviceName ||
    process.env.DD_SERVICE ||
    process.env.SERVICE_NAME ||
    process.env.npm_package_name ||
    'unknown-service';
  const env =
    opts.env || process.env.DD_ENV || process.env.NODE_ENV || 'development';
  const version =
    opts.version ||
    process.env.DD_VERSION ||
    process.env.APP_VERSION ||
    process.env.npm_package_version ||
    '0.0.0';
  const level = resolveLevel(opts);
  const sampleRate = opts.healthSampleRate ?? DEFAULT_HEALTH_SAMPLE_RATE;
  const healthPaths = opts.healthPaths || DEFAULT_HEALTH_PATHS;
  const redactPaths = [...DEFAULT_REDACT_PATHS, ...(opts.redactPaths || [])];

  const base: Record<string, unknown> = {
    level,

    // Atributos presentes en TODOS los logs.
    base: { service, env, version },

    // Mensaje -> columna Content de DataDog.
    messageKey: 'message',

    // Fecha del evento bajo 'timestamp' (atributo que DataDog reconoce como
    // fecha nativa, en vez de la hora de ingesta).
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,

    formatters: {
      // Nivel como label + `status` (reservado de DataDog para severidad).
      level(label: string) {
        return { level: label, status: label };
      },

      // Mapea cada log a atributos estandar de DataDog.
      log(obj: Record<string, any>) {
        // context -> logger.name (facet "Logger Name")
        if (obj.context && !obj.logger) {
          obj.logger = { name: obj.context };
          delete obj.context;
        }
        // err -> error.{kind,message,stack}
        if (obj.err && !obj.error) {
          obj.error = {
            kind: obj.err.type,
            message: obj.err.message,
            stack: obj.err.stack,
          };
          delete obj.err;
        }
        // responseTime (ms) -> duration (ns)
        if (typeof obj.responseTime === 'number') {
          obj.duration = Math.round(obj.responseTime * 1e6);
          delete obj.responseTime;
        }
        return obj;
      },
    },

    // Redaccion de secrets / PII.
    redact: {
      paths: redactPaths,
      censor: DEFAULT_REDACT_CENSOR,
    },

    // En CADA log: request_id y (si hay dd-trace) dd.trace_id/span_id.
    mixin(): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      const id = getRequestId();
      if (id) {
        out.request_id = id;
      }
      const usr = getUser();
      if (usr) {
        out.usr = usr;
      }
      const dd = getDatadogTraceIds();
      if (dd) {
        Object.assign(out, dd);
      }
      return out;
    },

    // Genera o reutiliza el id de correlacion.
    genReqId(req: any, res: any): string {
      const existing = req?.headers?.[headerName];
      const id = typeof existing === 'string' && existing.length > 0 ? existing : ulid();
      if (req?.headers) {
        req.headers[headerName] = id;
      }
      try {
        if (res && typeof res.setHeader === 'function' && !res.headersSent) {
          res.setHeader(headerName, id);
        }
      } catch {
        /* la respuesta pudo haber empezado a enviarse; ignoramos */
      }
      return id;
    },

    // Nivel del log de request segun el status de la respuesta.
    customLogLevel(_req: any, res: any, err?: Error): string {
      if (err || (res && res.statusCode >= 500)) {
        return 'error';
      }
      if (res && res.statusCode >= 400) {
        return 'warn';
      }
      return 'info';
    },

    // Atributos HTTP estandar para la linea de "request completed".
    customProps(req: any, res: any): Record<string, unknown> {
      const http: Record<string, unknown> = {};
      if (req?.method) http.method = req.method;
      if (req?.url) http.url = req.url;
      if (res?.statusCode) http.status_code = res.statusCode;
      const ip = req?.ip || req?.socket?.remoteAddress;
      const out: Record<string, unknown> = { http };
      if (ip) {
        out.network = { client: { ip } };
      }
      return out;
    },

    // Auto-logging HTTP. Con autoHttpLogging:false se apaga por completo
    // (solo quedan los logs que el servicio instrumenta a mano).
    autoLogging:
      opts.autoHttpLogging === false
        ? false
        : { ignore: createHealthIgnore(sampleRate, healthPaths) },

    // Los logs de negocio solo llevan el id de correlacion, no el blob req.
    quietReqLogger: true,

    // Suprimimos los blobs crudos req/res/reqId: el http estandar lo arma
    // customProps. err pasa por el serializador estandar de pino.
    serializers: {
      req: () => undefined,
      res: () => undefined,
      reqId: () => undefined,
      err: pino.stdSerializers.err,
    },
  };

  // Escape hatch: el consumidor puede sobreescribir cualquier opcion.
  return opts.pinoHttp ? { ...base, ...opts.pinoHttp } : base;
}

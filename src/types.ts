/**
 * Opciones de configuración de LoggingModule.forRoot().
 * Todos los campos son opcionales: si no se pasan, se leen de variables
 * de entorno (SERVICE_NAME, NODE_ENV, APP_VERSION, LOG_LEVEL).
 */
export interface LoggingModuleOptions {
  /** Nombre del servicio. Default: process.env.SERVICE_NAME */
  serviceName?: string;

  /** Ambiente (prod, staging, qa, dev...). Default: process.env.NODE_ENV */
  env?: string;

  /** Versión del servicio. Default: process.env.APP_VERSION */
  version?: string;

  /**
   * Nivel mínimo de log. Default: process.env.LOG_LEVEL, o el default por
   * ambiente (dev -> debug, prod -> info).
   */
  level?: string;

  /** Header para el id de correlación. Default: 'x-request-id' */
  requestIdHeader?: string;

  /** Conserva 1 de cada N logs de health. Default: 20. Usa 1 para no muestrear. */
  healthSampleRate?: number;

  /**
   * Auto-loguear cada request HTTP (linea "request completed"). Default: true.
   * Ponlo en false si solo quieres loguear los puntos que instrumentas a mano.
   */
  autoHttpLogging?: boolean;

  /** Regex de rutas consideradas health/ping. Default: ver DEFAULT_HEALTH_PATHS. */
  healthPaths?: RegExp;

  /** Rutas extra a redactar (se suman a las predeterminadas de secrets/PII). */
  redactPaths?: string[];

  /**
   * Registra automáticamente el AllExceptionsFilter como filtro global.
   * Default: true. Pásalo en false si ya tienes tu propio filtro.
   */
  registerGlobalExceptionFilter?: boolean;

  /**
   * Escape hatch: opciones crudas de pino-http que sobreescriben las
   * generadas por la librería (merge superficial).
   */
  pinoHttp?: Record<string, unknown>;
}

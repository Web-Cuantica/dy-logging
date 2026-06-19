// API publica de @dy/logging

export { LoggingModule } from './logging.module';
export { LoggingModuleOptions } from './types';

export {
  LOGGING_OPTIONS,
  DEFAULT_REQUEST_ID_HEADER,
  DEFAULT_HEALTH_SAMPLE_RATE,
} from './constants';

// Logger ergonomico (mensaje primero, atributos planos)
export { DyLogger, LogAttributes } from './logger/dy-logger.service';

// Contexto de request (ALS)
export { RequestContextService } from './context/request-context.service';
export {
  requestContext,
  getRequestId,
  getRequestStore,
  setContextValue,
  setUser,
  getUser,
  RequestStore,
  RequestUser,
} from './context/als';

// Componentes individuales (por si quieres usarlos sueltos)
export { RequestContextMiddleware } from './middleware/request-context.middleware';
export { AllExceptionsFilter } from './filters/all-exceptions.filter';
export { createTracePropagationInterceptor } from './http/trace-propagation';
export { getDatadogTraceIds, DatadogTraceIds } from './dd-trace/dd-trace.util';

// Utilidades de configuracion
export { buildPinoHttpOptions, resolveLevel } from './pino/pino-options.factory';
export { DEFAULT_HEALTH_PATHS, createHealthIgnore } from './sampling/health-sampling';
export { DEFAULT_REDACT_PATHS, DEFAULT_REDACT_CENSOR } from './pino/redact';

// Re-export del logger de nestjs-pino para que los servicios no dependan
// directamente del paquete.
export { Logger, PinoLogger, LoggerModule, InjectPinoLogger } from 'nestjs-pino';

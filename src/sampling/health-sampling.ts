import type { IncomingMessage } from 'node:http';

/**
 * Rutas consideradas health/ping. Cubre el patrón de actuator (Nest/Spring)
 * y endpoints comunes de liveness/readiness.
 */
export const DEFAULT_HEALTH_PATHS =
  /(\/actuator\/(health|ping|info)|\/health(z)?|\/ping|\/livez|\/readyz|\/liveness|\/readiness)(\?|$)/i;

/**
 * Crea la función `ignore` de pino-http para muestrear health-checks.
 *
 * Devuelve true (= ignorar el log) para todos los hits de health EXCEPTO 1 de
 * cada `sampleRate`. Así conservas señal de vida sin inundar DataDog ni gastar
 * cuota de ingesta. Las rutas que no son health nunca se ignoran.
 *
 * sampleRate = 1 desactiva el muestreo (se loguea todo).
 */
export function createHealthIgnore(
  sampleRate: number,
  healthPaths: RegExp = DEFAULT_HEALTH_PATHS,
): (req: IncomingMessage) => boolean {
  const rate = Math.max(1, Math.floor(sampleRate));
  let counter = 0;

  return function ignore(req: IncomingMessage): boolean {
    const url = req.url || '';
    if (!healthPaths.test(url)) {
      return false; // no es health -> siempre se loguea
    }
    if (rate === 1) {
      return false; // sin muestreo
    }
    counter = (counter + 1) % rate;
    // Conserva el log solo cuando el contador vuelve a 0 (1 de cada `rate`).
    return counter !== 0;
  };
}

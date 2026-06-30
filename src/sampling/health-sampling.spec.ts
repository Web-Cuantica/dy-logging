import type { IncomingMessage } from 'node:http';
import { createHealthIgnore, DEFAULT_HEALTH_PATHS } from './health-sampling';

/** Helper: arma un request mínimo con solo la url. */
function req(url: string): IncomingMessage {
  return { url } as IncomingMessage;
}

describe('DEFAULT_HEALTH_PATHS', () => {
  it.each([
    '/actuator/health',
    '/actuator/ping',
    '/actuator/info',
    '/health',
    '/healthz',
    '/ping',
    '/livez',
    '/readyz',
    '/liveness',
    '/readiness',
    '/health?ts=123',
  ])('reconoce %s como ruta de health', (url) => {
    expect(DEFAULT_HEALTH_PATHS.test(url)).toBe(true);
  });

  it.each(['/inspections', '/receipt/update-status', '/api/health-report', '/healthcheck-detail'])(
    'NO marca %s como health',
    (url) => {
      expect(DEFAULT_HEALTH_PATHS.test(url)).toBe(false);
    },
  );

  it('es case-insensitive', () => {
    expect(DEFAULT_HEALTH_PATHS.test('/ACTUATOR/HEALTH')).toBe(true);
  });
});

describe('createHealthIgnore', () => {
  it('nunca ignora rutas que no son de health', () => {
    const ignore = createHealthIgnore(20);
    for (let i = 0; i < 50; i++) {
      expect(ignore(req('/inspections'))).toBe(false);
    }
  });

  it('con sampleRate=1 no muestrea (loguea todo, incluso health)', () => {
    const ignore = createHealthIgnore(1);
    for (let i = 0; i < 10; i++) {
      expect(ignore(req('/health'))).toBe(false);
    }
  });

  it('conserva 1 de cada N hits de health (N=20)', () => {
    const ignore = createHealthIgnore(20);
    let kept = 0;
    for (let i = 0; i < 100; i++) {
      if (!ignore(req('/health'))) kept++;
    }
    // 100 / 20 = 5 conservados.
    expect(kept).toBe(5);
  });

  it('el primer hit de health se ignora y el N-ésimo se conserva', () => {
    const ignore = createHealthIgnore(3);
    expect(ignore(req('/ping'))).toBe(true); // 1
    expect(ignore(req('/ping'))).toBe(true); // 2
    expect(ignore(req('/ping'))).toBe(false); // 3 -> conservado
    expect(ignore(req('/ping'))).toBe(true); // 4
  });

  it('normaliza sampleRate < 1 a 1 (sin muestreo)', () => {
    const ignore = createHealthIgnore(0);
    expect(ignore(req('/health'))).toBe(false);
  });

  it('trunca sampleRate fraccionario (2.9 -> 2)', () => {
    const ignore = createHealthIgnore(2.9);
    expect(ignore(req('/health'))).toBe(true); // 1
    expect(ignore(req('/health'))).toBe(false); // 2 -> conservado
  });

  it('trata una url ausente como cadena vacía (no es health)', () => {
    const ignore = createHealthIgnore(20);
    expect(ignore({} as IncomingMessage)).toBe(false);
  });

  it('respeta un healthPaths personalizado', () => {
    const ignore = createHealthIgnore(2, /^\/custom-health$/);
    expect(ignore(req('/health'))).toBe(false); // ya no cuenta como health
    expect(ignore(req('/custom-health'))).toBe(true); // 1
    expect(ignore(req('/custom-health'))).toBe(false); // 2 -> conservado
  });

  it('mantiene contadores independientes por instancia', () => {
    const a = createHealthIgnore(2);
    const b = createHealthIgnore(2);
    expect(a(req('/health'))).toBe(true);
    // b arranca su propio contador, no comparte estado con a.
    expect(b(req('/health'))).toBe(true);
    expect(b(req('/health'))).toBe(false);
  });
});

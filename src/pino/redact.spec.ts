import { DEFAULT_REDACT_PATHS, DEFAULT_REDACT_CENSOR } from './redact';

describe('redact (rutas de redacción de secrets/PII)', () => {
  it('el censor es [REDACTED]', () => {
    expect(DEFAULT_REDACT_CENSOR).toBe('[REDACTED]');
  });

  it('cubre headers sensibles', () => {
    expect(DEFAULT_REDACT_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'req.headers["x-auth-token"]',
        'res.headers["set-cookie"]',
      ]),
    );
  });

  it.each(['password', 'token', 'access_token', 'refreshToken', 'secret', 'apiKey', 'api_key'])(
    'redacta la credencial "%s" en raíz y anidada',
    (campo) => {
      expect(DEFAULT_REDACT_PATHS).toContain(campo);
      expect(DEFAULT_REDACT_PATHS).toContain(`*.${campo}`);
    },
  );

  it.each(['email', 'vin', 'serial_number', 'serialNumber', 'client_name', 'clientName'])(
    'redacta el PII "%s" en raíz y anidado',
    (campo) => {
      expect(DEFAULT_REDACT_PATHS).toContain(campo);
      expect(DEFAULT_REDACT_PATHS).toContain(`*.${campo}`);
    },
  );

  it('no contiene rutas duplicadas', () => {
    const unicas = new Set(DEFAULT_REDACT_PATHS);
    expect(unicas.size).toBe(DEFAULT_REDACT_PATHS.length);
  });

  it('es una lista no vacía de strings', () => {
    expect(DEFAULT_REDACT_PATHS.length).toBeGreaterThan(0);
    expect(DEFAULT_REDACT_PATHS.every((p) => typeof p === 'string')).toBe(true);
  });
});

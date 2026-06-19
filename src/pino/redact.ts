/**
 * Rutas redactadas por defecto. pino las reemplaza por '[REDACTED]' antes de
 * escribir el log, así nunca salen secrets ni PII a DataDog.
 *
 * La sintaxis `*.campo` matchea ese campo en cualquier objeto de primer nivel.
 * Para anidados más profundos, agrega rutas explícitas vía `redactPaths`.
 */
export const DEFAULT_REDACT_PATHS: string[] = [
  // Headers sensibles
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-auth-token"]',
  'res.headers["set-cookie"]',

  // Credenciales / tokens
  'password',
  '*.password',
  'pass',
  '*.pass',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'access_token',
  '*.access_token',
  'refreshToken',
  '*.refreshToken',
  'authorization',
  '*.authorization',
  'secret',
  '*.secret',
  'apiKey',
  '*.apiKey',
  'api_key',
  '*.api_key',

  // PII detectada en los logs actuales
  'email',
  '*.email',
  'emails',
  '*.emails',
  'vin',
  '*.vin',
  'serial_number',
  '*.serial_number',
  'serialNumber',
  '*.serialNumber',
  'client_name',
  '*.client_name',
  'clientName',
  '*.clientName',
];

export const DEFAULT_REDACT_CENSOR = '[REDACTED]';

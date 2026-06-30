import { resolveLevel, buildPinoHttpOptions } from './pino-options.factory';
import { DEFAULT_REDACT_CENSOR } from './redact';
import { requestContext } from '../context/als';

/** Limpia las env vars que afectan la resolución de opciones. */
const ENV_KEYS = [
  'LOG_LEVEL',
  'NODE_ENV',
  'DD_ENV',
  'DD_SERVICE',
  'SERVICE_NAME',
  'DD_VERSION',
  'APP_VERSION',
  'npm_package_name',
  'npm_package_version',
];

describe('resolveLevel', () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    ENV_KEYS.forEach((k) => {
      original[k] = process.env[k];
      delete process.env[k];
    });
  });

  afterEach(() => {
    ENV_KEYS.forEach((k) => {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    });
  });

  it('opts.level tiene la máxima prioridad', () => {
    process.env.LOG_LEVEL = 'warn';
    expect(resolveLevel({ level: 'trace', env: 'production' })).toBe('trace');
  });

  it('LOG_LEVEL gana sobre el default por ambiente', () => {
    process.env.LOG_LEVEL = 'error';
    expect(resolveLevel({ env: 'production' })).toBe('error');
  });

  it.each([
    ['local', 'debug'],
    ['dev', 'debug'],
    ['development', 'debug'],
    ['qa', 'info'],
    ['staging', 'info'],
    ['uat', 'info'],
    ['prod', 'info'],
    ['production', 'info'],
  ])('ambiente %s => nivel %s', (env, level) => {
    expect(resolveLevel({ env })).toBe(level);
  });

  it('es case-insensitive con el ambiente', () => {
    expect(resolveLevel({ env: 'PRODUCTION' })).toBe('info');
  });

  it('default a info para un ambiente desconocido', () => {
    expect(resolveLevel({ env: 'marte' })).toBe('info');
  });

  it('default a development (debug) sin ninguna pista', () => {
    expect(resolveLevel({})).toBe('debug');
  });

  it('toma DD_ENV cuando no hay opts.env', () => {
    process.env.DD_ENV = 'production';
    expect(resolveLevel({})).toBe('info');
  });
});

describe('buildPinoHttpOptions', () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    ENV_KEYS.forEach((k) => {
      original[k] = process.env[k];
      delete process.env[k];
    });
  });

  afterEach(() => {
    ENV_KEYS.forEach((k) => {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    });
  });

  describe('atributos base (service/env/version)', () => {
    it('usa los valores de opts', () => {
      const o = buildPinoHttpOptions({ serviceName: 'dyinspectionws', env: 'qa', version: '1.2.3' });
      expect(o.base).toEqual({ service: 'dyinspectionws', env: 'qa', version: '1.2.3' });
    });

    it('cae a las env de Unified Service Tagging de DataDog', () => {
      process.env.DD_SERVICE = 'svc-dd';
      process.env.DD_ENV = 'staging';
      process.env.DD_VERSION = '9.9.9';
      const o = buildPinoHttpOptions({});
      expect(o.base).toEqual({ service: 'svc-dd', env: 'staging', version: '9.9.9' });
    });

    it('default seguro cuando no hay nada configurado', () => {
      const o = buildPinoHttpOptions({});
      expect(o.base).toEqual({ service: 'unknown-service', env: 'development', version: '0.0.0' });
    });
  });

  it('configura la redacción con el censor estándar', () => {
    const o = buildPinoHttpOptions({}) as any;
    expect(o.redact.censor).toBe(DEFAULT_REDACT_CENSOR);
    expect(o.redact.paths).toEqual(expect.arrayContaining(['password', 'authorization']));
  });

  it('suma redactPaths extra del consumidor', () => {
    const o = buildPinoHttpOptions({ redactPaths: ['*.curp'] }) as any;
    expect(o.redact.paths).toContain('*.curp');
    expect(o.redact.paths).toContain('password');
  });

  it('messageKey apunta a "message" (columna Content de DataDog)', () => {
    expect(buildPinoHttpOptions({}).messageKey).toBe('message');
  });

  it('timestamp emite el campo "timestamp" en ISO', () => {
    const o = buildPinoHttpOptions({}) as any;
    const ts = o.timestamp();
    expect(ts).toMatch(/^,"timestamp":"\d{4}-\d{2}-\d{2}T.*Z"$/);
  });

  describe('formatters.level', () => {
    it('mapea el label a level + status (reservado de DataDog)', () => {
      const o = buildPinoHttpOptions({}) as any;
      expect(o.formatters.level('error')).toEqual({ level: 'error', status: 'error' });
    });
  });

  describe('formatters.log', () => {
    let log: (obj: Record<string, any>) => Record<string, any>;
    beforeEach(() => {
      log = (buildPinoHttpOptions({}) as any).formatters.log;
    });

    it('convierte context -> logger.name', () => {
      expect(log({ context: 'ReceiptService' })).toEqual({ logger: { name: 'ReceiptService' } });
    });

    it('no pisa logger si ya existe', () => {
      const out = log({ context: 'X', logger: { name: 'Y' } });
      expect(out.logger).toEqual({ name: 'Y' });
      expect(out.context).toBe('X');
    });

    it('convierte err -> error.{kind,message,stack}', () => {
      const out = log({ err: { type: 'QueryFailedError', message: 'lock', stack: 'st' } });
      expect(out.error).toEqual({ kind: 'QueryFailedError', message: 'lock', stack: 'st' });
      expect(out.err).toBeUndefined();
    });

    it('no pisa error si ya existe', () => {
      const out = log({ err: { type: 'E' }, error: { kind: 'previo' } });
      expect(out.error).toEqual({ kind: 'previo' });
    });

    it('convierte responseTime (ms) -> duration (ns)', () => {
      const out = log({ responseTime: 269 });
      expect(out.duration).toBe(269000000);
      expect(out.responseTime).toBeUndefined();
    });

    it('responseTime=0 se convierte a duration=0', () => {
      const out = log({ responseTime: 0 });
      expect(out.duration).toBe(0);
    });

    it('deja intactos los campos de negocio planos', () => {
      const out = log({ eco: '12346A4', inspection_id: 97125 });
      expect(out).toEqual({ eco: '12346A4', inspection_id: 97125 });
    });
  });

  describe('mixin (inyecta request_id / usr / dd en cada log)', () => {
    it('vacío fuera de un contexto de request', () => {
      const o = buildPinoHttpOptions({}) as any;
      expect(o.mixin()).toEqual({});
    });

    it('inyecta request_id y usr desde la ALS', () => {
      const o = buildPinoHttpOptions({}) as any;
      requestContext.run({ requestId: 'rid-1', usr: { id: 4471 } }, () => {
        expect(o.mixin()).toEqual({ request_id: 'rid-1', usr: { id: 4471 } });
      });
    });

    it('sin usr solo inyecta request_id', () => {
      const o = buildPinoHttpOptions({}) as any;
      requestContext.run({ requestId: 'rid-2' }, () => {
        expect(o.mixin()).toEqual({ request_id: 'rid-2' });
      });
    });
  });

  describe('genReqId', () => {
    it('reutiliza el header entrante si existe', () => {
      const o = buildPinoHttpOptions({}) as any;
      const req = { headers: { 'x-request-id': 'cliente-123' } };
      const res = { setHeader: jest.fn(), headersSent: false };
      expect(o.genReqId(req, res)).toBe('cliente-123');
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'cliente-123');
    });

    it('genera un ULID cuando no hay header', () => {
      const o = buildPinoHttpOptions({}) as any;
      const req = { headers: {} as Record<string, string> };
      const res = { setHeader: jest.fn(), headersSent: false };
      const id = o.genReqId(req, res);
      expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // formato ULID
      expect(req.headers['x-request-id']).toBe(id);
    });

    it('usa el header personalizado de requestIdHeader', () => {
      const o = buildPinoHttpOptions({ requestIdHeader: 'X-Correlation-Id' }) as any;
      const req = { headers: { 'x-correlation-id': 'corr-9' } };
      const res = { setHeader: jest.fn(), headersSent: false };
      expect(o.genReqId(req, res)).toBe('corr-9');
    });

    it('no truena si la respuesta ya empezó a enviarse', () => {
      const o = buildPinoHttpOptions({}) as any;
      const req = { headers: {} };
      const res = {
        headersSent: false,
        setHeader: () => {
          throw new Error('headers ya enviados');
        },
      };
      expect(() => o.genReqId(req, res)).not.toThrow();
    });

    it('ignora un header vacío y genera uno nuevo', () => {
      const o = buildPinoHttpOptions({}) as any;
      const req = { headers: { 'x-request-id': '' } };
      const res = { setHeader: jest.fn(), headersSent: false };
      expect(o.genReqId(req, res)).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });
  });

  describe('customLogLevel', () => {
    let fn: (req: any, res: any, err?: Error) => string;
    beforeEach(() => {
      fn = (buildPinoHttpOptions({}) as any).customLogLevel;
    });

    it('5xx => error', () => {
      expect(fn({}, { statusCode: 500 })).toBe('error');
    });
    it('error presente => error aunque el status sea 2xx', () => {
      expect(fn({}, { statusCode: 200 }, new Error('x'))).toBe('error');
    });
    it('4xx => warn', () => {
      expect(fn({}, { statusCode: 404 })).toBe('warn');
    });
    it('2xx => info', () => {
      expect(fn({}, { statusCode: 200 })).toBe('info');
    });
  });

  describe('customProps', () => {
    let fn: (req: any, res: any) => Record<string, any>;
    beforeEach(() => {
      fn = (buildPinoHttpOptions({}) as any).customProps;
    });

    it('arma http.{method,url,status_code} y network.client.ip', () => {
      const out = fn({ method: 'PATCH', url: '/receipt', ip: '10.5.20.244' }, { statusCode: 200 });
      expect(out).toEqual({
        http: { method: 'PATCH', url: '/receipt', status_code: 200 },
        network: { client: { ip: '10.5.20.244' } },
      });
    });

    it('cae a socket.remoteAddress cuando no hay req.ip', () => {
      const out = fn({ method: 'GET', socket: { remoteAddress: '1.2.3.4' } }, { statusCode: 200 });
      expect((out.network as any).client.ip).toBe('1.2.3.4');
    });

    it('omite network cuando no hay IP', () => {
      const out = fn({ method: 'GET', url: '/x' }, { statusCode: 200 });
      expect(out.network).toBeUndefined();
      expect(out.http).toEqual({ method: 'GET', url: '/x', status_code: 200 });
    });
  });

  describe('autoLogging', () => {
    it('por defecto trae un ignore() para muestrear health', () => {
      const o = buildPinoHttpOptions({}) as any;
      expect(typeof o.autoLogging.ignore).toBe('function');
    });

    it('autoHttpLogging:false apaga el auto-logging', () => {
      const o = buildPinoHttpOptions({ autoHttpLogging: false }) as any;
      expect(o.autoLogging).toBe(false);
    });
  });

  describe('serializers', () => {
    it('suprime los blobs crudos req/res/reqId', () => {
      const o = buildPinoHttpOptions({}) as any;
      expect(o.serializers.req()).toBeUndefined();
      expect(o.serializers.res()).toBeUndefined();
      expect(o.serializers.reqId()).toBeUndefined();
    });

    it('serializa err con el serializador estándar de pino', () => {
      const o = buildPinoHttpOptions({}) as any;
      const out = o.serializers.err(new Error('boom'));
      expect(out).toMatchObject({ type: 'Error', message: 'boom' });
      expect(out.stack).toBeDefined();
    });
  });

  describe('escape hatch pinoHttp', () => {
    it('sobreescribe opciones generadas', () => {
      const o = buildPinoHttpOptions({ pinoHttp: { level: 'silent', custom: 1 } }) as any;
      expect(o.level).toBe('silent');
      expect(o.custom).toBe(1);
    });
  });
});

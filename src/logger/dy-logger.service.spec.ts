import { DyLogger } from './dy-logger.service';

/** Mock del PinoLogger subyacente (solo los métodos que usa DyLogger). */
function createPinoMock() {
  return {
    setContext: jest.fn(),
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };
}

describe('DyLogger', () => {
  let pino: ReturnType<typeof createPinoMock>;
  let logger: DyLogger;

  beforeEach(() => {
    pino = createPinoMock();
    logger = new DyLogger(pino as any);
  });

  it('setContext delega en el PinoLogger', () => {
    logger.setContext('ReceiptService');
    expect(pino.setContext).toHaveBeenCalledWith('ReceiptService');
  });

  describe('orden de argumentos (atributos primero hacia pino, mensaje después)', () => {
    it.each(['trace', 'debug', 'info', 'warn'] as const)(
      '%s pasa (attrs, message) a pino',
      (level) => {
        logger[level]('Recibo aprobado', { eco: '12346A4', sales_order: 1 });
        expect(pino[level]).toHaveBeenCalledWith({ eco: '12346A4', sales_order: 1 }, 'Recibo aprobado');
      },
    );

    it.each(['trace', 'debug', 'info', 'warn'] as const)(
      '%s usa objeto vacío cuando no hay atributos',
      (level) => {
        logger[level]('sin atributos');
        expect(pino[level]).toHaveBeenCalledWith({}, 'sin atributos');
      },
    );
  });

  describe('error y fatal', () => {
    it.each(['error', 'fatal'] as const)('%s acepta atributos planos', (level) => {
      logger[level]('Falló', { inspection_id: 97125 });
      expect(pino[level]).toHaveBeenCalledWith({ inspection_id: 97125 }, 'Falló');
    });

    it.each(['error', 'fatal'] as const)('%s envuelve un Error bajo `err`', (level) => {
      const err = new Error('boom');
      logger[level]('Falló al guardar', err);
      expect(pino[level]).toHaveBeenCalledWith({ err }, 'Falló al guardar');
    });

    it.each(['error', 'fatal'] as const)('%s sin segundo argumento manda objeto vacío', (level) => {
      logger[level]('Falló');
      expect(pino[level]).toHaveBeenCalledWith({}, 'Falló');
    });

    it('preserva subclases de Error', () => {
      class QueryFailedError extends Error {}
      const err = new QueryFailedError('lock timeout');
      logger.error('db', err);
      const [[attrs]] = pino.error.mock.calls;
      expect(attrs.err).toBeInstanceOf(QueryFailedError);
    });

    it('no confunde un objeto de atributos con un Error', () => {
      const attrs = { err: 'esto-es-un-string' };
      logger.error('msg', attrs);
      expect(pino.error).toHaveBeenCalledWith(attrs, 'msg');
    });
  });
});

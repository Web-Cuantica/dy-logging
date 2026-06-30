/**
 * dd-trace NO está instalado en este repo (es peer opcional). Por eso el camino
 * "sin tracer" se prueba con el require real (que falla y cae a undefined), y el
 * camino "con tracer activo" se prueba inyectando un módulo virtual 'dd-trace'.
 */
describe('getDatadogTraceIds', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('devuelve undefined cuando dd-trace no está instalado', () => {
    // require('dd-trace') lanza -> catch -> tracer null -> undefined.
    let result: unknown;
    jest.isolateModules(() => {
      const { getDatadogTraceIds } = require('./dd-trace.util');
      result = getDatadogTraceIds();
    });
    expect(result).toBeUndefined();
  });

  it('extrae trace_id/span_id del span activo', () => {
    const fakeSpan = {
      context: () => ({ toTraceId: () => 123n, toSpanId: () => 456n }),
    };
    jest.isolateModules(() => {
      jest.doMock(
        'dd-trace',
        () => ({ scope: () => ({ active: () => fakeSpan }) }),
        { virtual: true },
      );
      const { getDatadogTraceIds } = require('./dd-trace.util');
      expect(getDatadogTraceIds()).toEqual({ dd: { trace_id: '123', span_id: '456' } });
    });
  });

  it('devuelve undefined si no hay span activo', () => {
    let result: unknown;
    jest.isolateModules(() => {
      jest.doMock('dd-trace', () => ({ scope: () => ({ active: () => undefined }) }), {
        virtual: true,
      });
      const { getDatadogTraceIds } = require('./dd-trace.util');
      result = getDatadogTraceIds();
    });
    expect(result).toBeUndefined();
  });

  it('devuelve undefined si el tracer no expone scope()', () => {
    let result: unknown;
    jest.isolateModules(() => {
      jest.doMock('dd-trace', () => ({}), { virtual: true });
      const { getDatadogTraceIds } = require('./dd-trace.util');
      result = getDatadogTraceIds();
    });
    expect(result).toBeUndefined();
  });

  it('captura excepciones del span y devuelve undefined', () => {
    const explosiveSpan = {
      context: () => ({
        toTraceId: () => {
          throw new Error('span roto');
        },
        toSpanId: () => '1',
      }),
    };
    let result: unknown;
    jest.isolateModules(() => {
      jest.doMock('dd-trace', () => ({ scope: () => ({ active: () => explosiveSpan }) }), {
        virtual: true,
      });
      const { getDatadogTraceIds } = require('./dd-trace.util');
      result = getDatadogTraceIds();
    });
    expect(result).toBeUndefined();
  });

  it('cachea la resolución del tracer (no re-require en cada llamada)', () => {
    const factory = jest.fn(() => ({ scope: () => ({ active: () => undefined }) }));
    jest.isolateModules(() => {
      jest.doMock('dd-trace', factory, { virtual: true });
      const { getDatadogTraceIds } = require('./dd-trace.util');
      getDatadogTraceIds();
      getDatadogTraceIds();
      getDatadogTraceIds();
    });
    // require de 'dd-trace' se evalúa una sola vez gracias al flag `resolved`.
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

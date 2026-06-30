import { createTracePropagationInterceptor } from './trace-propagation';
import { requestContext } from '../context/als';

describe('createTracePropagationInterceptor', () => {
  it('agrega el request_id del contexto al header saliente', () => {
    const interceptor = createTracePropagationInterceptor();
    requestContext.run({ requestId: 'rid-out' }, () => {
      const config = interceptor({ headers: {} });
      expect(config.headers['x-request-id']).toBe('rid-out');
    });
  });

  it('inicializa headers si la config no los trae', () => {
    const interceptor = createTracePropagationInterceptor();
    requestContext.run({ requestId: 'rid-1' }, () => {
      const config = interceptor({});
      expect(config.headers['x-request-id']).toBe('rid-1');
    });
  });

  it('no pisa un header de correlación ya presente', () => {
    const interceptor = createTracePropagationInterceptor();
    requestContext.run({ requestId: 'rid-nuevo' }, () => {
      const config = interceptor({ headers: { 'x-request-id': 'ya-existe' } });
      expect(config.headers['x-request-id']).toBe('ya-existe');
    });
  });

  it('no agrega header si no hay contexto de request', () => {
    const interceptor = createTracePropagationInterceptor();
    const config = interceptor({ headers: {} });
    expect(config.headers['x-request-id']).toBeUndefined();
  });

  it('usa un nombre de header personalizado (en minúsculas)', () => {
    const interceptor = createTracePropagationInterceptor('X-Correlation-Id');
    requestContext.run({ requestId: 'corr-1' }, () => {
      const config = interceptor({ headers: {} });
      expect(config.headers['x-correlation-id']).toBe('corr-1');
    });
  });

  it('devuelve la misma config (contrato de interceptor de Axios)', () => {
    const interceptor = createTracePropagationInterceptor();
    const input = { headers: {}, url: '/x' };
    requestContext.run({ requestId: 'r' }, () => {
      expect(interceptor(input)).toBe(input);
    });
  });
});

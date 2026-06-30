import { RequestContextService } from './request-context.service';
import { requestContext, RequestStore } from './als';

function withStore<T>(store: RequestStore, fn: () => T): T {
  return requestContext.run(store, fn);
}

describe('RequestContextService', () => {
  const service = new RequestContextService();

  it('getRequestId lee el id del contexto activo', () => {
    withStore({ requestId: 'svc-1' }, () => {
      expect(service.getRequestId()).toBe('svc-1');
    });
  });

  it('getRequestId es undefined fuera de contexto', () => {
    expect(service.getRequestId()).toBeUndefined();
  });

  it('setUser/getUser registran y leen el usuario', () => {
    withStore({ requestId: 'svc-2' }, () => {
      service.setUser({ id: 7, name: 'ada' });
      expect(service.getUser()).toEqual({ id: 7, name: 'ada' });
    });
  });

  it('set/get manejan valores de negocio arbitrarios', () => {
    withStore({ requestId: 'svc-3' }, () => {
      service.set('eco', '12346A4');
      expect(service.get<string>('eco')).toBe('12346A4');
    });
  });

  it('get devuelve undefined si no hay store', () => {
    expect(service.get('cualquier')).toBeUndefined();
  });

  it('get devuelve undefined para una clave inexistente dentro del store', () => {
    withStore({ requestId: 'svc-4' }, () => {
      expect(service.get('no-existe')).toBeUndefined();
    });
  });
});

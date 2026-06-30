import {
  requestContext,
  getRequestId,
  getRequestStore,
  setContextValue,
  setUser,
  getUser,
  RequestStore,
} from './als';

/** Corre un callback dentro de un contexto ALS con el store dado. */
function withStore<T>(store: RequestStore, fn: () => T): T {
  return requestContext.run(store, fn);
}

describe('als (AsyncLocalStorage de request)', () => {
  describe('fuera de un contexto', () => {
    it('getRequestStore devuelve undefined', () => {
      expect(getRequestStore()).toBeUndefined();
    });

    it('getRequestId devuelve undefined', () => {
      expect(getRequestId()).toBeUndefined();
    });

    it('getUser devuelve undefined', () => {
      expect(getUser()).toBeUndefined();
    });

    it('setContextValue no rompe aunque no haya store', () => {
      expect(() => setContextValue('foo', 'bar')).not.toThrow();
    });

    it('setUser no rompe aunque no haya store', () => {
      expect(() => setUser({ id: 1 })).not.toThrow();
    });
  });

  describe('dentro de un contexto', () => {
    it('expone el requestId del store', () => {
      withStore({ requestId: 'abc123' }, () => {
        expect(getRequestId()).toBe('abc123');
        expect(getRequestStore()).toEqual({ requestId: 'abc123' });
      });
    });

    it('setContextValue escribe en el store activo', () => {
      withStore({ requestId: 'r1' }, () => {
        setContextValue('inspection_id', 97125);
        expect(getRequestStore()?.inspection_id).toBe(97125);
      });
    });

    it('setUser y getUser registran/leen el usuario', () => {
      withStore({ requestId: 'r1' }, () => {
        setUser({ id: 4471, name: 'jorge.aguilar', email: 'j@dy.com' });
        expect(getUser()).toEqual({ id: 4471, name: 'jorge.aguilar', email: 'j@dy.com' });
      });
    });

    it('aísla el contexto entre ejecuciones concurrentes', async () => {
      const seen: Array<string | undefined> = [];
      await Promise.all([
        new Promise<void>((resolve) =>
          withStore({ requestId: 'A' }, async () => {
            await Promise.resolve();
            seen.push(getRequestId());
            resolve();
          }),
        ),
        new Promise<void>((resolve) =>
          withStore({ requestId: 'B' }, async () => {
            await Promise.resolve();
            seen.push(getRequestId());
            resolve();
          }),
        ),
      ]);
      expect(seen.sort()).toEqual(['A', 'B']);
    });

    it('el contexto persiste a través de awaits', async () => {
      await withStore({ requestId: 'persist' }, async () => {
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 1));
        expect(getRequestId()).toBe('persist');
      });
    });
  });
});

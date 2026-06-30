import { RequestContextMiddleware } from './request-context.middleware';
import { getRequestId } from '../context/als';

function makeRes() {
  return { setHeader: jest.fn(), headersSent: false };
}

describe('RequestContextMiddleware', () => {
  it('genera un ULID cuando no llega header y abre el contexto ALS', () => {
    const mw = new RequestContextMiddleware({});
    const req: any = { headers: {} };
    const res = makeRes();
    let idDentro: string | undefined;

    mw.use(req, res, () => {
      idDentro = getRequestId();
    });

    expect(idDentro).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(req.headers['x-request-id']).toBe(idDentro);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', idDentro);
  });

  it('reutiliza el request_id entrante (correlación entre servicios)', () => {
    const mw = new RequestContextMiddleware({});
    const req: any = { headers: { 'x-request-id': 'upstream-123' } };
    const res = makeRes();
    let idDentro: string | undefined;

    mw.use(req, res, () => {
      idDentro = getRequestId();
    });

    expect(idDentro).toBe('upstream-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'upstream-123');
  });

  it('respeta un header de correlación personalizado', () => {
    const mw = new RequestContextMiddleware({ requestIdHeader: 'X-Correlation-Id' });
    const req: any = { headers: { 'x-correlation-id': 'corr-7' } };
    const res = makeRes();
    let idDentro: string | undefined;

    mw.use(req, res, () => {
      idDentro = getRequestId();
    });

    expect(idDentro).toBe('corr-7');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'corr-7');
  });

  it('llama next exactamente una vez', () => {
    const mw = new RequestContextMiddleware({});
    const next = jest.fn();
    mw.use({ headers: {} }, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('no escribe header si la respuesta ya lo envió', () => {
    const mw = new RequestContextMiddleware({});
    const res = { setHeader: jest.fn(), headersSent: true };
    mw.use({ headers: {} }, res, () => undefined);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('ignora un header entrante vacío y genera uno', () => {
    const mw = new RequestContextMiddleware({});
    const req: any = { headers: { 'x-request-id': '' } };
    let idDentro: string | undefined;
    mw.use(req, makeRes(), () => {
      idDentro = getRequestId();
    });
    expect(idDentro).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('fuera del callback no hay contexto (el store no se filtra)', () => {
    const mw = new RequestContextMiddleware({});
    mw.use({ headers: {} }, makeRes(), () => undefined);
    expect(getRequestId()).toBeUndefined();
  });
});

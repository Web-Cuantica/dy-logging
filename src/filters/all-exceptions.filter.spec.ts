import { HttpException, HttpStatus, BadRequestException, ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { requestContext } from '../context/als';

function createLoggerMock() {
  return { setContext: jest.fn(), error: jest.fn(), warn: jest.fn() };
}

/** Arma un ArgumentsHost HTTP falso con req/res controlados. */
function makeHost(req: any, res: any): ArgumentsHost {
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;
}

function makeRes() {
  const res: any = {
    statusCode: 0,
    body: undefined,
    status: jest.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function (this: any, b: unknown) {
      this.body = b;
      return this;
    }),
  };
  return res;
}

describe('AllExceptionsFilter', () => {
  let logger: ReturnType<typeof createLoggerMock>;
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    logger = createLoggerMock();
    filter = new AllExceptionsFilter(logger as any);
  });

  it('fija el contexto del logger a ExceptionFilter', () => {
    expect(logger.setContext).toHaveBeenCalledWith('ExceptionFilter');
  });

  it('una excepción no-HTTP se trata como 500 y se loguea como error', () => {
    const req = { method: 'POST', url: '/x' };
    const res = makeRes();
    filter.catch(new Error('kaboom'), makeHost(req, res));

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [payload, msg] = logger.error.mock.calls[0];
    expect(msg).toBe('Unhandled exception');
    expect(payload.http).toEqual({ method: 'POST', url: '/x', status_code: 500 });
    expect(payload.err).toBeInstanceOf(Error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ statusCode: 500, message: 'Internal server error' });
  });

  it('una HttpException 4xx se loguea como warn y responde el body original', () => {
    const res = makeRes();
    filter.catch(new BadRequestException('faltan campos'), makeHost({ method: 'GET', url: '/y' }, res));

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
    const [payload, msg] = logger.warn.mock.calls[0];
    expect(msg).toBe('Handled exception');
    expect(payload.http.status_code).toBe(400);
    expect(res.status).toHaveBeenCalledWith(400);
    // BadRequestException serializa un objeto con statusCode/message.
    expect(res.body).toMatchObject({ statusCode: 400, message: 'faltan campos' });
  });

  it('una HttpException 5xx se loguea como error', () => {
    const res = makeRes();
    const ex = new HttpException('upstream caído', HttpStatus.BAD_GATEWAY);
    filter.catch(ex, makeHost({ method: 'GET', url: '/z' }, res));

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('envuelve un response string de HttpException en {statusCode,message}', () => {
    const res = makeRes();
    // Una HttpException cuyo getResponse() es un string.
    const ex = new HttpException('texto plano', HttpStatus.FORBIDDEN);
    filter.catch(ex, makeHost({ method: 'GET', url: '/f' }, res));
    expect(res.body).toEqual({ statusCode: 403, message: 'texto plano' });
  });

  it('serializa una excepción que no es Error (string) bajo err.message', () => {
    const res = makeRes();
    filter.catch('algo raro', makeHost({ method: 'GET', url: '/r' }, res));
    const [payload] = logger.error.mock.calls[0];
    expect(payload.err).toEqual({ message: 'algo raro' });
  });

  it('incluye el request_id del contexto ALS', () => {
    const res = makeRes();
    requestContext.run({ requestId: 'rid-err' }, () => {
      filter.catch(new Error('x'), makeHost({ method: 'GET', url: '/c' }, res));
    });
    const [payload] = logger.error.mock.calls[0];
    expect(payload.request_id).toBe('rid-err');
  });

  it('no truena si no hay objeto response disponible', () => {
    expect(() =>
      filter.catch(new Error('x'), makeHost({ method: 'GET', url: '/n' }, undefined)),
    ).not.toThrow();
  });
});

import { Test } from '@nestjs/testing';
import { APP_FILTER } from '@nestjs/core';
import { LoggingModule } from './logging.module';
import { DyLogger } from './logger/dy-logger.service';
import { RequestContextService } from './context/request-context.service';
import { RequestContextMiddleware } from './middleware/request-context.middleware';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { LOGGING_OPTIONS } from './constants';

describe('LoggingModule (integración Nest)', () => {
  it('forRoot() arma un módulo global con los providers públicos', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggingModule.forRoot({ serviceName: 'test-svc', env: 'qa' })],
    }).compile();

    // DyLogger es TRANSIENT -> se obtiene con resolve(), no con get().
    await expect(moduleRef.resolve(DyLogger)).resolves.toBeInstanceOf(DyLogger);
    expect(moduleRef.get(RequestContextService, { strict: false })).toBeInstanceOf(
      RequestContextService,
    );
    expect(moduleRef.get(RequestContextMiddleware, { strict: false })).toBeInstanceOf(
      RequestContextMiddleware,
    );
  });

  it('registra el AllExceptionsFilter por defecto', () => {
    const dynamic = LoggingModule.forRoot();
    const filterProvider = (dynamic.providers || []).find(
      (p: any) => p && p.provide === APP_FILTER,
    ) as any;
    expect(filterProvider).toBeDefined();
    expect(filterProvider.useClass).toBe(AllExceptionsFilter);
  });

  it('omite el filtro global con registerGlobalExceptionFilter:false', () => {
    const dynamic = LoggingModule.forRoot({ registerGlobalExceptionFilter: false });
    const filterProvider = (dynamic.providers || []).find(
      (p: any) => p && p.provide === APP_FILTER,
    );
    expect(filterProvider).toBeUndefined();
  });

  it('expone las opciones bajo el token LOGGING_OPTIONS', async () => {
    const opts = { serviceName: 'token-svc', healthSampleRate: 5 };
    const moduleRef = await Test.createTestingModule({
      imports: [LoggingModule.forRoot(opts)],
    }).compile();
    expect(moduleRef.get(LOGGING_OPTIONS, { strict: false })).toEqual(opts);
  });

  it('marca el módulo como global', () => {
    expect(LoggingModule.forRoot().global).toBe(true);
  });

  it('configure() aplica el middleware a todas las rutas', () => {
    const apply = jest.fn().mockReturnValue({ forRoutes: jest.fn() });
    const consumer: any = { apply };
    new LoggingModule().configure(consumer);
    expect(apply).toHaveBeenCalledWith(RequestContextMiddleware);
    expect(apply().forRoutes).toHaveBeenCalledWith('*');
  });
});

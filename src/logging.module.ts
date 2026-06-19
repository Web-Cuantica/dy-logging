import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  Provider,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { LOGGING_OPTIONS } from './constants';
import { LoggingModuleOptions } from './types';
import { buildPinoHttpOptions } from './pino/pino-options.factory';
import { RequestContextMiddleware } from './middleware/request-context.middleware';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { RequestContextService } from './context/request-context.service';
import { DyLogger } from './logger/dy-logger.service';

/**
 * Modulo de logging homologado para todos los microservicios.
 *
 * Uso:
 *   @Module({ imports: [LoggingModule.forRoot()] })
 *   export class AppModule {}
 *
 * Es global: una sola importacion en AppModule basta. Expone el Logger de
 * nestjs-pino, el DyLogger y el RequestContextService a toda la app.
 */
@Module({})
export class LoggingModule implements NestModule {
  static forRoot(options: LoggingModuleOptions = {}): DynamicModule {
    const optionsProvider: Provider = {
      provide: LOGGING_OPTIONS,
      useValue: options,
    };

    const providers: Provider[] = [
      optionsProvider,
      RequestContextService,
      RequestContextMiddleware,
      DyLogger,
    ];

    if (options.registerGlobalExceptionFilter !== false) {
      providers.push({ provide: APP_FILTER, useClass: AllExceptionsFilter });
    }

    return {
      module: LoggingModule,
      global: true,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: buildPinoHttpOptions(options) as any,
        }),
      ],
      providers,
      exports: [LoggerModule, RequestContextService, DyLogger],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

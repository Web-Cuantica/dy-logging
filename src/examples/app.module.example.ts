/**
 * Ejemplo de integración en un microservicio. NO se compila en el build
 * (está excluido en tsconfig). Cópialo como referencia.
 */
import { Module, OnModuleInit, Injectable } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import {
  LoggingModule,
  createTracePropagationInterceptor,
} from '@dy/logging';

/**
 * 1) Importa LoggingModule.forRoot() una sola vez en AppModule.
 *    Sin argumentos, lee SERVICE_NAME / NODE_ENV / APP_VERSION / LOG_LEVEL
 *    del entorno. También puedes pasarlos explícitos.
 */
@Module({
  imports: [
    LoggingModule.forRoot({
      // serviceName: 'my-service',  // o via env SERVICE_NAME
      // env: 'production',             // o via env NODE_ENV
      // version: '1.4.2',              // o via env APP_VERSION
      // level: 'info',                 // o via env LOG_LEVEL
      healthSampleRate: 20,             // 1 de cada 20 health-checks
    }),
    HttpModule,
  ],
  providers: [HttpTracePropagationBootstrap],
})
export class AppModule {}

/**
 * 2) Para que el request_id viaje a los servicios downstream, engancha el
 *    interceptor de Axios al HttpService.
 */
@Injectable()
export class HttpTracePropagationBootstrap implements OnModuleInit {
  constructor(private readonly http: HttpService) {}

  onModuleInit(): void {
    this.http.axiosRef.interceptors.request.use(createTracePropagationInterceptor());
  }
}

/**
 * 3) En main.ts, usa el Logger de nestjs-pino como logger de la app:
 *
 *   import { NestFactory } from '@nestjs/core';
 *   import { Logger } from '@dy/logging';
 *   import { AppModule } from './app.module';
 *
 *   async function bootstrap() {
 *     const app = await NestFactory.create(AppModule, { bufferLogs: true });
 *     app.useLogger(app.get(Logger));
 *     await app.listen(3000);
 *   }
 *   bootstrap();
 *
 * 4) En tus servicios, inyecta el logger y loguea objetos estructurados:
 *
 *   import { PinoLogger, InjectPinoLogger } from '@dy/logging';
 *
 *   @Injectable()
 *   export class ReceiptService {
 *     constructor(
 *       @InjectPinoLogger(ReceiptService.name)
 *       private readonly logger: PinoLogger,
 *     ) {}
 *
 *     approve(rcptId: number) {
 *       this.logger.info(
 *         { data: { rcpt_id: rcptId, movement_type: 'Devolucion' } },
 *         'Recibo aprobado',
 *       );
 *     }
 *   }
 */

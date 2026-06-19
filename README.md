# @dy/logging

Librería de logging **homologada** para todos los microservicios NestJS. Una sola importación te da:

- **Logs JSON estructurados** (pino) listos para DataDog — sin colores ANSI, un evento = una línea.
- **`request_id` de correlación** que se propaga entre servicios vía header HTTP.
- **Integración automática con DataDog APM** (`dd.trace_id` / `dd.span_id`) si `dd-trace` está activo — y funciona igual si no lo está.
- **Redacción de secrets y PII** (emails, VIN, tokens, authorization, etc.) antes de salir al log.
- **Muestreo de health-checks** (1 de cada 20 por defecto) para no inundar DataDog.
- **Nivel de log por ambiente** vía `LOG_LEVEL`.
- **Filtro global de excepciones** con stack estructurado.

---

## Instalación

```bash
npm install @dy/logging
```

Peer dependencies (ya presentes en cualquier proyecto Nest): `@nestjs/common`, `@nestjs/core`, `rxjs`.
`dd-trace` es **opcional**: si el servicio lo tiene, la lib lo detecta solo.

> Distribución: el paquete es **standalone publicable**. Funciona igual si lo publicas en un registry privado (Artifactory/npm), lo instalas por git, o lo colocas como librería interna en un monorepo (Nx/Turbo). No hay que cambiar nada del código.

---

## Uso en 3 pasos

### 1. Importa el módulo en `AppModule`

```ts
import { Module } from '@nestjs/common';
import { LoggingModule } from '@dy/logging';

@Module({
  imports: [LoggingModule.forRoot()], // lee SERVICE_NAME / NODE_ENV / APP_VERSION / LOG_LEVEL del entorno
})
export class AppModule {}
```

Es **global**: una sola importación basta para toda la app.

### 2. Conéctalo como logger de la app en `main.ts`

```ts
import { NestFactory } from '@nestjs/core';
import { Logger } from '@dy/logging';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.listen(3000);
}
bootstrap();
```

### 3. Loguea desde tus servicios con `DyLogger` (recomendado)

`DyLogger` es un wrapper ergonomico: **mensaje primero, atributos en un objeto plano** (sin `{ data: {} }`). Los atributos quedan al tope del JSON, filtrables en DataDog como `@eco`, `@sales_order`, etc.

```ts
import { Injectable } from '@nestjs/common';
import { DyLogger } from '@dy/logging';

@Injectable()
export class ReceiptService {
  constructor(private readonly logger: DyLogger) {
    this.logger.setContext(ReceiptService.name);
  }

  approve(rcptId: number) {
    // mensaje primero, atributos planos despues -> sin { data: {} }
    this.logger.info('Recibo aprobado', {
      eco: '12346A4',
      sales_order: 1345678,
      client: 'ACME Corp',
    });
  }

  fail(err: Error) {
    // error/fatal aceptan un Error directo: se serializa type/message/stack
    this.logger.error('Fallo al aprobar', err);
  }
}
```

Produce:

```json
{
  "timestamp": "2026-06-19T17:41:09.286Z",
  "status": "info",
  "service": "orders-service",
  "env": "production",
  "version": "1.4.2",
  "request_id": "01J8XK9...",
  "logger": { "name": "ReceiptService" },
  "eco": "12346A4",
  "sales_order": 1345678,
  "message": "Recibo aprobado"
}
```

> Nombres reservados a evitar como llaves (los usa la infraestructura): `timestamp`, `level`, `status`, `message`, `service`, `env`, `version`, `request_id`, `dd`, `logger`, `http`, `network`, `duration`, `error`.

Si prefieres el estilo nativo de pino (objeto primero), tambien puedes inyectar `PinoLogger` directamente:

```ts
import { PinoLogger, InjectPinoLogger } from '@dy/logging';

@InjectPinoLogger(ReceiptService.name) private readonly logger: PinoLogger;
this.logger.info({ eco: '12346A4' }, 'Recibo aprobado');
```

---

## Propagación del `request_id` entre servicios

El id de correlación se genera (ULID) o se reutiliza del header entrante, y vive en un `AsyncLocalStorage` durante todo el request. Para que viaje a los servicios **downstream**, engancha el interceptor de Axios:

```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { createTracePropagationInterceptor } from '@dy/logging';

@Injectable()
export class HttpBootstrap implements OnModuleInit {
  constructor(private readonly http: HttpService) {}
  onModuleInit() {
    this.http.axiosRef.interceptors.request.use(createTracePropagationInterceptor());
  }
}
```

Con esto, `orders-service` → `billing-service` comparten el mismo `request_id`. En DataDog filtras por `@request_id:<id>` y ves el flujo completo cruzando ambos servicios.

> Si además activas **dd-trace** (APM), DataDog propaga su propio trace context automáticamente y la lib inyecta `dd.trace_id`/`dd.span_id` para correlacionar logs ↔ traces. Los dos mecanismos conviven.

---

## Esquema JSON del log

Los logs siguen los **atributos estandar de DataDog**, asi el panel enciende sus secciones (Logger Name, HTTP, Error, duracion) sin configurar pipelines.

**Log de negocio** (limpio, campos de negocio planos):

```json
{
  "timestamp": "2026-06-19T17:41:09.286Z",
  "status": "info",
  "service": "orders-service",
  "env": "production",
  "version": "1.4.2",
  "request_id": "01J8XK9...",
  "dd": { "trace_id": "...", "span_id": "..." },
  "logger": { "name": "ReceiptService" },
  "eco": "12346A4",
  "sales_order": 1345678,
  "rcpt_id": 87772,
  "movement_type": "Devolucion",
  "message": "Recibo 87772 aprobado"
}
```

**Log HTTP** (linea automatica de "request completed"):

```json
{
  "timestamp": "2026-06-19T17:41:09.298Z",
  "status": "info",
  "service": "orders-service",
  "env": "production",
  "request_id": "01J8XK9...",
  "http": { "method": "PATCH", "url": "/receipt/update-status", "status_code": 200 },
  "network": { "client": { "ip": "10.5.20.244" } },
  "duration": 269000000,
  "message": "request completed"
}
```

**Log de error** (`logger.error('...', err)`): incluye `error.kind`, `error.message` y `error.stack`, que DataDog muestra en la pestana Error.

| Concepto | Atributo estandar de DataDog |
|---|---|
| Fecha del evento | `timestamp` |
| Severidad | `status` |
| Clase/logger | `logger.name` |
| HTTP | `http.method`, `http.url`, `http.status_code` |
| IP cliente | `network.client.ip` |
| Latencia (ns) | `duration` |
| Error | `error.kind`, `error.message`, `error.stack` |
| Correlacion | `request_id`, `dd.trace_id`, `dd.span_id` |

Los campos de negocio (`eco`, `sales_order`, `rcpt_id`...) quedan planos al tope, filtrables como `@eco`, `@sales_order`.

---

## Configuración

Todo es opcional; por defecto se lee del entorno.

| Opción | Default | Descripción |
|---|---|---|
| `serviceName` | `SERVICE_NAME` | Nombre del servicio (atributo `service`). |
| `env` | `NODE_ENV` | Ambiente (atributo `env`). |
| `version` | `APP_VERSION` | Versión (atributo `version`). |
| `level` | `LOG_LEVEL` o default por ambiente | Nivel mínimo. |
| `requestIdHeader` | `x-request-id` | Header de correlación. |
| `healthSampleRate` | `20` | Conserva 1 de cada N logs de health. `1` = sin muestreo. |
| `healthPaths` | regex de actuator/health/ping | Rutas tratadas como health. |
| `redactPaths` | — | Rutas extra a redactar (se suman a las default). |
| `registerGlobalExceptionFilter` | `true` | Registra el filtro global de excepciones. |
| `pinoHttp` | — | Escape hatch: opciones crudas de pino-http. |

### Nivel por ambiente

Si no defines `level` ni `LOG_LEVEL`, se aplica según `NODE_ENV`:

| Ambiente | Nivel |
|---|---|
| local / dev / development | `debug` |
| qa / staging / uat | `info` |
| prod / production | `info` |

Niveles válidos (de menor a mayor): `trace < debug < info < warn < error < fatal`.

---

## Variables de entorno

```bash
SERVICE_NAME=orders-service
NODE_ENV=production
APP_VERSION=1.4.2
LOG_LEVEL=info
```

---

## Recomendaciones en DataDog

1. Activa la **correlación logs ↔ traces** (usa `dd.trace_id`).
2. Crea **facets** sobre `service`, `env`, `request_id`, `status`, `http.status_code`.
3. Define un **pipeline** que mapee `status` a la severidad y `request_id` como atributo de correlación.
4. Si quieres aún menos ruido en prod, sube `LOG_LEVEL` a `warn` para servicios muy chatos.

---

## Notas de compatibilidad

- NestJS 9 y 10: soportado tal cual.
- NestJS 11 (Express 5): el wildcard de middleware cambió; usa `forRoutes('{*path}')` si ves un warning. La lib lo ajustará en una versión futura.

---
marp: true
theme: default
paginate: true
title: "@dy/logging — Logging homologado para DataDog"
description: "Propuesta de estandarización de logging para los microservicios DY — Arquitectura TIP"
---

<!--
Presentación para el Arquitecto de TIP.
Render como slides: `npx @marp-team/marp-cli docs/presentacion-tip.md -o presentacion-tip.pdf`
También se lee bien como documento plano.
-->

# @dy/logging
## Logging homologado para DataDog

Estandarización de observabilidad para los microservicios DY (NestJS)

**Presenta:** Equipo DY · **Audiencia:** Arquitectura TIP
**Fecha:** Junio 2026

---

## El problema hoy

Cada microservicio loguea **a su manera**:

- Formatos distintos (texto plano, `console.log`, JSON parcial).
- Sin un `id` de correlación que cruce servicios → **imposible seguir una operación punta a punta**.
- Datos de negocio "sepultados" dentro del texto del mensaje → **no se pueden filtrar ni agregar** en DataDog.
- Secrets y PII (emails, VIN, tokens) que **se filtran al log** sin control.
- Health-checks inundando el volumen (y el costo) de DataDog.

> Resultado: depurar un incidente que cruza 3 servicios es arqueología manual.

---

## La propuesta

Una librería **única y homologada**: `@dy/logging`

Una sola importación en cada servicio da:

- ✅ **Logs JSON estructurados** (pino) listos para DataDog — un evento = una línea.
- ✅ **`request_id` de correlación** que se propaga por header HTTP entre servicios.
- ✅ **Atributos estándar de DataDog** — el panel enciende sus secciones sin configurar pipelines.
- ✅ **Redacción automática** de secrets y PII antes de salir al log.
- ✅ **Muestreo de health-checks** (1 de cada 20) para controlar volumen/costo.
- ✅ **Correlación logs ↔ traces** vía `dd-trace` (APM) si está activo.

---

## En qué estándares de mercado nos apoyamos

No inventamos un formato propio: seguimos las buenas prácticas reconocidas.

| Capa | Estándar de mercado | Cómo lo aplicamos |
|---|---|---|
| **Formato de log** | Structured Logging (JSON) | pino, un evento por línea |
| **Esquema de atributos** | DataDog Std Attributes / alineable a ECS · OTel | `service`, `env`, `logger.name`, `http.*`, `error.*`, `usr.*` |
| **Severidad** | RFC 5424 (Syslog levels) | `trace < debug < info < warn < error < fatal` |
| **Correlación** | `request_id` (de-facto, estilo Envoy/NGINX) | header `x-request-id` propagado |
| **Tracing (opcional)** | W3C Trace Context / OpenTelemetry | vía `dd-trace`: `dd.trace_id`, `dd.span_id` |

> Diseñado **DataDog-first**, pero mapeable a OTel/ECS si TIP cambia de stack.

---

## El estándar: mensaje + atributos (Structured Logging)

**Regla de oro:** el `message` es para humanos; los **datos van como atributos filtrables**.

```ts
this.logger.info('Recibo 87772 aprobado', {
  eco: '12346A4',
  sales_order: 1345678,
  rcpt_id: 87772,
  movement_type: 'Devolucion',
});
```

- **Content limpio** → legible de un vistazo en DataDog.
- **Datos filtrables** → `@eco:12346A4`, `@sales_order:1345678`, `@rcpt_id:87772`.
- Campos de negocio **planos** y en **`snake_case`**, consistentes entre servicios.

---

## Antes vs. después

**❌ Antes** (texto plano — no filtrable):
```
Error en inspeccion 97125 del usuario 4471 en zona LAT-IZQ: lock timeout
```

**✅ Después** (mensaje legible + atributos + error estructurado):
```json
{
  "status": "error",
  "service": "dyinspectionws",
  "request_id": "01J8XK9...",
  "logger": { "name": "InspectionService" },
  "message": "Fallo al guardar daño en inspeccion 97125",
  "inspection_id": 97125,
  "zone_type": "LAT-IZQ",
  "usr": { "id": 4471 },
  "error": { "kind": "QueryFailedError", "message": "ER_LOCK_WAIT_TIMEOUT...", "stack": "..." }
}
```

---

## Trazabilidad entre servicios

El `request_id` se genera (ULID) o se reutiliza del header entrante, vive en un
`AsyncLocalStorage` durante todo el request y **viaja a los servicios downstream**.

```
dyentryws  ──[x-request-id: 01J8XK9...]──►  dyinspectionws  ──►  dyfilews
```

En DataDog: filtras `@request_id:01J8XK9...` y ves **el flujo completo cruzando los 3 servicios**.

> Con `dd-trace` activo, además se correlacionan **logs ↔ traces** (`dd.trace_id` / `dd.span_id`)
> usando **W3C Trace Context** — el estándar de OpenTelemetry.

---

## Integración con DataDog (lo que TIP ya tiene)

Los logs usan los **nombres reservados de DataDog**, así el panel funciona sin esfuerzo:

| Concepto | Atributo |
|---|---|
| Severidad | `status` |
| Servicio / ambiente / versión | `service`, `env`, `version` |
| HTTP | `http.method`, `http.url`, `http.status_code` |
| Latencia | `duration` (ns) |
| Error | `error.kind`, `error.message`, `error.stack` |
| Correlación | `request_id`, `dd.trace_id`, `dd.span_id` |

**Checklist de despliegue:** `source: nodejs` · Unified Service Tagging (`DD_ENV`/`DD_SERVICE`/`DD_VERSION`) · `--enable-source-maps` · facets sobre `service`/`env`/`status`/`request_id`.

---

## Adopción: 3 pasos por servicio

```ts
// 1. AppModule
imports: [LoggingModule.forRoot()]

// 2. main.ts
app.useLogger(app.get(Logger));

// 3. En cualquier servicio
constructor(private readonly logger: DyLogger) {
  this.logger.setContext(MyService.name);
}
this.logger.info('Algo pasó', { campo_negocio: 123 });
```

- **Cero configuración** obligatoria: lee `SERVICE_NAME` / `NODE_ENV` / `APP_VERSION` / `LOG_LEVEL` del entorno.
- `dd-trace` es **opcional** — la lib lo detecta sola.

---

## Alcance: 16 microservicios NestJS (`c:/dy/`)

| | | | |
|---|---|---|---|
| dycatalogws | dyconfigurationws | dyentryws | dyfilews |
| dyfleetws | dyhumanresourcesws | dyinputoutputws | dyinspectionws |
| dyinterfacews | dynotificationws | dyproductivityws | dyrebillws |
| dyreportws | dysecurityws | dysyncws | dyworkorderws |

**Fuera de alcance:** `dyappweb` (Angular 19) y `dytipiows` (.NET) — no son NestJS.

> Misma librería, misma versión, mismo esquema de log en los 16 → **observabilidad consistente en toda la suite**.

---

## Beneficios para TIP

- 🔎 **MTTR menor:** seguir un incidente cruzando servicios con un solo filtro (`@request_id`).
- 📊 **Dashboards reutilizables:** todos los servicios emiten el mismo esquema → un dashboard sirve para todos.
- 💰 **Control de costo:** muestreo de health-checks y nivel por ambiente reducen volumen en DataDog.
- 🔐 **Seguridad/cumplimiento:** redacción automática de PII/secrets (OWASP-friendly).
- 🧩 **Sin lock-in fuerte:** esquema mapeable a OpenTelemetry / ECS si cambia el stack.
- ⚙️ **Bajo esfuerzo de adopción:** 3 líneas por servicio, sin reescribir lógica.

---

## Decisiones abiertas para el arquitecto

1. **Distribución del paquete:** ¿registry privado (Artifactory/npm), git, o monorepo?
2. **`dd-trace` (APM):** ¿lo activamos en prod para correlación logs↔traces?
3. **Trace Context:** ¿migramos a futuro de `x-request-id` a `traceparent` (W3C) full?
4. **`LOG_LEVEL` en prod:** ¿`info` general o `warn` para servicios muy chatos?
5. **Roadmap de adopción:** ¿servicio piloto (sugerido: `dyinspectionws`) → resto por olas?

---

## Próximos pasos sugeridos

1. **Validación de arquitectura** con TIP (esta sesión).
2. **Piloto** en `dyinspectionws` — medir antes/después en DataDog.
3. **Definir distribución** del paquete y pipeline de versionado.
4. **Roll-out por olas** a los 16 servicios.
5. **Dashboards y facets** estándar en DataDog.

---

# Gracias

**Repos / referencia:**
- Librería: `@dy/logging` (`c:/Code/dy-logging`)
- Estándar detallado: [`LOGGING_STANDARDS.md`](../LOGGING_STANDARDS.md)
- Guía de uso: [`README.md`](../README.md)

¿Preguntas?

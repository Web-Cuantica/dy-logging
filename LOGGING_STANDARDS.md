# Estándar de Logging — @dy/logging

Guía de cómo logueamos en los microservicios (NestJS + DataDog). El objetivo
es que **todos los servicios logueen igual**, que los logs sean útiles para
operar y depurar, y que cumplan las mejores prácticas de DataDog.

---

## 1. Principios

1. **JSON siempre, nunca texto plano.** Un evento = una línea JSON. El texto
   plano (estilo access-log de NGINX) no se puede filtrar; el JSON sí.
2. **El `message` es para humanos; los datos van en atributos.** La columna
   *Content* de DataDog muestra el `message`. Mantenlo corto y legible; todo
   lo estructurado (ids, montos, status) va como atributo aparte.
3. **Atributos estándar de DataDog.** Usar los nombres reservados para que el
   panel encienda sus secciones (Logger Name, HTTP, Error, User, duración).
4. **Nunca secrets ni PII en el log.** La librería redacta automáticamente,
   pero no metas datos sensibles a propósito.
5. **Loguea con intención.** No todo. Instrumenta los puntos de negocio que
   importan y los errores. El ruido (health-checks) va muestreado.

---

## 2. Anatomía de un buen log

```json
{
  "timestamp": "2026-06-19T18:17:12.595Z",
  "status": "info",
  "service": "dyinspectionws",
  "env": "qa",
  "version": "1.0.1",
  "logger": { "name": "InspectionService" },
  "request_id": "01J1781893030595000",
  "usr": { "id": 4471, "name": "jorge.aguilar" },
  "message": "Inspeccion 97125: daño guardado en zona LAT-IZQ (orden 1)",
  "inspection_id": 97125,
  "movement_type": "E",
  "zone_type": "LAT-IZQ",
  "danos_count": 5
}
```

- **Content limpio** (el `message`), **datos filtrables** como `@inspection_id`,
  `@zone_type`, `@usr.id`.

---

## 3. El `message` / columna Content

DataDog muestra en *Content* el atributo `message`. Reglas:

- **Corto, claro y en presente/pasado.** Describe QUÉ pasó, con el dato clave
  más importante incrustado para leerlo de un vistazo.
- **No metas en el texto lo que ya es atributo** (no repitas el `status`, el
  `service` ni el `trace_id` dentro del mensaje).
- **Hazlo un poco narrativo cuando aporte.** Ejemplos:
  - 🟡 ok pero seco: `Dano guardado`
  - 🟢 mejor: `Inspeccion 97125: daño guardado en zona LAT-IZQ (orden 1)`

> **Sobre el estilo "denso" tipo logback** (ej.
> `2019-07-05 18:58:15 ERROR CoffeeHouse:240 - <trace_id> <span_id> - java.lang.InterruptedException: ... - 500`):
> ese formato mete timestamp, nivel, `logger:línea`, los IDs de trace y la
> excepción **dentro de una sola cadena de texto**. Se ve rico, pero es el
> estilo viejo de Java/logback: no se puede filtrar por esas piezas. En
> nuestro JSON **todas esas piezas ya existen como atributos separados**
> (`timestamp`, `status`, `logger.name`, `dd.trace_id`, `dd.span_id`,
> `error.kind`, `error.message`), que es lo que DataDog recomienda. DataDog
> puede *mostrarlas* compuestas si quieres ese look, sin perder el filtrado.

---

## 4. Niveles (`status`)

| Nivel | Cuándo usarlo |
|---|---|
| `trace` | Detalle muy fino, solo para depurar en local. |
| `debug` | Diagnóstico de desarrollo (default en dev). |
| `info` | Eventos de negocio normales (inspección creada, daño guardado). |
| `warn` | Algo recuperable o inesperado pero no fatal (reintento, 4xx). |
| `error` | Falló una operación (excepción, 5xx). Siempre con el `Error`. |
| `fatal` | El servicio no puede continuar. |

Nivel mínimo por ambiente: dev → `debug`, qa/staging → `info`, prod → `info`
(o `warn` si quieres menos ruido). Se controla con `LOG_LEVEL`.

---

## 5. Atributos estándar de DataDog

Usar **estos nombres** para que el panel los reconozca:

| Concepto | Atributo |
|---|---|
| Fecha del evento | `timestamp` |
| Severidad | `status` |
| Servicio / ambiente / versión | `service`, `env`, `version` |
| Clase que loguea | `logger.name` |
| HTTP | `http.method`, `http.url`, `http.status_code` |
| IP del cliente | `network.client.ip` |
| Latencia (ns) | `duration` |
| Error | `error.kind`, `error.message`, `error.stack` |
| Usuario | `usr.id`, `usr.name`, `usr.email` |
| Correlación | `request_id`, `dd.trace_id`, `dd.span_id` |

**Nombres reservados — NO usar como llave de negocio:** `timestamp`, `level`,
`status`, `message`, `service`, `env`, `version`, `request_id`, `dd`,
`logger`, `http`, `network`, `duration`, `error`, `usr`.

---

## 6. Campos de negocio

- **Planos al tope** (no anidados en `data`), en **`snake_case`**:
  `inspection_id`, `movement_type`, `eco`, `sales_order`, `rcpt_id`.
- Filtrables como `@inspection_id:97125`, `@movement_type:E`.
- Consistencia entre servicios: mismo nombre para el mismo concepto.

```ts
this.logger.info('Inspeccion 97125: daño guardado en zona LAT-IZQ (orden 1)', {
  inspection_id: 97125,
  zone_type: 'LAT-IZQ',
  dano_order: 1,
  danos_count: 5,
});
```

---

## 7. Errores

- **Siempre pasa el `Error` real**, no un string:
  ```ts
  this.logger.error('Fallo al guardar daño', err); // -> error.kind/message/stack
  ```
- El stack se captura completo. Con **source maps activados**
  (`--enable-source-maps`) apunta al **`.ts:línea`**, no al `.js`.
- Para errores con contexto de negocio, pasa un objeto con `err` + campos:
  ```ts
  this.logger.error('Fallo al guardar daño', {
    err: error, inspection_id: headerId, zone_type: zoneType,
  });
  ```

---

## 8. Correlación y trazabilidad

- **`request_id`**: generado (ULID) o reutilizado del header `x-request-id`.
  Filtra `@request_id:<id>` para ver toda la secuencia de una operación.
- **Entre servicios**: el `request_id` se propaga por header HTTP, así ves el
  flujo cruzando microservicios.
- **dd-trace (APM)**: si está activo, inyecta `dd.trace_id`/`dd.span_id` y
  DataDog correlaciona logs ↔ traces. Recomendado en prod.

---

## 9. Volumen y ruido

- Health-checks (`/actuator/health`, `/ping`): muestreados (1 de cada 20).
- HTTP automático: apagable con `autoHttpLogging: false` cuando solo quieres
  instrumentar puntos de negocio.
- No loguees payloads completos ni respuestas grandes.

---

## 10. Checklist al desplegar a DataDog

- [ ] El Agent recolecta el stdout del pod (Kubernetes autodiscovery).
- [ ] `source: nodejs` para que DataDog aplique el pipeline de pino.
- [ ] Unified Service Tagging: `DD_ENV`, `DD_SERVICE`, `DD_VERSION` en el
      manifiesto del deploy.
- [ ] `--enable-source-maps` activo (stack traces en `.ts`).
- [ ] (Opcional) dd-trace para correlación logs↔traces.
- [ ] Facets creados sobre `service`, `env`, `status`, `request_id`,
      `logger.name`, y los de negocio (`inspection_id`, `movement_type`...).

---

## 11. Bueno vs. malo

**❌ Malo** (texto plano, datos en el mensaje, sin estructura):
```
Error en inspeccion 97125 del usuario 4471 en zona LAT-IZQ: lock timeout
```

**✅ Bueno** (mensaje legible + atributos filtrables + error estructurado):
```json
{
  "status": "error",
  "logger": { "name": "InspectionService" },
  "message": "Fallo al guardar daño en inspeccion 97125",
  "inspection_id": 97125,
  "zone_type": "LAT-IZQ",
  "usr": { "id": 4471 },
  "error": {
    "kind": "QueryFailedError",
    "message": "ER_LOCK_WAIT_TIMEOUT: tiempo de espera agotado",
    "stack": "QueryFailedError: ...\n  at InspectionService.savetInspectionZoneActivities (inspection.service.ts:2703:13)"
  }
}
```

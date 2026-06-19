/**
 * Auto-detección de dd-trace (DataDog APM).
 *
 * Si el servicio ya inicializó dd-trace, extraemos el trace_id/span_id del
 * span activo y los inyectamos en cada log bajo el namespace `dd` para que
 * DataDog correlacione logs <-> traces automáticamente.
 *
 * Si dd-trace NO está instalado/activo, esta función devuelve undefined y la
 * correlación cae sobre nuestro `request_id` propio. La librería funciona
 * idéntico en ambos escenarios.
 */
export interface DatadogTraceIds {
  dd: {
    trace_id: string;
    span_id: string;
  };
}

let tracer: any = null;
let resolved = false;

function resolveTracer(): any {
  if (resolved) {
    return tracer;
  }
  resolved = true;
  try {
    // require dinámico: si el paquete no existe, cae al catch sin romper nada.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    tracer = require('dd-trace');
  } catch {
    tracer = null;
  }
  return tracer;
}

export function getDatadogTraceIds(): DatadogTraceIds | undefined {
  const t = resolveTracer();
  if (!t) {
    return undefined;
  }
  try {
    const scope = typeof t.scope === 'function' ? t.scope() : undefined;
    const span = scope && typeof scope.active === 'function' ? scope.active() : undefined;
    if (!span) {
      return undefined;
    }
    const ctx = span.context();
    return {
      dd: {
        trace_id: String(ctx.toTraceId()),
        span_id: String(ctx.toSpanId()),
      },
    };
  } catch {
    return undefined;
  }
}

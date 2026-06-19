import { AsyncLocalStorage } from 'node:async_hooks';

/** Usuario autenticado del request (estandar DataDog: usr.id / usr.name / usr.email). */
export interface RequestUser {
  id?: string | number;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

/**
 * Datos que viven durante el ciclo de vida de un request.
 * `requestId` es el id de correlacion; `usr` el usuario autenticado.
 */
export interface RequestStore {
  requestId: string;
  usr?: RequestUser;
  [key: string]: unknown;
}

/**
 * AsyncLocalStorage compartido. Se "entra" en el middleware de contexto y
 * todo el procesamiento del request corre dentro de este contexto.
 */
export const requestContext = new AsyncLocalStorage<RequestStore>();

export function getRequestStore(): RequestStore | undefined {
  return requestContext.getStore();
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function setContextValue(key: string, value: unknown): void {
  const store = requestContext.getStore();
  if (store) {
    store[key] = value;
  }
}

/**
 * Registra el usuario autenticado en el contexto. A partir de aqui, TODOS los
 * logs del request incluyen `usr` (enciende el facet User de DataDog).
 * Se puede llamar desde un interceptor/guard, sin DI (la ALS es singleton).
 */
export function setUser(usr: RequestUser): void {
  const store = requestContext.getStore();
  if (store) {
    store.usr = usr;
  }
}

export function getUser(): RequestUser | undefined {
  return requestContext.getStore()?.usr;
}

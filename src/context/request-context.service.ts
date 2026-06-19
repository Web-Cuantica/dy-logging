import { Injectable } from '@nestjs/common';
import {
  getRequestId,
  getRequestStore,
  setContextValue,
  setUser,
  getUser,
  RequestUser,
} from './als';

/**
 * Servicio inyectable para leer/escribir el contexto del request actual.
 */
@Injectable()
export class RequestContextService {
  getRequestId(): string | undefined {
    return getRequestId();
  }

  /** Registra el usuario autenticado -> todos los logs del request llevan `usr`. */
  setUser(usr: RequestUser): void {
    setUser(usr);
  }

  getUser(): RequestUser | undefined {
    return getUser();
  }

  set(key: string, value: unknown): void {
    setContextValue(key, value);
  }

  get<T = unknown>(key: string): T | undefined {
    const store = getRequestStore();
    return store ? (store[key] as T) : undefined;
  }
}

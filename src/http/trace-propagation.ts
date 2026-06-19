import { getRequestId } from '../context/als';
import { DEFAULT_REQUEST_ID_HEADER } from '../constants';

/**
 * Interceptor de request para Axios (@nestjs/axios) que propaga el id de
 * correlación a los servicios downstream. Así el mismo request_id viaja de
 * punta a punta y puedes filtrar en DataDog por @request_id:<id> y ver el
 * flujo cruzando todos los microservicios.
 *
 * Uso con @nestjs/axios:
 *
 *   import { HttpService } from '@nestjs/axios';
 *   import { createTracePropagationInterceptor } from '@dy/logging';
 *
 *   @Injectable()
 *   export class HttpBootstrap implements OnModuleInit {
 *     constructor(private readonly http: HttpService) {}
 *     onModuleInit() {
 *       this.http.axiosRef.interceptors.request.use(
 *         createTracePropagationInterceptor(),
 *       );
 *     }
 *   }
 */
export function createTracePropagationInterceptor(
  headerName: string = DEFAULT_REQUEST_ID_HEADER,
): (config: any) => any {
  const header = headerName.toLowerCase();

  return function onFulfilled(config: any) {
    const id = getRequestId();
    if (id) {
      config.headers = config.headers || {};
      if (!config.headers[header]) {
        config.headers[header] = id;
      }
    }
    return config;
  };
}

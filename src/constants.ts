/**
 * Token de inyección para las opciones del módulo.
 */
export const LOGGING_OPTIONS = Symbol('DY_LOGGING_OPTIONS');

/**
 * Header HTTP usado para propagar el id de correlación entre servicios.
 */
export const DEFAULT_REQUEST_ID_HEADER = 'x-request-id';

/**
 * Por defecto se conserva 1 de cada N logs de health/ping.
 */
export const DEFAULT_HEALTH_SAMPLE_RATE = 20;

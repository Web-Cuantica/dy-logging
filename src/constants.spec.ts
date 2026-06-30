import {
  LOGGING_OPTIONS,
  DEFAULT_REQUEST_ID_HEADER,
  DEFAULT_HEALTH_SAMPLE_RATE,
} from './constants';

describe('constants', () => {
  it('LOGGING_OPTIONS es un Symbol único de inyección', () => {
    expect(typeof LOGGING_OPTIONS).toBe('symbol');
    expect(LOGGING_OPTIONS.toString()).toContain('DY_LOGGING_OPTIONS');
  });

  it('el header de correlación por defecto es x-request-id', () => {
    expect(DEFAULT_REQUEST_ID_HEADER).toBe('x-request-id');
  });

  it('el muestreo de health por defecto es 1 de cada 20', () => {
    expect(DEFAULT_HEALTH_SAMPLE_RATE).toBe(20);
  });
});

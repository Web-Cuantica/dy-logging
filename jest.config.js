/** Configuración de Jest para la librería @dy/logging (NestJS + ts-jest). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  // ts-jest usa un tsconfig propio para tests: relaja `types` para no exigir
  // @types/jest globalmente en el build de producción.
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          // Los decoradores de Nest requieren estos flags.
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          // El tsconfig base fija types:["node"]; los specs necesitan también
          // los globales de jest (describe/it/expect/jest).
          types: ['jest', 'node'],
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    // Excluidos: barrel, tipos puros y ejemplos (no llevan lógica testeable).
    '!src/index.ts',
    '!src/types.ts',
    '!src/examples/**',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  clearMocks: true,
};

import type { Config } from 'jest';

// Nest 12 se distribuye como ESM puro. Los specs se compilan a CommonJS y
// `--experimental-vm-modules` (ver el script test) permite que el runtime de
// Jest cargue esos paquetes ESM mediante require. La app también se compila a
// CommonJS, de modo que los tests ejercitan el mismo formato que dist/.
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
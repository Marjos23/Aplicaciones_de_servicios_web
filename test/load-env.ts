import { config } from 'dotenv';

config({ path: ['.env.test', '.env.local', '.env'] });

if (process.env.NODE_ENV !== 'test') {
  throw new Error(
    'Las pruebas e2e requieren NODE_ENV=test. Copia .env.test.example a .env.test o define las variables de prueba en el entorno.',
  );
}

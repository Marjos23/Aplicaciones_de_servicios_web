import { config } from 'dotenv';

// Las pruebas leen la configuración antes de que Nest arranque, así que el
// archivo .env se carga aquí de forma explícita.
config({ path: ['.env.local', '.env'] });

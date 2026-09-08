import { NestFactory } from '@nestjs/core'; // 1
import { AppModule, ObserveInstrument } from './app.module.js'; // 2

async function bootstrap() { // 3
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  }); // 4
  await app.listen(process.env.PORT ?? 3000); // 5
}
bootstrap(); // 6
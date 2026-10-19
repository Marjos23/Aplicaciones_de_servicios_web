import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      // Sin esto, una propiedad desconocida en el cuerpo se descarta en
      // silencio; con forbidNonWhitelisted el cliente recibe un 400 que
      // explica que la propiedad no existe.
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors();

  // El puerto vive en el entorno, no en el código. Si PORT no está definida
  // o es inválida, la aplicación ya se habrá detenido durante la validación
  // de ConfigModule; aquí solo se lee el valor garantizado.
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');

  await app.listen(port, '0.0.0.0');
}
bootstrap();

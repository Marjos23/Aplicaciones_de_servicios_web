import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';

export function corsOptions(config: ConfigService): CorsOptions {
  const origin = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    origin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

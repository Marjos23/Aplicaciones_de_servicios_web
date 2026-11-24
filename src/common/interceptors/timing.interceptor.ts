import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const record = () => {
      const durationMs = Date.now() - startedAt;
      response.setHeader('X-Response-Time', `${durationMs}ms`);
      this.logger.log({
        event: 'response_time',
        method: request.method,
        path: request.path,
        durationMs,
      });
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}

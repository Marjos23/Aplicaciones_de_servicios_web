import { Injectable } from '@nestjs/common';

@Injectable()
export class WelcomeService {
  getMessage(): { message: string } {
    return { message: 'Bienvenido a CourseHub API' };
  }
}

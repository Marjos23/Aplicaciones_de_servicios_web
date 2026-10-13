import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'CourseHub API - Cursos, Estudiantes y Matrículas';
  }
}

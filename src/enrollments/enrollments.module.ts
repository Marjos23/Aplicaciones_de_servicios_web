import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { Enrollment } from './entities/enrollment.entity';
import { Student } from '../students/entities/student.entity';
import { Course } from '../courses/entities/course.entity';

@Module({
  // El módulo de matrículas orquesta la regla que conecta los tres recursos,
  // por eso necesita el repositorio de los tres.
  imports: [TypeOrmModule.forFeature([Enrollment, Student, Course])],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  // Se exporta para que los módulos de cursos y estudiantes consulten las
  // matrículas de un recurso sin duplicar la consulta de la relación.
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}

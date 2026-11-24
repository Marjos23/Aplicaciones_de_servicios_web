import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { TypeOrmCourseRepository } from './adapters/typeorm-course.repository';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { Course } from './entities/course.entity';
import { COURSE_REPOSITORY } from './ports/course-repository';
import { UpdateCourseUseCase } from './use-cases/update-course.use-case';

@Module({
  imports: [TypeOrmModule.forFeature([Course]), EnrollmentsModule],
  controllers: [CoursesController],
  providers: [
    CoursesService,
    UpdateCourseUseCase,
    { provide: COURSE_REPOSITORY, useClass: TypeOrmCourseRepository },
  ],
})
export class CoursesModule {}

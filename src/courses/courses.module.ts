import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { Course } from './entities/course.entity';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [TypeOrmModule.forFeature([Course]), EnrollmentsModule],
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}

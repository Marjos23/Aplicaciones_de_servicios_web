import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../entities/course.entity';
import { CourseRepository } from '../ports/course-repository';

@Injectable()
export class TypeOrmCourseRepository implements CourseRepository {
  constructor(
    @InjectRepository(Course)
    private readonly repository: Repository<Course>,
  ) {}

  findById(id: number): Promise<Course | null> {
    return this.repository.findOneBy({ id });
  }

  save(course: Course): Promise<Course> {
    return this.repository.save(course);
  }
}

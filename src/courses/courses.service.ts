import { Injectable } from '@nestjs/common';

type Course = {
  id: number;
  title: string;
  level: string;
};

@Injectable()
export class CoursesService {
  private readonly courses: Course[] = [
    { id: 1, title: 'NestJS Fundamentals', level: 'beginner' },
    { id: 2, title: 'REST APIs with NestJS', level: 'beginner' },
    { id: 3, title: 'NestJS Architecture', level: 'intermediate' },
  ];

  findAll(level?: string): Course[] {
    if (!level) {
      return this.courses;
    }

    return this.courses.filter((course) => course.level === level);
  }

  findOne(id: number): Course | undefined {
    return this.courses.find((course) => course.id === id);
  }
}
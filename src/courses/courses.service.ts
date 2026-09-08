import { Injectable } from '@nestjs/common';

type Course = {
  id: number;
  title: string;
  level: string;
};

type CreateCourseInput = Omit<Course, 'id'>;
type UpdateCourseInput = Partial<CreateCourseInput>;

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
  
  create(input: CreateCourseInput): Course {
    const course: Course = {
        id: Math.max(0, ...this.courses.map((item) => item.id)) + 1,
        title: input.title,
        level: input.level,
    };
    this.courses.push(course);
    return course;
    }

    update(id: number, input: UpdateCourseInput): Course | undefined {
        const course = this.findOne(id);

        if (!course) {
            return undefined;
        }
        Object.assign(course, input);
        return course;
    }

    remove(id: number): Course | undefined {
        const index = this.courses.findIndex((course) => course.id === id);

        if (index === -1) {
            return undefined;
            
        }

        const [removedCourse] = this.courses.splice(index, 1);
        return removedCourse;
    }

}
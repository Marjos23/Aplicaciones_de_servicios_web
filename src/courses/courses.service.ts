import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

export type Course = {
  id: number;
  name: string;
  code: string;
  credits: number;
  teacher?: string;
};

@Injectable()
export class CoursesService {
  private readonly courses: Course[] = [
    {
      id: 1,
      name: 'Aplicaciones para el servidor web',
      code: 'ASW-501',
      credits: 4,
      teacher: 'Edgardo Panchana',
    },
    {
      id: 2,
      name: 'Bases de Datos Avanzadas',
      code: 'BDA-401',
      credits: 3,
      teacher: 'Marta Ruiz',
    },
  ];

  private nextId = 3;

  findAll(): Course[] {
    return this.courses;
  }

  findOne(id: number): Course {
    const course = this.courses.find((course) => course.id === id);

    if (!course) {
      throw new NotFoundException(`Curso con id ${id} no encontrado`);
    }

    return course;
  }

  exists(id: number): boolean {
    return this.courses.some((course) => course.id === id);
  }

  create(dto: CreateCourseDto): Course {
    const course: Course = {
      id: this.nextId,
      name: dto.name,
      code: dto.code,
      credits: dto.credits,
      teacher: dto.teacher,
    };

    this.nextId++;
    this.courses.push(course);
    return course;
  }

  update(id: number, dto: UpdateCourseDto): Course {
    const course = this.findOne(id);
    Object.assign(course, dto);
    return course;
  }

  remove(id: number): Course {
    const course = this.findOne(id);
    this.courses.splice(this.courses.indexOf(course), 1);
    return course;
  }
}

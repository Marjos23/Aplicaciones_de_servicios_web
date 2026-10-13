import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';

export type Student = {
  id: number;
  name: string;
  email: string;
  active: boolean;
};

@Injectable()
export class StudentsService {
  private readonly students: Student[] = [
    { id: 1, name: 'Ana Torres', email: 'ana.torres@correo.com', active: true },
    { id: 2, name: 'Luis Pérez', email: 'luis.perez@correo.com', active: true },
    {
      id: 3,
      name: 'Mariana Gómez',
      email: 'mariana.gomez@correo.com',
      active: false,
    },
  ];

  private nextId = 4;

  findAll(): Student[] {
    return this.students;
  }

  findOne(id: number): Student {
    const student = this.students.find((student) => student.id === id);

    if (!student) {
      throw new NotFoundException(`Estudiante con id ${id} no encontrado`);
    }

    return student;
  }

  exists(id: number): boolean {
    return this.students.some((student) => student.id === id);
  }

  create(dto: CreateStudentDto): Student {
    const student: Student = {
      id: this.nextId++,
      name: dto.name,
      email: dto.email,
      active: dto.active ?? true,
    };

    this.students.push(student);
    return student;
  }

  update(id: number, dto: UpdateStudentDto): Student {
    const student = this.findOne(id);
    Object.assign(student, dto);
    return student;
  }

  remove(id: number): Student {
    const student = this.findOne(id);
    this.students.splice(this.students.indexOf(student), 1);
    return student;
  }
}

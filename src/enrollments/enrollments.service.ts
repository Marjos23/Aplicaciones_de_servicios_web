import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CoursesService } from '../courses/courses.service.js';
import { StudentsService } from '../students/students.service.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { EnrollmentQueryDto } from './dto/enrollment-query.dto.js';

export type Enrollment = {
  id: number;
  studentId: number;
  courseId: number;
};

@Injectable()
export class EnrollmentsService {
  private readonly enrollments: Enrollment[] = [
    { id: 1, studentId: 1, courseId: 1 },
  ];

  private nextId = 2;

  constructor(
    private readonly studentsService: StudentsService,
    private readonly coursesService: CoursesService,
  ) {}

  create(dto: CreateEnrollmentDto): Enrollment {
    const student = this.studentsService.findOne(dto.studentId);
    this.coursesService.findOne(dto.courseId);

    if (!student.active) {
      throw new BadRequestException(
        `El estudiante con id ${student.id} no está activo`,
      );
    }

    const duplicated = this.enrollments.some(
      (enrollment) =>
        enrollment.studentId === dto.studentId &&
        enrollment.courseId === dto.courseId,
    );

    if (duplicated) {
      throw new ConflictException(
        `El estudiante ${dto.studentId} ya está matriculado en el curso ${dto.courseId}`,
      );
    }

    const enrollment: Enrollment = {
      id: this.nextId,
      studentId: dto.studentId,
      courseId: dto.courseId,
    };

    this.nextId++;
    this.enrollments.push(enrollment);
    return enrollment;
  }

  findAll(query: EnrollmentQueryDto = {}): Enrollment[] {
    return this.enrollments.filter(
      (enrollment) =>
        (query.studentId === undefined ||
          enrollment.studentId === query.studentId) &&
        (query.courseId === undefined ||
          enrollment.courseId === query.courseId),
    );
  }

  findByStudent(studentId: number): Enrollment[] {
    this.studentsService.findOne(studentId);
    return this.enrollments.filter(
      (enrollment) => enrollment.studentId === studentId,
    );
  }

  findByCourse(courseId: number): Enrollment[] {
    this.coursesService.findOne(courseId);
    return this.enrollments.filter(
      (enrollment) => enrollment.courseId === courseId,
    );
  }

  remove(id: number): Enrollment {
    const index = this.enrollments.findIndex(
      (enrollment) => enrollment.id === id,
    );

    if (index === -1) {
      throw new NotFoundException(`Matrícula con id ${id} no encontrada`);
    }

    return this.enrollments.splice(index, 1)[0];
  }
}

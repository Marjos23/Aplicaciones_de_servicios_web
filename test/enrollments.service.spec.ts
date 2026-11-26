import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Course } from '../src/courses/entities/course.entity';
import { EnrollmentsService } from '../src/enrollments/enrollments.service';
import { Enrollment } from '../src/enrollments/entities/enrollment.entity';
import { Student } from '../src/students/entities/student.entity';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  const enrollments = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const students = { findOneBy: jest.fn() };
  const courses = { findOneBy: jest.fn() };

  const student = {
    id: 3,
    name: 'Ana',
    email: 'ana@example.com',
    age: 20,
    career: 'Physics',
    semester: 4,
    isActive: true,
    enrollments: [],
  } as Student;
  const course = {
    id: 5,
    title: 'NestJS',
    level: 'beginner',
    createdByUserId: 9,
    enrollments: [],
  } as Course;

  beforeEach(async () => {
    enrollments.findOne.mockResolvedValue(null);
    enrollments.create.mockImplementation((value) => value as Enrollment);
    enrollments.save.mockImplementation(async (value) => value as Enrollment);
    students.findOneBy.mockResolvedValue(student);
    courses.findOneBy.mockResolvedValue(course);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        { provide: getRepositoryToken(Enrollment), useValue: enrollments },
        { provide: getRepositoryToken(Student), useValue: students },
        { provide: getRepositoryToken(Course), useValue: courses },
      ],
    }).compile();

    service = module.get(EnrollmentsService);
    jest.clearAllMocks();
  });

  it('crea la matrícula cuando estudiante, curso y pareja son válidos', async () => {
    const result = await service.create({ studentId: 3, courseId: 5 });

    expect(result).toMatchObject({ student, course });
    expect(enrollments.save).toHaveBeenCalledTimes(1);
  });

  it('rechaza un estudiante inexistente sin consultar el curso', async () => {
    students.findOneBy.mockResolvedValueOnce(null);

    await expect(
      service.create({ studentId: 999, courseId: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(courses.findOneBy).not.toHaveBeenCalled();
    expect(enrollments.save).not.toHaveBeenCalled();
  });

  it('rechaza un estudiante inactivo sin consultar el curso', async () => {
    students.findOneBy.mockResolvedValueOnce({ ...student, isActive: false });

    await expect(
      service.create({ studentId: 3, courseId: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(courses.findOneBy).not.toHaveBeenCalled();
    expect(enrollments.save).not.toHaveBeenCalled();
  });

  it('rechaza un curso inexistente sin buscar duplicados', async () => {
    courses.findOneBy.mockResolvedValueOnce(null);

    await expect(
      service.create({ studentId: 3, courseId: 999 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(enrollments.findOne).not.toHaveBeenCalled();
    expect(enrollments.save).not.toHaveBeenCalled();
  });

  it('rechaza la pareja repetida sin guardar', async () => {
    enrollments.findOne.mockResolvedValueOnce({ id: 1 } as Enrollment);

    await expect(
      service.create({ studentId: 3, courseId: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(enrollments.save).not.toHaveBeenCalled();
  });

  it('traduce el 23505 de PostgreSQL al mismo 409', async () => {
    const driverError = Object.assign(new Error('duplicate key'), {
      code: '23505',
    });
    enrollments.save.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], driverError),
    );

    await expect(
      service.create({ studentId: 3, courseId: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import type { AuthenticatedUser } from '../src/auth/interfaces/authenticated-user.interface';
import { CoursesService } from '../src/courses/courses.service';
import { CoursesController } from '../src/courses/courses.controller';
import { UpdateCourseDto } from '../src/courses/dto/update-course.dto';
import { UpdateCourseUseCase } from '../src/courses/use-cases/update-course.use-case';
import { EnrollmentsService } from '../src/enrollments/enrollments.service';
import { UserRole } from '../src/users/user-role.enum';

describe('CoursesController', () => {
  let controller: CoursesController;
  const coursesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };
  const enrollmentsService = { findByCourse: jest.fn() };
  const updateCourse = { execute: jest.fn() };

  const actor: AuthenticatedUser = {
    id: 4,
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [
        { provide: CoursesService, useValue: coursesService },
        { provide: EnrollmentsService, useValue: enrollmentsService },
        { provide: UpdateCourseUseCase, useValue: updateCourse },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CoursesController);
    jest.clearAllMocks();
  });

  it('delega el id, el DTO y la identidad autenticada al caso de uso', async () => {
    const dto: UpdateCourseDto = { title: 'NestJS avanzado' };
    const updated = { id: 7, ...dto };
    updateCourse.execute.mockResolvedValue(updated);

    await expect(controller.update(7, dto, actor)).resolves.toEqual(updated);
    expect(updateCourse.execute).toHaveBeenCalledWith(7, dto, actor);
  });

  it('propaga el error del caso de uso sin convertirlo en éxito', async () => {
    const error = new ForbiddenException('You cannot modify this course');
    updateCourse.execute.mockRejectedValue(error);

    await expect(
      controller.update(7, { title: 'Ajeno' }, actor),
    ).rejects.toBe(error);
    expect(updateCourse.execute).toHaveBeenCalledTimes(1);
  });

  it('delega el id transformado al consultar las matrículas del curso', async () => {
    enrollmentsService.findByCourse.mockResolvedValue([]);

    await expect(controller.findEnrollments(7)).resolves.toEqual([]);
    expect(enrollmentsService.findByCourse).toHaveBeenCalledWith(7);
  });
});

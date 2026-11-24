import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../src/users/user-role.enum';
import { Course } from '../src/courses/entities/course.entity';
import { CourseRepository } from '../src/courses/ports/course-repository';
import { UpdateCourseUseCase } from '../src/courses/use-cases/update-course.use-case';
import type { AuthenticatedUser } from '../src/auth/interfaces/authenticated-user.interface';

describe('UpdateCourseUseCase', () => {
  const ownerId = 7;
  let course: Course;
  let repository: jest.Mocked<CourseRepository>;
  let useCase: UpdateCourseUseCase;

  const actor = (id: number, role: UserRole): AuthenticatedUser => ({
    id,
    email: `${role}@example.com`,
    role,
  });

  beforeEach(() => {
    course = {
      id: 1,
      title: 'Original',
      level: 'beginner',
      createdByUserId: ownerId,
      enrollments: [],
    };
    repository = {
      findById: jest.fn().mockResolvedValue(course),
      save: jest.fn().mockImplementation(async (value: Course) => value),
    };
    useCase = new UpdateCourseUseCase(repository);
  });

  it('permite al docente propietario actualizar el curso', async () => {
    const result = await useCase.execute(
      1,
      { title: 'Cambiado' },
      actor(ownerId, UserRole.TEACHER),
    );

    expect(result.title).toBe('Cambiado');
    expect(repository.save).toHaveBeenCalledWith(course);
  });

  it('permite al administrador actualizar cualquier curso', async () => {
    await useCase.execute(1, { level: 'advanced' }, actor(99, UserRole.ADMIN));

    expect(course.level).toBe('advanced');
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('no toma el propietario del cuerpo de la petición', async () => {
    await useCase.execute(
      1,
      { title: 'Cambiado', createdByUserId: 99 } as never,
      actor(ownerId, UserRole.TEACHER),
    );

    expect(course.createdByUserId).toBe(ownerId);
  });

  it('niega el curso a otro docente', async () => {
    await expect(
      useCase.execute(1, { title: 'Ajeno' }, actor(100, UserRole.TEACHER)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('niega el curso a un estudiante autenticado', async () => {
    await expect(
      useCase.execute(1, { title: 'Ajeno' }, actor(ownerId, UserRole.STUDENT)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('avisa cuando el curso no existe', async () => {
    repository.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute(404, { title: 'Nada' }, actor(99, UserRole.ADMIN)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});

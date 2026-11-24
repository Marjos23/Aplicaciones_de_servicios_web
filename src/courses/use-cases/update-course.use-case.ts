import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/user-role.enum';
import { UpdateCourseDto } from '../dto/update-course.dto';
import { Course } from '../entities/course.entity';
import { COURSE_REPOSITORY } from '../ports/course-repository';
import type { CourseRepository } from '../ports/course-repository';

@Injectable()
export class UpdateCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY)
    private readonly courses: CourseRepository,
  ) {}

  async execute(
    id: number,
    changes: UpdateCourseDto,
    actor: AuthenticatedUser,
  ): Promise<Course> {
    const course = await this.courses.findById(id);
    if (!course) {
      throw new NotFoundException(`Course with id ${id} not found`);
    }

    const isAdmin = actor.role === UserRole.ADMIN;
    const isOwner =
      actor.role === UserRole.TEACHER && course.createdByUserId === actor.id;
    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('You cannot modify this course');
    }

    if (changes.title !== undefined) {
      course.title = changes.title;
    }
    if (changes.level !== undefined) {
      course.level = changes.level;
    }
    return this.courses.save(course);
  }
}

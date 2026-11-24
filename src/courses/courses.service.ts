import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { QueryFailedError, Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { CoursesQueryDto } from './dto/courses-query.dto';

/** Forma estable de toda lista paginada: elementos y metadatos. */
export interface Paginated<T> {
  items: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  async findAll(
    query: Partial<CoursesQueryDto> = {},
  ): Promise<Paginated<Course>> {
    const { level, page = 1, limit = 10, sortBy = 'id', order = 'ASC' } = query;

    // findAndCount entrega la página pedida y el total que cumple el
    // filtro en una sola consulta. skip = (page - 1) * limit omite las
    // filas de las páginas anteriores; sin un orden fijo, la segunda
    // página podría repetir o saltarse cursos entre solicitudes.
    const [items, total] = await this.coursesRepository.findAndCount({
      where: level ? { level } : {},
      order: { [sortBy]: order },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number): Promise<Course> {
    const course = await this.coursesRepository.findOneBy({ id });
    if (!course) {
      throw new NotFoundException(`Course with id ${id} not found`);
    }
    return course;
  }

  create(
    createCourseDto: CreateCourseDto,
    actor: AuthenticatedUser,
  ): Promise<Course> {
    return this.coursesRepository.save(
      this.coursesRepository.create({
        ...createCourseDto,
        createdByUserId: actor.id,
      }),
    );
  }

  async remove(id: number): Promise<Course> {
    const course = await this.findOne(id);
    try {
      await this.coursesRepository.remove(course);
    } catch (error) {
      // La tabla bloquea el borrado si el curso tiene matrículas. Se traduce
      // a un 409 explicable en lugar de dejar que PostgreSQL produzca un 500.
      // RESTRICT reporta 23001; 23503 cubre la violación de clave foránea.
      if (error instanceof QueryFailedError) {
        const code = (error.driverError as { code?: string })?.code;
        if (code === '23001' || code === '23503') {
          throw new ConflictException(
            `Course with id ${id} cannot be deleted because it has enrollments`,
          );
        }
      }
      throw error;
    }
    return course;
  }
}

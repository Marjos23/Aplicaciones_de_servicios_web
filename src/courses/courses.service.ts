import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  findAll(level?: string): Promise<Course[]> {
    return this.coursesRepository.find({
      where: level ? { level } : {},
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Course> {
    const course = await this.coursesRepository.findOneBy({ id });
    if (!course) {
      throw new NotFoundException(`Course with id ${id} not found`);
    }
    return course;
  }

  create(createCourseDto: CreateCourseDto): Promise<Course> {
    return this.coursesRepository.save(
      this.coursesRepository.create(createCourseDto),
    );
  }

  async update(id: number, input: UpdateCourseDto): Promise<Course> {
    const course = await this.findOne(id);
    // Se asignan solo campos conocidos: el id nunca se toma del cuerpo.
    Object.assign(course, input);
    return this.coursesRepository.save(course);
  }

  async remove(id: number): Promise<Course> {
    const course = await this.findOne(id);
    try {
      await this.coursesRepository.remove(course);
    } catch (error) {
      // La tabla bloquea el borrado si el curso tiene matrículas. Se traduce
      // a un 409 explicable en lugar de dejar que PostgreSQL produzca un 500.
      if (error instanceof QueryFailedError) {
        const code = (error.driverError as { code?: string })?.code;
        if (code === '23503') {
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

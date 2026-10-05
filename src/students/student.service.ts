import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Student } from './entities/student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentQueryDto } from './dto/student-query.dto';

@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
  ) {}

  findAll(filters: StudentQueryDto = {}): Promise<Student[]> {
    return this.studentsRepository.find({
      where: {
        ...(filters.career !== undefined ? { career: filters.career } : {}),
        ...(filters.semester !== undefined
          ? { semester: filters.semester }
          : {}),
        ...(filters.isActive !== undefined
          ? { isActive: filters.isActive }
          : {}),
      },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Student> {
    const student = await this.studentsRepository.findOneBy({ id });
    if (!student) {
      throw new NotFoundException(`Student with id ${id} not found`);
    }
    return student;
  }

  async create(createStudentDto: CreateStudentDto): Promise<Student> {
    await this.assertEmailAvailable(createStudentDto.email);
    try {
      return await this.studentsRepository.save(
        this.studentsRepository.create(createStudentDto),
      );
    } catch (error) {
      this.rethrowEmailConflict(error);
    }
  }

  async update(id: number, input: UpdateStudentDto): Promise<Student> {
    const student = await this.findOne(id);
    if (input.email && input.email !== student.email) {
      await this.assertEmailAvailable(input.email, id);
    }
    Object.assign(student, input);
    try {
      return await this.studentsRepository.save(student);
    } catch (error) {
      this.rethrowEmailConflict(error);
    }
  }

  async updateStatus(id: number, isActive: boolean): Promise<Student> {
    const student = await this.findOne(id);
    student.isActive = isActive;
    return this.studentsRepository.save(student);
  }

  async remove(id: number): Promise<Student> {
    const student = await this.findOne(id);
    if (!student.isActive) {
      throw new ConflictException('Inactive students cannot be deleted');
    }
    try {
      await this.studentsRepository.remove(student);
    } catch (error) {
      // Igual que en cursos: la tabla bloquea el borrado si el estudiante
      // tiene matrículas, y eso se explica con un 409 y no con un 500.
      if (error instanceof QueryFailedError) {
        const code = (error.driverError as { code?: string })?.code;
        if (code === '23503') {
          throw new ConflictException(
            `Student with id ${id} cannot be deleted because it has enrollments`,
          );
        }
      }
      throw error;
    }
    return student;
  }

  async findEnrollments(id: number) {
    await this.findOne(id);
    return this.studentsRepository
      .createQueryBuilder('student')
      .innerJoinAndSelect('student.enrollments', 'enrollment')
      .innerJoinAndSelect('enrollment.course', 'course')
      .where('student.id = :id', { id })
      .orderBy('enrollment.id', 'ASC')
      .getMany()
      .then((students) => students[0]?.enrollments ?? []);
  }

  private async assertEmailAvailable(email: string, ignoreId?: number) {
    const existing = await this.studentsRepository.findOneBy({ email });
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException('Email is already registered');
    }
  }

  /**
   * El índice único de la tabla `students.email` es la garantía real de que
   * el correo no se repite. Esta trampa traduce el error 23505 de PostgreSQL
   * al mismo 409 que lanza el servicio, de modo que la respuesta sea igual
   * tanto si la comprobación previa pasó como si no, algo que importa cuando
   * dos peticiones simultáneas compiten por el mismo correo.
   */
  private rethrowEmailConflict(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const code = (error.driverError as { code?: string })?.code;
      if (code === '23505') {
        throw new ConflictException('Email is already registered');
      }
    }
    throw error;
  }
}

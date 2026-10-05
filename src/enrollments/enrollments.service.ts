import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Enrollment } from './entities/enrollment.entity';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { EnrollmentQueryDto } from './dto/enrollment-query.dto';
import { Student } from '../students/entities/student.entity';
import { Course } from '../courses/entities/course.entity';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  /**
   * Reglas de negocio, en el orden que permite explicar el motivo exacto del
   * error: si el estudiante no existe es 404, si existe pero está inactivo es
   * 400, y si el curso no existe es 404. El servicio decide el código; la
   * clave foránea de la tabla sigue siendo la última red de seguridad.
   */
  async create(dto: CreateEnrollmentDto): Promise<Enrollment> {
    const student = await this.studentsRepository.findOneBy({
      id: dto.studentId,
    });
    if (!student) {
      throw new NotFoundException(`Student ${dto.studentId} not found`);
    }
    if (!student.isActive) {
      throw new BadRequestException('Inactive students cannot enroll');
    }

    const course = await this.coursesRepository.findOneBy({
      id: dto.courseId,
    });
    if (!course) {
      throw new NotFoundException(`Course ${dto.courseId} not found`);
    }

    const duplicate = await this.enrollmentsRepository.findOne({
      where: { student: { id: student.id }, course: { id: course.id } },
    });
    if (duplicate) {
      throw new ConflictException('Student is already enrolled in this course');
    }

    try {
      return await this.enrollmentsRepository.save(
        this.enrollmentsRepository.create({ student, course }),
      );
    } catch (error) {
      this.rethrowDuplicateConflict(error);
    }
  }

  findAll(filters: EnrollmentQueryDto = {}): Promise<Enrollment[]> {
    return this.enrollmentsRepository.find({
      where: {
        ...(filters.studentId !== undefined
          ? { student: { id: filters.studentId } }
          : {}),
        ...(filters.courseId !== undefined
          ? { course: { id: filters.courseId } }
          : {}),
      },
      relations: { student: true, course: true },
      order: { id: 'ASC' },
    });
  }

  async findByStudent(studentId: number): Promise<Enrollment[]> {
    const student = await this.studentsRepository.findOneBy({ id: studentId });
    if (!student) {
      throw new NotFoundException(`Student with id ${studentId} not found`);
    }
    return this.findAll({ studentId });
  }

  async findByCourse(courseId: number): Promise<Enrollment[]> {
    // Se comprueba que el curso existe: si no, la respuesta es 404 y no una
    // lista vacía, igual que en GET /courses/:id.
    const course = await this.coursesRepository.findOneBy({ id: courseId });
    if (!course) {
      throw new NotFoundException(`Course with id ${courseId} not found`);
    }
    return this.findAll({ courseId });
  }

  async remove(id: number): Promise<Enrollment> {
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { id },
      relations: { student: true, course: true },
    });
    if (!enrollment) {
      throw new NotFoundException(`Enrollment with id ${id} not found`);
    }
    // TypeORM limpia la clave primaria de la entidad al borrarla, así que se
    // guarda una copia de lo cancelado antes de ejecutar remove().
    const cancelled = { ...enrollment };
    // Cancelar la matrícula borra el vínculo, no el estudiante ni el curso.
    await this.enrollmentsRepository.remove(enrollment);
    return cancelled;
  }

  /**
   * El índice único compuesto (student_id, course_id) impide la pareja
   * repetida. Esta trampa traduce el 23505 de PostgreSQL al mismo 409 que
   * lanza el servicio, para que dos peticiones simultáneas que compiten por
   * la misma pareja devuelvan la misma respuesta.
   */
  private rethrowDuplicateConflict(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const code = (error.driverError as { code?: string })?.code;
      if (code === '23505') {
        throw new ConflictException(
          'Student is already enrolled in this course',
        );
      }
    }
    throw error;
  }
}

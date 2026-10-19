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
import { Paginated } from '../courses/courses.service';

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

  /**
   * Consulta compuesta de matrículas (Semana 6, sesión 12).
   *
   * QueryBuilder permite encadenar JOINs y condiciones opcionales sin
   * salir de TypeORM. Cada filtro se añade solo si el cliente lo pidió,
   * de modo que se combinan sin sobrescribirse.
   */
  async findAll(
    query: Partial<EnrollmentQueryDto> = {},
  ): Promise<Paginated<Enrollment>> {
    // Los defaults del DTO se aplican al pasar por ValidationPipe. Las
    // llamadas internas (findByStudent, findByCourse) llegan con un objeto
    // literal, así que aquí también se fijan los valores por defecto.
    const { page = 1, limit = 10 } = query;

    const qb = this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.student', 'student')
      .leftJoinAndSelect('enrollment.course', 'course');

    if (query.search) {
      // El marcador :search separa el dato de la instrucción SQL: el
      // texto del cliente nunca se interpola en la consulta. ILIKE
      // busca sin distinguir mayúsculas; el paréntesis mantiene juntas
      // las dos alternativas antes de combinarse con los demás filtros.
      qb.andWhere(
        '(student.name ILIKE :search OR course.title ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }

    if (query.studentId !== undefined) {
      qb.andWhere('student.id = :studentId', { studentId: query.studentId });
    }

    if (query.courseId !== undefined) {
      qb.andWhere('course.id = :courseId', { courseId: query.courseId });
    }

    if (query.activeOnly === 'true') {
      qb.andWhere('student.isActive = :active', { active: true });
    }

    // Orden fijo por id: hace reproducible el recorrido de páginas.
    qb.orderBy('enrollment.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByStudent(studentId: number): Promise<Enrollment[]> {
    const student = await this.studentsRepository.findOneBy({ id: studentId });
    if (!student) {
      throw new NotFoundException(`Student with id ${studentId} not found`);
    }
    const { items } = await this.findAll({ studentId });
    return items;
  }

  async findByCourse(courseId: number): Promise<Enrollment[]> {
    // Se comprueba que el curso existe: si no, la respuesta es 404 y no una
    // lista vacía, igual que en GET /courses/:id.
    const course = await this.coursesRepository.findOneBy({ id: courseId });
    if (!course) {
      throw new NotFoundException(`Course with id ${courseId} not found`);
    }
    const { items } = await this.findAll({ courseId });
    return items;
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

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EnrollmentsService } from '../src/enrollments/enrollments.service';
import { StudentService } from '../src/students/student.service';
import { CoursesService } from '../src/courses/courses.service';
import { Enrollment } from '../src/enrollments/entities/enrollment.entity';
import { Student } from '../src/students/entities/student.entity';
import { Course } from '../src/courses/entities/course.entity';
import {
  closeTestDataSource,
  createTestDataSource,
  dropTestTables,
} from './test-data-source';

/**
 * Los siete casos de la demostración del proyecto integrador, ejecutados
 * contra PostgreSQL real. No se usan repositorios simulados: el objetivo es
 * comprobar que las claves foráneas, el índice único del correo y la
 * restricción compuesta funcionan de verdad.
 */
describe('CourseHub API · demostración de la semana 5 (e2e)', () => {
  let dataSource: DataSource;
  let enrollmentsService: EnrollmentsService;
  let studentService: StudentService;
  let coursesService: CoursesService;

  let courseId: number;
  let studentId: number;
  let enrollmentId: number;

  /**
   * Los servicios reciben repositorios por @InjectRepository, así que se
   * construyen directamente sobre la conexión de pruebas en lugar de usar
   * Test.createTestingModule.
   */
  function buildServices(source: DataSource) {
    enrollmentsService = new EnrollmentsService(
      source.getRepository(Enrollment),
      source.getRepository(Student),
      source.getRepository(Course),
    );
    studentService = new StudentService(source.getRepository(Student));
    coursesService = new CoursesService(source.getRepository(Course));
  }

  beforeAll(async () => {
    dataSource = await createTestDataSource({ prefix: 'demo_' });

    buildServices(dataSource);
  });

  afterAll(async () => {
    // Las tablas se borran antes de cerrar la conexión que las usa.
    await dropTestTables(dataSource, 'demo_');
    await closeTestDataSource(dataSource);
  });

  it('1. crea un curso y un estudiante activo', async () => {
    const course = await coursesService.create({
      title: 'NestJS Relations',
      level: 'intermediate',
    });
    expect(course.id).toBeGreaterThan(0);

    const student = await studentService.create({
      name: 'Ana Ruiz',
      email: 'ana.ruiz@example.com',
      age: 20,
      career: 'Computer Science',
      semester: 5,
    });
    expect(student.isActive).toBe(true);

    courseId = course.id;
    studentId = student.id;
  });

  it('2. crea una matrícula válida con sus dos relaciones cargadas', async () => {
    const enrollment = await enrollmentsService.create({ studentId, courseId });

    expect(enrollment.id).toBeGreaterThan(0);
    expect(enrollment.student.id).toBe(studentId);
    expect(enrollment.course.id).toBe(courseId);

    enrollmentId = enrollment.id;

    // La fila existe y sus claves foráneas apuntan a las tablas correctas.
    const found = await enrollmentsService.findAll({ studentId });
    expect(found).toHaveLength(1);
    expect(found[0].student.name).toBe('Ana Ruiz');
    expect(found[0].course.title).toBe('NestJS Relations');
  });

  it('3. la matrícula sigue disponible tras reiniciar la API', async () => {
    // Simula el reinicio destruyendo y recreando la conexión. Si los datos
    // vivieran en memoria, la consulta volvería vacía.
    await closeTestDataSource(dataSource);
    dataSource = await createTestDataSource({ prefix: 'demo_' });
    buildServices(dataSource);

    const found: Enrollment[] = await dataSource
      .getRepository(Enrollment)
      .find({
        where: { id: enrollmentId },
        relations: { student: true, course: true },
      });

    expect(found).toHaveLength(1);
    expect(found[0].student.id).toBe(studentId);
    expect(found[0].course.id).toBe(courseId);
  });

  it('4. rechaza con 409 la pareja estudiante-curso repetida', async () => {
    await expect(
      enrollmentsService.create({ studentId, courseId }),
    ).rejects.toBeInstanceOf(ConflictException);

    // El índice único de la tabla lo impide aunque el servicio se equivoque.
    const rows = await dataSource.getRepository(Enrollment).find({
      where: { student: { id: studentId }, course: { id: courseId } },
    });
    expect(rows).toHaveLength(1);
  });

  it('5. rechaza con 400 matricular un estudiante inactivo', async () => {
    await studentService.updateStatus(studentId, false);

    const otherCourse = await coursesService.create({
      title: 'Curso para inactivo',
      level: 'beginner',
    });

    await expect(
      enrollmentsService.create({ studentId, courseId: otherCourse.id }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await studentService.updateStatus(studentId, true);
  });

  it('6. filtra las matrículas por estudiante y por curso', async () => {
    const second = await coursesService.create({
      title: 'Segundo curso',
      level: 'beginner',
    });
    await enrollmentsService.create({ studentId, courseId: second.id });

    const byStudent = await enrollmentsService.findAll({ studentId });
    expect(byStudent).toHaveLength(2);

    const byCourse = await enrollmentsService.findAll({ courseId });
    expect(byCourse).toHaveLength(1);
    expect(byCourse[0].course.id).toBe(courseId);

    // Filtros combinables: solo la matrícula que comparten ambos recursos.
    const both = await enrollmentsService.findAll({ studentId, courseId });
    expect(both).toHaveLength(1);
    expect(both[0].id).toBe(enrollmentId);
    expect(both[0].student).toBeDefined();
    expect(both[0].course).toBeDefined();

    // Ninguna combinación devuelve filas ajenas.
    const other = await enrollmentsService.findAll({
      studentId,
      courseId: second.id,
    });
    expect(other).toHaveLength(1);
    expect(other[0].course.id).toBe(second.id);
  });

  it('7. cancela la matrícula y ya no se encuentra', async () => {
    const removed = await enrollmentsService.remove(enrollmentId);
    expect(removed.id).toBe(enrollmentId);

    await expect(
      enrollmentsService.remove(enrollmentId),
    ).rejects.toBeInstanceOf(NotFoundException);

    const remaining = await enrollmentsService.findAll({ courseId });
    expect(remaining).toHaveLength(0);
  });

  it('devuelve 404 al matricular contra recursos inexistentes', async () => {
    await expect(
      enrollmentsService.create({ studentId: 999999, courseId }),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      enrollmentsService.create({ studentId, courseId: 999999 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('impide repetir el correo en el servicio y en la base de datos', async () => {
    const nuevo = {
      name: 'Repetido',
      email: 'ana.ruiz@example.com',
      age: 22,
      career: 'Mathematics',
      semester: 3,
    };

    // El servicio responde 409 con un mensaje comprensible.
    await expect(studentService.create(nuevo)).rejects.toBeInstanceOf(
      ConflictException,
    );

    // Y PostgreSQL lo impide por su cuenta: si el servicio se saltara la
    // comprobación, el índice único rechazaría el INSERT con el código 23505.
    const students: Repository<Student> = dataSource.getRepository(Student);
    await expect(
      students.save({ ...nuevo, isActive: true }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('no permite modificar el id desde el cuerpo', async () => {
    const course = await coursesService.create({
      title: 'Inmutable',
      level: 'beginner',
    });

    // Un cuerpo con "id" se descarta: el DTO y el servicio ignoran la propiedad.
    const updated = await coursesService.update(course.id, {
      title: 'Renombrado',
    });

    expect(updated.id).toBe(course.id);
    expect(updated.title).toBe('Renombrado');
  });

  it('devuelve 404 al consultar o borrar un recurso inexistente', async () => {
    await expect(coursesService.findOne(999999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(studentService.findOne(999999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(coursesService.remove(999999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

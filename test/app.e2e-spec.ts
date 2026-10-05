import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  closeTestDataSource,
  createTestDataSource,
  dropTestTables,
} from './test-data-source';

/**
 * Prueba de extremo a extremo por HTTP contra la aplicación completa.
 *
 * La conexión real de `AppModule` se sustituye por una que usa el prefijo de
 * tablas `e2e_`, de modo que estas pruebas nunca tocan los datos locales de
 * desarrollo y `dropSchema` deja la base limpia al terminar.
 */
describe('CourseHub API (e2e HTTP)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let courseId: number;
  let studentId: number;

  beforeAll(async () => {
    dataSource = await createTestDataSource({ prefix: 'http_' });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    // Las tablas se borran antes de cerrar la conexión que las usa.
    await dropTestTables(dataSource, 'http_');
    await app.close();
    await closeTestDataSource(dataSource);
  });

  it('GET / responde con el mensaje de la API', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('coursehub-api está en linea');
  });

  it('GET /welcome responde con el mensaje de bienvenida', () => {
    return request(app.getHttpServer())
      .get('/welcome')
      .expect(200)
      .expect({ message: 'Bienvenido a CourseHub API' });
  });

  it('crea un curso y lo persiste', async () => {
    const res = await request(app.getHttpServer())
      .post('/courses')
      .send({ title: 'Curso e2e', level: 'beginner' })
      .expect(201);

    expect(res.body.id).toBeGreaterThan(0);
    courseId = res.body.id;

    await request(app.getHttpServer()).get(`/courses/${courseId}`).expect(200);
  });

  it('rechaza un curso con level inválido con 400', () => {
    return request(app.getHttpServer())
      .post('/courses')
      .send({ title: 'Malo', level: 'avanzado' })
      .expect(400);
  });

  it('devuelve 404 al pedir un curso inexistente', () => {
    return request(app.getHttpServer()).get('/courses/999999').expect(404);
  });

  it('devuelve 400 cuando el id de la ruta no es un entero positivo', () => {
    return request(app.getHttpServer()).get('/courses/abc').expect(400);
  });

  it('no deja modificar el id del curso desde el cuerpo', async () => {
    await request(app.getHttpServer())
      .patch(`/courses/${courseId}`)
      .send({ title: 'Renombrado' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/courses/${courseId}`)
      .expect(200);

    expect(res.body.id).toBe(courseId);
    expect(res.body.title).toBe('Renombrado');
  });

  it('rechaza una propiedad desconocida en el cuerpo con 400', () => {
    return request(app.getHttpServer())
      .post('/courses')
      .send({ title: 'Con extra', level: 'beginner', id: 42 })
      .expect(400);
  });

  it('crea un estudiante activo por defecto', async () => {
    const res = await request(app.getHttpServer())
      .post('/students')
      .send({
        name: 'Luis Paz',
        email: 'luis.paz@example.com',
        age: 21,
        career: 'Physics',
        semester: 4,
      })
      .expect(201);

    expect(res.body.isActive).toBe(true);
    studentId = res.body.id;
  });

  it('devuelve 409 al repetir el correo de un estudiante', () => {
    return request(app.getHttpServer())
      .post('/students')
      .send({
        name: 'Otro',
        email: 'luis.paz@example.com',
        age: 23,
        career: 'Math',
        semester: 6,
      })
      .expect(409);
  });

  it('filtra estudiantes por carrera y por estado', async () => {
    const res = await request(app.getHttpServer())
      .get('/students')
      .query({ career: 'Physics' })
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].career).toBe('Physics');

    await request(app.getHttpServer())
      .get('/students')
      .query({ isActive: 'true' })
      .expect(200);
  });

  it('devuelve 400 si el filtro isActive no es booleano', () => {
    return request(app.getHttpServer())
      .get('/students')
      .query({ isActive: 'quizá' })
      .expect(400);
  });

  it('crea una matrícula y la consulta con sus relaciones', async () => {
    const res = await request(app.getHttpServer())
      .post('/enrollments')
      .send({ studentId, courseId })
      .expect(201);

    expect(res.body.student.id).toBe(studentId);
    expect(res.body.course.id).toBe(courseId);

    const list = await request(app.getHttpServer())
      .get('/enrollments')
      .query({ studentId })
      .expect(200);

    expect(list.body).toHaveLength(1);
  });

  it('devuelve 409 al repetir la misma matrícula', () => {
    return request(app.getHttpServer())
      .post('/enrollments')
      .send({ studentId, courseId })
      .expect(409);
  });

  it('devuelve 404 al matricular contra un estudiante inexistente', () => {
    return request(app.getHttpServer())
      .post('/enrollments')
      .send({ studentId: 999999, courseId })
      .expect(404);
  });

  it('devuelve 400 al matricular un estudiante inactivo', async () => {
    await request(app.getHttpServer())
      .patch(`/students/${studentId}/status`)
      .send({ isActive: false })
      .expect(200);

    const otro = await request(app.getHttpServer())
      .post('/courses')
      .send({ title: 'Curso para inactivo', level: 'beginner' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/enrollments')
      .send({ studentId, courseId: otro.body.id })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/students/${studentId}/status`)
      .send({ isActive: true })
      .expect(200);
  });

  it('lista las matrículas por estudiante y por curso', async () => {
    const byStudent = await request(app.getHttpServer())
      .get(`/students/${studentId}/enrollments`)
      .expect(200);
    expect(byStudent.body).toHaveLength(1);

    const byCourse = await request(app.getHttpServer())
      .get(`/courses/${courseId}/enrollments`)
      .expect(200);
    expect(byCourse.body).toHaveLength(1);
  });

  it('devuelve 404 al pedir las matrículas de un curso inexistente', () => {
    return request(app.getHttpServer())
      .get('/courses/999999/enrollments')
      .expect(404);
  });

  it('cancela la matrícula con 204 y luego devuelve 404', async () => {
    const list = await request(app.getHttpServer())
      .get(`/enrollments?studentId=${studentId}`)
      .expect(200);
    const id = list.body[0].id;

    await request(app.getHttpServer()).delete(`/enrollments/${id}`).expect(204);

    await request(app.getHttpServer()).delete(`/enrollments/${id}`).expect(404);

    const after = await request(app.getHttpServer())
      .get(`/enrollments?studentId=${studentId}`)
      .expect(200);
    expect(after.body).toHaveLength(0);
  });

  it('devuelve 409 al borrar un recurso que tiene matrículas', async () => {
    const curso = await request(app.getHttpServer())
      .post('/courses')
      .send({ title: 'Curso ocupado', level: 'beginner' })
      .expect(201);
    const alumno = await request(app.getHttpServer())
      .post('/students')
      .send({
        name: 'Ocupado',
        email: 'ocupado@example.com',
        age: 24,
        career: 'Physics',
        semester: 6,
      })
      .expect(201);

    const matricula = await request(app.getHttpServer())
      .post('/enrollments')
      .send({ studentId: alumno.body.id, courseId: curso.body.id })
      .expect(201);

    // La tabla bloquea el borrado; la API lo explica con 409 en vez de 500.
    await request(app.getHttpServer())
      .delete(`/courses/${curso.body.id}`)
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/students/${alumno.body.id}`)
      .expect(409);

    // Al cancelar la matrícula, ambos recursos ya se pueden borrar.
    await request(app.getHttpServer())
      .delete(`/enrollments/${matricula.body.id}`)
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/courses/${curso.body.id}`)
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/students/${alumno.body.id}`)
      .expect(204);
  });

  it('devuelve 409 al borrar un estudiante inactivo', async () => {
    const res = await request(app.getHttpServer())
      .post('/students')
      .send({
        name: 'Inactivo',
        email: 'inactivo@example.com',
        age: 30,
        career: 'Math',
        semester: 2,
        isActive: false,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/students/${res.body.id}`)
      .expect(409);
  });
});

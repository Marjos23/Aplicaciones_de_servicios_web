import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('Enrollments (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const enroll = (studentId: number, courseId: number) =>
    request(app.getHttpServer())
      .post('/enrollments')
      .send({ studentId, courseId });

  it('registra una matrícula válida con id consecutivo', async () => {
    await enroll(1, 2).expect(201).expect({ id: 2, studentId: 1, courseId: 2 });
  });

  it('rechaza una matrícula duplicada con 409', async () => {
    await enroll(1, 2).expect(201);

    const response = await enroll(1, 2).expect(409);
    expect(response.body.statusCode).toBe(409);
    expect(response.body.message).toContain('ya está matriculado');
  });

  it('rechaza un estudiante inactivo con 400', async () => {
    const response = await enroll(3, 1).expect(400);
    expect(response.body.message).toContain('no está activo');
  });

  it('rechaza estudiante y curso inexistentes con 404', async () => {
    const student = await enroll(999, 1).expect(404);
    expect(student.body.message).toContain('Estudiante');

    const course = await enroll(1, 999).expect(404);
    expect(course.body.message).toContain('Curso');
  });

  it('lista con filtros opcionales combinables', async () => {
    await enroll(1, 2).expect(201);
    await enroll(2, 1).expect(201);

    await request(app.getHttpServer())
      .get('/enrollments')
      .expect(200)
      .expect(({ body }) => expect(body).toHaveLength(3));

    await request(app.getHttpServer())
      .get('/enrollments?studentId=1')
      .expect(200)
      .expect(({ body }) => expect(body).toHaveLength(2));

    await request(app.getHttpServer())
      .get('/enrollments?courseId=1')
      .expect(200)
      .expect(({ body }) => expect(body).toHaveLength(2));

    await request(app.getHttpServer())
      .get('/enrollments?studentId=1&courseId=1')
      .expect(200)
      .expect([{ id: 1, studentId: 1, courseId: 1 }]);
  });

  it('consulta matrículas por estudiante y por curso', async () => {
    await enroll(1, 2).expect(201);

    await request(app.getHttpServer())
      .get('/students/1/enrollments')
      .expect(200)
      .expect(({ body }) => expect(body).toHaveLength(2));

    await request(app.getHttpServer())
      .get('/courses/2/enrollments')
      .expect(200)
      .expect([{ id: 2, studentId: 1, courseId: 2 }]);
  });

  it('cancela una matrícula existente y reporta 404 si no existe', async () => {
    await request(app.getHttpServer())
      .delete('/enrollments/1')
      .expect(200)
      .expect({ id: 1, studentId: 1, courseId: 1 });

    await request(app.getHttpServer())
      .get('/enrollments')
      .expect(200)
      .expect([]);

    await request(app.getHttpServer()).delete('/enrollments/1').expect(404);
  });

  it('valida identificadores de ruta con el pipe personalizado', async () => {
    const response = await request(app.getHttpServer())
      .get('/courses/abc')
      .expect(400);
    expect(response.body.message).toContain('entero positivo');

    await request(app.getHttpServer())
      .get('/students/-5/enrollments')
      .expect(400);
  });

  it('aplica whitelist, forbidNonWhitelisted y validación del DTO', async () => {
    const extra = await request(app.getHttpServer())
      .post('/enrollments')
      .send({ studentId: 1, courseId: 1, hack: true })
      .expect(400);
    expect(extra.body.message).toContain('property hack should not exist');

    await request(app.getHttpServer())
      .post('/enrollments')
      .send({ studentId: 'uno', courseId: 1 })
      .expect(400);
  });
});

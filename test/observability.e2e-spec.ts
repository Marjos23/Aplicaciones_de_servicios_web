import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CoursesService } from '../src/courses/courses.service';
import { UserRole } from '../src/users/user-role.enum';
import { createTestAdmin, createTestUser, TEST_PASSWORD } from './auth-helper';
import {
  closeTestDataSource,
  createTestDataSource,
  dropTestTables,
} from './test-data-source';

describe('CourseHub API · arquitectura y transversales (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let logSpy: jest.SpyInstance;
  let courseId: number;
  let studentToken: string;

  beforeAll(async () => {
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    dataSource = await createTestDataSource({ prefix: 'arch_' });

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

    const adminToken = await createTestAdmin(app, dataSource);
    const student = await createTestUser(
      dataSource,
      'arch-student@example.com',
      UserRole.STUDENT,
    );
    studentToken = await app.get(JwtService).signAsync({
      sub: student.id,
      email: student.email,
    });

    const course = await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Curso de la arquitectura', level: 'beginner' })
      .expect(201);
    courseId = course.body.id;
  });

  afterAll(async () => {
    logSpy.mockRestore();
    await dropTestTables(dataSource, 'arch_');
    await app.close();
    await closeTestDataSource(dataSource);
  });

  const logs = () =>
    logSpy.mock.calls
      .map(([entry]) => entry)
      .filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === 'object' && entry !== null,
      );

  it('muestra los cuatro casos con una forma de error coherente', async () => {
    const correct = await request(app.getHttpServer())
      .get('/courses')
      .expect(200);
    expect(correct.headers['x-request-id']).toEqual(expect.any(String));
    expect(correct.headers['x-response-time']).toMatch(/ms$/);

    const cases = [
      {
        path: '/courses/abc',
        status: 400,
        request: () => request(app.getHttpServer()).get('/courses/abc'),
      },
      {
        path: '/courses/999999',
        status: 404,
        request: () => request(app.getHttpServer()).get('/courses/999999'),
      },
      {
        path: `/courses/${courseId}`,
        status: 403,
        request: () =>
          request(app.getHttpServer())
            .patch(`/courses/${courseId}`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ title: 'Sin permiso' }),
      },
    ];

    for (const { path, status, request: send } of cases) {
      const response = await send().expect(status);
      expect(response.body).toMatchObject({
        statusCode: status,
        path,
        timestamp: expect.any(String),
        requestId: expect.any(String),
      });
      expect(response.body.message).toBeDefined();
      expect(response.headers['x-request-id']).toBe(response.body.requestId);
    }
  });

  it('no expone trazas, SQL ni secretos en una respuesta inesperada', async () => {
    const failure = jest
      .spyOn(app.get(CoursesService), 'findAll')
      .mockRejectedValueOnce(
        new Error(
          `SELECT password_hash FROM users WHERE secret='${TEST_PASSWORD}'`,
        ),
      );

    const response = await request(app.getHttpServer())
      .get('/courses')
      .expect(500);

    failure.mockRestore();

    expect(response.body.message).toBe('Internal server error');
    expect(response.body.statusCode).toBe(500);
    const publicBody = JSON.stringify(response.body);
    expect(publicBody).not.toContain('password_hash');
    expect(publicBody).not.toContain(TEST_PASSWORD);
    expect(publicBody).not.toContain('at Object.');
  });

  it('registra solicitudes sin guardar credenciales ni cuerpos', async () => {
    logSpy.mockClear();

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'arch-student@example.com', password: TEST_PASSWORD })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/courses')
      .expect(200);
    const requestId = response.headers['x-request-id'];

    const entries = logs();
    const requestLogs = entries.filter((entry) => entry.event === 'request');

    expect(requestLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'request',
          requestId,
          method: 'GET',
          path: '/courses',
          status: 200,
          durationMs: expect.any(Number),
        }),
      ]),
    );
    expect(Object.keys(requestLogs[0]).sort()).toEqual(
      ['durationMs', 'event', 'method', 'path', 'requestId', 'status'].sort(),
    );

    const allLogs = JSON.stringify(entries);
    expect(allLogs).not.toContain('Bearer');
    expect(allLogs).not.toContain(TEST_PASSWORD);
    expect(allLogs).not.toContain('password');
  });
});

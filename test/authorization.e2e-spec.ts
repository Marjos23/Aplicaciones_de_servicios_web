import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { corsOptions } from '../src/common/config/cors.config';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/user-role.enum';
import { createTestUser, TEST_PASSWORD } from './auth-helper';
import {
  closeTestDataSource,
  createTestDataSource,
  dropTestTables,
} from './test-data-source';

describe('CourseHub API · autorización y seguridad (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  const tokens: Record<string, string> = {};
  const ids: Record<string, number> = {};
  let teacherCourseId: number;

  const tokenFor = (identity: string) => ({
    Authorization: `Bearer ${tokens[identity]}`,
  });

  async function signIn(email: string, role: UserRole, key: string) {
    const user = await createTestUser(dataSource, email, role);
    ids[key] = user.id;
    tokens[key] = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return user;
  }

  beforeAll(async () => {
    dataSource = await createTestDataSource({ prefix: 'authz_' });

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
    app.enableCors(corsOptions(app.get(ConfigService)));
    jwtService = app.get(JwtService);

    await app.init();

    await signIn('authz-admin@example.com', UserRole.ADMIN, 'admin');
    await signIn('authz-teacher@example.com', UserRole.TEACHER, 'teacher');
    await signIn('authz-other@example.com', UserRole.TEACHER, 'other');
    await signIn('authz-student@example.com', UserRole.STUDENT, 'student');

    const course = await request(app.getHttpServer())
      .post('/courses')
      .set(tokenFor('teacher'))
      .send({ title: 'Curso de la docente', level: 'beginner' })
      .expect(201);
    teacherCourseId = course.body.id;
  });

  afterAll(async () => {
    await dropTestTables(dataSource, 'authz_');
    await app.close();
    await closeTestDataSource(dataSource);
  });

  it('identifica al usuario con /auth/me y rechaza tokens ausentes o alterados', async () => {
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set(tokenFor('teacher'))
      .expect(200);
    expect(me.body).toMatchObject({
      email: 'authz-teacher@example.com',
      role: UserRole.TEACHER,
    });

    await request(app.getHttpServer()).get('/auth/me').expect(401);

    const altered = `${tokens.teacher.slice(0, -1)}X`;
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${altered}`)
      .expect(401);
  });

  it('da por defecto el rol student a una cuenta nueva', async () => {
    const email = 'authz-register@example.com';
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: TEST_PASSWORD })
      .expect(201);

    const user = await dataSource.getRepository(User).findOneBy({ email });
    expect(user?.role).toBe(UserRole.STUDENT);
  });

  it('aplica la matriz de cinco casos sobre PATCH /courses/:id', async () => {
    const body = { title: 'Modificado' };

    await request(app.getHttpServer())
      .patch(`/courses/${teacherCourseId}`)
      .send(body)
      .expect(401);

    await request(app.getHttpServer())
      .patch(`/courses/${teacherCourseId}`)
      .set(tokenFor('student'))
      .send(body)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/courses/${teacherCourseId}`)
      .set(tokenFor('other'))
      .send(body)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/courses/${teacherCourseId}`)
      .set(tokenFor('teacher'))
      .send(body)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/courses/${teacherCourseId}`)
      .set(tokenFor('admin'))
      .send(body)
      .expect(200);
  });

  it('reserva DELETE /courses/:id para administradores', async () => {
    await request(app.getHttpServer())
      .delete(`/courses/${teacherCourseId}`)
      .set(tokenFor('teacher'))
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/courses/${teacherCourseId}`)
      .set(tokenFor('admin'))
      .expect(204);
  });

  it('niega la creación de cursos a un estudiante autenticado', async () => {
    await request(app.getHttpServer())
      .post('/courses')
      .set(tokenFor('student'))
      .send({ title: 'No permitido', level: 'beginner' })
      .expect(403);
  });

  it('no toma el propietario del cuerpo de la petición', async () => {
    await request(app.getHttpServer())
      .post('/courses')
      .set(tokenFor('teacher'))
      .send({
        title: 'Con owner falso',
        level: 'beginner',
        createdByUserId: ids.admin,
      })
      .expect(400);

    const course = await request(app.getHttpServer())
      .post('/courses')
      .set(tokenFor('teacher'))
      .send({ title: 'Propietario real', level: 'beginner' })
      .expect(201);

    expect(course.body.createdByUserId).toBe(ids.teacher);
  });

  it('limita POST /auth/login a cinco intentos por minuto', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'authz-teacher@example.com', password: 'incorrecta' })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'authz-teacher@example.com', password: 'incorrecta' })
      .expect(429);
  });

  it('solo permite el origen CORS documentado', async () => {
    await request(app.getHttpServer())
      .get('/courses')
      .set('Origin', 'http://localhost:5173')
      .expect('Access-Control-Allow-Origin', 'http://localhost:5173');

    const response = await request(app.getHttpServer())
      .get('/courses')
      .set('Origin', 'https://origen-no-autorizado.example');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

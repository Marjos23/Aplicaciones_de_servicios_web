import request from 'supertest';
import { Course } from '../src/courses/entities/course.entity';
import { UserRole } from '../src/users/user-role.enum';
import { createTestAdmin, createTestUser, login } from './auth-helper';
import { closeE2eFixture, createE2eFixture, E2eFixture } from './e2e-fixture';

describe('Semana 13 · ruta pública, protegida y rechazo (e2e)', () => {
  const prefix = 'semana13_';
  const publicTitle = 'Curso público de prueba';
  const protectedTitle = 'Curso protegido de prueba';

  let fixture: E2eFixture;
  let adminToken: string;
  let studentToken: string;

  const http = () => request(fixture.app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    fixture = await createE2eFixture(prefix);
    const courses = fixture.dataSource.getRepository(Course);
    await courses.save(
      courses.create({ title: publicTitle, level: 'beginner' }),
    );

    adminToken = await createTestAdmin(
      fixture.app,
      fixture.dataSource,
      'semana13-admin@example.com',
    );
    await createTestUser(
      fixture.dataSource,
      'semana13-student@example.com',
      UserRole.STUDENT,
    );
    studentToken = await login(fixture.app, 'semana13-student@example.com');
  });

  afterAll(async () => {
    await closeE2eFixture(fixture);
  });

  it('responde 200 en una ruta pública con datos exclusivos de prueba', async () => {
    const response = await http().get('/courses').expect(200);

    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: publicTitle, level: 'beginner' }),
      ]),
    );
  });

  it('permite una escritura protegida con token de administrador', async () => {
    const response = await http()
      .post('/courses')
      .set(bearer(adminToken))
      .send({ title: protectedTitle, level: 'advanced' })
      .expect(201);

    expect(response.body).toMatchObject({
      title: protectedTitle,
      level: 'advanced',
    });
    expect(response.body.createdByUserId).toBeGreaterThan(0);

    const stored = await fixture.dataSource
      .getRepository(Course)
      .findOneBy({ id: response.body.id });
    expect(stored?.title).toBe(protectedTitle);
  });

  it('rechaza la escritura sin token (401) y con rol insuficiente (403)', async () => {
    await http()
      .post('/courses')
      .send({ title: 'Sin token', level: 'beginner' })
      .expect(401);

    await http()
      .post('/courses')
      .set(bearer(studentToken))
      .send({ title: 'Sin permiso', level: 'beginner' })
      .expect(403);
  });
});

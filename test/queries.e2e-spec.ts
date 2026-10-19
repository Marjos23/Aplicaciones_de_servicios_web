import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  closeTestDataSource,
  createTestDataSource,
  dropTestTables,
} from './test-data-source';

/**
 * Semana 6, sesiones 11 y 12: filtros, paginación, ordenamiento y búsqueda.
 *
 * Se prueba por HTTP contra la aplicación completa y PostgreSQL real. Los
 * datos de esta suite viven en tablas con prefijo `query_` para no mezclarse
 * con los de desarrollo ni con las otras suites.
 */
describe('CourseHub API · filtros, paginación y búsqueda (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const courseTitles = [
    'Análisis de APIs',
    'Autómatas y lenguajes',
    'Bases de datos',
    'Compiladores',
    'Estructuras de datos',
    'NestJS avanzado',
    'Redes de computadoras',
    'Sistemas operativos',
  ];

  beforeAll(async () => {
    dataSource = await createTestDataSource({ prefix: 'query_' });

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

    // Ocho cursos con títulos y niveles distintos: una lista de uno o dos
    // registros no permite comprobar una página real.
    const levels = ['beginner', 'advanced', 'intermediate'];
    for (let i = 0; i < courseTitles.length; i++) {
      await request(app.getHttpServer())
        .post('/courses')
        .send({ title: courseTitles[i], level: levels[i % levels.length] })
        .expect(201);
    }

    // Estudiantes con nombres que permiten probar coincidencias parciales.
    await request(app.getHttpServer()).post('/students').send({
      name: 'Ana Torres',
      email: 'ana.torres@example.edu',
      age: 20,
      career: 'Software',
      semester: 4,
    });
    await request(app.getHttpServer()).post('/students').send({
      name: 'Anabel Gómez',
      email: 'anabel@example.edu',
      age: 22,
      career: 'Software',
      semester: 6,
    });

    // Matrículas: dos de Ana (una en un curso con "API" en el título) y una
    // de Anabel en un curso NestJS.
    const courses = await request(app.getHttpServer())
      .get('/courses?limit=50&sortBy=title')
      .expect(200);
    const byTitle = (fragment: string) =>
      courses.body.items.find((c: { title: string }) =>
        c.title.includes(fragment),
      ).id;

    const students = await request(app.getHttpServer())
      .get('/students?career=Software')
      .expect(200);
    const ana = students.body.find(
      (s: { name: string }) => s.name === 'Ana Torres',
    ).id;
    const anabel = students.body.find(
      (s: { name: string }) => s.name === 'Anabel Gómez',
    ).id;

    await request(app.getHttpServer())
      .post('/enrollments')
      .send({ studentId: ana, courseId: byTitle('Análisis') })
      .expect(201);
    await request(app.getHttpServer())
      .post('/enrollments')
      .send({ studentId: ana, courseId: byTitle('Bases') })
      .expect(201);
    await request(app.getHttpServer())
      .post('/enrollments')
      .send({ studentId: anabel, courseId: byTitle('NestJS') })
      .expect(201);
  });

  afterAll(async () => {
    await dropTestTables(dataSource, 'query_');
    await app.close();
    await closeTestDataSource(dataSource);
  });

  describe('GET /courses · filtros, paginación y ordenamiento', () => {
    it('devuelve items y meta con los valores por defecto', async () => {
      const res = await request(app.getHttpServer())
        .get('/courses')
        .expect(200);

      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items).toHaveLength(8);
      expect(res.body.meta).toEqual({
        total: 8,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('limita el tamaño de la página y calcula totalPages', async () => {
      const res = await request(app.getHttpServer())
        .get('/courses?page=1&limit=3&sortBy=title&order=ASC')
        .expect(200);

      expect(res.body.items).toHaveLength(3);
      expect(res.body.meta).toEqual({
        total: 8,
        page: 1,
        limit: 3,
        totalPages: 3,
      });
      // Con sortBy=title el primero es el alfabéticamente menor.
      expect(res.body.items[0].title).toBe('Análisis de APIs');
    });

    it('recorre dos páginas sin repetir ni saltarse cursos', async () => {
      const first = await request(app.getHttpServer())
        .get('/courses?page=1&limit=3&sortBy=title&order=ASC')
        .expect(200);
      const second = await request(app.getHttpServer())
        .get('/courses?page=2&limit=3&sortBy=title&order=ASC')
        .expect(200);

      const ids = [
        ...first.body.items.map((c: { id: number }) => c.id),
        ...second.body.items.map((c: { id: number }) => c.id),
      ];
      expect(new Set(ids).size).toBe(6);
    });

    it('ordena de forma descendente por título', async () => {
      const res = await request(app.getHttpServer())
        .get('/courses?sortBy=title&order=DESC&limit=1')
        .expect(200);

      expect(res.body.items[0].title).toBe('Sistemas operativos');
    });

    it('filtra por level', async () => {
      const res = await request(app.getHttpServer())
        .get('/courses?level=beginner')
        .expect(200);

      expect(res.body.meta.total).toBe(3);
      expect(
        res.body.items.every((c: { level: string }) => c.level === 'beginner'),
      ).toBe(true);
    });

    it('omite el filtro level cuando no se envía', async () => {
      const res = await request(app.getHttpServer())
        .get('/courses')
        .expect(200);
      expect(res.body.meta.total).toBe(8);
    });

    it.each([
      ['page=0', 'página menor que uno'],
      ['limit=200', 'límite por encima del máximo'],
      ['sortBy=createdAt', 'campo de orden no permitido'],
      ['order=sideways', 'orden distinto de ASC/DESC'],
    ])('responde 400 con %s (%s)', (query) => {
      return request(app.getHttpServer())
        .get(`/courses?${query}`)
        .expect(400);
    });
  });

  describe('GET /enrollments · búsqueda y filtros combinables', () => {
    it('busca por nombre de estudiante y título de curso sin distinguir mayúsculas', async () => {
      const res = await request(app.getHttpServer())
        .get('/enrollments?search=nest')
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].course.title).toBe('NestJS avanzado');
      expect(res.body.items[0].student.name).toBe('Anabel Gómez');
    });

    it('la búsqueda parcial coincide con varios registros', async () => {
      // "Ana" aparece en Ana Torres y Anabel Gómez.
      const res = await request(app.getHttpServer())
        .get('/enrollments?search=ana')
        .expect(200);
      expect(res.body.meta.total).toBe(3);
    });

    it('devuelve 200 con lista vacía cuando la búsqueda no tiene resultados', async () => {
      const res = await request(app.getHttpServer())
        .get('/enrollments?search=inexistente')
        .expect(200);

      expect(res.body.items).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('combina búsqueda, filtro de estudiante y paginación', async () => {
      const res = await request(app.getHttpServer())
        .get('/enrollments?search=ana&page=1&limit=2')
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.meta).toEqual({
        total: 3,
        page: 1,
        limit: 2,
        totalPages: 2,
      });
    });

    it('filtra solo estudiantes activos con activeOnly=true', async () => {
      const students = await request(app.getHttpServer())
        .get('/students?career=Software')
        .expect(200);
      const anabel = students.body.find(
        (s: { name: string }) => s.name === 'Anabel Gómez',
      ).id;
      await request(app.getHttpServer())
        .patch(`/students/${anabel}/status`)
        .send({ isActive: false })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/enrollments?activeOnly=true')
        .expect(200);
      expect(res.body.meta.total).toBe(2);
      expect(
        res.body.items.every(
          (e: { student: { isActive: boolean } }) => e.student.isActive,
        ),
      ).toBe(true);

      await request(app.getHttpServer())
        .patch(`/students/${anabel}/status`)
        .send({ isActive: true })
        .expect(200);
    });

    it('trata un intento de inyección SQL como texto, sin alterar la consulta', async () => {
      const res = await request(app.getHttpServer())
        .get(`/enrollments?search=${encodeURIComponent("' OR 1=1 --")}`)
        .expect(200);

      expect(res.body.items).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('responde 400 si limit supera el máximo', () => {
      return request(app.getHttpServer())
        .get('/enrollments?limit=200')
        .expect(400);
    });
  });
});

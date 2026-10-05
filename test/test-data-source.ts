import { DataSource } from 'typeorm';
import { Course } from '../src/courses/entities/course.entity';
import { Student } from '../src/students/entities/student.entity';
import { Enrollment } from '../src/enrollments/entities/enrollment.entity';

const ENTITIES = [Course, Student, Enrollment];

/**
 * Conexión propia para las pruebas, separada de la de la aplicación.
 *
 * Usa la misma base de datos que `.env` pero con un prefijo de tablas propio,
 * de modo que ejecutar las pruebas no mezcle sus filas con las de desarrollo.
 * Cada suite pide un prefijo distinto porque Jest las ejecuta en paralelo.
 *
 * IMPORTANTE: no se usa `dropSchema`. En PostgreSQL el esquema es único para
 * toda la base de datos, así que esa opción borraría también las tablas reales
 * de la aplicación. Solo se eliminan las tablas prefijadas de la suite.
 */
export async function createTestDataSource(
  options: { prefix?: string } = {},
): Promise<DataSource> {
  const prefix = options.prefix ?? 'e2e_';

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: ENTITIES,
    synchronize: true,
    entityPrefix: prefix,
  });

  await dataSource.initialize();
  return dataSource;
}

/**
 * Deja la base limpia: borra las tablas prefijadas de la suite.
 *
 * Se eligen las tablas por prefijo en lugar de usar `dropSchema`, porque en
 * PostgreSQL el esquema es único para toda la base de datos: `dropSchema`
 * borraría también las tablas reales de la aplicación.
 */
export async function dropTestTables(
  dataSource: DataSource,
  prefix: string,
): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    const tables = await queryRunner.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename LIKE $1`,
      [`${prefix}%`],
    );
    if (tables.length > 0) {
      const names = tables.map(
        (table: { tablename: string }) => `"${table.tablename}"`,
      );
      await queryRunner.query(`DROP TABLE ${names.join(', ')} CASCADE`);
    }
  } finally {
    await queryRunner.release();
  }
}

export async function closeTestDataSource(
  dataSource: DataSource,
): Promise<void> {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
}

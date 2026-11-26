import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  closeTestDataSource,
  createTestDataSource,
  dropTestTables,
} from './test-data-source';

export interface E2eFixture {
  app: INestApplication;
  dataSource: DataSource;
  prefix: string;
}

export async function createE2eFixture(prefix: string): Promise<E2eFixture> {
  const dataSource = await createTestDataSource({ prefix, reset: true });
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getDataSourceToken())
    .useValue(dataSource)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();

  return { app, dataSource, prefix };
}

export async function closeE2eFixture(fixture: E2eFixture): Promise<void> {
  await dropTestTables(fixture.dataSource, fixture.prefix);
  await fixture.app.close();
  await closeTestDataSource(fixture.dataSource);
}

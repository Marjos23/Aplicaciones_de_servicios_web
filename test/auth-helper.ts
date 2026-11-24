import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/user-role.enum';

export const TEST_PASSWORD = 'Password123!';

export async function createTestUser(
  dataSource: DataSource,
  email: string,
  role: UserRole,
): Promise<User> {
  const repository = dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const existing = await repository.findOneBy({ email });

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = role;
    return repository.save(existing);
  }

  return repository.save(
    repository.create({ email, passwordHash, role }),
  );
}

export async function login(
  app: INestApplication,
  email: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);

  return response.body.accessToken;
}

export async function createTestAdmin(
  app: INestApplication,
  dataSource: DataSource,
  email = 'e2e-admin@example.com',
): Promise<string> {
  await createTestUser(dataSource, email, UserRole.ADMIN);
  return login(app, email);
}

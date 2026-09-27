import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../src/http/app.js';

const symbols = [
  { symbol: 'AAPL', name: 'Apple', initialPrice: 188.25 },
  { symbol: 'MSFT', name: 'Microsoft', initialPrice: 421.5 },
  { symbol: 'NVDA', name: 'NVIDIA', initialPrice: 135.75 },
];

interface AuthResponseBody {
  token: string;
  user: { username: string; cash: number };
}

interface AccountResponseBody {
  cash: number;
  reservedCash: number;
  availableCash: number;
  positions: Array<{ quantity: number; reservedQuantity: number; availableQuantity: number }>;
}

describe('authentication API', () => {
  let app: Express;

  beforeEach(() => {
    app = createApplication({ symbols });
  });

  it('registers a user with starting cash and seeded positions without exposing secrets', async () => {
    const registration = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'correct-horse' })
      .expect(201);
    const registrationBody = registration.body as unknown as AuthResponseBody;

    expect(registrationBody.token).toEqual(expect.any(String));
    expect(registrationBody.user).toEqual(
      expect.objectContaining({ username: 'alice', cash: 1_000_000 }),
    );
    expect(JSON.stringify(registrationBody)).not.toContain('correct-horse');
    expect(JSON.stringify(registrationBody)).not.toContain('passwordHash');

    const account = await request(app)
      .get('/api/account')
      .set('Authorization', `Bearer ${registrationBody.token}`)
      .expect(200);
    const accountBody = account.body as unknown as AccountResponseBody;

    expect(accountBody).toEqual(
      expect.objectContaining({
        cash: 1_000_000,
        reservedCash: 0,
        availableCash: 1_000_000,
      }),
    );
    expect(accountBody.positions).toHaveLength(3);
    expect(accountBody.positions[0]).toEqual(
      expect.objectContaining({ quantity: 1_000, reservedQuantity: 0, availableQuantity: 1_000 }),
    );
  });

  it('rejects invalid and duplicate registrations with normalized errors', async () => {
    const invalid = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a', password: 'short' })
      .expect(400);

    expect(invalid.body as unknown).toEqual({
      error: { code: 'VALIDATION_ERROR', message: '用户名至少需要 3 个字符' },
    });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'correct-horse' })
      .expect(201);

    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'another-secret' })
      .expect(409);

    expect(duplicate.body as unknown).toEqual({
      error: { code: 'USERNAME_TAKEN', message: '用户名已存在' },
    });
  });

  it('logs in valid users and protects account access with bearer sessions', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'correct-horse' })
      .expect(201);

    await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'wrong-password' })
      .expect(401);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'correct-horse' })
      .expect(200);
    const loginBody = login.body as unknown as AuthResponseBody;

    await request(app).get('/api/account').expect(401);
    await request(app)
      .get('/api/account')
      .set('Authorization', `Bearer ${loginBody.token}`)
      .expect(200);
  });
});

import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../src/http/app.js';

const symbols = [{ symbol: 'AAPL', name: 'Apple', initialPrice: 100 }];

interface AuthBody {
  token: string;
}

interface AccountBody {
  cash: number;
  reservedCash: number;
  positions: Array<{ symbol: string; quantity: number; reservedQuantity: number }>;
  orders: Array<{ side: string; status: string; remainingQuantity: number }>;
  trades: Array<{ symbol: string; price: number; quantity: number }>;
}

describe('trading API', () => {
  let app: Express;

  beforeEach(() => {
    app = createApplication({ symbols });
  });

  async function register(username: string): Promise<string> {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'correct-horse' })
      .expect(201);
    return (response.body as unknown as AuthBody).token;
  }

  it('matches two users and exposes settled account snapshots', async () => {
    const sellerToken = await register('seller');
    const buyerToken = await register('buyer');

    const resting = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ symbol: 'AAPL', side: 'sell', price: 100, quantity: 4 })
      .expect(201);
    const restingBody = resting.body as unknown as { order: { status: string } };
    expect(restingBody.order.status).toBe('open');

    const crossing = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ symbol: 'AAPL', side: 'buy', price: 105, quantity: 4 })
      .expect(201);
    const crossingBody = crossing.body as unknown as { account: AccountBody };
    expect(crossingBody.account).toEqual(
      expect.objectContaining({ cash: 999_600, reservedCash: 0 }),
    );
    expect(crossingBody.account.orders[0]).toEqual(
      expect.objectContaining({ side: 'buy', status: 'filled', remainingQuantity: 0 }),
    );
    expect(crossingBody.account.trades[0]).toEqual(
      expect.objectContaining({ symbol: 'AAPL', price: 100, quantity: 4 }),
    );

    const seller = await request(app)
      .get('/api/account')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);
    const sellerBody = seller.body as unknown as AccountBody;
    expect(sellerBody.cash).toBe(1_000_400);
    expect(sellerBody.positions[0]).toEqual(
      expect.objectContaining({ symbol: 'AAPL', quantity: 996, reservedQuantity: 0 }),
    );
    expect(sellerBody.orders[0]?.status).toBe('filled');
    expect(sellerBody.trades).toHaveLength(1);
  });

  it('normalizes validation and resource errors without mutating account state', async () => {
    const token = await register('alice');
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'AAPL', side: 'buy', price: -1, quantity: 0 })
      .expect(400);

    const rejected = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'AAPL', side: 'buy', price: 10_000, quantity: 1_000 })
      .expect(422);
    expect(rejected.body as unknown).toEqual({
      error: { code: 'INSUFFICIENT_CASH', message: '可用资金不足' },
    });

    const accountResponse = await request(app)
      .get('/api/account')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const accountBody = accountResponse.body as unknown as AccountBody;
    expect(accountBody.cash).toBe(1_000_000);
    expect(accountBody.reservedCash).toBe(0);
    expect(accountBody.orders).toHaveLength(0);
  });
});

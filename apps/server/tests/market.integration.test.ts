import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../src/http/app.js';

const symbols = [
  { symbol: 'AAPL', name: 'Apple', initialPrice: 188.25 },
  { symbol: 'MSFT', name: 'Microsoft', initialPrice: 421.5 },
  { symbol: 'NVDA', name: 'NVIDIA', initialPrice: 135.75 },
];

describe('market API', () => {
  let app: Express;

  beforeEach(() => {
    app = createApplication({ symbols });
  });

  it('returns the current public market snapshot', async () => {
    const response = await request(app).get('/api/market').expect(200);
    const body = response.body as unknown as Array<{
      symbol: string;
      name: string;
      price: number;
      changePercent: number;
    }>;

    expect(body).toHaveLength(3);
    expect(body.map((quote) => quote.symbol)).toEqual(['AAPL', 'MSFT', 'NVDA']);
    expect(body.every((quote) => quote.price > 0 && Number.isFinite(quote.changePercent))).toBe(true);
  });
});

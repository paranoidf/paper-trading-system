import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApplication } from '../src/http/app.js';

describe('HTTP error boundary', () => {
  it('normalizes malformed JSON without exposing an HTML error page', async () => {
    const app = createApplication({
      symbols: [{ symbol: 'AAPL', name: 'Apple', initialPrice: 100 }],
    });

    const response = await request(app)
      .post('/api/auth/register')
      .set('content-type', 'application/json')
      .send('{"username":')
      .expect(400);

    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body as unknown).toEqual({
      error: { code: 'INVALID_JSON', message: '请求 JSON 格式无效' },
    });
    expect(response.text).not.toContain('SyntaxError');
  });
});

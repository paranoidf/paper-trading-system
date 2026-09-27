import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../src/http/app.js';

describe('production static serving', () => {
  let app: Express;
  let staticDirectory: string;

  beforeEach(async () => {
    staticDirectory = await mkdtemp(join(tmpdir(), 'paper-trading-web-'));
    await writeFile(join(staticDirectory, 'index.html'), '<!doctype html><title>Trading UI</title>');
    app = createApplication({
      symbols: [{ symbol: 'AAPL', name: 'Apple', initialPrice: 100 }],
      staticDirectory,
    });
  });

  afterEach(async () => {
    await rm(staticDirectory, { recursive: true, force: true });
  });

  it('serves the SPA entry for root and client-side routes', async () => {
    const root = await request(app).get('/').expect(200);
    const deepLink = await request(app).get('/portfolio').expect(200);

    expect(root.text).toContain('<title>Trading UI</title>');
    expect(deepLink.text).toContain('<title>Trading UI</title>');
  });

  it('keeps unknown API responses as JSON 404 errors', async () => {
    const response = await request(app).get('/api/missing').expect(404);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body as unknown).toEqual({
      error: { code: 'NOT_FOUND', message: '请求的资源不存在' },
    });
  });
});

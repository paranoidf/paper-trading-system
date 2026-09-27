import express, { type Request } from 'express';
import { z } from 'zod';
import { IdentityError, IdentityStore, type SeedSymbol } from '../domain/identity.js';

interface ApplicationOptions {
  symbols: SeedSymbol[];
}

const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, '用户名至少需要 3 个字符')
    .max(24, '用户名不能超过 24 个字符')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
  password: z.string().min(8, '密码至少需要 8 个字符').max(72, '密码不能超过 72 个字符'),
});

function bearerToken(request: Request): string | undefined {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return undefined;
  const token = authorization.slice('Bearer '.length).trim();
  return token || undefined;
}

export function createApplication(options: ApplicationOptions): express.Express {
  const app = express();
  const identity = new IdentityStore(options.symbols);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.post('/api/auth/register', (request, response) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '输入无效' },
      });
      return;
    }
    try {
      response.status(201).json(identity.register(parsed.data.username, parsed.data.password));
    } catch (error) {
      if (error instanceof IdentityError && error.code === 'USERNAME_TAKEN') {
        response.status(409).json({ error: { code: error.code, message: error.message } });
        return;
      }
      throw error;
    }
  });

  app.post('/api/auth/login', (request, response) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '输入无效' },
      });
      return;
    }
    try {
      response.json(identity.login(parsed.data.username, parsed.data.password));
    } catch (error) {
      if (error instanceof IdentityError && error.code === 'INVALID_CREDENTIALS') {
        response.status(401).json({ error: { code: error.code, message: error.message } });
        return;
      }
      throw error;
    }
  });

  app.get('/api/account', (request, response) => {
    try {
      response.json(identity.snapshot(bearerToken(request)));
    } catch (error) {
      if (error instanceof IdentityError && error.code === 'UNAUTHORIZED') {
        response.status(401).json({ error: { code: error.code, message: error.message } });
        return;
      }
      throw error;
    }
  });

  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: '请求的资源不存在' } });
  });

  return app;
}

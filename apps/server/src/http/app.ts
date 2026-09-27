import express, { type Request } from 'express';
import { z } from 'zod';
import { IdentityError, IdentityStore } from '../domain/identity.js';
import { MarketService, type SeedSymbol } from '../domain/market.js';
import {
  TradingEngine,
  TradingError,
  type LimitOrder,
  type Trade,
} from '../domain/trading.js';

interface ApplicationOptions {
  symbols: SeedSymbol[];
  market?: MarketService;
}

type AccountListener = (userIds: Set<string>) => void;

export interface ApplicationSystem {
  app: express.Express;
  identity: IdentityStore;
  market: MarketService;
  trading: TradingEngine;
  accountForUser: (userId: string) => ReturnType<IdentityStore['snapshotForUser']>;
  subscribeAccounts: (listener: AccountListener) => () => void;
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

const orderSchema = z.object({
  symbol: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  side: z.enum(['buy', 'sell']),
  price: z
    .number()
    .positive('价格必须大于 0')
    .max(1_000_000)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, '价格最多保留两位小数'),
  quantity: z.number().int('数量必须是整数').positive('数量必须大于 0').max(1_000_000),
});

function bearerToken(request: Request): string | undefined {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return undefined;
  const token = authorization.slice('Bearer '.length).trim();
  return token || undefined;
}

function serializeOrder(order: LimitOrder) {
  return {
    id: order.id,
    symbol: order.symbol,
    side: order.side,
    price: order.priceCents / 100,
    quantity: order.quantity,
    remainingQuantity: order.remainingQuantity,
    status: order.status,
    createdAt: new Date(order.createdAt).toISOString(),
  };
}

function serializeTrade(trade: Trade) {
  return {
    id: trade.id,
    symbol: trade.symbol,
    price: trade.priceCents / 100,
    quantity: trade.quantity,
    buyerId: trade.buyerId,
    sellerId: trade.sellerId,
    executedAt: new Date(trade.executedAt).toISOString(),
  };
}

export function createSystem(options: ApplicationOptions): ApplicationSystem {
  const app = express();
  const identity = new IdentityStore(options.symbols);
  const market = options.market ?? new MarketService(options.symbols);
  const trading = new TradingEngine({
    symbols: options.symbols.map((stock) => stock.symbol),
    accountById: (id) => identity.accountById(id),
  });
  const accountListeners = new Set<AccountListener>();

  const accountForUser = (userId: string) =>
    identity.snapshotForUser(
      userId,
      trading.ordersForUser(userId).map(serializeOrder),
      trading.tradesForUser(userId).map(serializeTrade),
    );

  const accountForToken = (token: string | undefined) => {
    const userId = identity.userIdByToken(token);
    if (!userId) throw new IdentityError('UNAUTHORIZED', '登录已失效，请重新登录');
    return accountForUser(userId);
  };

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/market', (_request, response) => {
    response.json(market.snapshot());
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
      response.json(accountForToken(bearerToken(request)));
    } catch (error) {
      if (error instanceof IdentityError && error.code === 'UNAUTHORIZED') {
        response.status(401).json({ error: { code: error.code, message: error.message } });
        return;
      }
      throw error;
    }
  });

  app.post('/api/orders', (request, response) => {
    const token = bearerToken(request);
    const userId = identity.userIdByToken(token);
    if (!userId) {
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: '登录已失效，请重新登录' } });
      return;
    }
    const parsed = orderSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '输入无效' },
      });
      return;
    }

    try {
      const result = trading.placeOrder({
        userId,
        symbol: parsed.data.symbol,
        side: parsed.data.side,
        priceCents: Math.round(parsed.data.price * 100),
        quantity: parsed.data.quantity,
      });
      const affectedUserIds = new Set([userId]);
      for (const trade of result.trades) {
        affectedUserIds.add(trade.buyerId);
        affectedUserIds.add(trade.sellerId);
      }
      for (const listener of accountListeners) listener(affectedUserIds);
      response.status(201).json({
        order: serializeOrder(result.order),
        account: accountForUser(userId),
      });
    } catch (error) {
      if (error instanceof TradingError) {
        const status = error.code === 'INSUFFICIENT_CASH' || error.code === 'INSUFFICIENT_POSITION' ? 422 : 400;
        response.status(status).json({ error: { code: error.code, message: error.message } });
        return;
      }
      throw error;
    }
  });

  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: '请求的资源不存在' } });
  });

  return {
    app,
    identity,
    market,
    trading,
    accountForUser,
    subscribeAccounts(listener) {
      accountListeners.add(listener);
      return () => accountListeners.delete(listener);
    },
  };
}

export function createApplication(options: ApplicationOptions): express.Express {
  return createSystem(options).app;
}

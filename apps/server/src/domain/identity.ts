import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { SeedSymbol } from './market.js';

interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  cashCents: number;
  positions: Map<string, StoredPosition>;
}

interface StoredPosition {
  symbol: string;
  name: string;
  quantity: number;
  reservedQuantity: number;
  averageCostCents: number;
}

export interface PublicUser {
  id: string;
  username: string;
  cash: number;
}

export interface AccountSnapshot {
  user: { id: string; username: string };
  cash: number;
  reservedCash: number;
  availableCash: number;
  positions: Array<{
    symbol: string;
    name: string;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    averageCost: number;
  }>;
  orders: unknown[];
  trades: unknown[];
}

export class IdentityError extends Error {
  constructor(
    readonly code: 'USERNAME_TAKEN' | 'INVALID_CREDENTIALS' | 'UNAUTHORIZED',
    message: string,
  ) {
    super(message);
  }
}

const STARTING_CASH_CENTS = 100_000_000;
const STARTING_SHARES = 1_000;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function dollars(cents: number): number {
  return cents / 100;
}

export class IdentityStore {
  private readonly usersById = new Map<string, StoredUser>();
  private readonly userIdsByName = new Map<string, string>();
  private readonly userIdsByToken = new Map<string, string>();

  constructor(private readonly symbols: SeedSymbol[]) {}

  register(username: string, password: string): { token: string; user: PublicUser } {
    if (this.userIdsByName.has(username)) {
      throw new IdentityError('USERNAME_TAKEN', '用户名已存在');
    }

    const id = randomUUID();
    const positions = new Map(
      this.symbols.map((stock) => [
        stock.symbol,
        {
          symbol: stock.symbol,
          name: stock.name,
          quantity: STARTING_SHARES,
          reservedQuantity: 0,
          averageCostCents: Math.round(stock.initialPrice * 100),
        },
      ]),
    );
    const user: StoredUser = {
      id,
      username,
      passwordHash: hashPassword(password),
      cashCents: STARTING_CASH_CENTS,
      positions,
    };
    this.usersById.set(id, user);
    this.userIdsByName.set(username, id);
    return { token: this.createSession(id), user: this.toPublicUser(user) };
  }

  login(username: string, password: string): { token: string; user: PublicUser } {
    const id = this.userIdsByName.get(username);
    const user = id ? this.usersById.get(id) : undefined;
    if (!user || !passwordMatches(password, user.passwordHash)) {
      throw new IdentityError('INVALID_CREDENTIALS', '用户名或密码错误');
    }
    return { token: this.createSession(user.id), user: this.toPublicUser(user) };
  }

  requireUserByToken(token: string | undefined): StoredUser {
    const userId = token ? this.userIdsByToken.get(token) : undefined;
    const user = userId ? this.usersById.get(userId) : undefined;
    if (!user) throw new IdentityError('UNAUTHORIZED', '登录已失效，请重新登录');
    return user;
  }

  snapshot(token: string | undefined): AccountSnapshot {
    const user = this.requireUserByToken(token);
    const reservedCashCents = 0;
    return {
      user: { id: user.id, username: user.username },
      cash: dollars(user.cashCents),
      reservedCash: dollars(reservedCashCents),
      availableCash: dollars(user.cashCents - reservedCashCents),
      positions: [...user.positions.values()].map((position) => ({
        symbol: position.symbol,
        name: position.name,
        quantity: position.quantity,
        reservedQuantity: position.reservedQuantity,
        availableQuantity: position.quantity - position.reservedQuantity,
        averageCost: dollars(position.averageCostCents),
      })),
      orders: [],
      trades: [],
    };
  }

  private createSession(userId: string): string {
    const token = randomBytes(32).toString('base64url');
    this.userIdsByToken.set(token, userId);
    return token;
  }

  private toPublicUser(user: StoredUser): PublicUser {
    return { id: user.id, username: user.username, cash: dollars(user.cashCents) };
  }
}

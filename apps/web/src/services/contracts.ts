import type {
  AccountSnapshot,
  AuthResponse,
  MarketQuote,
  Order,
  OrderResponse,
  Position,
  Trade,
  UserSummary,
} from '../types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isUser(value: unknown): value is UserSummary {
  return isRecord(value) && typeof value.id === 'string' && typeof value.username === 'string' && (value.cash === undefined || isFiniteNumber(value.cash));
}

function isPosition(value: unknown): value is Position {
  return isRecord(value) && typeof value.symbol === 'string' && typeof value.name === 'string' && isFiniteNumber(value.quantity) && isFiniteNumber(value.reservedQuantity) && isFiniteNumber(value.availableQuantity) && isFiniteNumber(value.averageCost);
}

function isOrder(value: unknown): value is Order {
  return isRecord(value) && typeof value.id === 'string' && typeof value.symbol === 'string' && (value.side === 'buy' || value.side === 'sell') && isFiniteNumber(value.price) && isFiniteNumber(value.quantity) && isFiniteNumber(value.remainingQuantity) && (value.status === 'open' || value.status === 'partially_filled' || value.status === 'filled') && typeof value.createdAt === 'string';
}

function isTrade(value: unknown): value is Trade {
  return isRecord(value) && typeof value.id === 'string' && typeof value.symbol === 'string' && isFiniteNumber(value.price) && isFiniteNumber(value.quantity) && typeof value.buyerId === 'string' && typeof value.sellerId === 'string' && typeof value.executedAt === 'string';
}

function isMarketQuote(value: unknown): value is MarketQuote {
  return isRecord(value) && typeof value.symbol === 'string' && typeof value.name === 'string' && isFiniteNumber(value.price) && isFiniteNumber(value.changePercent);
}

export function isMarketQuotes(value: unknown): value is MarketQuote[] {
  return Array.isArray(value) && value.every(isMarketQuote);
}

export function isAccountSnapshot(value: unknown): value is AccountSnapshot {
  return isRecord(value) && isUser(value.user) && isFiniteNumber(value.cash) && isFiniteNumber(value.reservedCash) && isFiniteNumber(value.availableCash) && Array.isArray(value.positions) && value.positions.every(isPosition) && Array.isArray(value.orders) && value.orders.every(isOrder) && Array.isArray(value.trades) && value.trades.every(isTrade);
}

export function isAuthResponse(value: unknown): value is AuthResponse {
  return isRecord(value) && typeof value.token === 'string' && value.token.length > 0 && isUser(value.user);
}

export function isOrderResponse(value: unknown): value is OrderResponse {
  return isRecord(value) && isOrder(value.order) && isAccountSnapshot(value.account);
}

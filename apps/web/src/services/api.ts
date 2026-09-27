import type {
  AccountSnapshot,
  AuthResponse,
  MarketQuote,
  OrderRequest,
  OrderResponse,
} from '../types';
import {
  isAccountSnapshot,
  isAuthResponse,
  isMarketQuotes,
  isOrderResponse,
  isRecord,
} from './contracts';

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function requestJson<T>(
  path: string,
  validator: (value: unknown) => value is T,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);

  const response = await fetch(path, { ...init, headers });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const envelope: ErrorEnvelope = isRecord(body) ? body : {};
    throw new ApiError(
      response.status,
      envelope.error?.code ?? 'REQUEST_FAILED',
      envelope.error?.message ?? '请求失败，请稍后重试',
    );
  }
  if (!validator(body)) {
    throw new ApiError(502, 'INVALID_RESPONSE', '服务器返回了无效数据');
  }
  return body;
}

export function authenticate(
  mode: 'login' | 'register',
  username: string,
  password: string,
): Promise<AuthResponse> {
  return requestJson<AuthResponse>(
    `/api/auth/${mode}`,
    isAuthResponse,
    { method: 'POST', body: JSON.stringify({ username, password }) },
  );
}

export function fetchAccount(token: string): Promise<AccountSnapshot> {
  return requestJson<AccountSnapshot>('/api/account', isAccountSnapshot, {}, token);
}

export function fetchMarket(): Promise<MarketQuote[]> {
  return requestJson<MarketQuote[]>('/api/market', isMarketQuotes);
}

export function placeOrder(token: string, order: OrderRequest): Promise<OrderResponse> {
  return requestJson<OrderResponse>(
    '/api/orders',
    isOrderResponse,
    { method: 'POST', body: JSON.stringify(order) },
    token,
  );
}

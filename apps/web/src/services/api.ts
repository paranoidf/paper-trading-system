import type { AccountSnapshot, AuthResponse } from '../types';

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

async function requestJson<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);

  const response = await fetch(path, { ...init, headers });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const envelope = body as ErrorEnvelope;
    throw new ApiError(
      response.status,
      envelope.error?.code ?? 'REQUEST_FAILED',
      envelope.error?.message ?? '请求失败，请稍后重试',
    );
  }
  return body as T;
}

export function authenticate(
  mode: 'login' | 'register',
  username: string,
  password: string,
): Promise<AuthResponse> {
  return requestJson<AuthResponse>(`/api/auth/${mode}`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function fetchAccount(token: string): Promise<AccountSnapshot> {
  return requestJson<AccountSnapshot>('/api/account', {}, token);
}

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from './session';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('session store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal('sessionStorage', memoryStorage());
  });

  it('registers, persists the token, and exposes the protected account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(jsonResponse({
          token: 'session-token',
          user: { id: 'user-1', username: 'alice', cash: 1_000_000 },
        }, 201)),
      ),
    );
    const session = useSessionStore();

    await session.register('alice', 'correct-horse');

    expect(session.token).toBe('session-token');
    expect(session.user?.username).toBe('alice');
    expect(sessionStorage.getItem('paper-trading-token')).toBe('session-token');
    expect(session.isAuthenticated).toBe(true);
  });

  it('restores a saved session from the authoritative account snapshot', async () => {
    sessionStorage.setItem('paper-trading-token', 'saved-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(jsonResponse({
          user: { id: 'user-1', username: 'alice' },
          cash: 1_000_000,
          reservedCash: 0,
          availableCash: 1_000_000,
          positions: [],
          orders: [],
          trades: [],
        })),
      ),
    );
    const session = useSessionStore();

    await session.restore();

    expect(session.user?.username).toBe('alice');
    expect(session.account?.availableCash).toBe(1_000_000);
    expect(session.status).toBe('ready');
  });

  it('clears an invalid saved session and logout removes all private state', async () => {
    sessionStorage.setItem('paper-trading-token', 'expired-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ error: { code: 'UNAUTHORIZED', message: '登录已失效' } }, 401),
        ),
      ),
    );
    const session = useSessionStore();

    await session.restore();
    expect(session.isAuthenticated).toBe(false);
    expect(sessionStorage.getItem('paper-trading-token')).toBeNull();

    session.logout();
    expect(session.user).toBeNull();
    expect(session.account).toBeNull();
  });
});

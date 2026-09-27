import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from './session';
import { useTradingStore } from './trading';

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

const account = {
  user: { id: 'user-1', username: 'alice' },
  cash: 1_000_000,
  reservedCash: 0,
  availableCash: 1_000_000,
  positions: [],
  orders: [],
  trades: [],
};

describe('trading store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal('sessionStorage', memoryStorage());
  });

  it('loads market quotes and the authoritative account snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        return Promise.resolve(
          jsonResponse(
            url === '/api/market'
              ? [
                  { symbol: 'AAPL', name: 'Apple', price: 100, changePercent: 0.25 },
                  { symbol: 'MSFT', name: 'Microsoft', price: 200, changePercent: -0.1 },
                  { symbol: 'NVDA', name: 'NVIDIA', price: 150, changePercent: 0 },
                ]
              : account,
          ),
        );
      }),
    );
    const session = useSessionStore();
    session.token = 'token';
    const trading = useTradingStore();

    await trading.refresh();

    expect(trading.market).toHaveLength(3);
    expect(trading.market[0]?.symbol).toBe('AAPL');
    expect(session.account?.availableCash).toBe(1_000_000);
  });

  it('submits a valid limit order and replaces local account state from the response', async () => {
    const updatedAccount = {
      ...account,
      reservedCash: 9_000,
      availableCash: 991_000,
      orders: [
        {
          id: 'order-1',
          symbol: 'AAPL',
          side: 'buy',
          price: 90,
          quantity: 1,
          remainingQuantity: 1,
          status: 'open',
          createdAt: '2026-09-27T00:00:00.000Z',
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ order: updatedAccount.orders[0], account: updatedAccount }, 201),
        ),
      ),
    );
    const session = useSessionStore();
    session.token = 'token';
    const trading = useTradingStore();

    await trading.submit({ symbol: 'AAPL', side: 'buy', price: 90, quantity: 1 });

    expect(session.account?.reservedCash).toBe(9_000);
    expect(session.account?.orders[0]?.status).toBe('open');
    expect(trading.notice).toContain('委托已提交');
  });

  it('rejects invalid price or quantity before making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const session = useSessionStore();
    session.token = 'token';
    const trading = useTradingStore();

    await expect(
      trading.submit({ symbol: 'AAPL', side: 'buy', price: 0, quantity: 1.5 }),
    ).rejects.toThrow('请输入有效价格和整数数量');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(trading.error).toBe('请输入有效价格和整数数量');
  });

  it('propagates snapshot failures so reconnect cannot report a false connected state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ error: { code: 'TEMPORARY_FAILURE', message: '快照暂不可用' } }, 503),
        ),
      ),
    );
    const session = useSessionStore();
    session.token = 'token';
    const trading = useTradingStore();

    await expect(trading.refresh()).rejects.toThrow('快照暂不可用');
    expect(trading.error).toBe('快照暂不可用');
  });

  it('rejects a malformed successful market response without mutating state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        return Promise.resolve(jsonResponse(url === '/api/market' ? [{ symbol: 42 }] : account));
      }),
    );
    const session = useSessionStore();
    session.token = 'token';
    const trading = useTradingStore();

    await expect(trading.refresh()).rejects.toThrow('服务器返回了无效数据');
    expect(trading.market).toEqual([]);
    expect(session.account).toBeNull();
  });
});

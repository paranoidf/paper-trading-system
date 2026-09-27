import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeClient, type RealtimeSocket } from './realtime';

class FakeSocket implements RealtimeSocket {
  readonly listeners = new Map<string, Array<(event: Event | MessageEvent) => void>>();
  closed = false;

  addEventListener(type: string, listener: (event: Event | MessageEvent) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  close() {
    this.closed = true;
  }

  emit(type: 'open' | 'close', event = new Event(type)) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  message(data: unknown) {
    const event = { data } as MessageEvent;
    for (const listener of this.listeners.get('message') ?? []) listener(event);
  }
}

describe('RealtimeClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies valid market/account events and ignores malformed messages', () => {
    const sockets: FakeSocket[] = [];
    const onMarket = vi.fn();
    const onAccount = vi.fn();
    const client = new RealtimeClient({
      url: 'ws://localhost/ws?token=test',
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      onMarket,
      onAccount,
      onReconnect: vi.fn(() => Promise.resolve()),
      onStatus: vi.fn(),
    });

    client.start();
    sockets[0]?.message('not-json');
    sockets[0]?.message(JSON.stringify({ type: 'market.updated', payload: [{ symbol: 42 }] }));
    sockets[0]?.message(
      JSON.stringify({
        type: 'market.updated',
        payload: [{ symbol: 'AAPL', name: 'Apple', price: 100, changePercent: 0.2 }],
      }),
    );
    sockets[0]?.message(
      JSON.stringify({
        type: 'account.updated',
        payload: { user: { id: 'u1', username: 'alice' }, cash: 1, reservedCash: 0, availableCash: 1, positions: [{}], orders: [], trades: [] },
      }),
    );
    sockets[0]?.message(
      JSON.stringify({
        type: 'account.updated',
        payload: { user: { id: 'u1', username: 'alice' }, cash: 1, reservedCash: 0, availableCash: 1, positions: [], orders: [], trades: [] },
      }),
    );

    expect(onMarket).toHaveBeenCalledTimes(1);
    expect(onAccount).toHaveBeenCalledTimes(1);
  });

  it('reconnects with backoff and refreshes a snapshot before reporting connected', async () => {
    const sockets: FakeSocket[] = [];
    const statuses: string[] = [];
    const onReconnect = vi.fn(() => Promise.resolve());
    const client = new RealtimeClient({
      url: 'ws://localhost/ws?token=test',
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      onMarket: vi.fn(),
      onAccount: vi.fn(),
      onReconnect,
      onStatus: (status) => statuses.push(status),
    });

    client.start();
    sockets[0]?.emit('open');
    expect(statuses.at(-1)).toBe('connected');
    sockets[0]?.emit('close');
    expect(statuses.at(-1)).toBe('reconnecting');

    await vi.advanceTimersByTimeAsync(999);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(2);
    sockets[1]?.emit('open');
    await Promise.resolve();

    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('connected');
  });

  it('stops cleanly and prevents scheduled reconnects', async () => {
    const sockets: FakeSocket[] = [];
    const client = new RealtimeClient({
      url: 'ws://localhost/ws?token=test',
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      onMarket: vi.fn(),
      onAccount: vi.fn(),
      onReconnect: vi.fn(() => Promise.resolve()),
      onStatus: vi.fn(),
    });

    client.start();
    sockets[0]?.emit('close');
    client.stop();
    await vi.runAllTimersAsync();

    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.closed).toBe(true);
  });
});

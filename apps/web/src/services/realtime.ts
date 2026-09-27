import type { AccountSnapshot, MarketQuote, Order, Position, Trade } from '../types';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface RealtimeSocket {
  addEventListener(type: string, listener: (event: Event | MessageEvent) => void): void;
  close(): void;
}

interface RealtimeClientOptions {
  url: string;
  socketFactory?: (url: string) => RealtimeSocket;
  onMarket: (quotes: MarketQuote[]) => void;
  onAccount: (account: AccountSnapshot) => void;
  onReconnect: () => Promise<void>;
  onStatus: (status: ConnectionStatus) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isQuote(value: unknown): value is MarketQuote {
  return isRecord(value) && typeof value.symbol === 'string' && typeof value.name === 'string' && typeof value.price === 'number' && Number.isFinite(value.price) && typeof value.changePercent === 'number' && Number.isFinite(value.changePercent);
}

function isPosition(value: unknown): value is Position {
  return isRecord(value) && typeof value.symbol === 'string' && typeof value.name === 'string' && typeof value.quantity === 'number' && typeof value.reservedQuantity === 'number' && typeof value.availableQuantity === 'number' && typeof value.averageCost === 'number';
}

function isOrder(value: unknown): value is Order {
  return isRecord(value) && typeof value.id === 'string' && typeof value.symbol === 'string' && (value.side === 'buy' || value.side === 'sell') && typeof value.price === 'number' && typeof value.quantity === 'number' && typeof value.remainingQuantity === 'number' && (value.status === 'open' || value.status === 'partially_filled' || value.status === 'filled') && typeof value.createdAt === 'string';
}

function isTrade(value: unknown): value is Trade {
  return isRecord(value) && typeof value.id === 'string' && typeof value.symbol === 'string' && typeof value.price === 'number' && typeof value.quantity === 'number' && typeof value.buyerId === 'string' && typeof value.sellerId === 'string' && typeof value.executedAt === 'string';
}

function isAccount(value: unknown): value is AccountSnapshot {
  return isRecord(value) && isRecord(value.user) && typeof value.user.id === 'string' && typeof value.user.username === 'string' && typeof value.cash === 'number' && Number.isFinite(value.cash) && typeof value.reservedCash === 'number' && Number.isFinite(value.reservedCash) && typeof value.availableCash === 'number' && Number.isFinite(value.availableCash) && Array.isArray(value.positions) && value.positions.every(isPosition) && Array.isArray(value.orders) && value.orders.every(isOrder) && Array.isArray(value.trades) && value.trades.every(isTrade);
}

export class RealtimeClient {
  private readonly socketFactory: (url: string) => RealtimeSocket;
  private socket: RealtimeSocket | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectAttempt = 0;
  private hasConnected = false;
  private stopped = true;

  constructor(private readonly options: RealtimeClientOptions) {
    this.socketFactory = options.socketFactory ?? ((url) => new WebSocket(url));
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.options.onStatus('connecting');
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.socket?.close();
    this.socket = undefined;
    this.options.onStatus('disconnected');
  }

  private connect(): void {
    if (this.stopped) return;
    const socket = this.socketFactory(this.options.url);
    this.socket = socket;
    socket.addEventListener('open', () => void this.handleOpen(socket));
    socket.addEventListener('message', (event) => this.handleMessage(event));
    socket.addEventListener('close', () => this.handleClose(socket));
  }

  private async handleOpen(socket: RealtimeSocket): Promise<void> {
    if (this.stopped || socket !== this.socket) return;
    if (this.hasConnected) {
      try {
        await this.options.onReconnect();
      } catch {
        socket.close();
        return;
      }
    }
    this.hasConnected = true;
    this.reconnectAttempt = 0;
    this.options.onStatus('connected');
  }

  private handleMessage(event: Event | MessageEvent): void {
    if (!('data' in event) || typeof event.data !== 'string') return;
    try {
      const message = JSON.parse(event.data) as unknown;
      if (!isRecord(message) || typeof message.type !== 'string') return;
      if (message.type === 'market.updated' && Array.isArray(message.payload) && message.payload.every(isQuote)) {
        this.options.onMarket(message.payload);
      } else if (message.type === 'account.updated' && isAccount(message.payload)) {
        this.options.onAccount(message.payload);
      }
    } catch {
      // Malformed external messages are ignored without changing client state.
    }
  }

  private handleClose(socket: RealtimeSocket): void {
    if (this.stopped || socket !== this.socket) return;
    this.options.onStatus('reconnecting');
    const delay = Math.min(1_000 * 2 ** this.reconnectAttempt, 10_000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}

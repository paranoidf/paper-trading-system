import type { AccountSnapshot, MarketQuote } from '../types';
import { isAccountSnapshot, isMarketQuotes, isRecord } from './contracts';

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
      if (message.type === 'market.updated' && isMarketQuotes(message.payload)) {
        this.options.onMarket(message.payload);
      } else if (message.type === 'account.updated' && isAccountSnapshot(message.payload)) {
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

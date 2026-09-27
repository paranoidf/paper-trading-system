import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import WebSocket, { type RawData } from 'ws';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSystem } from '../src/http/app.js';
import { attachWebSocket } from '../src/realtime/websocket.js';

const symbols = [{ symbol: 'AAPL', name: 'Apple', initialPrice: 100 }];

interface AuthBody {
  token: string;
}

interface EventBody {
  type: string;
  payload: unknown;
}

function messageText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return data.toString('utf8');
}

function nextEvent(socket: WebSocket): Promise<EventBody> {
  return new Promise((resolve, reject) => {
    socket.once('message', (data) => {
      try {
        resolve(JSON.parse(messageText(data)) as EventBody);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Invalid event JSON'));
      }
    });
    socket.once('error', reject);
  });
}

describe('authenticated WebSocket gateway', () => {
  let server: Server;
  let origin: string;
  let system: ReturnType<typeof createSystem>;
  let gateway: ReturnType<typeof attachWebSocket>;
  let sockets: WebSocket[];

  beforeEach(async () => {
    system = createSystem({ symbols });
    server = createServer(system.app);
    gateway = attachWebSocket(server, system);
    sockets = [];
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    for (const socket of sockets) socket.terminate();
    await new Promise<void>((resolve) => gateway.close(() => resolve()));
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  async function register(username: string): Promise<string> {
    const response = await request(origin)
      .post('/api/auth/register')
      .send({ username, password: 'correct-horse' })
      .expect(201);
    return (response.body as unknown as AuthBody).token;
  }

  async function connect(token: string): Promise<WebSocket> {
    const socket = new WebSocket(origin.replace('http', 'ws') + `/ws?token=${encodeURIComponent(token)}`);
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    return socket;
  }

  async function connectAuthorized(token: string): Promise<{ socket: WebSocket; connected: EventBody }> {
    const socket = new WebSocket(origin.replace('http', 'ws') + `/ws?token=${encodeURIComponent(token)}`);
    sockets.push(socket);
    const connectedEvent = nextEvent(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    return { socket, connected: await connectedEvent };
  }

  it('rejects an unauthorized connection with policy violation', async () => {
    const socket = await connect('invalid-token');
    const code = await new Promise<number>((resolve) => socket.once('close', resolve));
    expect(code).toBe(1008);
  });

  it('broadcasts market data but isolates private account updates', async () => {
    const aliceToken = await register('alice');
    const bobToken = await register('bob');
    const aliceConnection = await connectAuthorized(aliceToken);
    const bobConnection = await connectAuthorized(bobToken);
    const alice = aliceConnection.socket;
    const bob = bobConnection.socket;
    expect(aliceConnection.connected.type).toBe('connected');
    expect(bobConnection.connected.type).toBe('connected');

    const aliceMarket = nextEvent(alice);
    const bobMarket = nextEvent(bob);
    system.market.tick();
    expect((await aliceMarket).type).toBe('market.updated');
    expect((await bobMarket).type).toBe('market.updated');

    const aliceAccount = nextEvent(alice);
    const bobEvents: string[] = [];
    bob.on('message', (data) => {
      bobEvents.push((JSON.parse(messageText(data)) as EventBody).type);
    });
    await request(origin)
      .post('/api/orders')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ symbol: 'AAPL', side: 'buy', price: 90, quantity: 1 })
      .expect(201);
    expect((await aliceAccount).type).toBe('account.updated');
    await new Promise((resolve) => setTimeout(resolve, 75));
    expect(bobEvents).not.toContain('account.updated');

  });
});

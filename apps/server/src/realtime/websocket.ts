import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { ApplicationSystem } from '../http/app.js';

function send(socket: WebSocket, event: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
}

export function attachWebSocket(server: Server, system: ApplicationSystem): WebSocketServer {
  const socketsByUser = new Map<string, Set<WebSocket>>();
  const webSocketServer = new WebSocketServer({ server, path: '/ws' });

  webSocketServer.on('connection', (socket, request) => {
    const url = new URL(request.url ?? '/ws', 'http://localhost');
    const userId = system.identity.userIdByToken(url.searchParams.get('token') ?? undefined);
    if (!userId) {
      socket.close(1008, 'Unauthorized');
      return;
    }

    const userSockets = socketsByUser.get(userId) ?? new Set<WebSocket>();
    userSockets.add(socket);
    socketsByUser.set(userId, userSockets);
    send(socket, { type: 'connected', payload: { userId } });

    socket.on('close', () => {
      userSockets.delete(socket);
      if (userSockets.size === 0) socketsByUser.delete(userId);
    });
  });

  const unsubscribeMarket = system.market.subscribe((quotes) => {
    const event = { type: 'market.updated', payload: quotes };
    for (const client of webSocketServer.clients) send(client, event);
  });
  const unsubscribeAccounts = system.subscribeAccounts((userIds) => {
    for (const userId of userIds) {
      const event = { type: 'account.updated', payload: system.accountForUser(userId) };
      for (const socket of socketsByUser.get(userId) ?? []) send(socket, event);
    }
  });

  webSocketServer.on('close', () => {
    unsubscribeMarket();
    unsubscribeAccounts();
  });
  return webSocketServer;
}

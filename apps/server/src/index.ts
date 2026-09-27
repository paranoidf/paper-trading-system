import { createServer } from 'node:http';
import { createSystem } from './http/app.js';
import { MarketService, type SeedSymbol } from './domain/market.js';
import { attachWebSocket } from './realtime/websocket.js';

const port = Number(process.env.PORT ?? 3000);
const symbols: SeedSymbol[] = [
  { symbol: 'AAPL', name: 'Apple', initialPrice: 188.25 },
  { symbol: 'MSFT', name: 'Microsoft', initialPrice: 421.5 },
  { symbol: 'NVDA', name: 'NVIDIA', initialPrice: 135.75 },
];
const market = new MarketService(symbols);
const system = createSystem({ symbols, market });
const server = createServer(system.app);
attachWebSocket(server, system);

server.listen(port, () => {
  market.start();
  console.log(`Paper trading server listening on http://localhost:${port}`);
});

import { createApplication } from './http/app.js';
import { MarketService, type SeedSymbol } from './domain/market.js';

const port = Number(process.env.PORT ?? 3000);
const symbols: SeedSymbol[] = [
  { symbol: 'AAPL', name: 'Apple', initialPrice: 188.25 },
  { symbol: 'MSFT', name: 'Microsoft', initialPrice: 421.5 },
  { symbol: 'NVDA', name: 'NVIDIA', initialPrice: 135.75 },
];
const market = new MarketService(symbols);
const app = createApplication({ symbols, market });

app.listen(port, () => {
  market.start();
  console.log(`Paper trading server listening on http://localhost:${port}`);
});

import { createApplication } from './http/app.js';

const port = Number(process.env.PORT ?? 3000);
const app = createApplication({
  symbols: [
    { symbol: 'AAPL', name: 'Apple', initialPrice: 188.25 },
    { symbol: 'MSFT', name: 'Microsoft', initialPrice: 421.5 },
    { symbol: 'NVDA', name: 'NVIDIA', initialPrice: 135.75 },
  ],
});

app.listen(port, () => {
  console.log(`Paper trading server listening on http://localhost:${port}`);
});

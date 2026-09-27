export interface SeedSymbol {
  symbol: string;
  name: string;
  initialPrice: number;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
}

interface StoredQuote {
  symbol: string;
  name: string;
  previousCloseCents: number;
  priceCents: number;
}

type MarketListener = (quotes: MarketQuote[]) => void;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export class MarketService {
  private readonly quotes: StoredQuote[];
  private readonly listeners = new Set<MarketListener>();
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    symbols: SeedSymbol[],
    private readonly random: () => number = Math.random,
  ) {
    this.quotes = symbols.map((stock) => {
      const initialCents = Math.max(1, Math.round(stock.initialPrice * 100));
      return {
        symbol: stock.symbol,
        name: stock.name,
        previousCloseCents: initialCents,
        priceCents: initialCents,
      };
    });
  }

  snapshot(): MarketQuote[] {
    return this.quotes.map((quote) => ({
      symbol: quote.symbol,
      name: quote.name,
      price: quote.priceCents / 100,
      changePercent: round(
        ((quote.priceCents - quote.previousCloseCents) / quote.previousCloseCents) * 100,
        2,
      ),
    }));
  }

  tick(): MarketQuote[] {
    for (const quote of this.quotes) {
      const boundedRandom = Math.min(1, Math.max(0, this.random()));
      const movement = (boundedRandom - 0.5) / 100;
      quote.priceCents = Math.max(1, Math.round(quote.priceCents * (1 + movement)));
    }
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
    return snapshot;
  }

  subscribe(listener: MarketListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(intervalMs = 1_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }
}

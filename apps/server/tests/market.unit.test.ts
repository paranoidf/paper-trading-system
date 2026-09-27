import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketService } from '../src/domain/market.js';

const symbols = [
  { symbol: 'AAA', name: 'Alpha', initialPrice: 100 },
  { symbol: 'BBB', name: 'Beta', initialPrice: 50 },
  { symbol: 'CCC', name: 'Gamma', initialPrice: 0.01 },
];

describe('MarketService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes seeded quotes with stable price and percentage fields', () => {
    const market = new MarketService(symbols, () => 0.5);

    expect(market.snapshot()).toEqual([
      { symbol: 'AAA', name: 'Alpha', price: 100, changePercent: 0 },
      { symbol: 'BBB', name: 'Beta', price: 50, changePercent: 0 },
      { symbol: 'CCC', name: 'Gamma', price: 0.01, changePercent: 0 },
    ]);
  });

  it('moves each quote by at most half a percent and never below one cent', () => {
    const randomValues = [1, 0, 0];
    const market = new MarketService(symbols, () => randomValues.shift() ?? 0.5);

    const quotes = market.tick();

    expect(quotes[0]).toEqual({ symbol: 'AAA', name: 'Alpha', price: 100.5, changePercent: 0.5 });
    expect(quotes[1]).toEqual({ symbol: 'BBB', name: 'Beta', price: 49.75, changePercent: -0.5 });
    expect(quotes[2]).toEqual({ symbol: 'CCC', name: 'Gamma', price: 0.01, changePercent: 0 });
  });

  it('publishes once per interval and stops without leaving an active loop', () => {
    vi.useFakeTimers();
    const market = new MarketService(symbols, () => 0.5);
    const listener = vi.fn();
    market.subscribe(listener);

    market.start(1_000);
    vi.advanceTimersByTime(2_100);
    expect(listener).toHaveBeenCalledTimes(2);

    market.stop();
    vi.advanceTimersByTime(2_000);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

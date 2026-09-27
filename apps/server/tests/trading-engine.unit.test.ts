import { describe, expect, it } from 'vitest';
import {
  TradingEngine,
  TradingError,
  type TradingAccount,
  type TradingPosition,
} from '../src/domain/trading.js';

const symbols = ['AAPL'];

function account(
  id: string,
  cashCents: number,
  shares: number,
  averageCostCents = 10_000,
): TradingAccount {
  const position: TradingPosition = {
    symbol: 'AAPL',
    name: 'Apple',
    quantity: shares,
    reservedQuantity: 0,
    averageCostCents,
  };
  return {
    id,
    cashCents,
    reservedCashCents: 0,
    positions: new Map([['AAPL', position]]),
  };
}

function setup(initial: TradingAccount[]) {
  const accounts = new Map(initial.map((value) => [value.id, value]));
  let now = 1_000;
  const engine = new TradingEngine({
    symbols,
    accountById: (id) => accounts.get(id),
    clock: () => now++,
  });
  return { accounts, engine };
}

describe('TradingEngine', () => {
  it('matches the best price before a worse price regardless of arrival order', () => {
    const { engine } = setup([
      account('seller-high', 0, 10),
      account('seller-best', 0, 10),
      account('buyer', 100_000, 0),
    ]);
    engine.placeOrder({ userId: 'seller-high', symbol: 'AAPL', side: 'sell', priceCents: 10_500, quantity: 2 });
    engine.placeOrder({ userId: 'seller-best', symbol: 'AAPL', side: 'sell', priceCents: 10_000, quantity: 2 });

    const result = engine.placeOrder({
      userId: 'buyer',
      symbol: 'AAPL',
      side: 'buy',
      priceCents: 11_000,
      quantity: 3,
    });

    expect(result.trades.map((trade) => [trade.sellerId, trade.priceCents, trade.quantity])).toEqual([
      ['seller-best', 10_000, 2],
      ['seller-high', 10_500, 1],
    ]);
  });

  it('uses FIFO sequence when orders share the same price', () => {
    const { engine } = setup([
      account('seller-first', 0, 10),
      account('seller-second', 0, 10),
      account('buyer', 100_000, 0),
    ]);
    const first = engine.placeOrder({ userId: 'seller-first', symbol: 'AAPL', side: 'sell', priceCents: 10_000, quantity: 2 }).order;
    const second = engine.placeOrder({ userId: 'seller-second', symbol: 'AAPL', side: 'sell', priceCents: 10_000, quantity: 2 }).order;

    engine.placeOrder({ userId: 'buyer', symbol: 'AAPL', side: 'buy', priceCents: 10_000, quantity: 3 });

    expect(engine.orderById(first.id)?.status).toBe('filled');
    expect(engine.orderById(second.id)).toEqual(expect.objectContaining({ status: 'partially_filled', remainingQuantity: 1 }));
  });

  it('keeps only the unfilled quantity reserved after a partial fill', () => {
    const buyer = account('buyer', 100_000, 0);
    const seller = account('seller', 0, 10);
    const { engine } = setup([buyer, seller]);
    const buy = engine.placeOrder({ userId: 'buyer', symbol: 'AAPL', side: 'buy', priceCents: 12_000, quantity: 5 }).order;

    const sellResult = engine.placeOrder({
      userId: 'seller',
      symbol: 'AAPL',
      side: 'sell',
      priceCents: 10_000,
      quantity: 2,
    });

    expect(sellResult.trades[0]?.priceCents).toBe(12_000);
    expect(engine.orderById(buy.id)).toEqual(expect.objectContaining({ status: 'partially_filled', remainingQuantity: 3 }));
    expect(buyer).toEqual(expect.objectContaining({ cashCents: 76_000, reservedCashCents: 36_000 }));
    expect(buyer.positions.get('AAPL')?.quantity).toBe(2);
    expect(seller).toEqual(expect.objectContaining({ cashCents: 24_000 }));
    expect(seller.positions.get('AAPL')).toEqual(
      expect.objectContaining({ quantity: 8, reservedQuantity: 0 }),
    );
  });

  it('executes at the resting sell price and releases buy-side price improvement', () => {
    const buyer = account('buyer', 100_000, 0);
    const seller = account('seller', 0, 10);
    const { engine } = setup([buyer, seller]);
    engine.placeOrder({ userId: 'seller', symbol: 'AAPL', side: 'sell', priceCents: 10_000, quantity: 2 });

    const result = engine.placeOrder({ userId: 'buyer', symbol: 'AAPL', side: 'buy', priceCents: 12_000, quantity: 2 });

    expect(result.trades[0]?.priceCents).toBe(10_000);
    expect(buyer).toEqual(expect.objectContaining({ cashCents: 80_000, reservedCashCents: 0 }));
    expect(seller.cashCents).toBe(20_000);
  });

  it('rejects invalid or insufficient orders without mutating accounts or books', () => {
    const buyer = account('buyer', 5_000, 0);
    const seller = account('seller', 0, 1);
    const { engine } = setup([buyer, seller]);

    expect(() =>
      engine.placeOrder({ userId: 'buyer', symbol: 'AAPL', side: 'buy', priceCents: 10_000, quantity: 1 }),
    ).toThrowError(new TradingError('INSUFFICIENT_CASH', '可用资金不足'));
    expect(() =>
      engine.placeOrder({ userId: 'seller', symbol: 'AAPL', side: 'sell', priceCents: 10_000, quantity: 2 }),
    ).toThrowError(new TradingError('INSUFFICIENT_POSITION', '可用持仓不足'));
    expect(() =>
      engine.placeOrder({ userId: 'buyer', symbol: 'UNKNOWN', side: 'buy', priceCents: 1, quantity: 1 }),
    ).toThrowError(new TradingError('UNKNOWN_SYMBOL', '股票代码不存在'));

    expect(buyer).toEqual(expect.objectContaining({ cashCents: 5_000, reservedCashCents: 0 }));
    expect(seller.positions.get('AAPL')).toEqual(
      expect.objectContaining({ quantity: 1, reservedQuantity: 0 }),
    );
    expect(engine.ordersForUser('buyer')).toHaveLength(0);
    expect(engine.ordersForUser('seller')).toHaveLength(0);
  });
});

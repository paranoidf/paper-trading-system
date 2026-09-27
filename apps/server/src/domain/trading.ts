export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'partially_filled' | 'filled';

export interface TradingPosition {
  symbol: string;
  name: string;
  quantity: number;
  reservedQuantity: number;
  averageCostCents: number;
}

export interface TradingAccount {
  id: string;
  cashCents: number;
  reservedCashCents: number;
  positions: Map<string, TradingPosition>;
}

export interface LimitOrder {
  id: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  priceCents: number;
  quantity: number;
  remainingQuantity: number;
  status: OrderStatus;
  createdAt: number;
  sequence: number;
}

export interface Trade {
  id: string;
  symbol: string;
  priceCents: number;
  quantity: number;
  buyerId: string;
  sellerId: string;
  buyOrderId: string;
  sellOrderId: string;
  executedAt: number;
}

interface TradingEngineOptions {
  symbols: string[];
  accountById: (id: string) => TradingAccount | undefined;
  clock?: () => number;
}

interface PlaceOrderInput {
  userId: string;
  symbol: string;
  side: OrderSide;
  priceCents: number;
  quantity: number;
}

export class TradingError extends Error {
  constructor(
    readonly code:
      | 'UNKNOWN_USER'
      | 'UNKNOWN_SYMBOL'
      | 'INVALID_ORDER'
      | 'INSUFFICIENT_CASH'
      | 'INSUFFICIENT_POSITION',
    message: string,
  ) {
    super(message);
  }
}

export class TradingEngine {
  private readonly symbols: Set<string>;
  private readonly orders = new Map<string, LimitOrder>();
  private readonly trades: Trade[] = [];
  private readonly accountById: TradingEngineOptions['accountById'];
  private readonly clock: () => number;
  private nextSequence = 1;
  private nextTradeSequence = 1;

  constructor(options: TradingEngineOptions) {
    this.symbols = new Set(options.symbols);
    this.accountById = options.accountById;
    this.clock = options.clock ?? Date.now;
  }

  placeOrder(input: PlaceOrderInput): { order: LimitOrder; trades: Trade[] } {
    const account = this.validateAndGetAccount(input);
    this.reserve(account, input);

    const sequence = this.nextSequence++;
    const order: LimitOrder = {
      id: `order-${sequence}`,
      ...input,
      quantity: input.quantity,
      remainingQuantity: input.quantity,
      status: 'open',
      createdAt: this.clock(),
      sequence,
    };
    this.orders.set(order.id, order);

    const newTrades: Trade[] = [];
    while (order.remainingQuantity > 0) {
      const resting = this.bestCrossingOrder(order);
      if (!resting) break;
      const quantity = Math.min(order.remainingQuantity, resting.remainingQuantity);
      const trade = this.settle(order, resting, quantity, resting.priceCents);
      newTrades.push(trade);
      this.trades.push(trade);
      this.updateStatus(resting);
    }
    this.updateStatus(order);
    return { order, trades: newTrades };
  }

  orderById(id: string): LimitOrder | undefined {
    return this.orders.get(id);
  }

  ordersForUser(userId: string): LimitOrder[] {
    return [...this.orders.values()]
      .filter((order) => order.userId === userId)
      .sort((left, right) => right.sequence - left.sequence);
  }

  tradesForUser(userId: string): Trade[] {
    return this.trades
      .filter((trade) => trade.buyerId === userId || trade.sellerId === userId)
      .slice(-50)
      .reverse();
  }

  private validateAndGetAccount(input: PlaceOrderInput): TradingAccount {
    const account = this.accountById(input.userId);
    if (!account) throw new TradingError('UNKNOWN_USER', '用户不存在');
    if (!this.symbols.has(input.symbol)) {
      throw new TradingError('UNKNOWN_SYMBOL', '股票代码不存在');
    }
    if (
      !Number.isSafeInteger(input.priceCents) ||
      input.priceCents <= 0 ||
      !Number.isSafeInteger(input.quantity) ||
      input.quantity <= 0
    ) {
      throw new TradingError('INVALID_ORDER', '价格和数量必须为正数');
    }
    return account;
  }

  private reserve(account: TradingAccount, input: PlaceOrderInput): void {
    if (input.side === 'buy') {
      const required = input.priceCents * input.quantity;
      if (!Number.isSafeInteger(required) || account.cashCents - account.reservedCashCents < required) {
        throw new TradingError('INSUFFICIENT_CASH', '可用资金不足');
      }
      account.reservedCashCents += required;
      return;
    }

    const position = account.positions.get(input.symbol);
    if (!position || position.quantity - position.reservedQuantity < input.quantity) {
      throw new TradingError('INSUFFICIENT_POSITION', '可用持仓不足');
    }
    position.reservedQuantity += input.quantity;
  }

  private bestCrossingOrder(incoming: LimitOrder): LimitOrder | undefined {
    const candidates = [...this.orders.values()].filter((candidate) => {
      if (
        candidate.id === incoming.id ||
        candidate.symbol !== incoming.symbol ||
        candidate.side === incoming.side ||
        candidate.remainingQuantity === 0
      ) {
        return false;
      }
      return incoming.side === 'buy'
        ? candidate.priceCents <= incoming.priceCents
        : candidate.priceCents >= incoming.priceCents;
    });

    candidates.sort((left, right) => {
      const priceDifference =
        incoming.side === 'buy'
          ? left.priceCents - right.priceCents
          : right.priceCents - left.priceCents;
      return priceDifference || left.sequence - right.sequence;
    });
    return candidates[0];
  }

  private settle(
    incoming: LimitOrder,
    resting: LimitOrder,
    quantity: number,
    executionPriceCents: number,
  ): Trade {
    const buyOrder = incoming.side === 'buy' ? incoming : resting;
    const sellOrder = incoming.side === 'sell' ? incoming : resting;
    const buyer = this.accountById(buyOrder.userId);
    const seller = this.accountById(sellOrder.userId);
    if (!buyer || !seller) throw new TradingError('UNKNOWN_USER', '用户不存在');

    buyer.reservedCashCents -= buyOrder.priceCents * quantity;
    buyer.cashCents -= executionPriceCents * quantity;
    seller.cashCents += executionPriceCents * quantity;

    const sellerPosition = seller.positions.get(sellOrder.symbol);
    if (!sellerPosition) throw new TradingError('INSUFFICIENT_POSITION', '可用持仓不足');
    sellerPosition.reservedQuantity -= quantity;
    sellerPosition.quantity -= quantity;

    const buyerPosition = buyer.positions.get(buyOrder.symbol) ?? {
      symbol: buyOrder.symbol,
      name: buyOrder.symbol,
      quantity: 0,
      reservedQuantity: 0,
      averageCostCents: 0,
    };
    const oldCost = buyerPosition.averageCostCents * buyerPosition.quantity;
    buyerPosition.quantity += quantity;
    buyerPosition.averageCostCents = Math.round(
      (oldCost + executionPriceCents * quantity) / buyerPosition.quantity,
    );
    buyer.positions.set(buyOrder.symbol, buyerPosition);

    buyOrder.remainingQuantity -= quantity;
    sellOrder.remainingQuantity -= quantity;

    const tradeSequence = this.nextTradeSequence++;
    return {
      id: `trade-${tradeSequence}`,
      symbol: incoming.symbol,
      priceCents: executionPriceCents,
      quantity,
      buyerId: buyOrder.userId,
      sellerId: sellOrder.userId,
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      executedAt: this.clock(),
    };
  }

  private updateStatus(order: LimitOrder): void {
    if (order.remainingQuantity === 0) order.status = 'filled';
    else if (order.remainingQuantity < order.quantity) order.status = 'partially_filled';
    else order.status = 'open';
  }
}

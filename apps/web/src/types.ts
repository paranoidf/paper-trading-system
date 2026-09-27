export interface UserSummary {
  id: string;
  username: string;
  cash?: number;
}

export interface Position {
  symbol: string;
  name: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  averageCost: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  remainingQuantity: number;
  status: 'open' | 'partially_filled' | 'filled';
  createdAt: string;
}

export interface Trade {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  buyerId: string;
  sellerId: string;
  executedAt: string;
}

export interface AccountSnapshot {
  user: UserSummary;
  cash: number;
  reservedCash: number;
  availableCash: number;
  positions: Position[];
  orders: Order[];
  trades: Trade[];
}

export interface AuthResponse {
  token: string;
  user: UserSummary;
}

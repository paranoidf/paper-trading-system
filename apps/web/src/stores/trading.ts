import { defineStore } from 'pinia';
import { fetchAccount, fetchMarket, placeOrder } from '../services/api';
import type { MarketQuote, OrderRequest } from '../types';
import { useSessionStore } from './session';

function message(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败，请稍后重试';
}

export const useTradingStore = defineStore('trading', {
  state: () => ({
    market: [] as MarketQuote[],
    loading: false,
    submitting: false,
    error: null as string | null,
    notice: null as string | null,
  }),
  actions: {
    async refresh() {
      const session = useSessionStore();
      if (!session.token) return;
      this.loading = true;
      this.error = null;
      try {
        const [market, account] = await Promise.all([
          fetchMarket(),
          fetchAccount(session.token),
        ]);
        this.market = market;
        session.account = account;
        session.user = account.user;
      } catch (error) {
        this.error = message(error);
      } finally {
        this.loading = false;
      }
    },
    async submit(order: OrderRequest) {
      const session = useSessionStore();
      this.error = null;
      this.notice = null;
      if (
        !Number.isFinite(order.price) ||
        order.price <= 0 ||
        !Number.isInteger(order.quantity) ||
        order.quantity <= 0
      ) {
        const validationError = new Error('请输入有效价格和整数数量');
        this.error = validationError.message;
        throw validationError;
      }
      if (!session.token) throw new Error('请先登录');

      this.submitting = true;
      try {
        const result = await placeOrder(session.token, order);
        session.account = result.account;
        this.notice = `委托已提交：${result.order.symbol} ${result.order.quantity} 股`;
        return result.order;
      } catch (error) {
        this.error = message(error);
        throw error;
      } finally {
        this.submitting = false;
      }
    },
  },
});

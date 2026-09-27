<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RealtimeClient, type ConnectionStatus } from '../services/realtime';
import { useSessionStore } from '../stores/session';
import { useTradingStore } from '../stores/trading';

const session = useSessionStore();
const trading = useTradingStore();
const symbol = ref('');
const side = ref<'buy' | 'sell'>('buy');
const price = ref<number | null>(null);
const quantity = ref<number | null>(null);
const account = computed(() => session.account);
const estimatedAmount = computed(() => (price.value ?? 0) * (quantity.value ?? 0));
const connectionStatus = ref<ConnectionStatus>('connecting');
let realtime: RealtimeClient | undefined;

watch(
  () => trading.market,
  (quotes) => {
    if (!symbol.value && quotes[0]) {
      symbol.value = quotes[0].symbol;
      price.value = quotes[0].price;
    }
  },
  { deep: true },
);
onMounted(async () => {
  try {
    await trading.refresh();
  } catch {
    connectionStatus.value = 'disconnected';
    return;
  }
  if (!session.token) return;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  realtime = new RealtimeClient({
    url: `${protocol}//${location.host}/ws?token=${encodeURIComponent(session.token)}`,
    onMarket: (quotes) => {
      trading.market = quotes;
    },
    onAccount: (snapshot) => {
      session.account = snapshot;
    },
    onReconnect: () => trading.refresh(),
    onStatus: (status) => {
      connectionStatus.value = status;
    },
  });
  realtime.start();
});

onBeforeUnmount(() => realtime?.stop());

function selectQuote(selectedSymbol: string, selectedPrice: number) {
  symbol.value = selectedSymbol;
  price.value = selectedPrice;
}

async function submitOrder() {
  if (!symbol.value || price.value === null || quantity.value === null) {
    trading.error = '请完整填写股票、价格和数量';
    return;
  }
  try {
    await trading.submit({ symbol: symbol.value, side: side.value, price: price.value, quantity: quantity.value });
    quantity.value = null;
  } catch {
    // The store exposes a user-safe error message.
  }
}

function money(value: number | undefined): string {
  return (value ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function orderStatus(status: string): string {
  return { open: '未成交', partially_filled: '部分成交', filled: '已成交' }[status] ?? status;
}
</script>

<template>
  <div
    class="dashboard"
    data-testid="dashboard"
  >
    <header class="topbar">
      <div>
        <p class="eyebrow">
          PAPER MARKET / LIVE SIMULATION
        </p><h1>澄明交易台</h1>
      </div>
      <div class="session-actions">
        <span
          class="connection"
          :class="connectionStatus"
        >{{ connectionStatus === 'connected' ? '实时已连接' : connectionStatus === 'reconnecting' ? '正在重连' : '正在连接' }}</span>
        <span>{{ session.user?.username }}</span><button
          type="button"
          @click="session.logout"
        >
          退出
        </button>
      </div>
    </header>

    <section
      class="metrics"
      aria-label="账户资金"
    >
      <article><span>账户总资金</span><strong>¥{{ money(account?.cash) }}</strong></article>
      <article><span>可用资金</span><strong>¥{{ money(account?.availableCash) }}</strong></article>
      <article><span>冻结资金</span><strong>¥{{ money(account?.reservedCash) }}</strong></article>
      <article><span>持仓品种</span><strong>{{ account?.positions.length ?? 0 }}</strong></article>
    </section>

    <section
      class="panel"
      aria-labelledby="market-title"
    >
      <div class="panel-heading">
        <div>
          <p class="section-index">
            01 / MARKET
          </p><h2 id="market-title">
            实时行情
          </h2>
        </div><span class="live-dot"><i />每秒更新</span>
      </div>
      <p
        v-if="trading.loading"
        class="muted"
      >
        正在载入行情…
      </p>
      <div
        v-else
        class="quote-grid"
      >
        <button
          v-for="quote in trading.market"
          :key="quote.symbol"
          class="quote-card"
          :class="{ selected: symbol === quote.symbol }"
          type="button"
          @click="selectQuote(quote.symbol, quote.price)"
        >
          <span class="symbol">{{ quote.symbol }}</span><span class="name">{{ quote.name }}</span>
          <strong>¥{{ money(quote.price) }}</strong><em :class="quote.changePercent >= 0 ? 'up' : 'down'">{{ quote.changePercent >= 0 ? '+' : '' }}{{ quote.changePercent.toFixed(2) }}%</em>
        </button>
      </div>
    </section>

    <div class="workbench">
      <section
        class="panel"
        aria-labelledby="trade-title"
      >
        <p class="section-index">
          02 / ORDER
        </p><h2 id="trade-title">
          限价委托
        </h2>
        <form
          data-testid="trade-form"
          @submit.prevent="submitOrder"
        >
          <label for="trade-symbol">股票</label>
          <select
            id="trade-symbol"
            v-model="symbol"
            required
          >
            <option
              v-for="quote in trading.market"
              :key="quote.symbol"
              :value="quote.symbol"
            >
              {{ quote.symbol }} · {{ quote.name }}
            </option>
          </select>
          <div class="side-switch">
            <button
              :class="{ active: side === 'buy' }"
              type="button"
              @click="side = 'buy'"
            >
              买入
            </button><button
              :class="{ active: side === 'sell' }"
              type="button"
              @click="side = 'sell'"
            >
              卖出
            </button>
          </div>
          <div class="field-row">
            <div>
              <label for="trade-price">限价</label><input
                id="trade-price"
                v-model.number="price"
                min="0.01"
                step="0.01"
                type="number"
                required
              >
            </div><div>
              <label for="trade-quantity">数量</label><input
                id="trade-quantity"
                v-model.number="quantity"
                min="1"
                step="1"
                type="number"
                required
              >
            </div>
          </div>
          <p class="estimate">
            预计金额 <strong>¥{{ money(estimatedAmount) }}</strong>
          </p>
          <p
            v-if="trading.error"
            class="error"
            role="alert"
          >
            {{ trading.error }}
          </p><p
            v-if="trading.notice"
            class="notice"
            role="status"
          >
            {{ trading.notice }}
          </p>
          <button
            class="submit"
            :disabled="trading.submitting"
            type="submit"
          >
            {{ trading.submitting ? '提交中…' : side === 'buy' ? '提交买入委托' : '提交卖出委托' }}
          </button>
        </form>
      </section>

      <section
        class="panel"
        aria-labelledby="positions-title"
      >
        <p class="section-index">
          03 / PORTFOLIO
        </p><h2 id="positions-title">
          当前持仓
        </h2>
        <div class="table-scroll">
          <table>
            <thead><tr><th>股票</th><th>总持仓</th><th>可用</th><th>均价</th></tr></thead><tbody>
              <tr
                v-for="position in account?.positions"
                :key="position.symbol"
              >
                <td><strong>{{ position.symbol }}</strong><small>{{ position.name }}</small></td><td>{{ position.quantity }}</td><td>{{ position.availableQuantity }}</td><td>¥{{ money(position.averageCost) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <section
      class="panel"
      aria-labelledby="orders-title"
    >
      <p class="section-index">
        04 / ORDERS
      </p><h2 id="orders-title">
        我的委托
      </h2>
      <div class="table-scroll">
        <table>
          <thead><tr><th>时间</th><th>股票</th><th>方向</th><th>限价</th><th>数量</th><th>剩余</th><th>状态</th></tr></thead><tbody>
            <tr
              v-for="order in account?.orders"
              :key="order.id"
            >
              <td>{{ new Date(order.createdAt).toLocaleTimeString('zh-CN') }}</td><td><strong>{{ order.symbol }}</strong></td><td :class="order.side === 'buy' ? 'up' : 'down'">
                {{ order.side === 'buy' ? '买入' : '卖出' }}
              </td><td>¥{{ money(order.price) }}</td><td>{{ order.quantity }}</td><td>{{ order.remainingQuantity }}</td><td><span class="status">{{ orderStatus(order.status) }}</span></td>
            </tr><tr v-if="!account?.orders.length">
              <td
                colspan="7"
                class="empty"
              >
                尚无委托
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      class="panel"
      aria-labelledby="trades-title"
    >
      <p class="section-index">
        05 / FILLS
      </p><h2 id="trades-title">
        最近成交
      </h2>
      <div class="table-scroll">
        <table>
          <thead><tr><th>时间</th><th>股票</th><th>成交价</th><th>数量</th></tr></thead><tbody>
            <tr
              v-for="trade in account?.trades"
              :key="trade.id"
            >
              <td>{{ new Date(trade.executedAt).toLocaleTimeString('zh-CN') }}</td><td><strong>{{ trade.symbol }}</strong></td><td>¥{{ money(trade.price) }}</td><td>{{ trade.quantity }}</td>
            </tr><tr v-if="!account?.trades.length">
              <td
                colspan="4"
                class="empty"
              >
                尚无成交
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard{width:min(1380px,100%);display:grid;gap:18px}.topbar,.panel-heading,.session-actions{display:flex;align-items:center;justify-content:space-between;gap:18px}h1{margin:5px 0 0;font:700 clamp(30px,5vw,48px)/1 Georgia,serif}h2{margin:4px 0 22px;font:700 25px/1.2 Georgia,serif}.eyebrow,.section-index{margin:0;color:#b55732;font:700 11px/1.2 ui-monospace,monospace;letter-spacing:.14em}.session-actions{color:#526052}.connection{padding:5px 8px;border-radius:999px;background:#eeeae0;font-size:11px}.connection.connected{background:#dfeade;color:#2f6940}.connection.reconnecting{background:#f5e6d7;color:#9b552d}.session-actions button{border:1px solid #b8b8ae;border-radius:8px;padding:8px 13px;background:#fffdf8;cursor:pointer}.metrics{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #d7d2c7;border-radius:14px;background:#263b2d;color:#fff;overflow:hidden}.metrics article{display:grid;gap:8px;padding:20px 24px;border-right:1px solid #ffffff1f}.metrics article:last-child{border:0}.metrics span{color:#c5d0c6;font-size:12px}.metrics strong{font:650 22px/1.1 ui-monospace,monospace}.panel{padding:24px;border:1px solid #d7d2c7;border-radius:14px;background:#fffdf8;box-shadow:0 10px 30px #2634210c}.live-dot{display:flex;align-items:center;gap:7px;color:#5e6c5f;font-size:12px}.live-dot i{width:8px;height:8px;border-radius:50%;background:#4f925d;box-shadow:0 0 0 4px #dcebdc}.quote-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.quote-card{display:grid;grid-template-columns:1fr auto;gap:7px 12px;padding:18px;border:1px solid #ded9ce;border-radius:11px;background:#faf8f2;text-align:left;cursor:pointer}.quote-card.selected{border-color:#42634a;box-shadow:inset 0 0 0 1px #42634a}.quote-card .symbol{font:700 16px ui-monospace,monospace}.quote-card .name{text-align:right;color:#7b8077}.quote-card strong{font-size:24px}.quote-card em{text-align:right;font-style:normal}.up{color:#a94332}.down{color:#277050}.muted,.empty{color:#83887f}.workbench{display:grid;grid-template-columns:minmax(300px,.7fr) 1.3fr;gap:18px}form{display:grid;gap:10px}label{color:#526052;font-size:13px;font-weight:650}select,input{width:100%;min-height:42px;border:1px solid #cbc8bf;border-radius:8px;padding:0 11px;background:#fff;color:#202820}.side-switch{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:5px 0;padding:4px;border-radius:10px;background:#f0ede5}.side-switch button{border:0;border-radius:7px;padding:9px;background:transparent;cursor:pointer}.side-switch .active{background:#fff;box-shadow:0 2px 8px #25331e17;color:#244d33;font-weight:700}.field-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field-row div{display:grid;gap:7px}.estimate{display:flex;justify-content:space-between;color:#697064}.estimate strong{color:#253229}.submit{min-height:44px;border:0;border-radius:8px;background:#244d33;color:#fff;font-weight:700;cursor:pointer}.submit:disabled{opacity:.6}.error{color:#a33b2b}.notice{color:#277050}.table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;white-space:nowrap}th,td{padding:13px 12px;border-bottom:1px solid #e4e0d6;text-align:right;font-size:13px}th:first-child,td:first-child{text-align:left}th{color:#757b72;font-size:11px;letter-spacing:.06em}td small{display:block;margin-top:3px;color:#8b8f87}.status{padding:4px 8px;border-radius:999px;background:#ecefe8;color:#425444}.empty{text-align:center!important;padding:26px}@media(max-width:820px){.metrics{grid-template-columns:1fr 1fr}.metrics article:nth-child(2){border-right:0}.workbench,.quote-grid{grid-template-columns:1fr}}@media(max-width:520px){.topbar{align-items:flex-start}.session-actions span:not(.connection){display:none}.metrics{grid-template-columns:1fr}.metrics article{border-right:0;border-bottom:1px solid #ffffff1f}.panel{padding:18px}.field-row{grid-template-columns:1fr}}
</style>

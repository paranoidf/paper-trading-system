<script setup lang="ts">
import { onMounted } from 'vue';
import AuthPanel from './components/AuthPanel.vue';
import TradingDashboard from './components/TradingDashboard.vue';
import { useSessionStore } from './stores/session';

const session = useSessionStore();
onMounted(() => void session.restore());
</script>

<template>
  <main class="app-shell">
    <p
      v-if="session.status === 'loading' && !session.user"
      class="loading"
    >
      正在同步账户…
    </p>
    <AuthPanel v-else-if="!session.isAuthenticated" />
    <TradingDashboard v-else />
  </main>
</template>

<style>
:root { font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif; color: #202820; background: #ece9df; font-synthesis: none; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; background: radial-gradient(circle at 10% 10%, #f9f5e9 0, transparent 35%), linear-gradient(135deg, #e8ece3, #e9e2d4); }
button, input, select { font: inherit; }
.app-shell { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.loading { color: #526052; }
</style>

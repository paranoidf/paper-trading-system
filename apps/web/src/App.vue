<script setup lang="ts">
import { onMounted } from 'vue';
import AuthPanel from './components/AuthPanel.vue';
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
    <section
      v-else
      class="protected-shell"
    >
      <header>
        <div>
          <p class="eyebrow">
            SESSION ACTIVE
          </p>
          <h1>欢迎，{{ session.user?.username }}</h1>
        </div>
        <button
          type="button"
          @click="session.logout"
        >
          退出登录
        </button>
      </header>
      <p class="balance">
        初始资金 <strong>¥{{ (session.user?.cash ?? session.account?.cash ?? 0).toLocaleString('zh-CN') }}</strong>
      </p>
      <p>交易工作台正在载入。</p>
    </section>
  </main>
</template>

<style>
:root { font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif; color: #202820; background: #ece9df; font-synthesis: none; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; background: radial-gradient(circle at 10% 10%, #f9f5e9 0, transparent 35%), linear-gradient(135deg, #e8ece3, #e9e2d4); }
button, input, select { font: inherit; }
.app-shell { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.loading { color: #526052; }
.protected-shell { width: min(1100px, 100%); min-height: 70vh; padding: 32px; border: 1px solid #d4d0c5; border-radius: 20px; background: #fffdf8; box-shadow: 0 24px 70px #2b34231a; }
.protected-shell header { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
.protected-shell h1 { margin: 4px 0; font-family: Georgia, serif; }
.protected-shell button { border: 1px solid #b8b8ae; border-radius: 8px; padding: 9px 14px; background: transparent; cursor: pointer; }
.eyebrow { margin: 0; color: #b55732; font: 700 12px/1.2 ui-monospace, monospace; letter-spacing: .14em; }
.balance { margin-top: 56px; font-size: 18px; }
</style>

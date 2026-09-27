<script setup lang="ts">
import { ref } from 'vue';
import { useSessionStore } from '../stores/session';

const session = useSessionStore();
const mode = ref<'login' | 'register'>('register');
const username = ref('');
const password = ref('');

async function submit() {
  try {
    if (mode.value === 'register') await session.register(username.value, password.value);
    else await session.login(username.value, password.value);
  } catch {
    // The store already exposes a user-safe error message.
  }
}
</script>

<template>
  <section
    class="auth-card"
    aria-labelledby="auth-title"
  >
    <p class="eyebrow">
      PAPER MARKET / 纸上交易
    </p>
    <h1 id="auth-title">
      澄明交易台
    </h1>
    <p class="intro">
      在真实的价格—时间优先规则下，练习每一次判断。
    </p>

    <div
      class="mode-switch"
      aria-label="认证方式"
    >
      <button
        :class="{ active: mode === 'register' }"
        type="button"
        @click="mode = 'register'"
      >
        注册
      </button>
      <button
        :class="{ active: mode === 'login' }"
        type="button"
        @click="mode = 'login'"
      >
        登录
      </button>
    </div>

    <form @submit.prevent="submit">
      <label for="username">用户名</label>
      <input
        id="username"
        v-model.trim="username"
        autocomplete="username"
        minlength="3"
        maxlength="24"
        required
      >

      <label for="password">密码</label>
      <input
        id="password"
        v-model="password"
        :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
        type="password"
        minlength="8"
        maxlength="72"
        required
      >

      <p
        v-if="session.error"
        class="error"
        role="alert"
      >
        {{ session.error }}
      </p>
      <button
        class="primary"
        :disabled="session.status === 'loading'"
        type="submit"
      >
        {{ session.status === 'loading' ? '处理中…' : mode === 'register' ? '建立模拟账户' : '进入交易台' }}
      </button>
    </form>
    <p class="fine-print">
      本应用仅用于模拟练习，不涉及真实资金或投资建议。
    </p>
  </section>
</template>

<style scoped>
.auth-card { width: min(440px, calc(100vw - 32px)); padding: 40px; border: 1px solid #d9d4c8; border-radius: 18px; background: #fffdf8; box-shadow: 0 24px 70px #2b34231a; }
.eyebrow { color: #b55732; font: 700 12px/1.2 ui-monospace, monospace; letter-spacing: .14em; }
h1 { margin: 10px 0 8px; font-family: Georgia, serif; font-size: clamp(36px, 8vw, 52px); color: #1f2a1f; }
.intro, .fine-print { color: #697064; line-height: 1.6; }
.mode-switch { display: grid; grid-template-columns: 1fr 1fr; margin: 28px 0 22px; padding: 4px; border-radius: 12px; background: #f1eee6; }
.mode-switch button { border: 0; padding: 10px; border-radius: 9px; background: transparent; color: #697064; cursor: pointer; }
.mode-switch .active { background: #fff; color: #203424; box-shadow: 0 2px 10px #26342114; }
form { display: grid; gap: 9px; }
label { margin-top: 8px; color: #344238; font-size: 14px; font-weight: 650; }
input { min-height: 44px; border: 1px solid #cbc8bf; border-radius: 9px; padding: 0 13px; background: #fff; color: #1f2a1f; font: inherit; }
input:focus { outline: 3px solid #dce7d8; border-color: #466b4f; }
.primary { margin-top: 16px; min-height: 46px; border: 0; border-radius: 9px; background: #244d33; color: #fff; font-weight: 700; cursor: pointer; }
.primary:disabled { opacity: .65; cursor: wait; }
.error { margin: 6px 0 0; color: #a33b2b; }
.fine-print { margin: 20px 0 0; font-size: 12px; }
@media (max-width: 520px) { .auth-card { padding: 28px 22px; } }
</style>

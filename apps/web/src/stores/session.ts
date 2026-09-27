import { defineStore } from 'pinia';
import { ApiError, authenticate, fetchAccount } from '../services/api';
import type { AccountSnapshot, UserSummary } from '../types';

const TOKEN_KEY = 'paper-trading-token';

function savedToken(): string | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '发生未知错误';
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    token: savedToken(),
    user: null as UserSummary | null,
    account: null as AccountSnapshot | null,
    status: 'idle',
    error: null as string | null,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token && state.user),
  },
  actions: {
    async login(username: string, password: string) {
      await this.authenticate('login', username, password);
    },
    async register(username: string, password: string) {
      await this.authenticate('register', username, password);
    },
    async authenticate(mode: 'login' | 'register', username: string, password: string) {
      this.status = 'loading';
      this.error = null;
      try {
        const result = await authenticate(mode, username, password);
        this.token = result.token;
        this.user = result.user;
        sessionStorage.setItem(TOKEN_KEY, result.token);
        this.status = 'ready';
      } catch (error) {
        this.status = 'idle';
        this.error = errorMessage(error);
        throw error;
      }
    },
    async restore() {
      if (!this.token) {
        this.status = 'idle';
        return;
      }
      this.status = 'loading';
      this.error = null;
      try {
        const account = await fetchAccount(this.token);
        this.account = account;
        this.user = account.user;
        this.status = 'ready';
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          this.logout();
          return;
        }
        this.status = 'idle';
        this.error = errorMessage(error);
      }
    },
    logout() {
      this.token = null;
      this.user = null;
      this.account = null;
      this.status = 'idle';
      this.error = null;
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(TOKEN_KEY);
    },
  },
});

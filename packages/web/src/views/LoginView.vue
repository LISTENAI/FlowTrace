<script setup lang="ts">
import { ArrowRightIcon, BoltIcon } from '@heroicons/vue/24/outline';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { AuthConfig } from '@flowtrace/shared';
import { request } from '@/api/client';
import { authClient } from '@/auth';
import { weComAuthorizationURL } from '@/auth/wecom';
import ThemeMenu from '@/components/ThemeMenu.vue';

const route = useRoute();
const config = ref<AuthConfig>();
const email = ref('');
const password = ref('');
const name = ref('');
const configLoading = ref(true);
const loading = ref(false);
const error = ref('');
const callbackURL = computed(() => {
  const target =
    typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  return target.startsWith('/') && !target.startsWith('//') ? target : '/';
});

onMounted(async () => {
  try {
    config.value = await request<AuthConfig>('/auth-config');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法读取登录方式';
  } finally {
    configLoading.value = false;
  }
});

async function providerLogin(provider: string) {
  error.value = '';
  loading.value = true;
  const result = await authClient.signIn.social({
    provider,
    callbackURL: callbackURL.value,
    disableRedirect: true,
  });
  if (result.error) {
    error.value = result.error.message ?? '无法发起登录';
    loading.value = false;
    return;
  }
  if (!result.data?.url) {
    error.value = '登录服务没有返回授权地址';
    loading.value = false;
    return;
  }
  try {
    window.location.assign(
      provider === 'wecom'
        ? weComAuthorizationURL(result.data.url, navigator.userAgent)
        : result.data.url,
    );
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法发起登录';
    loading.value = false;
  }
}

async function passwordLogin() {
  error.value = '';
  loading.value = true;
  const result = config.value?.setupRequired
    ? await authClient.signUp.email({
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
        callbackURL: callbackURL.value,
      })
    : await authClient.signIn.email({
        email: email.value.trim(),
        password: password.value,
        callbackURL: callbackURL.value,
      });
  if (result.error) {
    error.value = result.error.message ?? '登录失败';
    loading.value = false;
    return;
  }
  window.location.assign(callbackURL.value);
}
</script>

<template>
  <main
    class="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12"
  >
    <div class="absolute right-5 top-5"><ThemeMenu /></div>
    <div
      class="pointer-events-none absolute inset-0 opacity-70"
      aria-hidden="true"
    >
      <div
        class="absolute left-[12%] top-[18%] h-64 w-64 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-950/50"
      />
      <div
        class="absolute bottom-[12%] right-[10%] h-72 w-72 rounded-full bg-cyan-100/50 blur-3xl dark:bg-cyan-950/30"
      />
    </div>

    <section class="surface relative w-full max-w-md p-7 sm:p-9">
      <div class="flex items-center gap-3">
        <div
          class="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15 dark:bg-indigo-500"
        >
          <BoltIcon class="h-6 w-6" />
        </div>
        <div>
          <h1
            class="text-xl font-bold tracking-tight text-slate-950 dark:text-white"
          >
            {{ config?.setupRequired ? '初始化 FlowTrace' : '登录 FlowTrace' }}
          </h1>
          <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {{
              config?.setupRequired
                ? '创建此实例唯一的本地所有者账号'
                : '继续查看和维护真实的研发过程'
            }}
          </p>
        </div>
      </div>

      <p v-if="configLoading" class="mt-8 text-center text-sm text-slate-400">
        正在读取登录方式…
      </p>

      <div v-else-if="config?.provider.kind === 'external'" class="mt-8">
        <button
          class="focus-ring flex w-full items-center justify-between rounded-2xl bg-slate-950 px-4 py-3.5 text-left text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          :disabled="loading"
          @click="providerLogin(config.provider.id)"
        >
          使用{{ config.provider.name }}登录
          <ArrowRightIcon class="h-4 w-4" />
        </button>
      </div>

      <form
        v-else-if="config?.provider.kind === 'local'"
        class="mt-7"
        @submit.prevent="passwordLogin"
      >
        <p
          class="mb-4 text-xs font-semibold tracking-wide text-amber-700 dark:text-amber-300"
        >
          {{ config.setupRequired ? '首次初始化' : '本地账号' }}
        </p>
        <div class="space-y-3">
          <input
            v-if="config.setupRequired"
            v-model="name"
            required
            autocomplete="name"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-white/80 px-3.5 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            placeholder="显示名称"
          />
          <input
            v-model="email"
            required
            type="email"
            autocomplete="email"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-white/80 px-3.5 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            placeholder="邮箱"
          />
          <input
            v-model="password"
            required
            minlength="8"
            type="password"
            :autocomplete="
              config.setupRequired ? 'new-password' : 'current-password'
            "
            class="focus-ring w-full rounded-xl border border-slate-200 bg-white/80 px-3.5 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            placeholder="密码"
          />
        </div>
        <button
          type="submit"
          class="focus-ring mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-indigo-500"
          :disabled="loading || (config.setupRequired && !name.trim())"
        >
          {{ config.setupRequired ? '创建所有者账号' : '登录' }}
        </button>
      </form>
      <p v-if="error" class="mt-4 text-sm text-rose-600 dark:text-rose-400">
        {{ error }}
      </p>
    </section>
  </main>
</template>

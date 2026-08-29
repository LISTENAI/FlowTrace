<script setup lang="ts">
import {
  ArrowRightStartOnRectangleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { authClient } from '@/auth';
import ThemeMenu from '@/components/ThemeMenu.vue';

const route = useRoute();
const message = computed(() =>
  typeof route.query.message === 'string'
    ? route.query.message
    : '登录账号无法与人员档案建立可靠关联，请联系实例管理员。',
);

async function signOut() {
  await authClient.signOut();
  window.location.assign('/login');
}
</script>

<template>
  <main class="relative grid min-h-screen place-items-center px-5 py-12">
    <div class="absolute right-5 top-5"><ThemeMenu /></div>
    <section class="surface w-full max-w-md p-7 sm:p-9">
      <span
        class="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300"
      >
        <ExclamationTriangleIcon class="h-6 w-6" />
      </span>
      <h1 class="mt-5 text-xl font-bold text-slate-950 dark:text-white">
        无法确认人员身份
      </h1>
      <p class="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {{ message }}
      </p>
      <p class="mt-4 text-xs leading-5 text-slate-400">
        FlowTrace 不允许用户自行认领人员档案，以免同名或重复邮箱造成身份冒领。
      </p>
      <button
        class="focus-ring mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        @click="signOut"
      >
        <ArrowRightStartOnRectangleIcon class="h-4 w-4" />
        退出登录
      </button>
    </section>
  </main>
</template>

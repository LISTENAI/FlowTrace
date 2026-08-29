<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  Bars3BottomLeftIcon,
  ArrowRightStartOnRectangleIcon,
  BoltIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CpuChipIcon,
  KeyIcon,
  PencilSquareIcon,
  QueueListIcon,
  Squares2X2Icon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import type { CurrentIdentity } from '@flowtrace/shared';
import { api } from '@/api';
import { authClient, currentIdentity } from '@/auth';
import AppModal from '@/components/AppModal.vue';
import ToastStack from '@/components/ToastStack.vue';
import ThemeMenu from '@/components/ThemeMenu.vue';
import { loadWorkspace, workspace } from '@/state/workspace';
import { toasts } from '@/state/toasts';

const route = useRoute();
const mobileOpen = ref(false);
const session = authClient.useSession();
const identity = ref<CurrentIdentity>();
const profileOpen = ref(false);
const profileSaving = ref(false);
const passwordOpen = ref(false);
const passwordChanging = ref(false);
const profileForm = reactive({ name: '', note: '' });
const passwordForm = reactive({ current: '', next: '', confirm: '' });
const activeProjectId = computed(
  () => route.params.projectId as string | undefined,
);
const accountEmail = computed(() => {
  const email = identity.value?.person.email || session.value.data?.user.email;
  return email?.endsWith('@flowtrace.invalid') ? '未提供邮箱' : email;
});
const projectColors = [
  'bg-indigo-500',
  'bg-cyan-500',
  'bg-amber-500',
  'bg-rose-500',
];

async function signOut() {
  await authClient.signOut();
  window.location.assign('/login');
}

function openProfile() {
  const person = identity.value?.person;
  if (!person) return;
  profileForm.name = person.name;
  profileForm.note = person.note ?? '';
  passwordOpen.value = false;
  passwordForm.current = '';
  passwordForm.next = '';
  passwordForm.confirm = '';
  profileOpen.value = true;
}

async function changePassword() {
  if (passwordForm.next !== passwordForm.confirm) {
    toasts.show('两次输入的新密码不一致', undefined, 'error');
    return;
  }
  passwordChanging.value = true;
  try {
    const result = await authClient.changePassword({
      currentPassword: passwordForm.current,
      newPassword: passwordForm.next,
      revokeOtherSessions: true,
    });
    if (result.error) {
      throw new Error(
        result.error.code === 'INVALID_PASSWORD'
          ? '当前密码不正确'
          : (result.error.message ?? '密码修改失败'),
      );
    }
    passwordForm.current = '';
    passwordForm.next = '';
    passwordForm.confirm = '';
    passwordOpen.value = false;
    toasts.show('密码已更新', '其他设备上的登录会话已退出');
  } catch (error) {
    toasts.show(
      '密码修改失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    passwordChanging.value = false;
  }
}

async function saveProfile() {
  const person = identity.value?.person;
  if (!person) return;
  profileSaving.value = true;
  try {
    const updated = await api.updatePerson(person.id, {
      ...(person.identity?.nameAuthority === 'flowtrace'
        ? { name: profileForm.name }
        : {}),
      note: profileForm.note,
    });
    identity.value = { ...identity.value!, person: updated };
    profileOpen.value = false;
    toasts.show('个人资料已更新');
    await loadWorkspace(true);
  } catch (error) {
    toasts.show(
      '保存失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    profileSaving.value = false;
  }
}

onMounted(async () => {
  if (route.name !== 'login' && route.name !== 'identity-issue') {
    const [, loadedIdentity] = await Promise.all([
      loadWorkspace(),
      currentIdentity(),
    ]);
    identity.value = loadedIdentity;
  }
});
</script>

<template>
  <RouterView
    v-if="route.name === 'login' || route.name === 'identity-issue'"
  />
  <div v-else class="min-h-screen lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
    <div
      v-if="mobileOpen"
      class="fixed inset-0 z-[80] bg-slate-950/20 backdrop-blur-sm lg:hidden"
      @click="mobileOpen = false"
    />

    <aside
      class="fixed inset-y-0 left-0 z-[90] flex w-[17rem] flex-col border-r border-slate-200/70 bg-[#f9f9fc]/95 px-3.5 py-4 shadow-xl shadow-slate-900/5 backdrop-blur-xl transition-transform dark:border-slate-800 dark:bg-slate-950/95 lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none"
      :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex items-center justify-between px-2.5">
        <RouterLink
          to="/"
          class="focus-ring flex items-center gap-2.5 rounded-xl"
          @click="mobileOpen = false"
        >
          <div
            class="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-900/15"
          >
            <span
              class="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-indigo-500"
            />
            <BoltIcon class="relative h-5 w-5" />
          </div>
          <div>
            <div class="text-[15px] font-bold tracking-tight text-slate-900">
              FlowTrace
            </div>
            <div
              class="text-[10px] font-medium tracking-[.14em] text-slate-400"
            >
              研发过程追踪
            </div>
          </div>
        </RouterLink>
        <button
          class="rounded-lg p-1.5 text-slate-400 lg:hidden"
          aria-label="关闭导航"
          @click="mobileOpen = false"
        >
          <XMarkIcon class="h-5 w-5" />
        </button>
      </div>

      <nav class="mt-8 space-y-1">
        <RouterLink
          to="/"
          class="focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
          :class="
            route.name === 'projects'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
              : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
          "
          @click="mobileOpen = false"
        >
          <Squares2X2Icon class="h-[18px] w-[18px]" />
          项目总览
        </RouterLink>
        <RouterLink
          to="/people"
          class="focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
          :class="
            route.name === 'people'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
              : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
          "
          @click="mobileOpen = false"
        >
          <UsersIcon class="h-[18px] w-[18px]" />
          人员目录
        </RouterLink>
        <RouterLink
          to="/settings/project-rhythms"
          class="focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
          :class="
            route.name === 'project-rhythms'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
              : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
          "
          @click="mobileOpen = false"
        >
          <QueueListIcon class="h-[18px] w-[18px]" />
          项目节奏
        </RouterLink>
        <RouterLink
          to="/settings/ai-integration"
          class="focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
          :class="
            route.name === 'ai-integration'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
              : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
          "
          @click="mobileOpen = false"
        >
          <CpuChipIcon class="h-[18px] w-[18px]" />
          AI 接入
        </RouterLink>
      </nav>

      <div class="mt-7 flex min-h-0 flex-1 flex-col">
        <div class="flex items-center justify-between px-3">
          <p class="text-[11px] font-semibold tracking-[.12em] text-slate-400">
            我的项目
          </p>
          <span
            class="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-500"
          >
            {{ workspace.projects.length }}
          </span>
        </div>
        <div class="mt-2 min-h-0 space-y-0.5 overflow-y-auto">
          <RouterLink
            v-for="(project, index) in workspace.projects"
            :key="project.id"
            :to="`/projects/${project.id}`"
            class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition"
            :class="
              activeProjectId === project.id
                ? 'bg-indigo-50/80 font-medium text-indigo-800'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
            "
            @click="mobileOpen = false"
          >
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :class="projectColors[index % projectColors.length]"
            />
            <span class="min-w-0 flex-1 truncate">{{ project.name }}</span>
            <span
              v-if="project.metrics?.blocked"
              v-tooltip="'阻塞需求'"
              class="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600"
            >
              {{ project.metrics.blocked }}
            </span>
            <ChevronRightIcon
              class="h-3.5 w-3.5 text-slate-300 opacity-0 transition group-hover:opacity-100"
            />
          </RouterLink>
          <div v-if="workspace.loading" class="space-y-2 px-3 py-2">
            <div
              v-for="i in 3"
              :key="i"
              class="h-8 animate-pulse rounded-lg bg-slate-200/60"
            />
          </div>
        </div>
      </div>
    </aside>

    <main class="min-w-0">
      <header
        class="sticky top-0 z-[70] flex h-16 items-center justify-between border-b border-slate-200/60 bg-[#f7f8fb]/85 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 sm:px-7 lg:px-9"
      >
        <div>
          <button
            class="focus-ring rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm lg:hidden"
            aria-label="打开导航"
            @click="mobileOpen = true"
          >
            <Bars3BottomLeftIcon class="h-5 w-5" />
          </button>
        </div>
        <div class="flex items-center gap-2">
          <Menu v-if="session.data?.user" as="div" class="relative">
            <MenuButton
              class="focus-ring flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-1.5 pr-2.5 text-slate-600 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              aria-label="我的账号"
            >
              <span
                class="grid h-6 w-6 place-items-center rounded-lg bg-indigo-50 text-[11px] font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
              >
                {{
                  (identity?.person?.name || session.data.user.name).slice(0, 1)
                }}
              </span>
              <span
                class="hidden max-w-32 truncate text-xs font-medium sm:block"
              >
                {{ identity?.person?.name || session.data.user.name }}
              </span>
              <ChevronDownIcon
                class="hidden h-3.5 w-3.5 text-slate-400 sm:block"
              />
            </MenuButton>

            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="translate-y-1 opacity-0 scale-95"
              enter-to-class="translate-y-0 opacity-100 scale-100"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="translate-y-0 opacity-100 scale-100"
              leave-to-class="translate-y-1 opacity-0 scale-95"
            >
              <MenuItems
                class="absolute right-0 z-40 mt-2 w-64 origin-top-right rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl outline-none dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/30"
              >
                <div class="px-2.5 pb-2 pt-1.5">
                  <p
                    class="truncate text-xs font-semibold text-slate-800 dark:text-slate-100"
                  >
                    {{ identity?.person?.name || session.data.user.name }}
                  </p>
                  <p class="mt-0.5 truncate text-[11px] text-slate-400">
                    {{ identity?.provider.name }} · {{ accountEmail }}
                  </p>
                </div>
                <div
                  class="border-t border-slate-100 pt-1 dark:border-slate-800"
                >
                  <MenuItem v-slot="{ active }">
                    <button
                      class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition"
                      :class="
                        active
                          ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                          : 'text-slate-600 dark:text-slate-300'
                      "
                      @click="openProfile"
                    >
                      <PencilSquareIcon class="h-4 w-4" />
                      个人资料
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition"
                      :class="
                        active
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          : 'text-slate-600 dark:text-slate-300'
                      "
                      @click="signOut"
                    >
                      <ArrowRightStartOnRectangleIcon class="h-4 w-4" />
                      退出登录
                    </button>
                  </MenuItem>
                </div>
              </MenuItems>
            </Transition>
          </Menu>
          <ThemeMenu />
        </div>
      </header>

      <RouterView v-slot="{ Component, route: matchedRoute }">
        <Transition name="page" mode="out-in">
          <KeepAlive :max="5" include="ProjectView">
            <component
              :is="Component"
              :key="
                matchedRoute.name === 'project'
                  ? String(matchedRoute.params.projectId)
                  : matchedRoute.fullPath
              "
            />
          </KeepAlive>
        </Transition>
      </RouterView>
    </main>
    <AppModal
      :open="profileOpen"
      title="个人资料"
      description="登录身份由当前提供方确认；这里只维护允许在 FlowTrace 补充的资料。"
      width="sm"
      @close="profileOpen = false"
    >
      <div class="space-y-5">
        <form class="space-y-4" @submit.prevent="saveProfile">
          <div class="rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-slate-800/70">
            <div class="flex items-center justify-between gap-3">
              <p class="text-[11px] font-semibold text-slate-400">登录账号</p>
              <span
                class="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-900"
              >
                {{ identity?.provider.name }}管理
              </span>
            </div>
            <p class="mt-1 truncate text-sm text-slate-700 dark:text-slate-200">
              {{ accountEmail }}
            </p>
          </div>
          <label class="block">
            <span
              class="text-xs font-semibold text-slate-600 dark:text-slate-300"
              >姓名</span
            >
            <input
              v-model="profileForm.name"
              required
              maxlength="50"
              class="focus-ring mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
              :disabled="
                Boolean(identity?.person.identity) &&
                identity?.person.identity?.nameAuthority !== 'flowtrace'
              "
            />
            <span
              v-if="
                identity?.person.identity &&
                identity.person.identity.nameAuthority !== 'flowtrace'
              "
              class="mt-1.5 block text-[11px] text-slate-400"
            >
              姓名由{{ identity.provider.name }}管理
            </span>
          </label>
          <label class="block">
            <span
              class="text-xs font-semibold text-slate-600 dark:text-slate-300"
              >备注</span
            >
            <textarea
              v-model="profileForm.note"
              rows="3"
              class="focus-ring mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              placeholder="例如部门、岗位或团队"
            />
          </label>
          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="focus-ring rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              @click="profileOpen = false"
            >
              取消
            </button>
            <button
              type="submit"
              class="focus-ring rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-indigo-500"
              :disabled="profileSaving || !profileForm.name.trim()"
            >
              {{ profileSaving ? '保存中…' : '保存' }}
            </button>
          </div>
        </form>

        <section
          v-if="identity?.provider.kind === 'local'"
          class="border-t border-slate-100 pt-4 dark:border-slate-800"
        >
          <button
            type="button"
            class="focus-ring flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            @click="passwordOpen = !passwordOpen"
          >
            <span class="flex items-center gap-2">
              <KeyIcon class="h-4 w-4 text-slate-400" />修改密码
            </span>
            <ChevronDownIcon
              class="h-4 w-4 text-slate-400 transition"
              :class="passwordOpen ? 'rotate-180' : ''"
            />
          </button>
          <form
            v-if="passwordOpen"
            class="mt-3 space-y-3"
            @submit.prevent="changePassword"
          >
            <input
              v-model="passwordForm.current"
              required
              type="password"
              autocomplete="current-password"
              class="focus-ring w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              placeholder="当前密码"
            />
            <input
              v-model="passwordForm.next"
              required
              minlength="8"
              type="password"
              autocomplete="new-password"
              class="focus-ring w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              placeholder="新密码（至少 8 位）"
            />
            <input
              v-model="passwordForm.confirm"
              required
              minlength="8"
              type="password"
              autocomplete="new-password"
              class="focus-ring w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              placeholder="再次输入新密码"
            />
            <div class="flex justify-end">
              <button
                type="submit"
                class="focus-ring rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-indigo-500"
                :disabled="
                  passwordChanging ||
                  passwordForm.next.length < 8 ||
                  passwordForm.next !== passwordForm.confirm
                "
              >
                {{ passwordChanging ? '修改中…' : '确认修改密码' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppModal>
    <ToastStack />
  </div>
</template>

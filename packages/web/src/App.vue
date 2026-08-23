<script setup lang="ts">
import {
  Bars3BottomLeftIcon,
  BoltIcon,
  ChevronRightIcon,
  FolderIcon,
  PlusIcon,
  QueueListIcon,
  Squares2X2Icon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { computed, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import ToastStack from '@/components/ToastStack.vue';
import { loadWorkspace, workspace } from '@/state/workspace';

const route = useRoute();
const mobileOpen = ref(false);
const activeProjectId = computed(
  () => route.params.projectId as string | undefined,
);
const projectColors = [
  'bg-indigo-500',
  'bg-cyan-500',
  'bg-amber-500',
  'bg-rose-500',
];

onMounted(() => loadWorkspace());

function requestNewRequirement() {
  window.dispatchEvent(new CustomEvent('flowtrace:new-requirement'));
}
</script>

<template>
  <div class="min-h-screen lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
    <div
      v-if="mobileOpen"
      class="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-sm lg:hidden"
      @click="mobileOpen = false"
    />

    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-[17rem] flex-col border-r border-slate-200/70 bg-[#f9f9fc]/95 px-3.5 py-4 shadow-xl shadow-slate-900/5 backdrop-blur-xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none"
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
              class="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600"
              title="阻塞需求"
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
        class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/60 bg-[#f7f8fb]/85 px-4 backdrop-blur-xl sm:px-7 lg:px-9"
      >
        <div class="flex items-center gap-3">
          <button
            class="focus-ring rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm lg:hidden"
            aria-label="打开导航"
            @click="mobileOpen = true"
          >
            <Bars3BottomLeftIcon class="h-5 w-5" />
          </button>
          <div class="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
            <FolderIcon class="h-4 w-4" />
            <span>可信内部环境</span>
            <span class="h-1 w-1 rounded-full bg-emerald-400" />
            <span>自动保存历史</span>
          </div>
        </div>
        <button
          v-if="activeProjectId"
          class="focus-ring inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800"
          @click="requestNewRequirement"
        >
          <PlusIcon class="h-4 w-4" />
          新建需求
        </button>
      </header>

      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <ToastStack />
  </div>
</template>

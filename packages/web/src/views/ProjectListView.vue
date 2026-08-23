<script setup lang="ts">
import type { ProjectRhythm } from '@flowtrace/shared';
import {
  ArrowUpRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  SparklesIcon,
} from '@heroicons/vue/24/outline';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import AppModal from '@/components/AppModal.vue';
import { relativeDate } from '@/lib/presentation';
import { toasts } from '@/state/toasts';
import { loadWorkspace, workspace } from '@/state/workspace';

const router = useRouter();
const createOpen = ref(false);
const saving = ref(false);
const rhythms = ref<ProjectRhythm[]>([]);
const form = reactive({
  key: '',
  name: '',
  description: '',
  rhythmId: '',
});
const selectedRhythm = computed(() =>
  rhythms.value.find((item) => item.id === form.rhythmId),
);

const totals = computed(() => ({
  incomplete: workspace.projects.reduce(
    (sum, item) => sum + (item.metrics?.incompleteRequirements ?? 0),
    0,
  ),
  waiting: workspace.projects.reduce(
    (sum, item) => sum + (item.metrics?.waiting ?? 0),
    0,
  ),
  blocked: workspace.projects.reduce(
    (sum, item) => sum + (item.metrics?.blocked ?? 0),
    0,
  ),
}));

onMounted(async () => {
  await Promise.all([loadWorkspace(), loadRhythms()]);
});

async function loadRhythms() {
  rhythms.value = await api.projectRhythms();
  if (!rhythms.value.some((item) => item.id === form.rhythmId)) {
    form.rhythmId = rhythms.value[0]?.id ?? '';
  }
}

async function createProject() {
  const rhythm = selectedRhythm.value;
  if (!rhythm) {
    toasts.show(
      '还没有可用的项目节奏',
      '请先在项目节奏中添加一个模板',
      'error',
    );
    return;
  }
  saving.value = true;
  try {
    const project = await api.createProject({
      key: form.key.toUpperCase(),
      name: form.name,
      description: form.description,
      templateStages: rhythm.stages.map(({ name }) => ({ name })),
    });
    await loadWorkspace(true);
    createOpen.value = false;
    toasts.show(
      '项目已创建',
      `已按「${rhythm.name}」准备 ${rhythm.stages.length} 个默认阶段`,
    );
    await router.push(`/projects/${project.id}`);
  } catch (error) {
    toasts.show(
      '创建失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-[92rem] px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
    <section
      class="relative overflow-hidden rounded-[1.8rem] bg-slate-900 px-6 py-7 text-white shadow-2xl shadow-slate-900/10 sm:px-8 sm:py-9"
    >
      <div
        class="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-indigo-500/35 blur-3xl"
      />
      <div
        class="absolute bottom-[-7rem] right-[22%] h-52 w-52 rounded-full bg-cyan-400/15 blur-3xl"
      />
      <div
        class="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end"
      >
        <div class="max-w-2xl">
          <div
            class="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-indigo-100"
          >
            <SparklesIcon class="h-3.5 w-3.5" />
            项目组合概况
          </div>
          <h1 class="text-2xl font-semibold tracking-[-.035em] sm:text-4xl">
            项目总览
          </h1>
          <p
            class="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-[15px]"
          >
            汇总当前未完成需求、等待中与阻塞事项，快速进入各项目查看过程。
          </p>
        </div>
        <div class="grid grid-cols-3 gap-2 sm:gap-3">
          <div
            class="rounded-2xl border border-white/10 bg-white/[.07] px-4 py-3 backdrop-blur"
          >
            <div class="text-2xl font-semibold">{{ totals.incomplete }}</div>
            <div class="mt-0.5 text-[11px] text-slate-400">未完成需求</div>
          </div>
          <div
            class="rounded-2xl border border-amber-300/10 bg-amber-300/[.07] px-4 py-3 backdrop-blur"
          >
            <div class="text-2xl font-semibold text-amber-300">
              {{ totals.waiting }}
            </div>
            <div class="mt-0.5 text-[11px] text-slate-400">正在等待</div>
          </div>
          <div
            class="rounded-2xl border border-rose-300/10 bg-rose-300/[.07] px-4 py-3 backdrop-blur"
          >
            <div class="text-2xl font-semibold text-rose-300">
              {{ totals.blocked }}
            </div>
            <div class="mt-0.5 text-[11px] text-slate-400">当前阻塞</div>
          </div>
        </div>
      </div>
    </section>

    <section class="mt-9">
      <div class="mb-4 flex items-end justify-between">
        <div>
          <h2 class="text-lg font-semibold tracking-tight text-slate-900">
            全部项目
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            按项目查看未完成需求、风险和最近更新时间。
          </p>
        </div>
        <button
          class="focus-ring inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
          @click="createOpen = true"
        >
          <PlusIcon class="h-4 w-4" />
          新建项目
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="(project, index) in workspace.projects"
          :key="project.id"
          class="surface focus-ring group relative overflow-hidden p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-900/[.06]"
          @click="router.push(`/projects/${project.id}`)"
        >
          <div
            class="absolute inset-x-0 top-0 h-1 opacity-80"
            :class="['bg-indigo-500', 'bg-cyan-500', 'bg-amber-500'][index % 3]"
          />
          <div class="flex items-start justify-between gap-4">
            <div class="flex min-w-0 items-center gap-3">
              <div
                class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-bold"
                :class="
                  [
                    'bg-indigo-50 text-indigo-700',
                    'bg-cyan-50 text-cyan-700',
                    'bg-amber-50 text-amber-700',
                  ][index % 3]
                "
              >
                {{ project.key.slice(0, 3) }}
              </div>
              <div class="min-w-0">
                <h3 class="truncate text-base font-semibold text-slate-900">
                  {{ project.name }}
                </h3>
                <p class="mt-0.5 truncate text-xs text-slate-400">
                  {{ project.description || '尚未填写项目说明' }}
                </p>
              </div>
            </div>
            <ArrowUpRightIcon
              class="h-4 w-4 text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-indigo-500"
            />
          </div>

          <div class="mt-6 grid grid-cols-3 gap-2">
            <div class="rounded-xl bg-slate-50 px-3 py-2.5">
              <div class="text-lg font-semibold text-slate-800">
                {{ project.metrics?.incompleteRequirements ?? 0 }}
              </div>
              <div class="text-[10px] text-slate-400">未完成</div>
            </div>
            <div class="rounded-xl bg-amber-50/70 px-3 py-2.5">
              <div class="text-lg font-semibold text-amber-700">
                {{ project.metrics?.waiting ?? 0 }}
              </div>
              <div class="text-[10px] text-amber-600/70">等待中</div>
            </div>
            <div class="rounded-xl bg-rose-50/70 px-3 py-2.5">
              <div class="text-lg font-semibold text-rose-700">
                {{ project.metrics?.blocked ?? 0 }}
              </div>
              <div class="text-[10px] text-rose-600/70">阻塞</div>
            </div>
          </div>
          <div
            class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400"
          >
            <span class="inline-flex items-center gap-1.5"
              ><ClockIcon class="h-3.5 w-3.5" />{{
                relativeDate(project.updatedAt)
              }}更新</span
            >
            <span
              v-if="project.metrics?.overdue"
              class="inline-flex items-center gap-1 text-rose-600"
            >
              <ExclamationTriangleIcon class="h-3.5 w-3.5" />{{
                project.metrics.overdue
              }}
              项延期
            </span>
            <span v-else class="text-emerald-600">排期平稳</span>
          </div>
        </button>

        <button
          class="focus-ring group flex min-h-60 flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-slate-300 bg-white/40 p-6 text-center transition hover:border-indigo-300 hover:bg-indigo-50/30"
          @click="createOpen = true"
        >
          <span
            class="grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 transition group-hover:scale-105 group-hover:text-indigo-600 group-hover:ring-indigo-200"
          >
            <PlusIcon class="h-5 w-5" />
          </span>
          <span class="mt-3 text-sm font-semibold text-slate-700"
            >创建新的项目边界</span
          >
          <span class="mt-1 max-w-48 text-xs leading-5 text-slate-400"
            >工作对象或长期研发流程发生变化时使用</span
          >
        </button>
      </div>
    </section>

    <AppModal
      :open="createOpen"
      title="创建项目"
      description="项目是长期研发流程和阶段模板的边界。"
      @close="createOpen = false"
    >
      <form class="space-y-5" @submit.prevent="createProject">
        <div class="grid gap-4 sm:grid-cols-[7rem_1fr]">
          <label class="block">
            <span class="mb-1.5 block text-xs font-medium text-slate-600"
              >项目标识</span
            >
            <input
              v-model="form.key"
              required
              maxlength="10"
              placeholder="FW"
              class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white"
            />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs font-medium text-slate-600"
              >项目名称</span
            >
            <input
              v-model="form.name"
              required
              placeholder="例如：晴岚设备固件"
              class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white"
            />
          </label>
        </div>
        <label class="block">
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >一句话说明</span
          >
          <textarea
            v-model="form.description"
            rows="2"
            placeholder="这个项目长期负责什么？"
            class="focus-ring w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white"
          />
        </label>
        <fieldset>
          <legend class="mb-2 text-xs font-medium text-slate-600">
            从哪种节奏开始
          </legend>
          <div class="grid gap-2 sm:grid-cols-3">
            <button
              v-for="rhythm in rhythms"
              :key="rhythm.id"
              type="button"
              class="rounded-xl border p-3 text-left transition"
              :class="
                form.rhythmId === rhythm.id
                  ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100'
                  : 'border-slate-200 hover:border-slate-300'
              "
              @click="form.rhythmId = rhythm.id"
            >
              <span class="text-sm font-semibold text-slate-800">{{
                rhythm.name
              }}</span>
              <span class="mt-1 block text-[10px] leading-4 text-slate-400">{{
                rhythm.stages.map((stage) => stage.name).join(' · ')
              }}</span>
            </button>
          </div>
          <div
            v-if="!rhythms.length"
            class="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500"
          >
            暂无可用节奏，
            <button
              type="button"
              class="font-semibold text-indigo-600"
              @click="router.push('/settings/project-rhythms')"
            >
              先去添加
            </button>
          </div>
          <p class="mt-2 text-[11px] leading-5 text-slate-400">
            节奏只用于生成这个项目的默认环节，之后可以独立调整。
          </p>
        </fieldset>
        <div class="flex justify-end gap-2 pt-1">
          <button
            type="button"
            class="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
            @click="createOpen = false"
          >
            取消
          </button>
          <button
            :disabled="saving || !selectedRhythm"
            class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 disabled:opacity-50"
          >
            {{ saving ? '正在创建…' : '创建并进入' }}
          </button>
        </div>
      </form>
    </AppModal>
  </div>
</template>

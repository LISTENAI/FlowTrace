<script setup lang="ts">
import type {
  ProjectSnapshot,
  Requirement,
  RequirementSummary,
} from '@flowtrace/shared';
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  ListBulletIcon,
  PlusIcon,
  SquaresPlusIcon,
} from '@heroicons/vue/24/outline';
import dayjs from 'dayjs';
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '@/api';
import AppModal from '@/components/AppModal.vue';
import RequirementCard from '@/components/RequirementCard.vue';
import TimelineView from '@/components/TimelineView.vue';
import { formatDate } from '@/lib/presentation';
import { toasts } from '@/state/toasts';
import { loadWorkspace, workspace } from '@/state/workspace';

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const snapshot = ref<ProjectSnapshot>();
const loading = ref(true);
const error = ref('');
const view = ref<'list' | 'timeline'>('list');
const timelineMode = ref<'baseline' | 'current' | 'actual'>('current');
const timelineRequirements = ref<Requirement[]>([]);
const createOpen = ref(false);
const saving = ref(false);
const filtersOpen = ref(false);
const filters = reactive({ versionId: 'all', health: 'all', ownerId: 'all' });
const form = reactive({
  title: '',
  description: '',
  versionId: '',
  ownerIds: [] as string[],
  plannedStartAt: dayjs().format('YYYY-MM-DD'),
  plannedEndAt: dayjs().add(14, 'day').format('YYYY-MM-DD'),
});

const requirements = computed(() => {
  const rows = snapshot.value?.requirements ?? [];
  return rows.filter((item) => {
    if (filters.versionId === 'backlog' && item.versionId) return false;
    if (
      filters.versionId !== 'all' &&
      filters.versionId !== 'backlog' &&
      item.versionId !== filters.versionId
    )
      return false;
    if (filters.health !== 'all' && item.health !== filters.health)
      return false;
    if (filters.ownerId !== 'all' && !item.ownerIds.includes(filters.ownerId))
      return false;
    return true;
  });
});

const activeFilters = computed(
  () => Object.values(filters).filter((value) => value !== 'all').length,
);

const firstRiskId = computed(
  () =>
    requirements.value.find((item) => item.health === 'blocked')?.id ??
    requirements.value.find((item) => item.health === 'waiting')?.id,
);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    snapshot.value = await api.projectSnapshot(projectId.value);
    await loadWorkspace();
    if (view.value === 'timeline') await loadTimeline();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '无法读取项目';
  } finally {
    loading.value = false;
  }
}

async function loadTimeline() {
  if (!snapshot.value) return;
  timelineRequirements.value = await Promise.all(
    snapshot.value.requirements.map((item) => api.requirement(item.id)),
  );
}

async function setView(next: 'list' | 'timeline') {
  view.value = next;
  if (next === 'timeline' && !timelineRequirements.value.length)
    await loadTimeline();
}

function openCreate() {
  form.title = '';
  form.description = '';
  form.versionId =
    snapshot.value?.versions.find((item) => item.status === 'active')?.id ?? '';
  form.ownerIds = [];
  createOpen.value = true;
}

async function createRequirement() {
  saving.value = true;
  try {
    const requirement = await api.createRequirement({
      projectId: projectId.value,
      versionId: form.versionId || undefined,
      title: form.title,
      description: form.description,
      ownerIds: form.ownerIds,
      plannedStartAt: dayjs(form.plannedStartAt).startOf('day').toISOString(),
      plannedEndAt: dayjs(form.plannedEndAt).endOf('day').toISOString(),
    });
    createOpen.value = false;
    toasts.show('需求已创建', `${requirement.key} 已复制当前项目流程`);
    await load();
  } catch (caught) {
    toasts.show(
      '创建失败',
      caught instanceof Error ? caught.message : undefined,
      'error',
    );
  } finally {
    saving.value = false;
  }
}

function toggleOwner(id: string) {
  const index = form.ownerIds.indexOf(id);
  if (index >= 0) form.ownerIds.splice(index, 1);
  else form.ownerIds.push(id);
}

onMounted(() => {
  void load();
  window.addEventListener('flowtrace:new-requirement', openCreate);
});
onBeforeUnmount(() =>
  window.removeEventListener('flowtrace:new-requirement', openCreate),
);
watch(projectId, () => {
  filters.versionId = 'all';
  timelineRequirements.value = [];
  void load();
});
</script>

<template>
  <div class="mx-auto max-w-[92rem] px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
    <div v-if="loading && !snapshot" class="space-y-4">
      <div class="h-32 animate-pulse rounded-[1.5rem] bg-white" />
      <div class="grid gap-3 sm:grid-cols-4">
        <div
          v-for="i in 4"
          :key="i"
          class="h-24 animate-pulse rounded-2xl bg-white"
        />
      </div>
      <div class="h-80 animate-pulse rounded-2xl bg-white" />
    </div>
    <div
      v-else-if="error"
      class="surface mx-auto mt-20 max-w-lg p-8 text-center"
    >
      <ExclamationTriangleIcon class="mx-auto h-8 w-8 text-rose-400" />
      <h2 class="mt-3 font-semibold text-slate-900">项目暂时无法打开</h2>
      <p class="mt-1 text-sm text-slate-500">{{ error }}</p>
      <button
        class="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        @click="load"
      >
        重新尝试
      </button>
    </div>

    <template v-else-if="snapshot">
      <section
        class="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
      >
        <div>
          <div class="flex items-center gap-2">
            <span
              class="rounded-lg bg-indigo-100 px-2 py-1 font-mono text-[11px] font-bold text-indigo-700"
              >{{ snapshot.project.key }}</span
            >
            <span class="text-xs text-slate-400">{{
              snapshot.versions.find((item) => item.status === 'active')
                ?.name || '未设置进行中版本'
            }}</span>
          </div>
          <h1
            class="mt-2 text-2xl font-semibold tracking-[-.035em] text-slate-900 sm:text-3xl"
          >
            {{ snapshot.project.name }}
          </h1>
          <p class="mt-1 max-w-2xl text-sm text-slate-500">
            {{ snapshot.project.description }}
          </p>
        </div>
        <div class="flex gap-2">
          <RouterLink
            :to="`/projects/${projectId}/settings`"
            class="focus-ring inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm hover:border-slate-300"
          >
            <Cog6ToothIcon class="h-4 w-4" />项目设置
          </RouterLink>
          <button
            class="focus-ring inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5"
            @click="openCreate"
          >
            <PlusIcon class="h-4 w-4" />新建需求
          </button>
        </div>
      </section>

      <section class="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div
          class="surface col-span-2 flex items-center gap-5 p-4 lg:col-span-1"
        >
          <div
            class="relative grid h-12 w-12 place-items-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700"
          >
            {{
              snapshot.metrics.total
                ? Math.round(
                    (snapshot.metrics.completed / snapshot.metrics.total) * 100,
                  )
                : 0
            }}%
            <span
              class="absolute inset-0 rounded-full border-4 border-indigo-100 border-r-indigo-500"
            />
          </div>
          <div>
            <div class="text-xl font-semibold text-slate-900">
              {{ snapshot.metrics.completed }}/{{ snapshot.metrics.total }}
            </div>
            <div class="text-[11px] text-slate-400">需求已完成</div>
          </div>
        </div>
        <div class="surface p-4">
          <div class="text-2xl font-semibold text-slate-900">
            {{ snapshot.metrics.inProgress }}
          </div>
          <div class="mt-1 text-[11px] text-slate-400">正在推进</div>
        </div>
        <div class="surface p-4">
          <div class="text-2xl font-semibold text-amber-600">
            {{ snapshot.metrics.waiting }}
          </div>
          <div class="mt-1 text-[11px] text-slate-400">正在等待</div>
        </div>
        <div class="surface p-4">
          <div class="text-2xl font-semibold text-rose-600">
            {{ snapshot.metrics.blocked }}
          </div>
          <div class="mt-1 text-[11px] text-slate-400">当前阻塞</div>
        </div>
        <div class="surface p-4">
          <div class="text-2xl font-semibold text-violet-600">
            {{ snapshot.metrics.openBugs }}
          </div>
          <div class="mt-1 text-[11px] text-slate-400">未完成 Bug</div>
        </div>
      </section>

      <section
        v-if="
          snapshot.blockedItems.length ||
          snapshot.waitingItems.length ||
          snapshot.externalDependencies.length
        "
        class="mt-4 grid gap-3 lg:grid-cols-[1.35fr_1fr]"
      >
        <div
          class="overflow-hidden rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50/90 to-amber-50/60 p-4"
        >
          <div class="flex items-start gap-3">
            <span
              class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-rose-500 shadow-sm"
              ><ExclamationTriangleIcon class="h-5 w-5"
            /></span>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-slate-800">需要关注的事项</p>
              <div class="mt-1.5 space-y-1">
                <p
                  v-for="item in [
                    ...snapshot.blockedItems,
                    ...snapshot.waitingItems,
                  ].slice(0, 2)"
                  :key="item.id"
                  class="truncate text-xs text-slate-600"
                >
                  <span
                    class="mr-1 font-medium"
                    :class="
                      snapshot.blockedItems.some(
                        (blocked) => blocked.id === item.id,
                      )
                        ? 'text-rose-600'
                        : 'text-amber-600'
                    "
                    >{{
                      snapshot.blockedItems.some(
                        (blocked) => blocked.id === item.id,
                      )
                        ? '阻塞'
                        : '等待'
                    }}</span
                  >
                  {{ item.name }} · {{ item.reason }}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div class="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <p class="text-xs font-semibold text-indigo-800">跨项目协作</p>
          <p
            v-if="snapshot.externalDependencies.length"
            class="mt-1.5 truncate text-xs text-indigo-600/80"
          >
            {{ snapshot.externalDependencies[0]?.successor?.name }} 正在等待
            {{ snapshot.externalDependencies[0]?.predecessor?.projectName }} /
            {{ snapshot.externalDependencies[0]?.predecessor?.name }}
          </p>
          <p v-else class="mt-1.5 text-xs text-indigo-600/70">
            当前依赖都在项目内部，暂无外部等待。
          </p>
        </div>
      </section>

      <section class="mt-7">
        <div
          class="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
        >
          <div class="flex flex-wrap items-center gap-2">
            <div
              class="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
            >
              <button
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                :class="
                  view === 'list'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                "
                @click="setView('list')"
              >
                <span class="inline-flex items-center gap-1.5"
                  ><ListBulletIcon class="h-4 w-4" />需求</span
                >
              </button>
              <button
                class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                :class="
                  view === 'timeline'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                "
                @click="setView('timeline')"
              >
                <span class="inline-flex items-center gap-1.5"
                  ><CalendarDaysIcon class="h-4 w-4" />时间线</span
                >
              </button>
            </div>
            <div class="relative">
              <button
                class="focus-ring inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm"
                @click="filtersOpen = !filtersOpen"
              >
                <AdjustmentsHorizontalIcon class="h-4 w-4" />筛选
                <span
                  v-if="activeFilters"
                  class="grid h-4 min-w-4 place-items-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white"
                  >{{ activeFilters }}</span
                >
                <ChevronDownIcon class="h-3 w-3" />
              </button>
              <div
                v-if="filtersOpen"
                class="absolute left-0 top-11 z-20 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10"
              >
                <label class="block text-[11px] font-medium text-slate-500"
                  >目标版本<select
                    v-model="filters.versionId"
                    class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                  >
                    <option value="all">全部版本</option>
                    <option value="backlog">未排版本</option>
                    <option
                      v-for="version in snapshot.versions"
                      :key="version.id"
                      :value="version.id"
                    >
                      {{ version.name }}
                    </option>
                  </select></label
                >
                <label class="mt-3 block text-[11px] font-medium text-slate-500"
                  >健康状态<select
                    v-model="filters.health"
                    class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                  >
                    <option value="all">全部状态</option>
                    <option value="waiting">等待中</option>
                    <option value="blocked">阻塞</option>
                    <option value="normal">正常</option>
                  </select></label
                >
                <label class="mt-3 block text-[11px] font-medium text-slate-500"
                  >负责人<select
                    v-model="filters.ownerId"
                    class="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                  >
                    <option value="all">所有人员</option>
                    <option
                      v-for="person in workspace.people"
                      :key="person.id"
                      :value="person.id"
                    >
                      {{ person.name }}
                    </option>
                  </select></label
                >
              </div>
            </div>
            <span class="text-xs text-slate-400"
              >{{ requirements.length }} 项需求</span
            >
          </div>

          <div
            v-if="view === 'timeline'"
            class="flex items-center gap-1 rounded-xl bg-slate-100 p-1"
          >
            <button
              v-for="item in [
                { id: 'baseline', label: '初始计划' },
                { id: 'current', label: '当前计划' },
                { id: 'actual', label: '实际过程' },
              ]"
              :key="item.id"
              class="rounded-lg px-3 py-1.5 text-[11px] font-semibold transition"
              :class="
                timelineMode === item.id
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500'
              "
              @click="timelineMode = item.id as typeof timelineMode"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div v-if="view === 'list'" class="space-y-3">
          <RequirementCard
            v-for="item in requirements"
            :key="item.id"
            :summary="item"
            :initial-open="item.id === firstRiskId"
            @refresh="load"
          />
          <div v-if="!requirements.length" class="surface py-16 text-center">
            <SquaresPlusIcon class="mx-auto h-8 w-8 text-slate-300" />
            <p class="mt-3 text-sm font-semibold text-slate-700">
              这里还没有符合条件的需求
            </p>
            <button
              class="mt-3 text-xs font-medium text-indigo-600"
              @click="
                filters.versionId = filters.health = filters.ownerId = 'all'
              "
            >
              清除筛选
            </button>
          </div>
        </div>
        <div v-else>
          <TimelineView
            :requirements="timelineRequirements"
            :mode="timelineMode"
          />
        </div>
      </section>

      <AppModal
        :open="createOpen"
        title="创建需求"
        description="创建时复制当前项目模板，之后可按实际过程调整阶段。"
        width="lg"
        @close="createOpen = false"
      >
        <form class="space-y-5" @submit.prevent="createRequirement">
          <label class="block"
            ><span class="mb-1.5 block text-xs font-medium text-slate-600"
              >需求标题</span
            ><input
              v-model="form.title"
              autofocus
              required
              placeholder="例如：设备配网流程优化"
              class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base font-medium text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
          /></label>
          <label class="block"
            ><span class="mb-1.5 block text-xs font-medium text-slate-600"
              >为什么要做</span
            ><textarea
              v-model="form.description"
              rows="2"
              placeholder="用一两句话留下必要背景"
              class="focus-ring w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
            />
          </label>
          <div class="grid gap-4 sm:grid-cols-3">
            <label
              ><span class="mb-1.5 block text-xs font-medium text-slate-600"
                >目标版本</span
              ><select
                v-model="form.versionId"
                class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
              >
                <option value="">未排版本</option>
                <option
                  v-for="version in snapshot.versions"
                  :key="version.id"
                  :value="version.id"
                >
                  {{ version.name }}
                </option>
              </select></label
            >
            <label
              ><span class="mb-1.5 block text-xs font-medium text-slate-600"
                >计划开始</span
              ><input
                v-model="form.plannedStartAt"
                type="date"
                class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
            /></label>
            <label
              ><span class="mb-1.5 block text-xs font-medium text-slate-600"
                >计划完成</span
              ><input
                v-model="form.plannedEndAt"
                type="date"
                class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
            /></label>
          </div>
          <fieldset>
            <legend class="mb-2 text-xs font-medium text-slate-600">
              谁来共同负责
            </legend>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="person in workspace.people"
                :key="person.id"
                type="button"
                class="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                :class="
                  form.ownerIds.includes(person.id)
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                "
                @click="toggleOwner(person.id)"
              >
                {{ person.name }}
              </button>
            </div>
          </fieldset>
          <div
            class="flex items-center justify-between rounded-2xl bg-indigo-50/60 px-4 py-3 text-xs text-indigo-700"
          >
            <span
              >将自动生成
              {{ snapshot.project.templateStages.length }} 个阶段</span
            ><span class="font-medium"
              >{{
                snapshot.project.templateStages
                  .slice(0, 4)
                  .map((item) => item.name)
                  .join(' → ')
              }}{{
                snapshot.project.templateStages.length > 4 ? '…' : ''
              }}</span
            >
          </div>
          <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
              @click="createOpen = false"
            >
              取消</button
            ><button
              :disabled="saving"
              class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {{ saving ? '正在创建…' : '创建需求' }}
            </button>
          </div>
        </form>
      </AppModal>
    </template>
  </div>
</template>

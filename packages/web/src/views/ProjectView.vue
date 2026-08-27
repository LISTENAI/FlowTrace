<script setup lang="ts">
import type {
  ProjectSnapshot,
  Requirement,
  RequirementSummary,
  SnapshotWorkItem,
} from '@flowtrace/shared';
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  ListBulletIcon,
  PlusIcon,
  RectangleStackIcon,
  SquaresPlusIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import dayjs from 'dayjs';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '@/api';
import AppDateTimeField from '@/components/AppDateTimeField.vue';
import AppModal from '@/components/AppModal.vue';
import AppSelect from '@/components/AppSelect.vue';
import OwnerPicker from '@/components/OwnerPicker.vue';
import PlanningDialog from '@/components/PlanningDialog.vue';
import RequirementCard from '@/components/RequirementCard.vue';
import StatusUpdateDialog from '@/components/StatusUpdateDialog.vue';
import TimelineView from '@/components/TimelineView.vue';
import { formatDate, versionLabels } from '@/lib/presentation';
import { toasts } from '@/state/toasts';
import { loadWorkspace, workspace } from '@/state/workspace';

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const snapshot = ref<ProjectSnapshot>();
const loading = ref(true);
const error = ref('');
const view = ref<'list' | 'timeline'>('list');
const timelineExpansionMode = ref<'smart' | 'depth' | 'custom'>('smart');
const timelineExpansionDepth = ref(1);
const timelineExpansionOpen = ref(false);
const timelineFocusOpen = ref(false);
const timelineFocusedStages = ref<string[]>([]);
const timelineIncludeBugs = ref(false);
const timelineRequirements = ref<Requirement[]>([]);
const createOpen = ref(false);
const saving = ref(false);
const filtersOpen = ref(false);
const filters = reactive({ versionId: 'auto', health: 'all', ownerId: 'all' });
const attentionTarget = ref<SnapshotWorkItem>();
const scheduleTarget = ref<RequirementSummary>();
const form = reactive({
  title: '',
  description: '',
  versionId: '',
  ownerIds: [] as string[],
  plannedStartAt: dayjs().format('YYYY-MM-DD'),
  plannedEndAt: dayjs().add(14, 'day').format('YYYY-MM-DD'),
  stageMode: 'template' as 'template' | 'custom',
  stages: [{ name: '' }],
});

const versionScopedRequirements = computed(() => {
  const rows = snapshot.value?.requirements ?? [];
  return rows.filter((item) => {
    if (filters.versionId === 'backlog' && item.versionId) return false;
    if (
      filters.versionId !== 'all' &&
      filters.versionId !== 'backlog' &&
      item.versionId !== filters.versionId
    )
      return false;
    return true;
  });
});

const requirements = computed(() => {
  return versionScopedRequirements.value.filter((item) => {
    if (
      ['waiting', 'blocked', 'normal'].includes(filters.health) &&
      item.health !== filters.health
    )
      return false;
    if (filters.health === 'in_progress' && item.lifecycle !== 'in_progress')
      return false;
    if (filters.health === 'overdue' && !item.overdue) return false;
    if (
      filters.health === 'open_bugs' &&
      item.bugCount === item.completedBugCount
    )
      return false;
    if (filters.health === 'review' && !reviewIssueMap.value.has(item.id))
      return false;
    if (filters.ownerId !== 'all' && !item.ownerIds.includes(filters.ownerId))
      return false;
    return true;
  });
});

const activeFilters = computed(
  () =>
    [filters.health, filters.ownerId].filter((value) => value !== 'all').length,
);
const versionFilterOptions = computed(() => [
  { value: 'all', label: '全部版本' },
  { value: 'backlog', label: '未排版本' },
  ...(snapshot.value?.versions ?? []).map((version) => ({
    value: version.id,
    label: `${version.name} · ${versionLabels[version.status]}`,
  })),
]);
const healthFilterOptions = [
  { value: 'all', label: '全部需求' },
  { value: 'in_progress', label: '正在推进' },
  { value: 'waiting', label: '等待中' },
  { value: 'blocked', label: '阻塞' },
  { value: 'overdue', label: '已延期' },
  { value: 'open_bugs', label: '有未完成 Bug' },
  { value: 'review', label: '待补全' },
  { value: 'normal', label: '正常' },
];
const ownerFilterOptions = computed(() => [
  { value: 'all', label: '所有人员' },
  ...workspace.people.map((person) => ({
    value: person.id,
    label: person.name,
    description: person.note,
  })),
]);
const createVersionOptions = computed(() => [
  { value: '', label: '未排版本' },
  ...(snapshot.value?.versions ?? []).map((version) => ({
    value: version.id,
    label: version.name,
  })),
]);
const scopedRequirementIds = computed(
  () => new Set(versionScopedRequirements.value.map((item) => item.id)),
);
const scopedMetrics = computed(() => {
  const rows = versionScopedRequirements.value;
  return {
    total: rows.length,
    completed: rows.filter((item) => item.lifecycle === 'done').length,
    inProgress: rows.filter((item) => item.lifecycle === 'in_progress').length,
    waiting: rows.filter((item) => item.health === 'waiting').length,
    blocked: rows.filter((item) => item.health === 'blocked').length,
    openBugs: rows.reduce(
      (sum, item) => sum + item.bugCount - item.completedBugCount,
      0,
    ),
  };
});
const reviewIssueMap = computed(() => {
  const issues = new Map<string, string[]>();
  for (const item of snapshot.value?.reviewItems ?? []) {
    issues.set(item.requirementId, [
      ...(issues.get(item.requirementId) ?? []),
      item.message,
    ]);
  }
  return issues;
});
const scopedReviewItems = computed(() =>
  (snapshot.value?.reviewItems ?? []).filter((item) =>
    scopedRequirementIds.value.has(item.requirementId),
  ),
);
const scopedBlockedItems = computed(() =>
  (snapshot.value?.blockedItems ?? []).filter((item) =>
    scopedRequirementIds.value.has(item.requirementId),
  ),
);
const scopedWaitingItems = computed(() =>
  (snapshot.value?.waitingItems ?? []).filter((item) =>
    scopedRequirementIds.value.has(item.requirementId),
  ),
);
const scopedDelayedRows = computed(() =>
  versionScopedRequirements.value.filter((item) => item.overdue),
);
const scopedExternalDependencies = computed(() =>
  (snapshot.value?.externalDependencies ?? []).filter((item) =>
    item.successor
      ? scopedRequirementIds.value.has(item.successor.requirementId)
      : false,
  ),
);
const timelineVersions = computed(() => {
  if (filters.versionId === 'all' || filters.versionId === 'backlog')
    return snapshot.value?.versions ?? [];
  return (snapshot.value?.versions ?? []).filter(
    (item) => item.id === filters.versionId,
  );
});
const filteredTimelineRequirements = computed(() => {
  const ids = new Set(requirements.value.map((item) => item.id));
  return timelineRequirements.value.filter((item) => ids.has(item.id));
});
const timelineStageOptions = computed(() => {
  const counts = new Map<string, number>();
  for (const requirement of filteredTimelineRequirements.value) {
    for (const name of new Set(requirement.stages.map((stage) => stage.name)))
      counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.name.localeCompare(right.name, 'zh-CN'),
    );
});
const timelineFocusLabel = computed(() => {
  if (!timelineFocusedStages.value.length) return '全流程';
  if (timelineFocusedStages.value.length === 1)
    return timelineFocusedStages.value[0];
  return `${timelineFocusedStages.value.length} 个阶段`;
});
const focusedTimelineRequirementCount = computed(() => {
  if (!timelineFocusedStages.value.length)
    return filteredTimelineRequirements.value.length;
  const names = new Set(timelineFocusedStages.value);
  return filteredTimelineRequirements.value.filter(
    (requirement) =>
      requirement.stages.some((stage) => names.has(stage.name)) ||
      (timelineIncludeBugs.value && requirement.bugs.length > 0),
  ).length;
});
const timelineExpansionOptions = [
  { value: 'smart', label: '智能', hint: '按版本状态展开' },
  { value: 0, label: '版本', hint: '只看版本汇总' },
  { value: 1, label: '需求', hint: '显示版本内需求' },
  { value: 2, label: '过程', hint: '显示需求的各个阶段' },
  { value: 3, label: '明细', hint: '同时显示具体 Bug' },
] as const;
const timelineExpansionLabel = computed(() => {
  if (timelineExpansionMode.value === 'smart') return '智能';
  if (timelineExpansionMode.value === 'custom') return '自定义';
  return (
    timelineExpansionOptions.find(
      (item) => item.value === timelineExpansionDepth.value,
    )?.label ?? '自定义'
  );
});

function setTimelineExpansionDepth(value: number) {
  timelineExpansionDepth.value = Math.max(0, Math.min(3, Math.round(value)));
  timelineExpansionMode.value = 'depth';
}

function resetTimelineExpansion() {
  timelineExpansionDepth.value = 1;
  timelineExpansionMode.value = 'smart';
}

function selectTimelineExpansion(value: 'smart' | number) {
  if (value === 'smart') resetTimelineExpansion();
  else setTimelineExpansionDepth(value);
  timelineExpansionOpen.value = false;
}

function toggleTimelineStage(name: string) {
  timelineFocusedStages.value = timelineFocusedStages.value.includes(name)
    ? timelineFocusedStages.value.filter((item) => item !== name)
    : [...timelineFocusedStages.value, name];
}

function clearTimelineFocus() {
  timelineFocusedStages.value = [];
  timelineIncludeBugs.value = false;
}

function timelineExpansionSelected(value: 'smart' | number) {
  if (value === 'smart') return timelineExpansionMode.value === 'smart';
  return (
    timelineExpansionMode.value === 'depth' &&
    timelineExpansionDepth.value === value
  );
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    snapshot.value = await api.projectSnapshot(projectId.value);
    if (filters.versionId === 'auto') {
      filters.versionId =
        snapshot.value.versions.find((item) => item.status === 'active')?.id ??
        'all';
    }
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
  form.stageMode = 'template';
  form.stages = [{ name: '' }];
  createOpen.value = true;
}

function addCreateStage() {
  form.stages.push({ name: '' });
}

function removeCreateStage(index: number) {
  form.stages.splice(index, 1);
  if (!form.stages.length) form.stages.push({ name: '' });
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
      stages:
        form.stageMode === 'custom'
          ? form.stages.map((stage) => ({ name: stage.name.trim() }))
          : undefined,
    });
    createOpen.value = false;
    toasts.show(
      '需求已创建',
      form.stageMode === 'custom'
        ? `${requirement.key} 已按本次真实流程创建`
        : `${requirement.key} 已复制当前项目流程`,
    );
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

onMounted(() => void load());
watch(timelineStageOptions, (options) => {
  const available = new Set(options.map((item) => item.name));
  timelineFocusedStages.value = timelineFocusedStages.value.filter((name) =>
    available.has(name),
  );
});
watch(projectId, () => {
  filters.versionId = 'auto';
  clearTimelineFocus();
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
              snapshot.versions.find((item) => item.status === 'active')?.name
                ? `当前交付 ${snapshot.versions.find((item) => item.status === 'active')?.name}`
                : '未设置进行中版本'
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

      <section class="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <button
          type="button"
          class="surface col-span-2 flex items-center gap-5 p-4 text-left transition hover:border-indigo-200 lg:col-span-1"
          :class="filters.health === 'all' ? 'ring-2 ring-indigo-100' : ''"
          @click="filters.health = 'all'"
        >
          <div
            class="relative grid h-12 w-12 place-items-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700"
          >
            {{
              scopedMetrics.total
                ? Math.round(
                    (scopedMetrics.completed / scopedMetrics.total) * 100,
                  )
                : 0
            }}%
            <span
              class="absolute inset-0 rounded-full border-4 border-indigo-100 border-r-indigo-500"
            />
          </div>
          <div>
            <div class="text-xl font-semibold text-slate-900">
              {{ scopedMetrics.completed }}/{{ scopedMetrics.total }}
            </div>
            <div class="text-[11px] text-slate-400">需求已完成</div>
          </div>
        </button>
        <button
          type="button"
          class="surface p-4 text-left transition hover:border-indigo-200"
          :class="
            filters.health === 'in_progress' ? 'ring-2 ring-indigo-100' : ''
          "
          @click="filters.health = 'in_progress'"
        >
          <div class="text-2xl font-semibold text-slate-900">
            {{ scopedMetrics.inProgress }}
          </div>
          <div class="mt-1 text-[11px] text-slate-400">正在推进</div>
        </button>
        <button
          type="button"
          class="surface p-4 text-left transition hover:border-amber-200"
          :class="filters.health === 'waiting' ? 'ring-2 ring-amber-100' : ''"
          @click="filters.health = 'waiting'"
        >
          <div class="text-2xl font-semibold text-amber-600">
            {{ scopedMetrics.waiting }}
          </div>
          <div class="mt-1 text-[11px] text-slate-400">正在等待</div>
        </button>
        <button
          type="button"
          class="surface p-4 text-left transition hover:border-rose-200"
          :class="filters.health === 'blocked' ? 'ring-2 ring-rose-100' : ''"
          @click="filters.health = 'blocked'"
        >
          <div class="text-2xl font-semibold text-rose-600">
            {{ scopedMetrics.blocked }}
          </div>
          <div class="mt-1 text-[11px] text-slate-400">当前阻塞</div>
        </button>
        <button
          type="button"
          class="surface p-4 text-left transition hover:border-violet-200"
          :class="
            filters.health === 'open_bugs' ? 'ring-2 ring-violet-100' : ''
          "
          @click="filters.health = 'open_bugs'"
        >
          <div class="text-2xl font-semibold text-violet-600">
            {{ scopedMetrics.openBugs }}
          </div>
          <div class="mt-1 text-[11px] text-slate-400">未完成 Bug</div>
        </button>
        <button
          type="button"
          class="surface p-4 text-left transition hover:border-indigo-200"
          :class="filters.health === 'review' ? 'ring-2 ring-indigo-100' : ''"
          @click="filters.health = 'review'"
        >
          <div class="text-2xl font-semibold text-indigo-600">
            {{ scopedReviewItems.length }}
          </div>
          <div class="mt-1 text-[11px] text-slate-400">待补全项</div>
        </button>
      </section>

      <section
        v-if="
          scopedBlockedItems.length ||
          scopedWaitingItems.length ||
          scopedDelayedRows.length ||
          scopedReviewItems.length ||
          scopedExternalDependencies.length
        "
        class="mt-4 grid items-start gap-3 lg:grid-cols-2"
      >
        <div
          v-if="
            scopedBlockedItems.length ||
            scopedWaitingItems.length ||
            scopedDelayedRows.length
          "
          class="surface overflow-hidden"
        >
          <div
            class="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800"
          >
            <span
              class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-950/60"
              ><ExclamationTriangleIcon class="h-4 w-4"
            /></span>
            <p class="min-w-0 flex-1 text-xs font-semibold text-slate-800">
              需要决策与跟进
            </p>
            <span
              class="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-rose-600 dark:bg-rose-950/60"
            >
              {{
                scopedBlockedItems.length +
                scopedWaitingItems.length +
                scopedDelayedRows.length
              }}
            </span>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-800">
            <div
              v-for="item in [
                ...scopedBlockedItems,
                ...scopedWaitingItems,
              ].slice(0, 3)"
              :key="item.id"
              class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
            >
              <RouterLink
                :to="`/requirements/${item.requirementId}`"
                class="focus-ring min-w-0 rounded-lg text-left"
              >
                <span class="flex min-w-0 items-baseline gap-2">
                  <span
                    class="shrink-0 font-mono text-[10px] font-bold text-indigo-600"
                    >{{ item.requirementKey }}</span
                  >
                  <span
                    class="min-w-0 truncate text-xs font-semibold text-slate-700"
                    >{{ item.requirementTitle }}</span
                  >
                </span>
                <span
                  class="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500"
                >
                  {{ item.name }} · {{ item.reason }}
                </span>
              </RouterLink>
              <button
                type="button"
                class="focus-ring inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-semibold text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:hover:bg-indigo-950/50"
                @click="attentionTarget = item"
              >
                <ArrowPathIcon class="h-3.5 w-3.5" />
                记录进展
              </button>
            </div>
            <div
              v-for="item in scopedDelayedRows.slice(0, 2)"
              :key="`delayed-${item.id}`"
              class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
            >
              <RouterLink
                :to="`/requirements/${item.id}`"
                class="focus-ring min-w-0 rounded-lg text-left"
              >
                <span class="flex min-w-0 items-baseline gap-2">
                  <span
                    class="shrink-0 font-mono text-[10px] font-bold text-indigo-600"
                    >{{ item.key }}</span
                  >
                  <span
                    class="min-w-0 truncate text-xs font-semibold text-slate-700"
                    >{{ item.title }}</span
                  >
                </span>
                <span class="mt-0.5 block text-[11px] leading-4 text-rose-600">
                  当前计划已到 {{ formatDate(item.plannedEndAt) }}
                </span>
              </RouterLink>
              <button
                type="button"
                class="focus-ring inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-semibold text-slate-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 dark:border-slate-700 dark:hover:bg-violet-950/50"
                @click="scheduleTarget = item"
              >
                <CalendarDaysIcon class="h-3.5 w-3.5" />
                调整计划
              </button>
            </div>
          </div>
        </div>
        <div v-if="scopedReviewItems.length" class="surface overflow-hidden">
          <div
            class="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800"
          >
            <span
              class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-500 dark:bg-indigo-950/60"
            >
              <CheckIcon class="h-4 w-4" />
            </span>
            <p class="min-w-0 flex-1 text-xs font-semibold text-slate-800">
              完整性 Review
            </p>
            <span
              class="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-indigo-600 dark:bg-indigo-950/60"
              >{{ scopedReviewItems.length }}</span
            >
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-800">
            <RouterLink
              v-for="item in scopedReviewItems.slice(0, 5)"
              :key="`${item.requirementId}-${item.targetId}-${item.code}`"
              :to="`/requirements/${item.requirementId}`"
              class="focus-ring block px-4 py-3 transition hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"
            >
              <span class="flex min-w-0 items-baseline gap-2">
                <span
                  class="shrink-0 font-mono text-[10px] font-bold text-indigo-600"
                  >{{ item.requirementKey }}</span
                >
                <span
                  class="min-w-0 truncate text-xs font-semibold text-slate-700"
                  >{{ item.requirementTitle }}</span
                >
              </span>
              <span
                class="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-slate-500"
                >{{ item.message }}</span
              >
            </RouterLink>
          </div>
        </div>
        <div
          v-if="scopedExternalDependencies.length"
          class="surface overflow-hidden"
        >
          <div
            class="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800"
          >
            <span
              class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-500 dark:bg-violet-950/60"
            >
              <RectangleStackIcon class="h-4 w-4" />
            </span>
            <p class="min-w-0 flex-1 text-xs font-semibold text-slate-800">
              跨项目协作
            </p>
          </div>
          <p class="px-4 py-3 text-xs leading-5 text-slate-500">
            <span class="font-mono text-[10px] font-bold text-indigo-600">{{
              scopedExternalDependencies[0]?.successor?.requirementKey
            }}</span>
            {{ scopedExternalDependencies[0]?.successor?.name }} 正在等待
            <span class="font-medium text-slate-700">
              {{ scopedExternalDependencies[0]?.predecessor?.projectName }} /
              {{ scopedExternalDependencies[0]?.predecessor?.name }}
            </span>
          </p>
        </div>
      </section>

      <section class="mt-7">
        <div
          class="timeline-toolbar mb-2 flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
        >
          <div class="flex min-w-0 items-center gap-2 pl-1 max-sm:w-full">
            <span class="shrink-0 text-[10px] font-semibold text-slate-400"
              >交付范围</span
            >
            <AppSelect
              v-model="filters.versionId"
              class="w-44 min-w-0 max-sm:flex-1"
              :options="versionFilterOptions"
            />
          </div>
          <span class="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
          <div class="flex shrink-0 items-center gap-1">
            <div class="flex items-center gap-1">
              <button
                class="h-9 rounded-xl px-3 text-xs font-semibold transition"
                :class="
                  view === 'list'
                    ? 'bg-slate-900 text-white dark:bg-indigo-500'
                    : 'text-slate-500 hover:bg-slate-50'
                "
                @click="setView('list')"
              >
                <span class="inline-flex items-center gap-1.5"
                  ><ListBulletIcon class="h-4 w-4" />需求</span
                >
              </button>
              <button
                class="h-9 rounded-xl px-3 text-xs font-semibold transition"
                :class="
                  view === 'timeline'
                    ? 'bg-slate-900 text-white dark:bg-indigo-500'
                    : 'text-slate-500 hover:bg-slate-50'
                "
                @click="setView('timeline')"
              >
                <span class="inline-flex items-center gap-1.5"
                  ><CalendarDaysIcon class="h-4 w-4" />时间线</span
                >
              </button>
            </div>
            <span class="mx-1 h-5 w-px bg-slate-200" />
            <div class="relative">
              <button
                class="focus-ring inline-flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                @click="
                  filtersOpen = !filtersOpen;
                  timelineExpansionOpen = false;
                  timelineFocusOpen = false;
                "
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
                class="absolute left-0 top-11 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10"
              >
                <label class="block text-[11px] font-medium text-slate-500">
                  Review 视角
                  <AppSelect
                    v-model="filters.health"
                    class="mt-1.5"
                    :options="healthFilterOptions"
                  />
                </label>
                <label
                  class="mt-3 block text-[11px] font-medium text-slate-500"
                >
                  负责人
                  <AppSelect
                    v-model="filters.ownerId"
                    class="mt-1.5"
                    :options="ownerFilterOptions"
                  />
                </label>
              </div>
            </div>
            <span
              class="whitespace-nowrap px-1.5 text-[11px] font-medium text-slate-400"
              :aria-label="`${requirements.length} 项需求`"
              >{{ requirements.length }} 项</span
            >
          </div>

          <div
            v-if="view === 'timeline'"
            class="ml-auto flex max-w-full shrink-0 items-center justify-end gap-1 max-sm:w-full max-sm:flex-wrap max-sm:justify-between"
          >
            <div class="relative">
              <button
                type="button"
                class="focus-ring inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600"
                aria-haspopup="menu"
                :aria-expanded="timelineFocusOpen"
                @click="
                  timelineFocusOpen = !timelineFocusOpen;
                  timelineExpansionOpen = false;
                  filtersOpen = false;
                "
              >
                <FunnelIcon class="h-4 w-4" />
                <span>聚焦</span>
                <span class="max-w-24 truncate text-indigo-600">{{
                  timelineFocusLabel
                }}</span>
                <span
                  v-if="timelineFocusedStages.length"
                  class="text-[9px] tabular-nums text-slate-400"
                  >{{ focusedTimelineRequirementCount }}/{{
                    filteredTimelineRequirements.length
                  }}</span
                >
                <ChevronDownIcon
                  class="h-3 w-3 text-slate-400 transition"
                  :class="timelineFocusOpen ? 'rotate-180' : ''"
                />
              </button>
              <button
                v-if="timelineFocusOpen"
                type="button"
                aria-label="关闭阶段聚焦菜单"
                class="fixed inset-0 z-20 cursor-default"
                @click="timelineFocusOpen = false"
              />
              <div
                v-if="timelineFocusOpen"
                role="menu"
                aria-label="聚焦阶段"
                class="absolute right-0 top-11 z-30 max-h-[28rem] w-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10"
              >
                <button
                  type="button"
                  role="menuitemcheckbox"
                  :aria-checked="!timelineFocusedStages.length"
                  class="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                  :class="
                    !timelineFocusedStages.length ? 'bg-indigo-50/70' : ''
                  "
                  @click="clearTimelineFocus"
                >
                  <span
                    class="grid h-5 w-5 shrink-0 place-items-center rounded-md border"
                    :class="
                      !timelineFocusedStages.length
                        ? 'border-indigo-500 bg-indigo-500 text-white'
                        : 'border-slate-200 text-transparent'
                    "
                  >
                    <CheckIcon class="h-3 w-3" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-xs font-semibold text-slate-700"
                      >全流程</span
                    >
                    <span class="mt-0.5 block text-[10px] text-slate-400"
                      >汇总需求中的所有阶段和 Bug</span
                    >
                  </span>
                </button>
                <div class="my-1 h-px bg-slate-100" />
                <button
                  v-for="item in timelineStageOptions"
                  :key="item.name"
                  type="button"
                  role="menuitemcheckbox"
                  :aria-checked="timelineFocusedStages.includes(item.name)"
                  class="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                  :class="
                    timelineFocusedStages.includes(item.name)
                      ? 'bg-indigo-50/70'
                      : ''
                  "
                  @click="toggleTimelineStage(item.name)"
                >
                  <span
                    class="grid h-5 w-5 shrink-0 place-items-center rounded-md border"
                    :class="
                      timelineFocusedStages.includes(item.name)
                        ? 'border-indigo-500 bg-indigo-500 text-white'
                        : 'border-slate-200 text-transparent'
                    "
                  >
                    <CheckIcon class="h-3 w-3" />
                  </span>
                  <span
                    class="min-w-0 flex-1 truncate text-xs font-medium text-slate-700"
                    >{{ item.name }}</span
                  >
                  <span class="text-[10px] tabular-nums text-slate-400"
                    >{{ item.count }} 项</span
                  >
                </button>
                <label
                  v-if="timelineFocusedStages.length"
                  class="mt-1 flex cursor-pointer items-center gap-3 rounded-xl border-t border-slate-100 px-3 py-2.5 text-xs text-slate-600"
                >
                  <input
                    v-model="timelineIncludeBugs"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  同时包含 Bug
                </label>
                <p class="px-3 py-2 text-[10px] leading-4 text-slate-400">
                  选项来自当前筛选结果中真实存在的阶段；可以多选。
                </p>
              </div>
            </div>

            <div class="relative">
              <button
                type="button"
                class="focus-ring inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600"
                aria-haspopup="menu"
                :aria-expanded="timelineExpansionOpen"
                @click="
                  timelineExpansionOpen = !timelineExpansionOpen;
                  timelineFocusOpen = false;
                  filtersOpen = false;
                "
              >
                <RectangleStackIcon class="h-4 w-4" />
                <span>展开</span>
                <span class="text-indigo-600">{{
                  timelineExpansionLabel
                }}</span>
                <ChevronDownIcon
                  class="h-3 w-3 text-slate-400 transition"
                  :class="timelineExpansionOpen ? 'rotate-180' : ''"
                />
              </button>

              <button
                v-if="timelineExpansionOpen"
                type="button"
                aria-label="关闭展开层级菜单"
                class="fixed inset-0 z-20 cursor-default"
                @click="timelineExpansionOpen = false"
              />
              <div
                v-if="timelineExpansionOpen"
                role="menu"
                aria-label="展开层级"
                class="absolute right-0 top-11 z-30 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10"
              >
                <button
                  v-for="item in timelineExpansionOptions"
                  :key="item.value"
                  type="button"
                  role="menuitemradio"
                  :aria-checked="timelineExpansionSelected(item.value)"
                  class="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                  :class="
                    timelineExpansionSelected(item.value)
                      ? 'bg-indigo-50/70'
                      : ''
                  "
                  @click="selectTimelineExpansion(item.value)"
                >
                  <span
                    class="grid h-5 w-5 shrink-0 place-items-center rounded-full border"
                    :class="
                      timelineExpansionSelected(item.value)
                        ? 'border-indigo-500 bg-indigo-500 text-white'
                        : 'border-slate-200 text-transparent'
                    "
                  >
                    <CheckIcon class="h-3 w-3" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-xs font-semibold text-slate-700">{{
                      item.label
                    }}</span>
                    <span class="mt-0.5 block text-[10px] text-slate-400">{{
                      item.hint
                    }}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="view === 'list'" class="space-y-3">
          <RequirementCard
            v-for="item in requirements"
            :key="item.id"
            :summary="item"
            @refresh="load"
          />
          <div v-if="!requirements.length" class="surface py-16 text-center">
            <SquaresPlusIcon class="mx-auto h-8 w-8 text-slate-300" />
            <p class="mt-3 text-sm font-semibold text-slate-700">
              这里还没有符合条件的需求
            </p>
            <button
              class="mt-3 text-xs font-medium text-indigo-600"
              @click="filters.health = filters.ownerId = 'all'"
            >
              清除筛选
            </button>
          </div>
        </div>
        <div v-else>
          <TimelineView
            v-model:expansion-depth="timelineExpansionDepth"
            v-model:expansion-mode="timelineExpansionMode"
            :requirements="filteredTimelineRequirements"
            :versions="timelineVersions"
            :people="workspace.people"
            :focused-stage-names="timelineFocusedStages"
            :include-bugs="timelineIncludeBugs"
            @schedule-saved="load"
          />
        </div>
      </section>

      <AppModal
        :open="createOpen"
        title="创建需求"
        description="可使用项目默认流程，也可直接定义这次交付的真实阶段。"
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
            <label>
              <span class="mb-1.5 block text-xs font-medium text-slate-600"
                >目标版本</span
              >
              <AppSelect
                v-model="form.versionId"
                :options="createVersionOptions"
              />
            </label>
            <label>
              <span class="mb-1.5 block text-xs font-medium text-slate-600"
                >计划开始</span
              >
              <AppDateTimeField v-model="form.plannedStartAt" required />
            </label>
            <label>
              <span class="mb-1.5 block text-xs font-medium text-slate-600"
                >计划完成</span
              >
              <AppDateTimeField
                v-model="form.plannedEndAt"
                required
                :min="form.plannedStartAt"
              />
            </label>
          </div>
          <fieldset>
            <legend class="mb-2 text-xs font-medium text-slate-600">
              此次工作流程
            </legend>
            <div class="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                class="rounded-xl border p-3 text-left transition"
                :class="
                  form.stageMode === 'template'
                    ? 'border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-100'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                "
                @click="form.stageMode = 'template'"
              >
                <span class="block text-xs font-semibold text-slate-700"
                  >使用项目默认流程</span
                >
                <span class="mt-1 block text-[10px] leading-4 text-slate-400">
                  {{
                    snapshot.project.templateStages
                      .map((item) => item.name)
                      .join(' → ') || '当前项目没有默认阶段'
                  }}
                </span>
              </button>
              <button
                type="button"
                class="rounded-xl border p-3 text-left transition"
                :class="
                  form.stageMode === 'custom'
                    ? 'border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-100'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                "
                @click="form.stageMode = 'custom'"
              >
                <span class="block text-xs font-semibold text-slate-700"
                  >定义本次真实流程</span
                >
                <span class="mt-1 block text-[10px] leading-4 text-slate-400"
                  >直接创建真实阶段，不产生待取消的模板阶段</span
                >
              </button>
            </div>
            <div v-if="form.stageMode === 'custom'" class="mt-3 space-y-2">
              <div
                v-for="(stage, index) in form.stages"
                :key="index"
                class="flex items-center gap-2"
              >
                <span
                  class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-400"
                  >{{ index + 1 }}</span
                >
                <input
                  v-model="stage.name"
                  required
                  :placeholder="`阶段 ${index + 1}，例如：物料报价`"
                  class="focus-ring min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                />
                <button
                  type="button"
                  class="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="移除此阶段"
                  @click="removeCreateStage(index)"
                >
                  <XMarkIcon class="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                class="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                @click="addCreateStage"
              >
                <PlusIcon class="h-3.5 w-3.5" />添加阶段
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend class="mb-2 text-xs font-medium text-slate-600">
              需求整体协调人（可选）
            </legend>
            <OwnerPicker v-model="form.ownerIds" :people="workspace.people" />
            <p class="mt-2 text-[10px] leading-4 text-slate-400">
              这里只设置需求的整体协调人；各阶段负责人需要按实际分工独立设置。
            </p>
          </fieldset>
          <div
            class="flex items-center justify-between rounded-2xl bg-indigo-50/60 px-4 py-3 text-xs text-indigo-700"
          >
            <template v-if="form.stageMode === 'template'">
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
            </template>
            <template v-else>
              <span>将按本次计划创建真实阶段</span>
              <span class="font-medium">{{ form.stages.length }} 个阶段</span>
            </template>
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

      <StatusUpdateDialog
        v-if="attentionTarget"
        :open="Boolean(attentionTarget)"
        :item-id="attentionTarget.id"
        :item-type="attentionTarget.type"
        :item-name="attentionTarget.name"
        :current-status="attentionTarget.status"
        :actual-start-at="attentionTarget.actualStartAt"
        :status-reason="attentionTarget.reason"
        :expected-resume-at="attentionTarget.expectedResumeAt"
        :owner-ids="attentionTarget.ownerIds"
        :people="workspace.people"
        @close="attentionTarget = undefined"
        @saved="load"
      />

      <PlanningDialog
        v-if="scheduleTarget"
        :open="Boolean(scheduleTarget)"
        :item-id="scheduleTarget.id"
        item-type="requirement"
        :item-name="scheduleTarget.title"
        :planned-start-at="scheduleTarget.plannedStartAt"
        :planned-end-at="scheduleTarget.plannedEndAt"
        :current-version-id="scheduleTarget.versionId"
        :versions="snapshot.versions"
        @close="scheduleTarget = undefined"
        @saved="load"
      />
    </template>
  </div>
</template>

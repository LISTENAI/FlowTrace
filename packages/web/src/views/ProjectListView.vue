<script setup lang="ts">
import type {
  ChangeEvent,
  ExecutionStatus,
  ProjectRhythm,
  ProjectSnapshot,
  Version,
} from '@flowtrace/shared';
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
import AvatarStack from '@/components/AvatarStack.vue';
import PlanningDialog from '@/components/PlanningDialog.vue';
import StatusUpdateDialog from '@/components/StatusUpdateDialog.vue';
import { formatDate, formatDateTime, relativeDate } from '@/lib/presentation';
import { toasts } from '@/state/toasts';
import { loadWorkspace, workspace } from '@/state/workspace';

const router = useRouter();
const createOpen = ref(false);
const saving = ref(false);
const rhythms = ref<ProjectRhythm[]>([]);
const snapshots = ref<ProjectSnapshot[]>([]);
const portfolioLoading = ref(true);
const progressTarget = ref<AttentionRow>();
const planningTarget = ref<AttentionRow>();
const portfolioLens = ref<'decide' | 'follow_up' | 'review' | 'all'>('decide');
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

interface AttentionRow {
  projectId: string;
  projectName: string;
  requirementId: string;
  requirementKey: string;
  requirementTitle: string;
  kind: 'blocked' | 'waiting' | 'overdue' | 'review' | 'due_soon';
  itemName?: string;
  reason: string;
  ownerIds: string[];
  extraCount: number;
  workItemId?: string;
  workItemType?: 'stage' | 'bug';
  currentStatus?: ExecutionStatus;
  actualStartAt?: string;
  expectedResumeAt?: string;
  plannedStartAt?: string;
  plannedEndAt?: string;
  versionId?: string;
  versions: Version[];
  planningItemId?: string;
  planningItemType?: 'requirement' | 'stage';
  planningItemName?: string;
}

const attentionRows = computed<AttentionRow[]>(() => {
  const rows: AttentionRow[] = [];
  for (const snapshot of snapshots.value) {
    const grouped = new Map<string, AttentionRow>();
    const addWork = (
      kind: 'blocked' | 'waiting',
      item: ProjectSnapshot['blockedItems'][number],
    ) => {
      const existing = grouped.get(item.requirementId);
      if (existing) {
        if (existing.kind === kind) existing.extraCount += 1;
        return;
      }
      grouped.set(item.requirementId, {
        projectId: snapshot.project.id,
        projectName: snapshot.project.name,
        requirementId: item.requirementId,
        requirementKey: item.requirementKey,
        requirementTitle: item.requirementTitle,
        kind,
        itemName: item.type === 'bug' ? item.key || item.name : item.name,
        reason: item.reason || '尚未填写原因',
        ownerIds: item.ownerIds,
        extraCount: 0,
        workItemId: item.id,
        workItemType: item.type,
        currentStatus: item.status,
        actualStartAt: item.actualStartAt,
        expectedResumeAt: item.expectedResumeAt,
        plannedStartAt: item.plannedStartAt,
        plannedEndAt: item.plannedEndAt,
        versions: snapshot.versions,
      });
    };

    snapshot.blockedItems.forEach((item) => addWork('blocked', item));
    snapshot.waitingItems.forEach((item) => addWork('waiting', item));
    for (const item of snapshot.delayedItems) {
      if (grouped.has(item.id)) continue;
      grouped.set(item.id, {
        projectId: snapshot.project.id,
        projectName: snapshot.project.name,
        requirementId: item.id,
        requirementKey: item.key,
        requirementTitle: item.title,
        kind: 'overdue',
        reason: `当前计划已到 ${formatDate(item.plannedEndAt, '未排期')}`,
        ownerIds: item.ownerIds,
        extraCount: 0,
        plannedStartAt: item.plannedStartAt,
        plannedEndAt: item.plannedEndAt,
        versionId: item.versionId,
        versions: snapshot.versions,
      });
    }

    const requirementsById = new Map(
      snapshot.requirements.map((item) => [item.id, item]),
    );
    for (const issue of snapshot.reviewItems) {
      const requirement = requirementsById.get(issue.requirementId);
      if (!requirement) continue;
      const stage = [
        ...requirement.activeStages,
        ...requirement.nextStages,
      ].find((item) => item.id === issue.targetId);
      rows.push({
        projectId: snapshot.project.id,
        projectName: snapshot.project.name,
        requirementId: requirement.id,
        requirementKey: requirement.key,
        requirementTitle: requirement.title,
        kind: 'review',
        itemName: issue.targetName,
        reason: issue.message,
        ownerIds: stage?.ownerIds ?? requirement.ownerIds,
        extraCount: 0,
        versionId: requirement.versionId,
        versions: snapshot.versions,
        workItemId: stage?.id,
        workItemType: stage ? 'stage' : undefined,
        currentStatus: stage?.status,
        actualStartAt: stage?.actualStartAt,
        expectedResumeAt: stage?.expectedResumeAt,
        plannedStartAt: stage?.plannedStartAt,
        plannedEndAt: stage?.plannedEndAt,
        planningItemId:
          issue.code === 'work_plan_missing' ? stage?.id : undefined,
        planningItemType:
          issue.code === 'work_plan_missing' && stage ? 'stage' : undefined,
        planningItemName: stage?.name,
      });
    }

    for (const item of snapshot.requirements) {
      if (['done', 'canceled'].includes(item.lifecycle)) continue;
      const daysUntilDue = item.plannedEndAt
        ? new Date(item.plannedEndAt).getTime() - Date.now()
        : undefined;
      if (
        !item.overdue &&
        daysUntilDue !== undefined &&
        daysUntilDue >= 0 &&
        daysUntilDue <= 7 * 24 * 60 * 60 * 1000
      ) {
        rows.push({
          projectId: snapshot.project.id,
          projectName: snapshot.project.name,
          requirementId: item.id,
          requirementKey: item.key,
          requirementTitle: item.title,
          kind: 'due_soon',
          itemName: item.currentStage,
          reason: `当前计划将在 ${formatDate(item.plannedEndAt)} 完成`,
          ownerIds: item.currentStageOwnerIds.length
            ? item.currentStageOwnerIds
            : item.ownerIds,
          extraCount: 0,
          plannedStartAt: item.plannedStartAt,
          plannedEndAt: item.plannedEndAt,
          versionId: item.versionId,
          versions: snapshot.versions,
        });
      }
    }
    rows.push(...grouped.values());
  }
  const priority = {
    blocked: 0,
    waiting: 1,
    overdue: 2,
    review: 3,
    due_soon: 4,
  } as const;
  return rows.sort(
    (left, right) =>
      priority[left.kind] - priority[right.kind] ||
      left.projectName.localeCompare(right.projectName, 'zh-CN'),
  );
});

const visibleAttentionRows = computed(() =>
  attentionRows.value.filter((item) => {
    if (portfolioLens.value === 'all') return true;
    if (portfolioLens.value === 'decide')
      return ['blocked', 'overdue'].includes(item.kind);
    if (portfolioLens.value === 'follow_up') return item.kind === 'waiting';
    return ['review', 'due_soon'].includes(item.kind);
  }),
);

const portfolioLensOptions = computed(() => [
  {
    id: 'decide' as const,
    label: '需要决策',
    count: attentionRows.value.filter((item) =>
      ['blocked', 'overdue'].includes(item.kind),
    ).length,
  },
  {
    id: 'follow_up' as const,
    label: '等待跟进',
    count: attentionRows.value.filter((item) => item.kind === 'waiting').length,
  },
  {
    id: 'review' as const,
    label: '完整性 Review',
    count: attentionRows.value.filter((item) =>
      ['review', 'due_soon'].includes(item.kind),
    ).length,
  },
  { id: 'all' as const, label: '全部', count: attentionRows.value.length },
]);

const recentChanges = computed<ChangeEvent[]>(() => {
  const unique = new Map<string, ChangeEvent>();
  snapshots.value
    .flatMap((snapshot) => snapshot.recentChanges)
    .forEach((event) => unique.set(event.id, event));
  return [...unique.values()]
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime(),
    )
    .slice(0, 8);
});

const attentionLabels = {
  blocked: '阻塞',
  waiting: '等待',
  overdue: '延期',
  review: '待补全',
  due_soon: '即将到期',
} as const;

onMounted(async () => {
  await Promise.all([loadWorkspace(), loadRhythms()]);
  await loadPortfolio();
});

async function loadPortfolio() {
  portfolioLoading.value = true;
  const results = await Promise.allSettled(
    workspace.projects.map((project) => api.projectSnapshot(project.id)),
  );
  snapshots.value = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  portfolioLoading.value = false;
}

async function refreshPortfolio() {
  progressTarget.value = undefined;
  planningTarget.value = undefined;
  await loadWorkspace(true);
  await loadPortfolio();
}

function attentionActionLabel(item: AttentionRow) {
  if (
    ['blocked', 'waiting'].includes(item.kind) &&
    item.workItemId &&
    item.currentStatus
  )
    return '记录进展';
  if (item.kind === 'overdue') return '调整计划';
  if (item.kind === 'review' && item.planningItemId && !item.plannedEndAt)
    return '补排计划';
  if (
    item.kind === 'review' &&
    item.workItemId &&
    item.currentStatus &&
    !item.ownerIds.length
  )
    return '补负责人';
  return '查看详情';
}

function handleAttentionAction(item: AttentionRow) {
  if (
    ['blocked', 'waiting'].includes(item.kind) &&
    item.workItemId &&
    item.currentStatus
  ) {
    progressTarget.value = item;
    return;
  }
  if (
    item.kind === 'overdue' ||
    (item.kind === 'review' && item.planningItemId && !item.plannedEndAt)
  ) {
    planningTarget.value = item;
    return;
  }
  if (
    item.kind === 'review' &&
    item.workItemId &&
    item.currentStatus &&
    !item.ownerIds.length
  ) {
    progressTarget.value = item;
    return;
  }
  void router.push(`/requirements/${item.requirementId}`);
}

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

    <section class="mt-7">
      <div class="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold tracking-tight text-slate-900">
            管理工作台
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            先处理阻塞、等待与延期，再回到项目查看完整过程。
          </p>
        </div>
        <span
          v-if="attentionRows.length"
          class="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-100"
          >{{ attentionRows.length }} 项需要关注</span
        >
      </div>

      <div
        class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.75fr)]"
      >
        <div class="surface overflow-hidden">
          <div
            class="flex items-center justify-between border-b border-slate-100 px-4 py-3"
          >
            <div>
              <h3 class="text-sm font-semibold text-slate-900">Review 队列</h3>
              <p class="mt-0.5 text-[11px] text-slate-400">
                从事实风险、跟进事项和计划完整性三个角度检查
              </p>
            </div>
          </div>
          <div
            class="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2"
            role="tablist"
            aria-label="管理 Review 视角"
          >
            <button
              v-for="lens in portfolioLensOptions"
              :key="lens.id"
              type="button"
              role="tab"
              :aria-selected="portfolioLens === lens.id"
              class="focus-ring inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition"
              :class="
                portfolioLens === lens.id
                  ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-200 dark:ring-indigo-900'
                  : 'text-slate-500 hover:bg-slate-50'
              "
              @click="portfolioLens = lens.id"
            >
              {{ lens.label }}
              <span
                class="rounded-full px-1.5 py-0.5 text-[9px] tabular-nums"
                :class="
                  portfolioLens === lens.id
                    ? 'bg-white text-indigo-600 dark:bg-indigo-900/70 dark:text-indigo-200'
                    : 'bg-slate-100 text-slate-500'
                "
                >{{ lens.count }}</span
              >
            </button>
          </div>
          <div v-if="portfolioLoading" class="space-y-2 p-4">
            <div
              v-for="i in 3"
              :key="i"
              class="h-20 animate-pulse rounded-2xl bg-slate-100"
            />
          </div>
          <div
            v-else-if="visibleAttentionRows.length"
            class="divide-y divide-slate-100"
          >
            <div
              v-for="item in visibleAttentionRows"
              :key="`${item.kind}-${item.requirementId}-${item.itemName}-${item.reason}`"
              class="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-slate-50/70"
            >
              <button
                type="button"
                class="focus-ring grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5 rounded-lg text-left"
                @click="router.push(`/requirements/${item.requirementId}`)"
              >
                <span
                  class="mt-px shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold ring-1"
                  :class="
                    item.kind === 'blocked'
                      ? 'bg-rose-50 text-rose-700 ring-rose-100'
                      : item.kind === 'waiting'
                        ? 'bg-amber-50 text-amber-700 ring-amber-100'
                        : item.kind === 'overdue'
                          ? 'bg-violet-50 text-violet-700 ring-violet-100'
                          : 'bg-indigo-50 text-indigo-700 ring-indigo-100'
                  "
                  >{{ attentionLabels[item.kind] }}</span
                >
                <span class="min-w-0 flex-1">
                  <span class="flex min-w-0 items-baseline gap-2">
                    <span
                      class="shrink-0 font-mono text-[10px] font-bold text-indigo-600"
                      >{{ item.requirementKey }}</span
                    >
                    <span
                      class="min-w-0 truncate text-xs font-semibold text-slate-800"
                      >{{ item.requirementTitle }}</span
                    >
                  </span>
                  <span
                    class="mt-0.5 block truncate text-[11px] leading-4 text-slate-500"
                  >
                    {{ item.projectName }}
                    <template v-if="item.itemName">
                      · {{ item.itemName }}</template
                    >
                    · {{ item.reason }}
                    <template v-if="item.extraCount">
                      · 另有 {{ item.extraCount }} 项
                    </template>
                  </span>
                </span>
              </button>
              <div class="flex shrink-0 items-center justify-end gap-2">
                <span class="hidden sm:block">
                  <AvatarStack :owner-ids="item.ownerIds" :max="2" compact />
                </span>
                <button
                  type="button"
                  class="focus-ring inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50"
                  @click="handleAttentionAction(item)"
                >
                  {{ attentionActionLabel(item) }}
                  <ArrowUpRightIcon class="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
          <div v-else class="px-5 py-12 text-center">
            <p class="text-sm font-semibold text-emerald-700">
              当前视角没有待处理项
            </p>
            <p class="mt-1 text-xs text-slate-400">
              切换 Review 视角可检查其他管理维度。
            </p>
          </div>
        </div>

        <div class="surface overflow-hidden">
          <div class="border-b border-slate-100 px-4 py-3">
            <h3 class="text-sm font-semibold text-slate-900">最近变化</h3>
            <p class="mt-0.5 text-[11px] text-slate-400">
              按实际发生时间汇总全部项目
            </p>
          </div>
          <div v-if="portfolioLoading" class="space-y-3 p-5">
            <div
              v-for="i in 4"
              :key="i"
              class="h-12 animate-pulse rounded-xl bg-slate-100"
            />
          </div>
          <div
            v-else-if="recentChanges.length"
            class="max-h-[28rem] overflow-y-auto px-4 py-1.5"
          >
            <button
              v-for="event in recentChanges"
              :key="event.id"
              type="button"
              class="focus-ring block w-full border-l border-slate-200 px-3 py-2 text-left transition hover:bg-slate-50"
              :class="event.requirementId ? 'cursor-pointer' : 'cursor-default'"
              @click="
                event.requirementId &&
                router.push(`/requirements/${event.requirementId}`)
              "
            >
              <span class="flex items-center gap-2 text-[10px] text-slate-400">
                <span>{{ event.project?.name || '项目' }}</span>
                <span
                  v-if="event.requirement"
                  class="font-mono text-indigo-500"
                  >{{ event.requirement.key }}</span
                >
                <span class="ml-auto">{{
                  formatDateTime(event.occurredAt)
                }}</span>
              </span>
              <span
                class="mt-1 block text-xs font-medium leading-5 text-slate-700"
                >{{ event.summary }}</span
              >
              <span
                v-if="event.reason"
                class="mt-0.5 block text-[10px] text-slate-400"
                >{{ event.reason }}</span
              >
            </button>
          </div>
          <p v-else class="px-5 py-12 text-center text-xs text-slate-400">
            暂时没有变化记录
          </p>
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

    <StatusUpdateDialog
      v-if="progressTarget?.workItemId && progressTarget.currentStatus"
      :open="Boolean(progressTarget)"
      :item-id="progressTarget.workItemId"
      :item-type="progressTarget.workItemType || 'stage'"
      :item-name="progressTarget.itemName || progressTarget.requirementTitle"
      :current-status="progressTarget.currentStatus"
      :actual-start-at="progressTarget.actualStartAt"
      :status-reason="progressTarget.reason"
      :expected-resume-at="progressTarget.expectedResumeAt"
      :owner-ids="progressTarget.ownerIds"
      :people="workspace.people"
      @close="progressTarget = undefined"
      @saved="refreshPortfolio"
    />

    <PlanningDialog
      v-if="planningTarget"
      :open="Boolean(planningTarget)"
      :item-id="planningTarget.planningItemId || planningTarget.requirementId"
      :item-type="planningTarget.planningItemType || 'requirement'"
      :item-name="
        planningTarget.planningItemName || planningTarget.requirementTitle
      "
      :planned-start-at="planningTarget.plannedStartAt"
      :planned-end-at="planningTarget.plannedEndAt"
      :current-version-id="planningTarget.versionId"
      :versions="planningTarget.versions"
      @close="planningTarget = undefined"
      @saved="refreshPortfolio"
    />
  </div>
</template>

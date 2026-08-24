<script setup lang="ts">
import type {
  Bug,
  Dependency,
  Requirement,
  Stage,
  Version,
} from '@flowtrace/shared';
import {
  ArrowLeftIcon,
  BugAntIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  LinkIcon,
  PlusIcon,
  QueueListIcon,
} from '@heroicons/vue/24/outline';
import dayjs from 'dayjs';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '@/api';
import AppModal from '@/components/AppModal.vue';
import AvatarStack from '@/components/AvatarStack.vue';
import PlanningDialog from '@/components/PlanningDialog.vue';
import StatusUpdateDialog from '@/components/StatusUpdateDialog.vue';
import {
  formatDate,
  formatDateTime,
  healthLabels,
  lifecycleLabels,
  statusDot,
  statusLabels,
  statusTone,
} from '@/lib/presentation';
import { toasts } from '@/state/toasts';
import { loadWorkspace, workspace } from '@/state/workspace';

const route = useRoute();
const id = computed(() => route.params.requirementId as string);
const requirement = ref<Requirement>();
const dependencies = ref<Dependency[]>([]);
const versions = ref<Version[]>([]);
const loading = ref(true);
const addStageOpen = ref(false);
const addBugOpen = ref(false);
const addDependencyOpen = ref(false);
const saving = ref(false);
const movingStageId = ref('');
const statusTarget = ref<Stage | Bug>();
const planningTarget = ref<Requirement | Stage | Bug>();
const candidateRequirements = ref<
  Array<{ id: string; key: string; title: string; projectId: string }>
>([]);
const selectedPredecessor = ref<Requirement>();
const stageForm = reactive({
  name: '',
  note: '',
  ownerIds: [] as string[],
  order: 0,
});
const bugForm = reactive({
  title: '',
  description: '',
  ownerIds: [] as string[],
  discoveredStageId: '',
  targetVersionId: '',
  plannedStartAt: '',
  plannedEndAt: '',
});
const dependencyForm = reactive({
  predecessorRequirementId: '',
  predecessorStageId: '',
  note: '',
});

const project = computed(() =>
  workspace.projects.find((item) => item.id === requirement.value?.projectId),
);
const stageOptions = computed(() => requirement.value?.stages ?? []);

const events = computed(() => {
  if (!requirement.value) return [];
  const result: Array<{
    id: string;
    time: string;
    title: string;
    detail?: string;
    tone: string;
  }> = [];
  for (const stage of requirement.value.stages) {
    for (const history of stage.statusHistory) {
      result.push({
        id: history.id,
        time: history.effectiveAt,
        title: `${stage.name} → ${statusLabels[history.toStatus]}`,
        detail: history.reason || history.note,
        tone: statusDot[history.toStatus],
      });
    }
    for (const history of stage.scheduleHistory) {
      result.push({
        id: history.id,
        time: history.changedAt,
        title: `${stage.name} 调整排期`,
        detail: history.reason,
        tone: 'bg-violet-400',
      });
    }
  }
  for (const bug of requirement.value.bugs) {
    result.push({
      id: `created-${bug.id}`,
      time: bug.createdAt,
      title: `新增 ${bug.key}`,
      detail: bug.title,
      tone: 'bg-rose-400',
    });
    for (const history of bug.statusHistory) {
      result.push({
        id: history.id,
        time: history.effectiveAt,
        title: `${bug.key} → ${statusLabels[history.toStatus]}`,
        detail: history.reason || history.note,
        tone: statusDot[history.toStatus],
      });
    }
  }
  for (const history of requirement.value.versionHistory) {
    result.push({
      id: history.id,
      time: history.changedAt,
      title: '调整目标版本',
      detail: history.reason,
      tone: 'bg-cyan-400',
    });
  }
  return result.sort(
    (a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf(),
  );
});

const incomingDependencies = computed(() =>
  dependencies.value.filter(
    (item) =>
      item.successor?.requirementId === requirement.value?.id &&
      item.predecessor?.requirementId !== item.successor?.requirementId,
  ),
);
const outgoingDependencies = computed(() =>
  dependencies.value.filter(
    (item) =>
      item.predecessor?.requirementId === requirement.value?.id &&
      item.predecessor?.requirementId !== item.successor?.requirementId,
  ),
);

async function load() {
  loading.value = true;
  try {
    const [item, deps] = await Promise.all([
      api.requirement(id.value),
      api.dependencies(id.value),
    ]);
    requirement.value = item;
    dependencies.value = deps;
    versions.value = await api.versions(item.projectId);
    await loadWorkspace();
  } finally {
    loading.value = false;
  }
}

function toggleOwner(target: string[], ownerId: string) {
  const index = target.indexOf(ownerId);
  if (index >= 0) target.splice(index, 1);
  else target.push(ownerId);
}

function openStageForm() {
  stageForm.order = requirement.value?.stages.length ?? 0;
  addStageOpen.value = true;
}

async function addStage() {
  if (!requirement.value) return;
  saving.value = true;
  try {
    await api.addStage(requirement.value.id, {
      name: stageForm.name,
      note: stageForm.note,
      ownerIds: stageForm.ownerIds,
      order: stageForm.order,
    });
    addStageOpen.value = false;
    toasts.show('阶段已加入过程', stageForm.name);
    stageForm.name = '';
    stageForm.note = '';
    stageForm.ownerIds = [];
    stageForm.order = 0;
    await load();
  } catch (error) {
    toasts.show(
      '新增失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    saving.value = false;
  }
}

async function moveStage(stage: Stage, index: number, offset: number) {
  if (!requirement.value) return;
  const target = index + offset;
  if (target < 0 || target >= requirement.value.stages.length) return;
  movingStageId.value = stage.id;
  try {
    await api.updateStage(stage.id, {
      order: target,
      reason: '手动调整实际过程顺序',
    });
    await load();
    toasts.show('阶段顺序已调整', `${stage.name} 现在位于第 ${target + 1} 位`);
  } catch (error) {
    toasts.show(
      '调整失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    movingStageId.value = '';
  }
}

async function addBug() {
  if (!requirement.value) return;
  saving.value = true;
  try {
    const bug = await api.addBug(requirement.value.id, {
      title: bugForm.title,
      description: bugForm.description,
      ownerIds: bugForm.ownerIds,
      discoveredStageId: bugForm.discoveredStageId || undefined,
      targetVersionId: bugForm.targetVersionId || undefined,
      plannedStartAt: bugForm.plannedStartAt
        ? dayjs(bugForm.plannedStartAt).startOf('day').toISOString()
        : undefined,
      plannedEndAt: bugForm.plannedEndAt
        ? dayjs(bugForm.plannedEndAt).endOf('day').toISOString()
        : undefined,
    });
    addBugOpen.value = false;
    toasts.show('Bug 已进入追踪', bug.key);
    bugForm.title = '';
    bugForm.description = '';
    bugForm.ownerIds = [];
    await load();
  } catch (error) {
    toasts.show(
      '新增失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    saving.value = false;
  }
}

function openBugForm() {
  bugForm.targetVersionId = requirement.value?.versionId ?? '';
  bugForm.plannedStartAt = '';
  bugForm.plannedEndAt = '';
  addBugOpen.value = true;
}

async function prepareDependencies() {
  const groups = await Promise.all(
    workspace.projects.map((item) => api.requirements({ projectId: item.id })),
  );
  candidateRequirements.value = groups
    .flat()
    .filter((item) => item.id !== requirement.value?.id)
    .map((item) => ({
      id: item.id,
      key: item.key,
      title: item.title,
      projectId: item.projectId,
    }));
  dependencyForm.predecessorRequirementId = '';
  dependencyForm.predecessorStageId = '';
  selectedPredecessor.value = undefined;
  addDependencyOpen.value = true;
}

async function selectPredecessor() {
  if (!dependencyForm.predecessorRequirementId) return;
  selectedPredecessor.value = await api.requirement(
    dependencyForm.predecessorRequirementId,
  );
}

async function addDependency() {
  if (!requirement.value) return;
  saving.value = true;
  try {
    await api.addDependency({
      successorType: 'requirement',
      successorId: requirement.value.id,
      predecessorType: dependencyForm.predecessorStageId
        ? 'stage'
        : 'requirement',
      predecessorId:
        dependencyForm.predecessorStageId ||
        dependencyForm.predecessorRequirementId,
      note: dependencyForm.note,
    });
    addDependencyOpen.value = false;
    toasts.show('依赖已建立', '未满足时会提示，但不会阻止提前推进');
    await load();
  } catch (error) {
    toasts.show(
      '建立失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    saving.value = false;
  }
}

onMounted(load);
watch(id, load);
</script>

<template>
  <div class="mx-auto max-w-[92rem] px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
    <div
      v-if="loading && !requirement"
      class="grid gap-4 lg:grid-cols-[1fr_20rem]"
    >
      <div class="h-[44rem] animate-pulse rounded-3xl bg-white" />
      <div class="h-96 animate-pulse rounded-3xl bg-white" />
    </div>
    <template v-else-if="requirement">
      <div class="mb-6">
        <RouterLink
          :to="`/projects/${requirement.projectId}`"
          class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-600"
          ><ArrowLeftIcon class="h-3.5 w-3.5" />返回
          {{ project?.name }}</RouterLink
        >
        <div
          class="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-start"
        >
          <div class="max-w-3xl">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="font-mono text-xs font-bold tracking-wide text-indigo-600"
                >{{ requirement.key }}</span
              ><span
                class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                >{{ lifecycleLabels[requirement.lifecycle] }}</span
              ><span
                v-if="requirement.health !== 'normal'"
                class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                :class="
                  requirement.health === 'blocked'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
                "
                >{{ healthLabels[requirement.health] }}</span
              >
            </div>
            <h1
              class="mt-2 text-2xl font-semibold tracking-[-.035em] text-slate-900 sm:text-3xl"
            >
              {{ requirement.title }}
            </h1>
            <p class="mt-2 text-sm leading-6 text-slate-500">
              {{ requirement.description || '尚未填写需求说明。' }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="focus-ring section-action"
              @click="planningTarget = requirement"
            >
              <CalendarDaysIcon class="h-3.5 w-3.5" />调整计划
            </button>
            <AvatarStack :owner-ids="requirement.ownerIds" :max="5" />
          </div>
        </div>
      </div>

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div class="min-w-0 space-y-5">
          <section class="surface overflow-hidden">
            <div
              class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:items-center"
            >
              <div class="min-w-0">
                <h2 class="text-sm font-semibold text-slate-900">实际过程</h2>
                <p class="mt-0.5 text-[11px] text-slate-400">
                  点击任一行，就地记录状态与生效时间
                </p>
              </div>
              <button class="focus-ring section-action" @click="openStageForm">
                <PlusIcon class="h-3.5 w-3.5" />新增阶段
              </button>
            </div>
            <div class="px-4 py-3 sm:px-5">
              <div
                class="relative space-y-1 before:absolute before:bottom-6 before:left-[14px] before:top-6 before:w-px before:bg-slate-200"
              >
                <div
                  v-for="(stage, index) in requirement.stages"
                  :key="stage.id"
                  class="group relative flex w-full items-center rounded-2xl transition hover:bg-slate-50"
                >
                  <button
                    class="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-3 text-left"
                    @click="statusTarget = stage"
                  >
                    <span
                      class="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200"
                      :class="statusDot[stage.status]"
                      ><CheckIcon
                        v-if="stage.status === 'done'"
                        class="h-3.5 w-3.5 text-white"
                    /></span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-slate-800">{{
                          stage.name
                        }}</span
                        ><span class="text-[10px] text-slate-300"
                          >#{{ index + 1 }}</span
                        >
                      </div>
                      <p
                        v-if="stage.statusReason"
                        class="mt-0.5 truncate text-[11px]"
                        :class="
                          stage.status === 'blocked'
                            ? 'text-rose-600'
                            : 'text-amber-600'
                        "
                      >
                        {{ stage.statusReason }}
                      </p>
                      <p
                        v-else-if="stage.note"
                        class="mt-0.5 truncate text-[11px] text-slate-400"
                      >
                        {{ stage.note }}
                      </p>
                    </div>
                    <AvatarStack :owner-ids="stage.ownerIds" :max="2" compact />
                    <div class="hidden min-w-36 text-right sm:block">
                      <p class="text-[10px] text-slate-400">
                        {{ formatDate(stage.plannedStartAt) }} →
                        {{ formatDate(stage.plannedEndAt, '待定') }}
                      </p>
                      <p
                        v-if="stage.actualStartAt"
                        class="mt-0.5 text-[10px] text-slate-500"
                      >
                        实际 {{ formatDate(stage.actualStartAt) }} →
                        {{ formatDate(stage.actualEndAt, '至今') }}
                      </p>
                    </div>
                    <span
                      class="rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1"
                      :class="statusTone[stage.status]"
                      >{{ statusLabels[stage.status] }}</span
                    >
                  </button>
                  <div class="mr-1 flex shrink-0 flex-col gap-0.5">
                    <button
                      class="focus-ring rounded-md p-1 text-slate-300 transition hover:bg-white hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-20"
                      :disabled="index === 0 || movingStageId === stage.id"
                      :aria-label="`上移${stage.name}`"
                      @click="moveStage(stage, index, -1)"
                    >
                      <ChevronUpIcon class="h-3.5 w-3.5" />
                    </button>
                    <button
                      class="focus-ring rounded-md p-1 text-slate-300 transition hover:bg-white hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-20"
                      :disabled="
                        index === requirement.stages.length - 1 ||
                        movingStageId === stage.id
                      "
                      :aria-label="`下移${stage.name}`"
                      @click="moveStage(stage, index, 1)"
                    >
                      <ChevronDownIcon class="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    class="focus-ring mr-2 rounded-lg p-1.5 text-slate-300 opacity-60 transition hover:bg-white hover:text-indigo-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    :aria-label="`调整「${stage.name}」的计划`"
                    @click="planningTarget = stage"
                  >
                    <CalendarDaysIcon class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section class="surface overflow-hidden">
            <div
              class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"
            >
              <div class="flex items-center gap-2">
                <span
                  class="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-500"
                  ><BugAntIcon class="h-4.5 w-4.5"
                /></span>
                <div>
                  <h2 class="text-sm font-semibold text-slate-900">Bug 修复</h2>
                  <p class="text-[11px] text-slate-400">
                    {{
                      requirement.bugs.filter((item) => item.status === 'done')
                        .length
                    }}/{{ requirement.bugs.length }} 已完成
                  </p>
                </div>
              </div>
              <button
                class="focus-ring section-action section-action-danger"
                @click="openBugForm"
              >
                <PlusIcon class="h-3.5 w-3.5" />报告 Bug
              </button>
            </div>
            <div
              v-if="requirement.bugs.length"
              class="divide-y divide-slate-100 px-5"
            >
              <div
                v-for="bug in requirement.bugs"
                :key="bug.id"
                class="group flex items-center"
              >
                <button
                  class="focus-ring flex min-w-0 flex-1 items-center gap-3 py-3.5 text-left"
                  @click="statusTarget = bug"
                >
                  <span
                    class="h-2.5 w-2.5 rounded-full"
                    :class="statusDot[bug.status]"
                  /><span
                    class="w-24 shrink-0 font-mono text-[10px] font-bold text-rose-500"
                    >{{ bug.key }}</span
                  ><span
                    class="min-w-0 flex-1 truncate text-sm text-slate-700"
                    >{{ bug.title }}</span
                  ><AvatarStack
                    :owner-ids="bug.ownerIds"
                    :max="2"
                    compact
                  /><span class="text-[10px] font-medium text-slate-500">{{
                    statusLabels[bug.status]
                  }}</span>
                </button>
                <button
                  class="focus-ring ml-2 rounded-lg p-1.5 text-slate-300 opacity-60 transition hover:bg-slate-50 hover:text-indigo-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  :aria-label="`调整「${bug.title}」的计划`"
                  @click="planningTarget = bug"
                >
                  <CalendarDaysIcon class="h-4 w-4" />
                </button>
              </div>
            </div>
            <div v-else class="px-5 py-10 text-center text-xs text-slate-400">
              暂时没有 Bug，这里会保留每个问题的独立过程。
            </div>
          </section>

          <section class="surface overflow-hidden">
            <div
              class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"
            >
              <div class="flex items-center gap-2">
                <LinkIcon class="h-4.5 w-4.5 text-indigo-500" />
                <h2 class="text-sm font-semibold text-slate-900">协作依赖</h2>
              </div>
              <button
                class="focus-ring section-action"
                @click="prepareDependencies"
              >
                <PlusIcon class="h-3.5 w-3.5" />建立依赖
              </button>
            </div>
            <div class="grid gap-3 p-5 md:grid-cols-2">
              <div>
                <p
                  class="mb-2 text-[10px] font-semibold tracking-[.08em] text-slate-400"
                >
                  本需求正在等待
                </p>
                <div v-if="incomingDependencies.length" class="space-y-2">
                  <div
                    v-for="item in incomingDependencies"
                    :key="item.id"
                    class="rounded-xl border p-3"
                    :class="
                      item.satisfied
                        ? 'border-emerald-100 bg-emerald-50/40'
                        : 'border-amber-100 bg-amber-50/50'
                    "
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-semibold text-slate-700"
                        >{{ item.predecessor?.projectName }} /
                        {{ item.predecessor?.name }}</span
                      ><span
                        class="text-[9px] font-bold"
                        :class="
                          item.satisfied ? 'text-emerald-600' : 'text-amber-600'
                        "
                        >{{ item.satisfied ? '已满足' : '未满足' }}</span
                      >
                    </div>
                    <p v-if="item.note" class="mt-1 text-[10px] text-slate-400">
                      {{ item.note }}
                    </p>
                  </div>
                </div>
                <p
                  v-else
                  class="rounded-xl bg-slate-50 p-4 text-xs text-slate-400"
                >
                  没有前置依赖
                </p>
              </div>
              <div>
                <p
                  class="mb-2 text-[10px] font-semibold tracking-[.08em] text-slate-400"
                >
                  依赖本需求的事项
                </p>
                <div v-if="outgoingDependencies.length" class="space-y-2">
                  <div
                    v-for="item in outgoingDependencies"
                    :key="item.id"
                    class="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs font-semibold text-slate-700"
                  >
                    {{ item.successor?.projectName }} /
                    {{ item.successor?.name }}
                  </div>
                </div>
                <p
                  v-else
                  class="rounded-xl bg-slate-50 p-4 text-xs text-slate-400"
                >
                  暂时没有下游事项
                </p>
              </div>
            </div>
          </section>
        </div>

        <aside class="min-w-0 space-y-5">
          <section class="surface p-5">
            <h2 class="text-xs font-semibold tracking-[.08em] text-slate-400">
              时间概览
            </h2>
            <div class="mt-4 space-y-4">
              <div class="flex gap-3">
                <CalendarDaysIcon class="h-4 w-4 text-indigo-500" />
                <div>
                  <p class="text-[10px] text-slate-400">初始计划</p>
                  <p class="mt-0.5 text-xs font-medium text-slate-700">
                    {{ formatDate(requirement.baselineStartAt) }} →
                    {{ formatDate(requirement.baselineEndAt, '待定') }}
                  </p>
                </div>
              </div>
              <div class="flex gap-3">
                <ClockIcon class="h-4 w-4 text-violet-500" />
                <div>
                  <p class="text-[10px] text-slate-400">当前计划</p>
                  <p class="mt-0.5 text-xs font-medium text-slate-700">
                    {{ formatDate(requirement.plannedStartAt) }} →
                    {{ formatDate(requirement.plannedEndAt, '待定') }}
                  </p>
                </div>
              </div>
              <div class="flex gap-3">
                <QueueListIcon class="h-4 w-4 text-emerald-500" />
                <div>
                  <p class="text-[10px] text-slate-400">实际跨度</p>
                  <p class="mt-0.5 text-xs font-medium text-slate-700">
                    {{ formatDate(requirement.actualStartAt, '尚未开始') }} →
                    {{ formatDate(requirement.actualEndAt, '至今') }}
                  </p>
                </div>
              </div>
            </div>
          </section>
          <section class="surface overflow-hidden">
            <div class="border-b border-slate-100 px-5 py-4">
              <h2 class="text-sm font-semibold text-slate-900">最近历史</h2>
              <p class="mt-0.5 text-[11px] text-slate-400">实际生效时间排序</p>
            </div>
            <div class="max-h-[36rem] overflow-y-auto px-5 py-3">
              <div
                v-for="event in events.slice(0, 20)"
                :key="event.id"
                class="relative border-l border-slate-200 py-2 pl-4"
              >
                <span
                  class="absolute -left-[4.5px] top-4 h-2 w-2 rounded-full"
                  :class="event.tone"
                />
                <p class="text-xs font-medium text-slate-700">
                  {{ event.title }}
                </p>
                <p
                  v-if="event.detail"
                  class="mt-0.5 text-[10px] leading-4 text-slate-400"
                >
                  {{ event.detail }}
                </p>
                <p class="mt-1 text-[9px] text-slate-300">
                  {{ formatDateTime(event.time) }}
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </template>

    <StatusUpdateDialog
      v-if="statusTarget"
      :open="Boolean(statusTarget)"
      :item-id="statusTarget.id"
      :item-type="'key' in statusTarget ? 'bug' : 'stage'"
      :item-name="
        'title' in statusTarget ? statusTarget.title : statusTarget.name
      "
      :current-status="statusTarget.status"
      @close="statusTarget = undefined"
      @saved="load"
    />

    <PlanningDialog
      v-if="planningTarget"
      :open="Boolean(planningTarget)"
      :item-id="planningTarget.id"
      :item-type="
        planningTarget.id === requirement?.id
          ? 'requirement'
          : 'title' in planningTarget
            ? 'bug'
            : 'stage'
      "
      :item-name="
        'title' in planningTarget ? planningTarget.title : planningTarget.name
      "
      :planned-start-at="planningTarget.plannedStartAt"
      :planned-end-at="planningTarget.plannedEndAt"
      :current-version-id="
        'versionId' in planningTarget ? planningTarget.versionId : undefined
      "
      :versions="versions"
      @close="planningTarget = undefined"
      @saved="load"
    />

    <AppModal
      :open="addStageOpen"
      title="新增阶段"
      description="用于记录返工、再次打样或回归验证等实际过程。"
      @close="addStageOpen = false"
      ><form class="space-y-4" @submit.prevent="addStage">
        <label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >阶段名称</span
          ><input
            v-model="stageForm.name"
            required
            placeholder="例如：修复 #1 / 二次打样"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" /></label
        ><label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >备注</span
          ><textarea
            v-model="stageForm.note"
            rows="2"
            class="focus-ring w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          />
        </label>
        <label class="block">
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >插入位置</span
          >
          <select
            v-model.number="stageForm.order"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          >
            <option :value="0">放在最前面</option>
            <option
              v-for="(stage, index) in stageOptions"
              :key="stage.id"
              :value="index + 1"
            >
              在「{{ stage.name }}」之后
            </option>
          </select>
        </label>
        <fieldset>
          <legend class="mb-2 text-xs font-medium text-slate-600">
            负责人
          </legend>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="person in workspace.people"
              :key="person.id"
              type="button"
              class="rounded-full border px-3 py-1.5 text-xs"
              :class="
                stageForm.ownerIds.includes(person.id)
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-500'
              "
              @click="toggleOwner(stageForm.ownerIds, person.id)"
            >
              {{ person.name }}
            </button>
          </div>
        </fieldset>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-sm text-slate-500"
            @click="addStageOpen = false"
          >
            取消</button
          ><button
            :disabled="saving"
            class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            加入过程
          </button>
        </div>
      </form></AppModal
    >

    <AppModal
      :open="addBugOpen"
      title="报告一个独立 Bug"
      description="它会保留自己的负责人、状态和时间轨迹。"
      @close="addBugOpen = false"
      ><form class="space-y-4" @submit.prevent="addBug">
        <label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >问题标题</span
          ><input
            v-model="bugForm.title"
            required
            placeholder="例如：二次配网可能失败"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" /></label
        ><label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >问题描述</span
          ><textarea
            v-model="bugForm.description"
            rows="2"
            class="focus-ring w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          /></label
        ><label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >发现于</span
          ><select
            v-model="bugForm.discoveredStageId"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          >
            <option value="">未指定阶段</option>
            <option
              v-for="stage in requirement?.stages"
              :key="stage.id"
              :value="stage.id"
            >
              {{ stage.name }}
            </option>
          </select></label
        >
        <div class="grid grid-cols-2 gap-3">
          <label
            ><span class="mb-1.5 block text-xs font-medium text-slate-600"
              >目标版本</span
            ><select
              v-model="bugForm.targetVersionId"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
            >
              <option value="">未排版本</option>
              <option
                v-for="version in versions"
                :key="version.id"
                :value="version.id"
              >
                {{ version.name }}
              </option>
            </select></label
          ><label
            ><span class="mb-1.5 block text-xs font-medium text-slate-600"
              >计划开始</span
            ><input
              v-model="bugForm.plannedStartAt"
              type="date"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          /></label>
        </div>
        <label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >计划结束</span
          ><input
            v-model="bugForm.plannedEndAt"
            type="date"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        /></label>
        <fieldset>
          <legend class="mb-2 text-xs font-medium text-slate-600">
            负责人
          </legend>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="person in workspace.people"
              :key="person.id"
              type="button"
              class="rounded-full border px-3 py-1.5 text-xs"
              :class="
                bugForm.ownerIds.includes(person.id)
                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                  : 'border-slate-200 text-slate-500'
              "
              @click="toggleOwner(bugForm.ownerIds, person.id)"
            >
              {{ person.name }}
            </button>
          </div>
        </fieldset>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-sm text-slate-500"
            @click="addBugOpen = false"
          >
            取消</button
          ><button
            :disabled="saving"
            class="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            报告 Bug
          </button>
        </div>
      </form></AppModal
    >

    <AppModal
      :open="addDependencyOpen"
      title="建立一个明确的前置依赖"
      description="优先指向具体阶段；未满足时只会提示，不会阻止推进。"
      @close="addDependencyOpen = false"
      ><form class="space-y-4" @submit.prevent="addDependency">
        <label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >前置需求</span
          ><select
            v-model="dependencyForm.predecessorRequirementId"
            required
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
            @change="selectPredecessor"
          >
            <option value="">选择另一个需求</option>
            <option
              v-for="item in candidateRequirements"
              :key="item.id"
              :value="item.id"
            >
              {{
                workspace.projects.find(
                  (project) => project.id === item.projectId,
                )?.name
              }}
              / {{ item.key }} {{ item.title }}
            </option>
          </select></label
        ><label v-if="selectedPredecessor" class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >具体前置阶段（推荐）</span
          ><select
            v-model="dependencyForm.predecessorStageId"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          >
            <option value="">依赖整个需求完成</option>
            <option
              v-for="stage in selectedPredecessor.stages"
              :key="stage.id"
              :value="stage.id"
            >
              {{ stage.name }} · {{ statusLabels[stage.status] }}
            </option>
          </select></label
        ><label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >关系说明</span
          ><input
            v-model="dependencyForm.note"
            placeholder="例如：样板完成后即可开始板上验证"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        /></label>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-sm text-slate-500"
            @click="addDependencyOpen = false"
          >
            取消</button
          ><button
            :disabled="saving"
            class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            建立依赖
          </button>
        </div>
      </form></AppModal
    >
  </div>
</template>

<script setup lang="ts">
import type {
  Bug,
  Dependency,
  Requirement,
  Stage,
  StatusHistory,
  Version,
} from '@flowtrace/shared';
import { reviewRequirement } from '@flowtrace/shared';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  ArrowLeftIcon,
  BugAntIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  EllipsisHorizontalIcon,
  LinkIcon,
  PencilSquareIcon,
  PlusIcon,
  QueueListIcon,
  TrashIcon,
  UserPlusIcon,
} from '@heroicons/vue/24/outline';
import dayjs from 'dayjs';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import AppDateTimeField from '@/components/AppDateTimeField.vue';
import AppModal from '@/components/AppModal.vue';
import AppSelect from '@/components/AppSelect.vue';
import AvatarStack from '@/components/AvatarStack.vue';
import DeleteWorkItemDialog from '@/components/DeleteWorkItemDialog.vue';
import OwnerPicker from '@/components/OwnerPicker.vue';
import PlanningDialog from '@/components/PlanningDialog.vue';
import StatusHistoryCorrectionDialog from '@/components/StatusHistoryCorrectionDialog.vue';
import StatusUpdateDialog from '@/components/StatusUpdateDialog.vue';
import StagePlanEditor from '@/components/StagePlanEditor.vue';
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  healthLabels,
  lifecycleLabels,
  statusDot,
  statusLabels,
  statusTone,
} from '@/lib/presentation';
import { newStagePlanDraft, type StagePlanDraft } from '@/lib/stage-plan';
import { toasts } from '@/state/toasts';
import { loadWorkspace, workspace } from '@/state/workspace';

const route = useRoute();
const router = useRouter();
const id = computed(() => route.params.requirementId as string);

function returnToProject() {
  const state = window.history.state as {
    flowtraceReturnPath?: unknown;
    flowtraceReturnProjectId?: unknown;
  };
  if (
    typeof state.flowtraceReturnPath === 'string' &&
    state.flowtraceReturnProjectId === requirement.value?.projectId
  ) {
    router.back();
    return;
  }
  if (requirement.value)
    void router.push(`/projects/${requirement.value.projectId}`);
}
const requirement = ref<Requirement>();
const dependencies = ref<Dependency[]>([]);
const versions = ref<Version[]>([]);
const loading = ref(true);
const addBugOpen = ref(false);
const addDependencyOpen = ref(false);
const saving = ref(false);
const movingStageId = ref('');
const statusTarget = ref<Stage | Bug>();
const correctionTarget = ref<{
  history: StatusHistory;
  itemName: string;
}>();
const planningTarget = ref<Requirement | Stage | Bug>();
const ownerTarget = ref<Requirement | Stage | Bug>();
const deleteTarget = ref<Requirement | Stage | Bug>();
const deleting = ref(false);
const ownerForm = ref<string[]>([]);
const assigningOwners = ref(false);
const stageMaintenanceOpen = ref(false);
const savingStages = ref(false);
const stageMaintenanceReason = ref('');
const stageDrafts = ref<StagePlanDraft[]>([]);
const candidateRequirements = ref<
  Array<{ id: string; key: string; title: string; projectId: string }>
>([]);
const selectedPredecessor = ref<Requirement>();
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
const discoveredStageOptions = computed(() => [
  { value: '', label: '未指定阶段' },
  ...stageOptions.value.map((stage) => ({
    value: stage.id,
    label: stage.name,
  })),
]);
const targetVersionOptions = computed(() => [
  { value: '', label: '未排版本' },
  ...versions.value.map((version) => ({
    value: version.id,
    label: version.name,
  })),
]);
const predecessorRequirementOptions = computed(() => [
  { value: '', label: '选择另一个需求' },
  ...candidateRequirements.value.map((item) => ({
    value: item.id,
    label: `${
      workspace.projects.find((project) => project.id === item.projectId)
        ?.name ?? '未知项目'
    } / ${item.key} ${item.title}`,
  })),
]);
const predecessorStageOptions = computed(() => [
  { value: '', label: '依赖整个需求完成' },
  ...(selectedPredecessor.value?.stages ?? []).map((stage) => ({
    value: stage.id,
    label: stage.name,
    description: statusLabels[stage.status],
  })),
]);
const deleteConfirmation = computed(() => {
  const target = deleteTarget.value;
  if (!target) return '';
  if (target.id === requirement.value?.id) return requirement.value.key;
  return 'key' in target ? target.key : target.name;
});
const deleteLabel = computed(() => {
  const target = deleteTarget.value;
  if (!target) return '事项';
  if (target.id === requirement.value?.id)
    return `需求 ${requirement.value.key}`;
  return 'key' in target ? `Bug ${target.key}` : `阶段「${target.name}」`;
});
const events = computed(() => {
  if (!requirement.value) return [];
  const result: Array<{
    id: string;
    time: string;
    title: string;
    detail?: string;
    tone: string;
    correction?: { history: StatusHistory; itemName: string };
  }> = [];
  for (const stage of requirement.value.stages) {
    for (const history of stage.statusHistory) {
      result.push({
        id: history.id,
        time: history.effectiveAt,
        title: `${stage.name} → ${statusLabels[history.toStatus]}`,
        detail: history.reason || history.note,
        tone: statusDot[history.toStatus],
        correction: { history, itemName: stage.name },
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
        correction: { history, itemName: `${bug.key} ${bug.title}` },
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

const currentWork = computed<Array<Stage | Bug>>(() => {
  if (!requirement.value) return [];
  const priority = { blocked: 0, waiting: 1, in_progress: 2 } as const;
  return [...requirement.value.stages, ...requirement.value.bugs]
    .filter((item) =>
      ['blocked', 'waiting', 'in_progress'].includes(item.status),
    )
    .sort(
      (left, right) =>
        priority[left.status as keyof typeof priority] -
        priority[right.status as keyof typeof priority],
    );
});
const nextStage = computed(() =>
  requirement.value?.stages.find((item) => item.status === 'not_started'),
);

const reviewNotes = computed(() => {
  return requirement.value
    ? reviewRequirement(requirement.value).map((issue) => issue.message)
    : [];
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

function openOwners(item: Requirement | Stage | Bug) {
  ownerForm.value = [...item.ownerIds];
  ownerTarget.value = item;
}

async function saveOwners() {
  if (!ownerTarget.value) return;
  assigningOwners.value = true;
  try {
    const input = { ownerIds: ownerForm.value };
    if (ownerTarget.value.id === requirement.value?.id)
      await api.updateRequirement(ownerTarget.value.id, input);
    else if ('key' in ownerTarget.value)
      await api.updateBug(ownerTarget.value.id, input);
    else await api.updateStage(ownerTarget.value.id, input);
    ownerTarget.value = undefined;
    toasts.show(
      '负责人已更新',
      ownerForm.value.length
        ? `已分配 ${ownerForm.value.length} 人`
        : '已设为待分配',
    );
    await load();
  } catch (error) {
    toasts.show(
      '分配失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    assigningOwners.value = false;
  }
}

function stageDate(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD') : '';
}

function openStageMaintenance() {
  if (!requirement.value) return;
  stageDrafts.value = requirement.value.stages.map((stage) =>
    newStagePlanDraft({
      id: stage.id,
      name: stage.name,
      note: stage.note ?? '',
      ownerIds: [...stage.ownerIds],
      plannedStartAt: stageDate(stage.plannedStartAt),
      plannedEndAt: stageDate(stage.plannedEndAt),
    }),
  );
  stageMaintenanceReason.value = '';
  stageMaintenanceOpen.value = true;
}

function sameOwners(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

const stageMaintenanceValid = computed(() =>
  stageDrafts.value.every(
    (stage) =>
      Boolean(stage.name.trim()) &&
      (!stage.plannedStartAt ||
        !stage.plannedEndAt ||
        !dayjs(stage.plannedEndAt).isBefore(dayjs(stage.plannedStartAt))),
  ),
);

async function saveStageMaintenance() {
  if (!requirement.value || !stageMaintenanceValid.value) return;
  savingStages.value = true;
  const originals = new Map(
    requirement.value.stages.map((stage) => [stage.id, stage]),
  );
  const reason =
    stageMaintenanceReason.value.trim() || '在需求详情批量维护阶段';
  try {
    for (const [order, draft] of stageDrafts.value.entries()) {
      const plannedStartAt = draft.plannedStartAt
        ? dayjs(draft.plannedStartAt).startOf('day').toISOString()
        : null;
      const plannedEndAt = draft.plannedEndAt
        ? dayjs(draft.plannedEndAt).endOf('day').toISOString()
        : null;
      if (!draft.id) {
        await api.addStage(requirement.value.id, {
          name: draft.name.trim(),
          note: draft.note.trim(),
          ownerIds: draft.ownerIds,
          order,
          plannedStartAt: plannedStartAt ?? undefined,
          plannedEndAt: plannedEndAt ?? undefined,
          reason,
        });
        continue;
      }

      const original = originals.get(draft.id);
      if (!original) continue;
      if (
        draft.name.trim() !== original.name ||
        draft.note.trim() !== (original.note ?? '') ||
        !sameOwners(draft.ownerIds, original.ownerIds) ||
        order !== original.order
      ) {
        await api.updateStage(draft.id, {
          name: draft.name.trim(),
          note: draft.note.trim(),
          ownerIds: draft.ownerIds,
          order,
          reason,
        });
      }
      if (
        draft.plannedStartAt !== stageDate(original.plannedStartAt) ||
        draft.plannedEndAt !== stageDate(original.plannedEndAt)
      ) {
        await api.rescheduleStage(draft.id, {
          plannedStartAt,
          plannedEndAt,
          reason,
        });
      }
    }
    await load();
    stageMaintenanceOpen.value = false;
    toasts.show(
      '阶段已统一保存',
      `${stageDrafts.value.length} 个阶段的资料与计划已核对`,
    );
  } catch (error) {
    await load();
    toasts.show(
      '保存未全部完成',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    savingStages.value = false;
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

async function removeWorkItem(input: { confirmation: string; reason: string }) {
  const target = deleteTarget.value;
  if (!target || !requirement.value) return;
  deleting.value = true;
  try {
    if (target.id === requirement.value.id) {
      const projectId = requirement.value.projectId;
      await api.deleteRequirement(target.id, input);
      toasts.show('需求已删除', '过程与删除审计仍已保留');
      await router.push(`/projects/${projectId}`);
      return;
    }
    if ('key' in target) await api.deleteBug(target.id, input);
    else await api.deleteStage(target.id, input);
    deleteTarget.value = undefined;
    toasts.show('事项已删除', '默认视图不再显示，历史审计仍已保留');
    await load();
  } catch (error) {
    toasts.show(
      '删除失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    deleting.value = false;
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
        <button
          type="button"
          class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-600"
          @click="returnToProject"
        >
          <ArrowLeftIcon class="h-3.5 w-3.5" />返回 {{ project?.name }}
        </button>
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
            <button
              class="focus-ring flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-slate-500 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600"
              aria-label="分配需求负责人"
              title="分配需求负责人"
              @click="openOwners(requirement)"
            >
              <UserPlusIcon class="h-3.5 w-3.5" />
              <span class="hidden text-[10px] font-semibold sm:inline"
                >需求负责人</span
              >
              <AvatarStack :owner-ids="requirement.ownerIds" :max="5" compact />
            </button>
            <Menu as="div" class="relative shrink-0">
              <MenuButton
                class="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:text-slate-700"
                aria-label="需求的更多操作"
              >
                <EllipsisHorizontalIcon class="h-5 w-5" />
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
                  class="absolute right-0 z-30 mt-1.5 w-36 origin-top-right rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl outline-none"
                >
                  <MenuItem v-slot="{ active }">
                    <button
                      class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-600 transition"
                      :class="active ? 'bg-rose-50' : ''"
                      @click="deleteTarget = requirement"
                    >
                      <TrashIcon class="h-4 w-4" />删除需求
                    </button>
                  </MenuItem>
                </MenuItems>
              </Transition>
            </Menu>
          </div>
        </div>
      </div>

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div class="min-w-0 space-y-5">
          <section class="surface p-4 sm:p-5">
            <div
              class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <h2 class="text-sm font-semibold text-slate-900">当前工作</h2>
                <p class="mt-0.5 text-[11px] text-slate-400">
                  先处理正在推进、等待和阻塞的事项
                </p>
              </div>
              <button
                v-if="!currentWork.length && nextStage"
                type="button"
                class="focus-ring section-action"
                @click="statusTarget = nextStage"
              >
                开始「{{ nextStage.name }}」
              </button>
            </div>
            <div
              v-if="currentWork.length"
              class="mt-3 grid gap-2 sm:grid-cols-2"
            >
              <button
                v-for="item in currentWork"
                :key="item.id"
                type="button"
                class="focus-ring flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-left transition hover:border-indigo-200 hover:bg-white"
                @click="statusTarget = item"
              >
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  :class="statusDot[item.status]"
                />
                <span class="min-w-0 flex-1">
                  <span
                    class="block truncate text-xs font-semibold text-slate-700"
                    >{{
                      'key' in item ? `${item.key} ${item.title}` : item.name
                    }}</span
                  >
                  <span
                    class="mt-0.5 block truncate text-[10px] text-slate-400"
                    >{{ item.statusReason || statusLabels[item.status] }}</span
                  >
                </span>
                <AvatarStack :owner-ids="item.ownerIds" :max="2" compact />
                <span
                  class="text-[10px] font-semibold"
                  :class="
                    item.status === 'blocked'
                      ? 'text-rose-600'
                      : item.status === 'waiting'
                        ? 'text-amber-600'
                        : 'text-indigo-600'
                  "
                  >{{ statusLabels[item.status] }}</span
                >
              </button>
            </div>
            <p
              v-else
              class="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500"
            >
              {{
                nextStage
                  ? `下一步是「${nextStage.name}」`
                  : '当前没有需要推进的事项'
              }}
            </p>
            <div
              v-if="reviewNotes.length"
              class="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2.5"
            >
              <p class="text-[10px] font-semibold text-indigo-700">
                本次检查还需确认
              </p>
              <p class="mt-1 text-[11px] leading-5 text-indigo-600/80">
                {{ reviewNotes.join(' · ') }}
              </p>
            </div>
          </section>

          <section class="surface relative z-20">
            <div
              class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:items-center"
            >
              <div class="min-w-0">
                <h2 class="text-sm font-semibold text-slate-900">实际过程</h2>
                <p class="mt-0.5 text-[11px] text-slate-400">
                  推进时点击阶段记录状态；整理资料时可一次维护整组阶段
                </p>
              </div>
              <button
                type="button"
                class="focus-ring section-action"
                @click="
                  stageMaintenanceOpen
                    ? (stageMaintenanceOpen = false)
                    : openStageMaintenance()
                "
              >
                <PencilSquareIcon
                  v-if="!stageMaintenanceOpen"
                  class="h-3.5 w-3.5"
                />
                {{ stageMaintenanceOpen ? '退出编辑' : '维护阶段' }}
              </button>
            </div>
            <form
              v-if="stageMaintenanceOpen"
              class="space-y-4 p-4 sm:p-5"
              @submit.prevent="saveStageMaintenance"
            >
              <StagePlanEditor
                v-model="stageDrafts"
                :people="workspace.people"
                :default-start-at="stageDate(requirement.plannedStartAt)"
                :default-end-at="stageDate(requirement.plannedEndAt)"
              />
              <div
                class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:flex-row sm:items-end sm:justify-between"
              >
                <div class="min-w-0">
                  <p class="text-[11px] font-semibold text-slate-600">
                    本次维护会统一保存名称、顺序、负责人和计划
                  </p>
                  <p class="mt-1 text-[10px] leading-4 text-slate-400">
                    已有阶段的删除仍从更多操作单独确认，避免误删历史记录。
                  </p>
                </div>
                <label class="block min-w-0 sm:w-80">
                  <span
                    class="mb-1.5 block text-[10px] font-medium text-slate-500"
                    >维护说明（可选）</span
                  >
                  <input
                    v-model="stageMaintenanceReason"
                    placeholder="例如：按评审结论补齐负责人和排期"
                    class="focus-ring w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-300"
                  />
                </label>
              </div>
              <p
                v-if="!stageMaintenanceValid"
                class="text-right text-[11px] font-medium text-rose-500"
              >
                请填写阶段名称，并确保结束日期不早于开始日期。
              </p>
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="focus-ring rounded-xl px-4 py-2.5 text-sm text-slate-500 transition hover:bg-slate-100"
                  @click="stageMaintenanceOpen = false"
                >
                  取消
                </button>
                <button
                  :disabled="savingStages || !stageMaintenanceValid"
                  class="focus-ring rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {{ savingStages ? '保存中…' : '保存全部阶段' }}
                </button>
              </div>
            </form>
            <div v-else class="px-4 py-3 sm:px-5">
              <div
                class="relative space-y-1 before:absolute before:bottom-6 before:left-[20px] before:top-6 before:w-px before:bg-slate-200"
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
                    <div class="hidden min-w-36 text-right sm:block">
                      <p class="text-[10px] text-slate-400">
                        {{
                          formatDateRange(
                            stage.plannedStartAt,
                            stage.plannedEndAt,
                          )
                        }}
                      </p>
                      <p
                        v-if="stage.actualStartAt"
                        class="mt-0.5 text-[10px] text-slate-500"
                      >
                        实际 {{ formatDate(stage.actualStartAt) }} →
                        {{ formatDate(stage.actualEndAt, '至今') }}
                      </p>
                    </div>
                    <AvatarStack
                      v-if="stage.ownerIds.length"
                      :owner-ids="stage.ownerIds"
                      :max="2"
                      compact
                    />
                    <span
                      v-else
                      class="hidden shrink-0 text-[10px] text-slate-300 sm:inline"
                      >待分配</span
                    >
                    <span
                      class="rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1"
                      :class="statusTone[stage.status]"
                      >{{ statusLabels[stage.status] }}</span
                    >
                  </button>
                  <Menu as="div" class="relative mr-1 shrink-0">
                    <MenuButton
                      class="focus-ring grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
                      :aria-label="`${stage.name}的更多操作`"
                    >
                      <EllipsisHorizontalIcon class="h-5 w-5" />
                    </MenuButton>
                    <MenuItems
                      class="absolute right-0 top-9 z-40 w-44 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl outline-none"
                    >
                      <MenuItem v-slot="{ active }">
                        <button
                          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-600"
                          :class="active ? 'bg-slate-50 text-indigo-600' : ''"
                          @click="openOwners(stage)"
                        >
                          <UserPlusIcon class="h-4 w-4" />分配负责人
                        </button>
                      </MenuItem>
                      <MenuItem v-slot="{ active }">
                        <button
                          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-600"
                          :class="active ? 'bg-slate-50 text-indigo-600' : ''"
                          @click="planningTarget = stage"
                        >
                          <CalendarDaysIcon class="h-4 w-4" />调整计划
                        </button>
                      </MenuItem>
                      <div class="my-1 h-px bg-slate-100" />
                      <MenuItem
                        v-slot="{ active, disabled }"
                        :disabled="index === 0"
                      >
                        <button
                          :disabled="disabled || movingStageId === stage.id"
                          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-600 disabled:opacity-30"
                          :class="active ? 'bg-slate-50 text-indigo-600' : ''"
                          @click="moveStage(stage, index, -1)"
                        >
                          <ChevronUpIcon class="h-4 w-4" />上移阶段
                        </button>
                      </MenuItem>
                      <MenuItem
                        v-slot="{ active, disabled }"
                        :disabled="index === requirement.stages.length - 1"
                      >
                        <button
                          :disabled="disabled || movingStageId === stage.id"
                          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-600 disabled:opacity-30"
                          :class="active ? 'bg-slate-50 text-indigo-600' : ''"
                          @click="moveStage(stage, index, 1)"
                        >
                          <ChevronDownIcon class="h-4 w-4" />下移阶段
                        </button>
                      </MenuItem>
                      <div class="my-1 h-px bg-slate-100" />
                      <MenuItem v-slot="{ active }">
                        <button
                          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-600"
                          :class="active ? 'bg-rose-50' : ''"
                          @click="deleteTarget = stage"
                        >
                          <TrashIcon class="h-4 w-4" />删除阶段
                        </button>
                      </MenuItem>
                    </MenuItems>
                  </Menu>
                </div>
              </div>
            </div>
          </section>

          <section class="surface relative z-10">
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
                    v-if="bug.ownerIds.length"
                    :owner-ids="bug.ownerIds"
                    :max="2"
                    compact
                  /><span
                    v-else
                    class="hidden shrink-0 text-[10px] text-slate-300 sm:inline"
                    >待分配</span
                  ><span class="text-[10px] font-medium text-slate-500">{{
                    statusLabels[bug.status]
                  }}</span>
                </button>
                <Menu as="div" class="relative ml-2 shrink-0">
                  <MenuButton
                    class="focus-ring grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                    :aria-label="`${bug.key}的更多操作`"
                  >
                    <EllipsisHorizontalIcon class="h-5 w-5" />
                  </MenuButton>
                  <MenuItems
                    class="absolute right-0 top-9 z-40 w-44 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl outline-none"
                  >
                    <MenuItem v-slot="{ active }">
                      <button
                        class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-600"
                        :class="active ? 'bg-slate-50 text-indigo-600' : ''"
                        @click="openOwners(bug)"
                      >
                        <UserPlusIcon class="h-4 w-4" />分配负责人
                      </button>
                    </MenuItem>
                    <MenuItem v-slot="{ active }">
                      <button
                        class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-600"
                        :class="active ? 'bg-slate-50 text-indigo-600' : ''"
                        @click="planningTarget = bug"
                      >
                        <CalendarDaysIcon class="h-4 w-4" />调整计划
                      </button>
                    </MenuItem>
                    <div class="my-1 h-px bg-slate-100" />
                    <MenuItem v-slot="{ active }">
                      <button
                        class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-600"
                        :class="active ? 'bg-rose-50' : ''"
                        @click="deleteTarget = bug"
                      >
                        <TrashIcon class="h-4 w-4" />删除 Bug
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Menu>
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
                    {{
                      formatDateRange(
                        requirement.baselineStartAt,
                        requirement.baselineEndAt,
                      )
                    }}
                  </p>
                </div>
              </div>
              <div class="flex gap-3">
                <ClockIcon class="h-4 w-4 text-violet-500" />
                <div>
                  <p class="text-[10px] text-slate-400">当前计划</p>
                  <p class="mt-0.5 text-xs font-medium text-slate-700">
                    {{
                      formatDateRange(
                        requirement.plannedStartAt,
                        requirement.plannedEndAt,
                      )
                    }}
                  </p>
                </div>
              </div>
              <div class="flex gap-3">
                <QueueListIcon class="h-4 w-4 text-emerald-500" />
                <div>
                  <p class="text-[10px] text-slate-400">实际跨度</p>
                  <p class="mt-0.5 text-xs font-medium text-slate-700">
                    {{
                      formatDateRange(
                        requirement.actualStartAt,
                        requirement.actualEndAt,
                        { empty: '尚未开始', openEnd: '至今' },
                      )
                    }}
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
                class="group/history relative border-l border-slate-200 py-2 pl-4"
              >
                <span
                  class="absolute -left-[4.5px] top-4 h-2 w-2 rounded-full"
                  :class="event.tone"
                />
                <div class="flex items-start gap-2">
                  <div class="min-w-0 flex-1">
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
                  <button
                    v-if="event.correction"
                    type="button"
                    class="focus-ring rounded-lg p-1.5 text-slate-300 opacity-60 transition hover:bg-violet-50 hover:text-violet-600 focus:opacity-100 sm:opacity-0 sm:group-hover/history:opacity-100"
                    :aria-label="`修正历史记录：${event.title}`"
                    title="修正这条历史记录"
                    @click="correctionTarget = event.correction"
                  >
                    <PencilSquareIcon class="h-3.5 w-3.5" />
                  </button>
                </div>
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
      :actual-start-at="statusTarget.actualStartAt"
      :status-reason="statusTarget.statusReason"
      :expected-resume-at="statusTarget.expectedResumeAt"
      :owner-ids="statusTarget.ownerIds"
      :people="workspace.people"
      @close="statusTarget = undefined"
      @saved="load"
    />

    <StatusHistoryCorrectionDialog
      v-if="correctionTarget"
      :open="Boolean(correctionTarget)"
      :item-name="correctionTarget.itemName"
      :history="correctionTarget.history"
      @close="correctionTarget = undefined"
      @saved="load"
    />

    <DeleteWorkItemDialog
      :open="Boolean(deleteTarget)"
      :item-label="deleteLabel"
      :confirmation-text="deleteConfirmation"
      :saving="deleting"
      @close="deleteTarget = undefined"
      @confirm="removeWorkItem"
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
      :open="Boolean(ownerTarget)"
      :title="
        ownerTarget?.id === requirement?.id
          ? '分配需求负责人'
          : '分配执行负责人'
      "
      :description="
        ownerTarget?.id === requirement?.id
          ? '这里记录需求的整体协调人。'
          : '负责人分配与实际进展分开记录，不会追加状态历史。'
      "
      @close="ownerTarget = undefined"
    >
      <form class="space-y-4" @submit.prevent="saveOwners">
        <OwnerPicker v-model="ownerForm" :people="workspace.people" />
        <div class="flex items-center justify-between gap-3 pt-2">
          <p class="text-[10px] text-slate-400">
            {{ ownerForm.length ? `已选择 ${ownerForm.length} 人` : '待分配' }}
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-xl px-4 py-2 text-sm text-slate-500"
              @click="ownerTarget = undefined"
            >
              取消</button
            ><button
              :disabled="assigningOwners"
              class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {{ assigningOwners ? '保存中…' : '保存分配' }}
            </button>
          </div>
        </div>
      </form>
    </AppModal>

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
          ><AppSelect
            v-model="bugForm.discoveredStageId"
            :options="discoveredStageOptions"
        /></label>
        <div class="grid grid-cols-2 gap-3">
          <label
            ><span class="mb-1.5 block text-xs font-medium text-slate-600"
              >目标版本</span
            ><AppSelect
              v-model="bugForm.targetVersionId"
              :options="targetVersionOptions" /></label
          ><label
            ><span class="mb-1.5 block text-xs font-medium text-slate-600"
              >计划开始</span
            ><AppDateTimeField v-model="bugForm.plannedStartAt"
          /></label>
        </div>
        <label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >计划结束</span
          ><AppDateTimeField
            v-model="bugForm.plannedEndAt"
            :min="bugForm.plannedStartAt"
        /></label>
        <fieldset>
          <legend class="mb-2 text-xs font-medium text-slate-600">
            负责人
          </legend>
          <OwnerPicker v-model="bugForm.ownerIds" :people="workspace.people" />
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
          ><AppSelect
            v-model="dependencyForm.predecessorRequirementId"
            :options="predecessorRequirementOptions"
            @update:model-value="selectPredecessor" /></label
        ><label v-if="selectedPredecessor" class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >具体前置阶段（推荐）</span
          ><AppSelect
            v-model="dependencyForm.predecessorStageId"
            :options="predecessorStageOptions" /></label
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

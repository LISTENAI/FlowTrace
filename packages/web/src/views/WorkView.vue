<script setup lang="ts">
import type {
  AttentionItem,
  ActionItem,
  Person,
  PersonWorkItem,
  PersonWorkOverview,
} from '@flowtrace/shared';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from '@heroicons/vue/24/outline';
import dayjs from 'dayjs';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { currentIdentity } from '@/auth';
import ActionItemDialog from '@/components/ActionItemDialog.vue';
import AppModal from '@/components/AppModal.vue';
import AvatarStack from '@/components/AvatarStack.vue';
import OwnerPicker from '@/components/OwnerPicker.vue';
import PersonSelect from '@/components/PersonSelect.vue';
import PlanningDialog from '@/components/PlanningDialog.vue';
import StatusUpdateDialog from '@/components/StatusUpdateDialog.vue';
import TimelineItemActionsMenu from '@/components/TimelineItemActionsMenu.vue';
import { formatDate, statusDot, statusLabels } from '@/lib/presentation';
import { toasts } from '@/state/toasts';
import { loadWorkspace, workspace } from '@/state/workspace';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const attentionExpanded = ref(false);
const selectedPersonId = ref('');
const ownPersonId = ref('');
const selectablePeople = ref<Person[]>([]);
const overview = ref<PersonWorkOverview>();
const windowStart = ref(dayjs().startOf('week').subtract(7, 'day'));
const showCompleted = ref(false);
const actionDialogOpen = ref(false);
const actionTarget = ref<ActionItem>();
const planningTarget = ref<PersonWorkItem>();
const statusTarget = ref<PersonWorkItem>();
const ownerTarget = ref<PersonWorkItem>();
const ownerForm = ref<string[]>([]);
const savingOwners = ref(false);
const dayCount = 42;
const dayWidth = 34;

const days = computed(() =>
  Array.from({ length: dayCount }, (_, index) =>
    windowStart.value.add(index, 'day'),
  ),
);
const windowEnd = computed(() => windowStart.value.add(dayCount - 1, 'day'));
const visibleItems = computed(() =>
  (overview.value?.items ?? []).filter(
    (item) =>
      showCompleted.value || !['done', 'canceled'].includes(item.status),
  ),
);
const currentPerson = computed(() => overview.value?.person);
const isMine = computed(() => selectedPersonId.value === ownPersonId.value);
const dateGridStyle = computed(() => ({
  width: `${dayCount * dayWidth}px`,
  minWidth: `${dayCount * dayWidth}px`,
  backgroundSize: `${dayWidth}px 100%`,
}));

function itemTypeLabel(item: PersonWorkItem) {
  return item.type === 'stage' ? '阶段' : item.type === 'bug' ? 'Bug' : '待办';
}

function itemTypeClass(item: PersonWorkItem) {
  return item.type === 'stage'
    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300'
    : item.type === 'bug'
      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300'
      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
}

function contextLabel(item: PersonWorkItem) {
  if (item.requirement)
    return `${item.project?.key ?? ''} · ${item.requirement.key} ${item.requirement.title}`;
  if (item.project) return `${item.project.key} · ${item.project.name}`;
  return '未归入项目';
}

function rangeStyle(start?: string, end?: string) {
  const point = start ?? end;
  if (!point) return;
  const rangeStart = dayjs(start ?? point).startOf('day');
  const rangeEnd = dayjs(end ?? point).startOf('day');
  if (
    rangeEnd.isBefore(windowStart.value) ||
    rangeStart.isAfter(windowEnd.value)
  )
    return;
  const clippedStart = rangeStart.isBefore(windowStart.value)
    ? windowStart.value
    : rangeStart;
  const clippedEnd = rangeEnd.isAfter(windowEnd.value)
    ? windowEnd.value
    : rangeEnd;
  return {
    left: `${clippedStart.diff(windowStart.value, 'day') * dayWidth + 3}px`,
    width: `${Math.max(dayWidth - 6, (clippedEnd.diff(clippedStart, 'day') + 1) * dayWidth - 6)}px`,
  };
}

function actualRange(item: PersonWorkItem) {
  const firstHistory = item.statusHistory[0]?.effectiveAt;
  const lastHistory = item.statusHistory.at(-1)?.effectiveAt;
  const start = item.actualStartAt ?? item.actualEndAt ?? firstHistory;
  if (!start) return;
  const open = ['in_progress', 'waiting', 'blocked'].includes(item.status);
  return {
    start,
    end:
      item.actualEndAt ??
      (open ? dayjs().toISOString() : (lastHistory ?? start)),
  };
}

function planTooltip(item: PersonWorkItem) {
  if (!item.plannedStartAt && !item.plannedEndAt) return '尚未排期';
  return `当前计划：${formatDate(item.plannedStartAt)} — ${formatDate(item.plannedEndAt)}`;
}

function planOutsidePosition(item: PersonWorkItem) {
  const point = item.plannedStartAt ?? item.plannedEndAt;
  return point && dayjs(point).isAfter(windowEnd.value) ? 'right-3' : 'left-3';
}

function planOutsideLabel(item: PersonWorkItem) {
  const point = item.plannedStartAt ?? item.plannedEndAt;
  if (!point) return '未排期';
  return dayjs(point).isAfter(windowEnd.value) ? '计划在此后' : '计划在此前';
}

async function load() {
  if (!selectedPersonId.value) return;
  loading.value = true;
  try {
    overview.value = await api.personWork(selectedPersonId.value);
  } catch (error) {
    toasts.show(
      '读取工作安排失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    loading.value = false;
  }
}

async function selectPerson(id: string) {
  if (!id) return;
  await router.replace({
    name: 'work',
    query: id === ownPersonId.value ? {} : { person: id },
  });
}

function weekdayLabel(day: number) {
  return ['日', '一', '二', '三', '四', '五', '六'][day];
}

function openOwners(item: PersonWorkItem) {
  ownerForm.value = [...item.ownerIds];
  ownerTarget.value = item;
}

async function saveOwners() {
  if (!ownerTarget.value) return;
  savingOwners.value = true;
  try {
    const item = ownerTarget.value;
    if (item.type === 'stage')
      await api.updateStage(item.id, { ownerIds: ownerForm.value });
    else if (item.type === 'bug')
      await api.updateBug(item.id, { ownerIds: ownerForm.value });
    else await api.updateActionItem(item.id, { ownerIds: ownerForm.value });
    ownerTarget.value = undefined;
    toasts.show('负责人已更新');
    await load();
  } catch (error) {
    toasts.show(
      '分配失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    savingOwners.value = false;
  }
}

async function editAction(item: PersonWorkItem) {
  actionTarget.value = await api.actionItem(item.id);
  actionDialogOpen.value = true;
}

function openDetail(item: PersonWorkItem) {
  if (!item.requirement) return;
  void router.push({
    name: 'requirement',
    params: { requirementId: item.requirement.id },
    state: { flowtraceReturnPath: route.fullPath },
  });
}

async function openAttention(item: AttentionItem) {
  if (item.targetType === 'action_item') {
    actionTarget.value = await api.actionItem(item.targetId);
    actionDialogOpen.value = true;
  } else if (item.requirementId) {
    await router.push({
      name: 'requirement',
      params: { requirementId: item.requirementId },
      state: { flowtraceReturnPath: route.fullPath },
    });
  }
}

function newAction() {
  actionTarget.value = undefined;
  actionDialogOpen.value = true;
}

function resetToToday() {
  windowStart.value = dayjs().startOf('week').subtract(7, 'day');
}

watch(selectedPersonId, (id, oldId) => {
  if (oldId && id !== oldId) void selectPerson(id);
});

onMounted(async () => {
  const [, identity] = await Promise.all([loadWorkspace(), currentIdentity()]);
  ownPersonId.value = identity.person.id;
  const requested = String(route.query.person ?? '');
  selectablePeople.value = [...workspace.people];
  if (
    requested &&
    !selectablePeople.value.some((person) => person.id === requested)
  ) {
    const requestedPerson = (await api.people(true)).find(
      (person) => person.id === requested,
    );
    if (requestedPerson) selectablePeople.value.push(requestedPerson);
  }
  selectedPersonId.value = selectablePeople.value.some(
    (person) => person.id === requested,
  )
    ? requested
    : identity.person.id;
  await load();
});
</script>

<template>
  <div class="px-4 py-7 sm:px-7 lg:px-9 lg:py-9">
    <div class="mx-auto max-w-[110rem]">
      <header
        class="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"
      >
        <div>
          <div
            class="mb-2 flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-300"
          >
            <CalendarDaysIcon class="h-4 w-4" />跨项目工作安排
          </div>
          <h1
            class="text-2xl font-semibold tracking-[-.035em] text-slate-900 dark:text-white sm:text-3xl"
          >
            {{ isMine ? '我的工作' : `${currentPerson?.name ?? ''}的工作` }}
          </h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            汇总阶段、Bug 和零碎待办；没有记录不代表人员空闲。
          </p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <PersonSelect v-model="selectedPersonId" :people="selectablePeople" />
          <button
            class="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 dark:bg-indigo-500"
            @click="newAction"
          >
            <PlusIcon class="h-4 w-4" />新增待办
          </button>
        </div>
      </header>

      <section
        v-if="overview && !loading"
        class="surface mt-6 p-4 sm:p-5"
        aria-label="需要关注"
      >
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
            需要关注 · {{ overview.attention.length }}
          </h2>
          <button
            v-if="overview.attention.length > 5"
            class="section-action"
            @click="attentionExpanded = !attentionExpanded"
          >
            {{ attentionExpanded ? '收起' : '查看全部' }}
          </button>
        </div>
        <p class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          按预计恢复已过、阻塞、计划逾期与待确认事实排序。更新原事项后自动重新核对。
        </p>
        <p
          v-if="!overview.attention.length"
          class="mt-3 text-sm text-slate-500 dark:text-slate-400"
        >
          当前没有需要提醒的记录；未排期不表示人员空闲。
        </p>
        <ul v-else class="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          <li
            v-for="item in attentionExpanded
              ? overview.attention
              : overview.attention.slice(0, 5)"
            :key="item.id"
            class="flex items-start justify-between gap-3 py-3"
          >
            <div class="min-w-0">
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ item.role === 'execution' ? '执行事项' : '协调职责' }} ·
                {{ item.context ?? '零碎待办' }}
              </p>
              <button
                class="mt-1 text-left text-sm font-medium text-indigo-600 dark:text-indigo-300"
                @click="openAttention(item)"
              >
                {{ item.label }}
              </button>
              <p
                v-for="reason in item.reasons"
                :key="reason.code"
                class="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300"
              >
                {{ reason.message }}
              </p>
            </div>
            <button
              class="section-action shrink-0"
              @click="openAttention(item)"
            >
              处理
            </button>
          </li>
        </ul>
      </section>

      <section class="surface mt-7 overflow-hidden">
        <div
          class="flex flex-col justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:px-5"
        >
          <div class="flex items-center gap-2">
            <button
              v-tooltip="'向前两周'"
              class="focus-ring grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              @click="windowStart = windowStart.subtract(14, 'day')"
            >
              <ChevronLeftIcon class="h-4 w-4" />
            </button>
            <button
              class="focus-ring rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              @click="resetToToday"
            >
              今天
            </button>
            <button
              v-tooltip="'向后两周'"
              class="focus-ring grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              @click="windowStart = windowStart.add(14, 'day')"
            >
              <ChevronRightIcon class="h-4 w-4" />
            </button>
            <span class="ml-1 text-xs text-slate-400">
              {{ windowStart.format('M月D日') }} —
              {{ windowEnd.format('M月D日') }}
            </span>
          </div>
          <label
            class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
          >
            <input
              v-model="showCompleted"
              type="checkbox"
              class="accent-indigo-600"
            />显示已完成和已取消
          </label>
        </div>

        <div v-if="loading" class="space-y-3 p-5">
          <div
            v-for="index in 4"
            :key="index"
            class="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
          />
        </div>
        <div v-else-if="!visibleItems.length" class="px-5 py-16 text-center">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">
            没有已记录的工作安排
          </p>
          <p class="mt-1 text-xs text-slate-400">
            可以新增一条待办，或为项目中的阶段和 Bug 分配负责人。
          </p>
        </div>
        <div v-else class="overflow-x-auto">
          <div class="min-w-[70rem]">
            <div
              class="grid grid-cols-[15rem_minmax(0,1fr)] sm:grid-cols-[22rem_minmax(0,1fr)] border-b border-slate-100 dark:border-slate-800"
            >
              <div
                class="sticky left-0 z-20 flex h-12 items-center border-r border-slate-100 bg-slate-50/95 px-4 text-[11px] font-semibold text-slate-400 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
              >
                工作事项
              </div>
              <div
                class="relative flex h-12 bg-slate-50/80 dark:bg-slate-900/70"
                :style="dateGridStyle"
              >
                <div
                  v-for="date in days"
                  :key="date.format('YYYY-MM-DD')"
                  class="flex shrink-0 flex-col items-center justify-center border-r border-slate-100 text-[9px] text-slate-400 dark:border-slate-800"
                  :class="
                    date.isSame(dayjs(), 'day')
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : ''
                  "
                  :style="{ width: `${dayWidth}px` }"
                >
                  <span>{{ weekdayLabel(date.day()) }}</span>
                  <span class="mt-0.5 font-semibold">{{ date.date() }}</span>
                </div>
              </div>
            </div>
            <div
              v-for="item in visibleItems"
              :key="`${item.type}-${item.id}`"
              class="grid grid-cols-[15rem_minmax(0,1fr)] sm:grid-cols-[22rem_minmax(0,1fr)] border-b border-slate-100 last:border-b-0 dark:border-slate-800"
            >
              <div
                class="sticky left-0 z-10 flex h-16 min-w-0 items-center gap-2 border-r border-slate-100 bg-white px-3.5 dark:border-slate-800 dark:bg-slate-950"
              >
                <button
                  v-tooltip="`记录进展：${statusLabels[item.status]}`"
                  class="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  @click="statusTarget = item"
                >
                  <span
                    class="h-2.5 w-2.5 rounded-full"
                    :class="statusDot[item.status]"
                  />
                </button>
                <button
                  class="min-w-0 flex-1 text-left"
                  @click="
                    item.type === 'action_item'
                      ? editAction(item)
                      : openDetail(item)
                  "
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <span
                      class="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
                      :class="itemTypeClass(item)"
                      >{{ itemTypeLabel(item) }}</span
                    >
                    <span
                      v-if="item.key"
                      class="shrink-0 font-mono text-[10px] font-semibold text-indigo-500"
                      >{{ item.key }}</span
                    >
                    <span
                      v-tooltip="item.name"
                      class="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-100"
                      >{{ item.name }}</span
                    >
                  </div>
                  <p class="mt-1 truncate text-[10px] text-slate-400">
                    {{ contextLabel(item) }}
                  </p>
                </button>
                <AvatarStack
                  :owner-ids="item.ownerIds"
                  :max="1"
                  compact
                  class="shrink-0"
                />
                <TimelineItemActionsMenu
                  :label="item.name"
                  :allow-edit="item.type === 'action_item'"
                  :allow-detail="
                    item.type !== 'action_item' && Boolean(item.requirement)
                  "
                  @edit="editAction(item)"
                  @owners="openOwners(item)"
                  @planning="planningTarget = item"
                  @detail="openDetail(item)"
                />
              </div>
              <div
                class="person-work-grid relative h-16"
                :style="dateGridStyle"
              >
                <button
                  v-if="rangeStyle(item.plannedStartAt, item.plannedEndAt)"
                  v-tooltip="planTooltip(item)"
                  class="focus-ring absolute top-[18px] h-3 rounded-full bg-indigo-300 shadow-sm transition hover:bg-indigo-400 dark:bg-indigo-500/70 dark:hover:bg-indigo-400"
                  :style="rangeStyle(item.plannedStartAt, item.plannedEndAt)"
                  @click="planningTarget = item"
                />
                <button
                  v-else
                  class="focus-ring absolute top-[18px] rounded-md bg-slate-100 px-2 py-1 text-[9px] font-medium text-slate-400 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                  :class="planOutsidePosition(item)"
                  @click="planningTarget = item"
                >
                  {{ planOutsideLabel(item) }}
                </button>
                <button
                  v-if="
                    actualRange(item) &&
                    rangeStyle(actualRange(item)?.start, actualRange(item)?.end)
                  "
                  v-tooltip="`实际进展：${statusLabels[item.status]}`"
                  class="focus-ring absolute top-[38px] h-1.5 rounded-full"
                  :class="statusDot[item.status]"
                  :style="
                    rangeStyle(actualRange(item)?.start, actualRange(item)?.end)
                  "
                  @click="statusTarget = item"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="overview?.coordinatedRequirements.length"
        class="surface mt-5 p-5"
      >
        <div class="flex items-baseline justify-between gap-4">
          <div>
            <h2
              class="text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              协调中的需求
            </h2>
            <p class="mt-0.5 text-xs text-slate-400">
              这些是协调职责，不计作整段时间占用。
            </p>
          </div>
          <span class="text-xs font-semibold text-slate-400"
            >{{ overview.coordinatedRequirements.length }} 项</span
          >
        </div>
        <div class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <button
            v-for="requirement in overview.coordinatedRequirements"
            :key="requirement.id"
            class="focus-ring rounded-xl border border-slate-100 px-3.5 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/30"
            @click="
              router.push({
                name: 'requirement',
                params: { requirementId: requirement.id },
                state: { flowtraceReturnPath: route.fullPath },
              })
            "
          >
            <div class="flex items-center gap-2">
              <span
                class="font-mono text-[10px] font-semibold text-indigo-500"
                >{{ requirement.key }}</span
              >
              <span
                class="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700 dark:text-slate-200"
                >{{ requirement.title }}</span
              >
            </div>
            <p class="mt-1 truncate text-[10px] text-slate-400">
              {{ requirement.project.name
              }}{{
                requirement.version ? ` · ${requirement.version.name}` : ''
              }}
            </p>
          </button>
        </div>
      </section>
    </div>

    <ActionItemDialog
      :open="actionDialogOpen"
      :item="actionTarget"
      :default-owner-id="selectedPersonId"
      :people="workspace.people"
      :projects="workspace.projects"
      @close="actionDialogOpen = false"
      @saved="load"
    />
    <PlanningDialog
      v-if="planningTarget"
      :open="Boolean(planningTarget)"
      :item-id="planningTarget.id"
      :item-type="planningTarget.type"
      :item-name="planningTarget.name"
      :planned-start-at="planningTarget.plannedStartAt"
      :planned-end-at="planningTarget.plannedEndAt"
      @close="planningTarget = undefined"
      @saved="load"
    />
    <StatusUpdateDialog
      v-if="statusTarget"
      :open="Boolean(statusTarget)"
      :item-id="statusTarget.id"
      :item-type="statusTarget.type"
      :item-name="statusTarget.name"
      :current-status="statusTarget.status"
      :actual-start-at="statusTarget.actualStartAt"
      :status-reason="statusTarget.statusReason"
      :expected-resume-at="statusTarget.expectedResumeAt"
      :owner-ids="statusTarget.ownerIds"
      :people="workspace.people"
      :status-history="statusTarget.statusHistory"
      @close="statusTarget = undefined"
      @saved="load"
    />
    <AppModal
      :open="Boolean(ownerTarget)"
      :title="
        ownerTarget ? `分配「${ownerTarget.name}」的负责人` : '分配负责人'
      "
      width="sm"
      @close="ownerTarget = undefined"
    >
      <OwnerPicker v-model="ownerForm" :people="workspace.people" />
      <div class="mt-5 flex justify-end gap-2">
        <button
          class="focus-ring rounded-xl px-4 py-2.5 text-sm text-slate-500"
          @click="ownerTarget = undefined"
        >
          取消
        </button>
        <button
          :disabled="savingOwners"
          class="focus-ring rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-indigo-500"
          @click="saveOwners"
        >
          {{ savingOwners ? '保存中…' : '保存' }}
        </button>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.person-work-grid {
  background-image: linear-gradient(
    to right,
    rgb(241 245 249) 1px,
    transparent 1px
  );
}

:global(.dark .person-work-grid) {
  background-image: linear-gradient(
    to right,
    rgb(30 41 59) 1px,
    transparent 1px
  );
}
</style>

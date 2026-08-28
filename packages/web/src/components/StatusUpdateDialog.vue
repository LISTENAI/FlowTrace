<script setup lang="ts">
import type {
  ExecutionStatus,
  Person,
  StatusHistory,
} from '@flowtrace/shared';
import { ChevronDownIcon, UserGroupIcon } from '@heroicons/vue/24/outline';
import dayjs from 'dayjs';
import { computed, reactive, ref, watch } from 'vue';
import { api } from '@/api';
import AppDateTimeField from '@/components/AppDateTimeField.vue';
import AppModal from '@/components/AppModal.vue';
import OwnerPicker from '@/components/OwnerPicker.vue';
import { formatDateTime, statusDot, statusLabels } from '@/lib/presentation';
import { toasts } from '@/state/toasts';

const props = defineProps<{
  open: boolean;
  itemId: string;
  itemType: 'stage' | 'bug';
  itemName: string;
  currentStatus: ExecutionStatus;
  actualStartAt?: string;
  statusReason?: string;
  expectedResumeAt?: string;
  ownerIds?: string[];
  people?: Person[];
  statusHistory?: StatusHistory[];
}>();

const emit = defineEmits<{ close: []; saved: [] }>();
const saving = ref(false);
const ownersOpen = ref(false);
const initialEffectiveAt = ref('');
const form = reactive({
  status: props.currentStatus,
  effectiveAt: dayjs().format('YYYY-MM-DDTHH:mm'),
  startedAt: '',
  statusReason: '',
  expectedResumeAt: '',
  note: '',
  ownerIds: [] as string[],
});

const statuses: Array<{ id: ExecutionStatus; hint: string }> = [
  { id: 'not_started', hint: '尚未开始' },
  { id: 'in_progress', hint: '正在主动推进' },
  { id: 'waiting', hint: '等待明确条件' },
  { id: 'blocked', hint: '恢复条件不明' },
  { id: 'done', hint: '已经完成' },
  { id: 'canceled', hint: '保留后取消' },
];

const needsReason = computed(() =>
  ['waiting', 'blocked'].includes(form.status),
);
const canBackfillStart = computed(
  () => form.status === 'done' && !props.actualStartAt,
);
const isBackfill = computed(
  () =>
    Boolean(form.effectiveAt) &&
    dayjs(form.effectiveAt).isBefore(dayjs().subtract(5, 'minute')),
);
const staysTerminal = computed(
  () =>
    form.status === props.currentStatus &&
    ['done', 'canceled'].includes(form.status),
);
const recordsProgressEvent = computed(
  () =>
    form.status !== props.currentStatus ||
    (!staysTerminal.value &&
      (Boolean(form.note.trim()) ||
        (needsReason.value &&
          form.statusReason.trim() !== (props.statusReason ?? '').trim()) ||
        (form.status === 'waiting' &&
          form.expectedResumeAt !== localTime(props.expectedResumeAt)))),
);
const backfillsStart = computed(
  () => canBackfillStart.value && Boolean(form.startedAt),
);
const ownersChanged = computed(() => {
  const previous = [...(props.ownerIds ?? [])].sort();
  const next = [...form.ownerIds].sort();
  return previous.join('\0') !== next.join('\0');
});
const hasChanges = computed(
  () =>
    recordsProgressEvent.value || backfillsStart.value || ownersChanged.value,
);
const validationMessage = computed(() => {
  if (!form.effectiveAt) return '请选择实际发生时间。';
  if (needsReason.value && !form.statusReason.trim())
    return form.status === 'blocked'
      ? '记录阻塞时需要说明当前卡在哪里。'
      : '记录等待时需要说明正在等待什么。';
  if (form.startedAt && dayjs(form.startedAt).isAfter(dayjs(form.effectiveAt)))
    return '开始时间不能晚于这次进展的发生时间。';
  if (
    form.status === 'waiting' &&
    form.expectedResumeAt &&
    dayjs(form.expectedResumeAt).isBefore(dayjs(form.effectiveAt))
  )
    return '预计恢复时间不能早于等待开始时间。';
  if (
    !staysTerminal.value &&
    form.status === props.currentStatus &&
    form.effectiveAt !== initialEffectiveAt.value &&
    !recordsProgressEvent.value &&
    !backfillsStart.value
  ) {
    const recordedStart =
      form.status === 'in_progress' && props.actualStartAt
        ? `当前「进行中」开始记录于 ${formatDateTime(props.actualStartAt)}。`
        : '';
    return `${recordedStart}这里只追加新变化，不能用新的发生时间覆盖已有记录；如需改正，请在「最近历史」中修正原记录。`;
  }
  return '';
});
const canSave = computed(
  () => hasChanges.value && !validationMessage.value && !saving.value,
);
const ownerSummary = computed(() => {
  const names = form.ownerIds
    .map((id) => props.people?.find((person) => person.id === id)?.name)
    .filter(Boolean);
  if (!names.length) return '待分配';
  if (names.length <= 3) return names.join('、');
  return `${names.slice(0, 3).join('、')}等 ${names.length} 人`;
});
const laterHistory = computed(() =>
  [...(props.statusHistory ?? [])]
    .filter((item) =>
      dayjs(item.effectiveAt).isAfter(dayjs(form.effectiveAt)),
    )
    .sort(
      (left, right) =>
        dayjs(left.effectiveAt).valueOf() - dayjs(right.effectiveAt).valueOf(),
    ),
);
const latestLaterHistory = computed(() => laterHistory.value.at(-1));

function localTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DDTHH:mm') : '';
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.status = props.currentStatus;
    form.effectiveAt = dayjs().format('YYYY-MM-DDTHH:mm');
    initialEffectiveAt.value = form.effectiveAt;
    form.startedAt = '';
    form.statusReason = props.statusReason ?? '';
    form.expectedResumeAt = localTime(props.expectedResumeAt);
    form.note = '';
    form.ownerIds = [...(props.ownerIds ?? [])];
    ownersOpen.value = false;
  },
  { immediate: true },
);

async function save() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const input = {
      status: form.status,
      effectiveAt: dayjs(form.effectiveAt).toISOString(),
      actualStartAt:
        canBackfillStart.value && form.startedAt
          ? dayjs(form.startedAt).toISOString()
          : undefined,
      statusReason: needsReason.value
        ? form.statusReason || undefined
        : undefined,
      expectedResumeAt:
        form.status === 'waiting' && form.expectedResumeAt
          ? dayjs(form.expectedResumeAt).toISOString()
          : undefined,
      note: recordsProgressEvent.value ? form.note || undefined : undefined,
      ownerIds: ownersChanged.value ? form.ownerIds : undefined,
    };
    const updated =
      props.itemType === 'stage'
        ? await api.updateStageStatus(props.itemId, input)
        : await api.updateBugStatus(props.itemId, input);
    if (recordsProgressEvent.value && updated.status !== form.status) {
      toasts.show(
        '进展已补记',
        `发生时间之后还有更晚的记录，当前仍为「${statusLabels[updated.status]}」`,
      );
      emit('saved');
      emit('close');
      return;
    }
    toasts.show(
      !recordsProgressEvent.value &&
        !backfillsStart.value &&
        ownersChanged.value
        ? '负责人已更新'
        : !recordsProgressEvent.value && backfillsStart.value
          ? '开始时间已补记'
          : isBackfill.value
            ? '进展已补记'
            : '进展已记录',
      `${props.itemName} · ${statusLabels[form.status]}`,
    );
    emit('saved');
    emit('close');
  } catch (error) {
    toasts.show(
      '记录失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AppModal
    :open="open"
    :title="`记录「${itemName}」的进展`"
    description="记录实际发生的状态变化；选择过去时间即表示补记。"
    width="lg"
    @close="emit('close')"
  >
    <form class="space-y-5" @submit.prevent="save">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          v-for="status in statuses"
          :key="status.id"
          type="button"
          class="flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition"
          :class="
            form.status === status.id
              ? 'border-indigo-300 bg-indigo-50/70 ring-2 ring-indigo-100'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          "
          @click="form.status = status.id"
        >
          <span
            class="h-2.5 w-2.5 shrink-0 rounded-full"
            :class="statusDot[status.id]"
          />
          <span>
            <span class="block text-sm font-semibold text-slate-800">{{
              statusLabels[status.id]
            }}</span>
            <span class="block text-[10px] text-slate-400">{{
              status.hint
            }}</span>
          </span>
        </button>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <label class="block">
          <span
            class="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-600"
          >
            发生时间
            <span
              v-if="isBackfill"
              class="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700"
              >补记</span
            >
          </span>
          <AppDateTimeField
            v-model="form.effectiveAt"
            required
            mode="datetime"
          />
        </label>
        <p v-if="isBackfill" class="mt-2 text-[11px] leading-5 text-amber-700">
          将补记一条发生于
          {{ formatDateTime(dayjs(form.effectiveAt).toISOString()) }}
          的进展，时间线会按实际发生时间重排。
        </p>
        <p
          v-if="latestLaterHistory"
          class="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800"
        >
          此后还有 {{ laterHistory.length }} 条进展记录，最后一条是
          {{ formatDateTime(latestLaterHistory.effectiveAt) }} 的「{{
            statusLabels[latestLaterHistory.toStatus]
          }}」。这次补记会保留，但不会成为当前状态；原记录有误时请直接修正历史。
        </p>
      </div>

      <label v-if="canBackfillStart" class="block">
        <span class="mb-1.5 block text-xs font-medium text-slate-600"
          >开始时间（可选）</span
        >
        <AppDateTimeField
          v-model="form.startedAt"
          mode="datetime"
          :max="form.effectiveAt"
        />
        <p class="mt-1.5 text-[10px] leading-4 text-slate-400">
          当前还没有开始记录。如果已知道开始时间，可在完成的同时一并补记。
        </p>
      </label>

      <div
        v-if="needsReason"
        class="rounded-2xl border p-4"
        :class="
          form.status === 'blocked'
            ? 'border-rose-100 bg-rose-50/50'
            : 'border-amber-100 bg-amber-50/50'
        "
      >
        <label class="block">
          <span
            class="mb-1.5 block text-xs font-semibold"
            :class="
              form.status === 'blocked' ? 'text-rose-700' : 'text-amber-700'
            "
          >
            {{
              form.status === 'blocked' ? '现在卡在哪里？' : '正在等待什么？'
            }}
          </span>
          <textarea
            v-model="form.statusReason"
            required
            rows="2"
            :placeholder="
              form.status === 'blocked'
                ? '例如：高负载重启原因尚未定位'
                : '例如：等待测试环境部署'
            "
            class="focus-ring w-full rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm text-slate-800"
          />
        </label>
        <label v-if="form.status === 'waiting'" class="mt-3 block">
          <span class="mb-1.5 block text-xs font-medium text-amber-700"
            >预计恢复时间（可选）</span
          >
          <AppDateTimeField
            v-model="form.expectedResumeAt"
            mode="datetime"
            :min="form.effectiveAt"
          />
        </label>
      </div>

      <label v-if="!staysTerminal" class="block">
        <span class="mb-1.5 block text-xs font-medium text-slate-600"
          >发生了什么（可选）</span
        >
        <input
          v-model="form.note"
          placeholder="例如：完成 alpha2 提测"
          class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
        />
      </label>

      <p
        v-if="staysTerminal"
        class="rounded-xl bg-violet-50/60 px-3 py-2.5 text-[11px] leading-5 text-violet-600"
      >
        这项工作已经结束。如需修改完成时间、状态或当时的说明，请在「最近历史」中修正对应记录。
      </p>

      <p
        v-if="validationMessage"
        class="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-[11px] leading-5 text-amber-700"
      >
        {{ validationMessage }}
      </p>

      <div v-if="people?.length" class="border-t border-slate-100 pt-4">
        <button
          type="button"
          class="focus-ring flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-white"
          :aria-expanded="ownersOpen"
          @click="ownersOpen = !ownersOpen"
        >
          <UserGroupIcon class="h-4 w-4 shrink-0 text-slate-400" />
          <span class="min-w-0 flex-1">
            <span class="block text-xs font-medium text-slate-600"
              >同时调整负责人</span
            >
            <span class="mt-0.5 block truncate text-[10px] text-slate-400">{{
              ownerSummary
            }}</span>
          </span>
          <ChevronDownIcon
            class="h-4 w-4 shrink-0 text-slate-400 transition"
            :class="ownersOpen ? 'rotate-180' : ''"
          />
        </button>
        <div v-if="ownersOpen" class="mt-3">
          <OwnerPicker v-model="form.ownerIds" :people="people" />
        </div>
      </div>

      <div
        class="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-[11px] leading-5 text-slate-400">
          这里只记录实际进展；计划日期请使用「调整计划」。
        </p>
        <div class="flex shrink-0 justify-end gap-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            :disabled="!canSave"
            class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {{
              saving
                ? '记录中…'
                : !recordsProgressEvent && !backfillsStart && ownersChanged
                  ? '保存负责人'
                  : !recordsProgressEvent && backfillsStart
                    ? '补记开始时间'
                    : isBackfill
                      ? '确认补记'
                      : '记录进展'
            }}
          </button>
        </div>
      </div>
    </form>
  </AppModal>
</template>

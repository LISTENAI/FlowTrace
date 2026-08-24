<script setup lang="ts">
import type { Version } from '@flowtrace/shared';
import dayjs from 'dayjs';
import { computed, reactive, ref, watch } from 'vue';
import { api } from '@/api';
import AppModal from '@/components/AppModal.vue';
import { toasts } from '@/state/toasts';

type PlanningItemType = 'requirement' | 'stage' | 'bug';

const props = withDefaults(
  defineProps<{
    open: boolean;
    itemId: string;
    itemType: PlanningItemType;
    itemName: string;
    plannedStartAt?: string;
    plannedEndAt?: string;
    suggestedStartAt?: string;
    suggestedEndAt?: string;
    changeSummary?: string;
    currentVersionId?: string;
    versions?: Version[];
  }>(),
  { versions: () => [] },
);

const emit = defineEmits<{ close: []; saved: [] }>();
const saving = ref(false);
const form = reactive({
  plannedStartAt: '',
  plannedEndAt: '',
  versionId: '',
  reason: '',
});

const supportsVersion = computed(() => props.itemType === 'requirement');
const hasScheduleChanges = computed(
  () =>
    form.plannedStartAt !==
      (props.plannedStartAt
        ? dayjs(props.plannedStartAt).format('YYYY-MM-DD')
        : '') ||
    form.plannedEndAt !==
      (props.plannedEndAt
        ? dayjs(props.plannedEndAt).format('YYYY-MM-DD')
        : ''),
);
const hasVersionChanges = computed(
  () =>
    supportsVersion.value && form.versionId !== (props.currentVersionId ?? ''),
);
const hasChanges = computed(
  () => hasScheduleChanges.value || hasVersionChanges.value,
);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.plannedStartAt = props.suggestedStartAt
      ? dayjs(props.suggestedStartAt).format('YYYY-MM-DD')
      : props.plannedStartAt
        ? dayjs(props.plannedStartAt).format('YYYY-MM-DD')
        : '';
    form.plannedEndAt = props.suggestedEndAt
      ? dayjs(props.suggestedEndAt).format('YYYY-MM-DD')
      : props.plannedEndAt
        ? dayjs(props.plannedEndAt).format('YYYY-MM-DD')
        : '';
    form.versionId = props.currentVersionId ?? '';
    form.reason = '';
  },
  { immediate: true },
);

function toIso(value: string, endOfDay = false) {
  if (!value) return null;
  const date = dayjs(value);
  return (endOfDay ? date.endOf('day') : date.startOf('day')).toISOString();
}

async function save() {
  saving.value = true;
  try {
    const schedule = {
      plannedStartAt: toIso(form.plannedStartAt),
      plannedEndAt: toIso(form.plannedEndAt, true),
      reason: form.reason,
    };
    if (hasScheduleChanges.value && props.itemType === 'requirement')
      await api.rescheduleRequirement(props.itemId, schedule);
    if (hasScheduleChanges.value && props.itemType === 'stage')
      await api.rescheduleStage(props.itemId, schedule);
    if (hasScheduleChanges.value && props.itemType === 'bug')
      await api.rescheduleBug(props.itemId, schedule);
    if (hasVersionChanges.value)
      await api.moveRequirement(
        props.itemId,
        form.versionId || null,
        form.reason,
      );
    toasts.show('计划已更新', '原始基线不变，本次调整已写入历史');
    emit('saved');
    emit('close');
  } catch (error) {
    toasts.show(
      '更新失败',
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
    :title="`调整「${itemName}」的计划`"
    :description="
      changeSummary
        ? '确认拖动产生的新日期，并说明本次调整。'
        : '保留初始基线，并记录这次调整的时间与原因。'
    "
    width="sm"
    @close="emit('close')"
  >
    <form class="space-y-4" @submit.prevent="save">
      <div
        v-if="changeSummary"
        class="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5 text-xs text-indigo-700"
      >
        <span class="font-semibold">拖动结果</span>
        <span class="ml-2">{{ changeSummary }}</span>
      </div>
      <label v-if="supportsVersion" class="block">
        <span class="mb-1.5 block text-xs font-medium text-slate-600"
          >目标版本</span
        >
        <select
          v-model="form.versionId"
          class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        >
          <option value="">未排版本</option>
          <option
            v-for="version in versions"
            :key="version.id"
            :value="version.id"
          >
            {{ version.name }}
          </option>
        </select>
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label>
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >计划开始</span
          >
          <input
            v-model="form.plannedStartAt"
            type="date"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          />
        </label>
        <label>
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >计划结束</span
          >
          <input
            v-model="form.plannedEndAt"
            type="date"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          />
        </label>
      </div>
      <label class="block">
        <span class="mb-1.5 block text-xs font-medium text-slate-600"
          >调整原因</span
        >
        <textarea
          v-model="form.reason"
          required
          rows="3"
          placeholder="例如：联调环境比原计划晚两天可用"
          class="focus-ring w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        />
      </label>
      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          class="rounded-xl px-4 py-2 text-sm text-slate-500"
          @click="emit('close')"
        >
          取消
        </button>
        <button
          :disabled="saving || !hasChanges"
          class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          保存计划
        </button>
      </div>
    </form>
  </AppModal>
</template>

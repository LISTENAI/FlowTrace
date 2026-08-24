<script setup lang="ts">
import type { ExecutionStatus, StatusHistory } from '@flowtrace/shared';
import dayjs from 'dayjs';
import { computed, reactive, ref, watch } from 'vue';
import { api } from '@/api';
import AppModal from '@/components/AppModal.vue';
import { formatDateTime, statusLabels } from '@/lib/presentation';
import { toasts } from '@/state/toasts';

const props = defineProps<{
  open: boolean;
  itemName: string;
  history: StatusHistory;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();
const saving = ref(false);
const form = reactive({
  status: props.history.toStatus,
  effectiveAt: '',
  note: '',
  statusReason: '',
  expectedResumeAt: '',
  correctionReason: '',
});
const statuses: ExecutionStatus[] = [
  'not_started',
  'in_progress',
  'waiting',
  'blocked',
  'done',
  'canceled',
];
const needsReason = computed(() =>
  ['waiting', 'blocked'].includes(form.status),
);
const changed = computed(
  () =>
    form.status !== props.history.toStatus ||
    form.effectiveAt !== localTime(props.history.effectiveAt) ||
    form.note !== (props.history.note ?? '') ||
    form.statusReason !== (props.history.reason ?? '') ||
    form.expectedResumeAt !== localTime(props.history.expectedResumeAt),
);

function localTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DDTHH:mm') : '';
}

watch(
  () => [props.open, props.history] as const,
  ([open]) => {
    if (!open) return;
    form.status = props.history.toStatus;
    form.effectiveAt = localTime(props.history.effectiveAt);
    form.note = props.history.note ?? '';
    form.statusReason = props.history.reason ?? '';
    form.expectedResumeAt = localTime(props.history.expectedResumeAt);
    form.correctionReason = '';
  },
  { immediate: true },
);

async function save() {
  saving.value = true;
  try {
    await api.correctStatusHistory(props.history.id, {
      status: form.status,
      effectiveAt: dayjs(form.effectiveAt).toISOString(),
      note: form.note,
      statusReason: needsReason.value ? form.statusReason : undefined,
      expectedResumeAt:
        form.status === 'waiting' && form.expectedResumeAt
          ? dayjs(form.expectedResumeAt).toISOString()
          : null,
      reason: form.correctionReason,
    });
    toasts.show('历史已修正', `${props.itemName} 的实际过程已重算`);
    emit('saved');
    emit('close');
  } catch (error) {
    toasts.show(
      '修正失败',
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
    :title="`修正「${itemName}」的历史记录`"
    :description="`正在修正 ${formatDateTime(history.effectiveAt)} 的已有记录，而不是追加一条新的补记。`"
    width="lg"
    @close="emit('close')"
  >
    <form class="space-y-5" @submit.prevent="save">
      <div class="grid gap-4 sm:grid-cols-2">
        <label>
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >状态</span
          >
          <select
            v-model="form.status"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          >
            <option v-for="status in statuses" :key="status" :value="status">
              {{ statusLabels[status] }}
            </option>
          </select>
        </label>
        <label>
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >发生时间</span
          >
          <input
            v-model="form.effectiveAt"
            required
            type="datetime-local"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      <div
        v-if="needsReason"
        class="grid gap-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4 sm:grid-cols-2"
      >
        <label>
          <span class="mb-1.5 block text-xs font-semibold text-amber-700">{{
            form.status === 'blocked' ? '阻塞原因' : '等待原因'
          }}</span>
          <input
            v-model="form.statusReason"
            required
            class="focus-ring w-full rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm"
          />
        </label>
        <label v-if="form.status === 'waiting'">
          <span class="mb-1.5 block text-xs font-medium text-amber-700"
            >预计恢复时间（可选）</span
          >
          <input
            v-model="form.expectedResumeAt"
            type="datetime-local"
            class="focus-ring w-full rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      <label class="block">
        <span class="mb-1.5 block text-xs font-medium text-slate-600"
          >当时的说明（可选）</span
        >
        <input
          v-model="form.note"
          class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        />
      </label>

      <label
        class="block rounded-2xl border border-violet-100 bg-violet-50/60 p-4"
      >
        <span class="mb-1.5 block text-xs font-semibold text-violet-700"
          >为什么要修正？</span
        >
        <textarea
          v-model="form.correctionReason"
          required
          rows="2"
          placeholder="例如：邮件时间表明实际提测早于原记录"
          class="focus-ring w-full resize-none rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm"
        />
        <p class="mt-2 text-[10px] leading-4 text-violet-600/80">
          系统会保留修正前后的值和原因，并重算实际起止与状态持续时间。
        </p>
      </label>

      <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          class="rounded-xl px-4 py-2.5 text-sm text-slate-500"
          @click="emit('close')"
        >
          取消
        </button>
        <button
          :disabled="saving || !changed || !form.correctionReason.trim()"
          class="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {{ saving ? '修正中…' : '确认修正' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>

<script setup lang="ts">
import type { ExecutionStatus, Person } from '@flowtrace/shared';
import dayjs from 'dayjs';
import { computed, reactive, ref, watch } from 'vue';
import { api } from '@/api';
import AppModal from '@/components/AppModal.vue';
import OwnerPicker from '@/components/OwnerPicker.vue';
import { statusDot, statusLabels } from '@/lib/presentation';
import { toasts } from '@/state/toasts';

const props = defineProps<{
  open: boolean;
  itemId: string;
  itemType: 'stage' | 'bug';
  itemName: string;
  currentStatus: ExecutionStatus;
  ownerIds: string[];
  people: Person[];
}>();

const emit = defineEmits<{ close: []; saved: [] }>();
const saving = ref(false);
const form = reactive({
  status: props.currentStatus,
  effectiveAt: dayjs().format('YYYY-MM-DDTHH:mm'),
  statusReason: '',
  expectedResumeAt: '',
  note: '',
  ownerIds: [...props.ownerIds],
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

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.status = props.currentStatus;
    form.effectiveAt = dayjs().format('YYYY-MM-DDTHH:mm');
    form.statusReason = '';
    form.expectedResumeAt = '';
    form.note = '';
    form.ownerIds = [...props.ownerIds];
  },
);

async function save() {
  saving.value = true;
  try {
    const input = {
      status: form.status,
      effectiveAt: dayjs(form.effectiveAt).toISOString(),
      statusReason: form.statusReason || undefined,
      expectedResumeAt: form.expectedResumeAt
        ? dayjs(form.expectedResumeAt).toISOString()
        : undefined,
      note: form.note || undefined,
      ownerIds: form.ownerIds,
    };
    const recordsStatus =
      form.status !== props.currentStatus ||
      Boolean(form.statusReason || form.expectedResumeAt || form.note);
    if (recordsStatus) {
      if (props.itemType === 'stage')
        await api.updateStageStatus(props.itemId, input);
      else await api.updateBugStatus(props.itemId, input);
      toasts.show(
        '轨迹已记录',
        `${props.itemName} · ${statusLabels[form.status]}`,
      );
    } else {
      const ownerInput = { ownerIds: form.ownerIds };
      if (props.itemType === 'stage')
        await api.updateStage(props.itemId, ownerInput);
      else await api.updateBug(props.itemId, ownerInput);
      toasts.show(
        '负责人已更新',
        form.ownerIds.length ? `已分配 ${form.ownerIds.length} 人` : '已设为待分配',
      );
    }
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
    :title="`记录「${itemName}」的新状态`"
    description="选择此刻真实发生的状态；生效时间可以补录到过去。"
    width="lg"
    @close="$emit('close')"
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
            class="focus-ring w-full resize-none rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm text-slate-800 outline-none"
          />
        </label>
        <label v-if="form.status === 'waiting'" class="mt-3 block">
          <span class="mb-1.5 block text-xs font-medium text-amber-700"
            >预计恢复时间（可选）</span
          >
          <input
            v-model="form.expectedResumeAt"
            type="datetime-local"
            class="focus-ring rounded-xl border border-white bg-white/80 px-3 py-2 text-sm text-slate-700 outline-none"
          />
        </label>
      </div>

      <fieldset>
        <legend class="mb-2 text-xs font-medium text-slate-600">负责人</legend>
        <OwnerPicker v-model="form.ownerIds" :people="people" />
      </fieldset>

      <div class="grid gap-4 sm:grid-cols-2">
        <label>
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >何时生效</span
          >
          <input
            v-model="form.effectiveAt"
            required
            type="datetime-local"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
          />
        </label>
        <label>
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >补充说明（可选）</span
          >
          <input
            v-model="form.note"
            placeholder="发生了什么变化"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
          />
        </label>
      </div>

      <div
        class="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-[11px] leading-5 text-slate-400">
          状态变化会写入过程轨迹；只调整负责人时不会重复写入状态历史
        </p>
        <div class="flex shrink-0 justify-end gap-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
            @click="$emit('close')"
          >
            取消
          </button>
          <button
            :disabled="saving"
            class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 disabled:opacity-50"
          >
            {{ saving ? '正在保存…' : '保存变更' }}
          </button>
        </div>
      </div>
    </form>
  </AppModal>
</template>

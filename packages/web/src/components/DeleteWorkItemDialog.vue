<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import AppModal from '@/components/AppModal.vue';

const props = defineProps<{
  open: boolean;
  itemLabel: string;
  confirmationText: string;
  saving?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [input: { confirmation: string; reason: string }];
}>();

const form = reactive({ confirmation: '', reason: '' });
const canDelete = computed(
  () =>
    form.confirmation === props.confirmationText && Boolean(form.reason.trim()),
);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.confirmation = '';
    form.reason = '';
  },
);
</script>

<template>
  <AppModal
    :open="open"
    :title="`删除${itemLabel}`"
    description="删除后会从项目和时间线中隐藏，已有过程历史与删除记录仍会保留。"
    width="sm"
    @close="$emit('close')"
  >
    <form class="space-y-4" @submit.prevent="$emit('confirm', { ...form })">
      <div class="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
        <p class="text-xs leading-5 text-amber-800">
          相关依赖会自动结束。这个操作用于清理误建或不再需要单独追踪的事项。
        </p>
      </div>
      <label class="block">
        <span class="mb-1.5 block text-xs font-medium text-slate-600">
          输入「{{ confirmationText }}」确认
        </span>
        <input
          v-model="form.confirmation"
          autocomplete="off"
          class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-rose-300 focus:bg-white"
        />
      </label>
      <label class="block">
        <span class="mb-1.5 block text-xs font-medium text-slate-600"
          >删除原因</span
        >
        <input
          v-model="form.reason"
          required
          placeholder="例如：重复创建"
          class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-rose-300 focus:bg-white"
        />
      </label>
      <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          class="whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
          @click="$emit('close')"
        >
          取消
        </button>
        <button
          :disabled="!canDelete || saving"
          class="whitespace-nowrap rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-600/10 disabled:opacity-40"
        >
          {{ saving ? '正在删除…' : '确认删除' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>

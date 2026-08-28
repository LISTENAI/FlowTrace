<script setup lang="ts">
import type { Requirement } from '@flowtrace/shared';
import { computed, reactive, ref, watch } from 'vue';
import { api } from '@/api';
import AppModal from '@/components/AppModal.vue';
import { toasts } from '@/state/toasts';

const props = defineProps<{
  open: boolean;
  requirement: Pick<Requirement, 'id' | 'key' | 'title' | 'description'>;
}>();
const emit = defineEmits<{
  close: [];
  saved: [requirement: Requirement];
}>();

const form = reactive({ title: '', description: '' });
const saving = ref(false);
const valid = computed(() => Boolean(form.title.trim()));
const changed = computed(
  () =>
    form.title.trim() !== props.requirement.title ||
    form.description.trim() !== (props.requirement.description ?? ''),
);
const canSave = computed(() => valid.value && changed.value);

watch(
  () => [
    props.open,
    props.requirement.id,
    props.requirement.title,
    props.requirement.description,
  ],
  () => {
    if (!props.open) return;
    form.title = props.requirement.title;
    form.description = props.requirement.description ?? '';
  },
  { immediate: true },
);

async function save() {
  if (!canSave.value || saving.value) return;
  saving.value = true;
  try {
    const updated = await api.updateRequirement(props.requirement.id, {
      title: form.title.trim(),
      description: form.description.trim(),
    });
    toasts.show('需求信息已更新', `${updated.key} · ${updated.title}`);
    emit('saved', updated);
    emit('close');
  } catch (error) {
    toasts.show(
      '保存失败',
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
    :title="`编辑 ${requirement.key}`"
    width="md"
    @close="$emit('close')"
  >
    <form class="space-y-4" @submit.prevent="save">
      <label class="block">
        <span class="mb-1.5 block text-xs font-medium text-slate-600"
          >需求标题</span
        >
        <input
          v-model="form.title"
          autofocus
          required
          class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
        />
        <span v-if="!valid" class="mt-1.5 block text-xs text-rose-600"
          >标题不能为空</span
        >
      </label>
      <label class="block">
        <span class="mb-1.5 block text-xs font-medium text-slate-600"
          >需求描述</span
        >
        <textarea
          v-model="form.description"
          rows="5"
          placeholder="补充目标、边界或必要背景（可选）"
          class="focus-ring w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
        />
      </label>
      <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          class="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          @click="$emit('close')"
        >
          取消
        </button>
        <button
          :disabled="!canSave || saving"
          class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
        >
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>

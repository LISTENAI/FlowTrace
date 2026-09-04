<script setup lang="ts">
import type { ActionItem, Person, Project } from '@flowtrace/shared';
import dayjs from 'dayjs';
import { computed, reactive, ref, watch } from 'vue';
import { api } from '@/api';
import AppDateTimeField from '@/components/AppDateTimeField.vue';
import AppModal from '@/components/AppModal.vue';
import AppSelect from '@/components/AppSelect.vue';
import OwnerPicker from '@/components/OwnerPicker.vue';
import { toasts } from '@/state/toasts';

const props = defineProps<{
  open: boolean;
  people: Person[];
  projects: Project[];
  item?: ActionItem;
  defaultOwnerId?: string;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();
const saving = ref(false);
const form = reactive({
  title: '',
  description: '',
  projectId: '',
  ownerIds: [] as string[],
  plannedStartAt: '',
  plannedEndAt: '',
});
const projectOptions = computed(() => [
  { value: '', label: '不归属项目' },
  ...props.projects.map((project) => ({
    value: project.id,
    label: `${project.key} · ${project.name}`,
  })),
]);
function localDate(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD') : '';
}

function isoDate(value: string, endOfDay = false) {
  if (!value) return null;
  const parsed = dayjs(value);
  return (endOfDay ? parsed.endOf('day') : parsed.startOf('day')).toISOString();
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    form.title = props.item?.title ?? '';
    form.description = props.item?.description ?? '';
    form.projectId = props.item?.projectId ?? '';
    form.ownerIds = props.item
      ? [...props.item.ownerIds]
      : props.defaultOwnerId
        ? [props.defaultOwnerId]
        : [];
    form.plannedStartAt = localDate(props.item?.plannedStartAt);
    form.plannedEndAt = localDate(props.item?.plannedEndAt);
  },
  { immediate: true },
);

async function save() {
  saving.value = true;
  try {
    if (!props.item) {
      await api.createActionItem({
        title: form.title,
        description: form.description || undefined,
        projectId: form.projectId || undefined,
        ownerIds: form.ownerIds,
        plannedStartAt: isoDate(form.plannedStartAt) ?? undefined,
        plannedEndAt: isoDate(form.plannedEndAt, true) ?? undefined,
      });
      toasts.show('待办已创建');
    } else {
      await api.updateActionItem(props.item.id, {
        title: form.title,
        description: form.description,
        ...(props.item.requirementId
          ? {}
          : { projectId: form.projectId || null }),
        ownerIds: form.ownerIds,
      });
      toasts.show('待办已更新');
    }
    emit('saved');
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
    :title="item ? `编辑 ${item.key}` : '新增待办'"
    description="先记下来；需要时再归入项目。"
    width="sm"
    @close="emit('close')"
  >
    <form class="space-y-4" @submit.prevent="save">
      <label class="block">
        <span
          class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"
          >待办内容</span
        >
        <input
          v-model="form.title"
          required
          maxlength="200"
          autofocus
          class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          placeholder="例如：确认下周评审时间"
        />
      </label>
      <label class="block">
        <span
          class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"
          >补充说明（可选）</span
        >
        <textarea
          v-model="form.description"
          rows="2"
          class="focus-ring w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>
      <div v-if="!item" class="grid gap-3 sm:grid-cols-2">
        <label>
          <span
            class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"
            >计划开始（可选）</span
          >
          <AppDateTimeField v-model="form.plannedStartAt" />
        </label>
        <label>
          <span
            class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"
            >计划完成（可选）</span
          >
          <AppDateTimeField
            v-model="form.plannedEndAt"
            :min="form.plannedStartAt"
          />
        </label>
      </div>
      <label class="block">
        <span
          class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"
          >归属项目（可选）</span
        >
        <AppSelect
          v-model="form.projectId"
          :options="projectOptions"
          :disabled="Boolean(item?.requirementId)"
        />
        <span
          v-if="item?.requirementId"
          class="mt-1.5 block text-[11px] text-slate-400"
          >此待办已关联需求，请从需求上下文调整归属。</span
        >
      </label>
      <div>
        <span
          class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"
          >负责人</span
        >
        <OwnerPicker v-model="form.ownerIds" :people="people" />
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          class="focus-ring rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          @click="emit('close')"
        >
          取消
        </button>
        <button
          :disabled="saving || !form.title.trim()"
          class="focus-ring rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-indigo-500"
        >
          {{ saving ? '保存中…' : item ? '保存' : '创建待办' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>

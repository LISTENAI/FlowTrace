<script setup lang="ts">
import type {
  Bug,
  Person,
  Requirement,
  Stage,
  StageWorkDomain,
  Version,
} from '@flowtrace/shared';
import dayjs from 'dayjs';
import { computed, reactive, ref } from 'vue';
import { api } from '@/api';
import AppModal from '@/components/AppModal.vue';
import AppSelect from '@/components/AppSelect.vue';
import AppDateTimeField from '@/components/AppDateTimeField.vue';
import OwnerPicker from '@/components/OwnerPicker.vue';
import { stageWorkDomainOptions } from '@/lib/presentation';
import { toasts } from '@/state/toasts';

const props = defineProps<{
  kind: 'stage' | 'bug';
  requirement: Requirement;
  people: Person[];
  versions: Version[];
}>();
const emit = defineEmits<{ close: []; created: [item: Stage | Bug] }>();
const saving = ref(false);
const form = reactive({
  title: '',
  description: '',
  workDomain: 'other' as StageWorkDomain,
  ownerIds: [] as string[],
  discoveredStageId: '',
  targetVersionId: props.requirement.versionId ?? '',
  plannedStartAt: '',
  plannedEndAt: '',
});
const isBug = computed(() => props.kind === 'bug');
const valid = computed(
  () =>
    Boolean(form.title.trim()) &&
    (!form.plannedStartAt ||
      !form.plannedEndAt ||
      !dayjs(form.plannedEndAt).isBefore(dayjs(form.plannedStartAt))),
);
const stageOptions = computed(() => [
  { value: '', label: '未指定阶段' },
  ...props.requirement.stages.map((stage) => ({
    value: stage.id,
    label: stage.name,
  })),
]);
const versionOptions = computed(() => [
  { value: '', label: '未排版本' },
  ...props.versions.map((version) => ({
    value: version.id,
    label: version.name,
  })),
]);
function close() {
  if (!saving.value) emit('close');
}
async function save() {
  if (saving.value || !valid.value) return;
  saving.value = true;
  try {
    const timing = {
      ownerIds: form.ownerIds,
      plannedStartAt: form.plannedStartAt
        ? dayjs(form.plannedStartAt).startOf('day').toISOString()
        : undefined,
      plannedEndAt: form.plannedEndAt
        ? dayjs(form.plannedEndAt).endOf('day').toISOString()
        : undefined,
    };
    const item = isBug.value
      ? await api.addBug(props.requirement.id, {
          ...timing,
          title: form.title.trim(),
          description: form.description.trim(),
          discoveredStageId: form.discoveredStageId || undefined,
          targetVersionId: form.targetVersionId || undefined,
        })
      : await api.addStage(props.requirement.id, {
          ...timing,
          name: form.title.trim(),
          note: form.description.trim(),
          workDomain: form.workDomain,
        });
    toasts.show(
      isBug.value ? 'Bug 已进入追踪' : '阶段已新增',
      'key' in item ? item.key : item.name,
    );
    emit('created', item);
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
</script>

<template>
  <AppModal
    :open="true"
    :title="isBug ? '报告一个独立 Bug' : '新增阶段'"
    :description="`${requirement.key} · ${requirement.title}`"
    @close="close"
  >
    <form class="min-w-0 space-y-4" @submit.prevent="save">
      <label class="block">
        <span class="mb-1.5 block text-xs font-medium text-slate-600">{{
          isBug ? '问题标题' : '阶段名称'
        }}</span>
        <input
          v-model="form.title"
          required
          autofocus
          class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          :placeholder="isBug ? '例如：二次配网可能失败' : '例如：专项回归验证'"
        />
      </label>
      <label class="block">
        <span class="mb-1.5 block text-xs font-medium text-slate-600">{{
          isBug ? '问题描述' : '阶段说明'
        }}</span>
        <textarea
          v-model="form.description"
          rows="2"
          class="focus-ring w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        />
      </label>
      <label v-if="!isBug" class="block">
        <span class="mb-1.5 block text-xs font-medium text-slate-600"
          >工作域</span
        >
        <AppSelect
          v-model="form.workDomain"
          :options="stageWorkDomainOptions"
        />
      </label>
      <div v-else class="grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >发现于</span
          >
          <AppSelect v-model="form.discoveredStageId" :options="stageOptions" />
        </label>
        <label class="block">
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >目标版本</span
          >
          <AppSelect v-model="form.targetVersionId" :options="versionOptions" />
        </label>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >计划开始</span
          >
          <AppDateTimeField v-model="form.plannedStartAt" />
        </label>
        <label class="block">
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >计划结束</span
          >
          <AppDateTimeField
            v-model="form.plannedEndAt"
            :min="form.plannedStartAt"
          />
        </label>
      </div>
      <fieldset>
        <legend class="mb-2 text-xs font-medium text-slate-600">负责人</legend>
        <OwnerPicker v-model="form.ownerIds" :people="people" />
      </fieldset>
      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          :disabled="saving"
          class="rounded-xl px-4 py-2 text-sm text-slate-500 disabled:opacity-50"
          @click="close"
        >
          取消
        </button>
        <button
          :disabled="saving || !valid"
          class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {{ saving ? '正在保存…' : isBug ? '报告 Bug' : '新增阶段' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>

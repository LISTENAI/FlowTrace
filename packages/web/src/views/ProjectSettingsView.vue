<script setup lang="ts">
import type {
  Project,
  ProjectAgentHandoff,
  ProjectAgentHandoffRevision,
  TemplateStage,
  Version,
} from '@flowtrace/shared';
import {
  ArrowLeftIcon,
  Bars3Icon,
  CheckIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline';
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '@/api';
import AppDateTimeField from '@/components/AppDateTimeField.vue';
import AppModal from '@/components/AppModal.vue';
import AppSelect from '@/components/AppSelect.vue';
import AuditAttribution from '@/components/AuditAttribution.vue';
import { createLocalId } from '@/lib/local-id';
import {
  formatDate,
  formatDateTime,
  stageWorkDomainOptions,
  versionLabels,
} from '@/lib/presentation';
import { toasts } from '@/state/toasts';
import { loadWorkspace } from '@/state/workspace';

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const project = ref<Project>();
const versions = ref<Version[]>([]);
const agentHandoff = ref<ProjectAgentHandoff>();
const agentHandoffHistory = ref<ProjectAgentHandoffRevision[]>([]);
const stages = ref<TemplateStage[]>([]);
const saving = ref(false);
const versionOpen = ref(false);
const versionOrderSaving = ref(false);
const handoffOpen = ref(false);
const handoffSaving = ref(false);
const handoffContent = ref('');
const handoffReason = ref('');
const projectForm = reactive({ name: '', description: '' });
const versionForm = reactive({
  name: '',
  status: 'planning',
  plannedReleaseAt: '',
  description: '',
});
const versionStatusOptions = [
  { value: 'planning', label: '规划中' },
  { value: 'active', label: '进行中' },
];

async function load() {
  const [projectResult, versionResult, handoffResult, handoffHistoryResult] =
    await Promise.all([
      api.project(projectId.value),
      api.versions(projectId.value),
      api.projectAgentHandoff(projectId.value),
      api.projectAgentHandoffHistory(projectId.value),
    ]);
  project.value = projectResult;
  versions.value = versionResult;
  agentHandoff.value = handoffResult;
  agentHandoffHistory.value = handoffHistoryResult;
  stages.value = projectResult.templateStages.map((item) => ({ ...item }));
  projectForm.name = projectResult.name;
  projectForm.description = projectResult.description ?? '';
}

const handoffPreview = computed(() => {
  const content = agentHandoff.value?.content.trim() ?? '';
  return content.length > 700 ? `${content.slice(0, 700)}…` : content;
});

function openHandoffEditor() {
  handoffContent.value = agentHandoff.value?.content ?? '';
  handoffReason.value = '';
  handoffOpen.value = true;
}

async function saveAgentHandoff() {
  if (!agentHandoff.value || handoffSaving.value) return;
  handoffSaving.value = true;
  try {
    agentHandoff.value = await api.updateProjectAgentHandoff(projectId.value, {
      content: handoffContent.value,
      expectedRevision: agentHandoff.value.revision,
      reason: handoffReason.value.trim() || undefined,
      source: 'manual',
    });
    agentHandoffHistory.value = await api.projectAgentHandoffHistory(
      projectId.value,
    );
    handoffOpen.value = false;
    toasts.show('Agent 交底已保存', `修订 ${agentHandoff.value.revision}`);
  } catch (error) {
    toasts.show(
      '交底保存失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    handoffSaving.value = false;
  }
}

function addStage() {
  stages.value.push({
    id: createLocalId(),
    name: '新阶段',
    workDomain: 'other',
    order: stages.value.length,
    ownerIds: [],
    dependsOnTemplateStageIds: [],
  });
}

function moveStage(index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= stages.value.length) return;
  const [stage] = stages.value.splice(index, 1);
  if (!stage) return;
  stages.value.splice(target, 0, stage);
  stages.value.forEach((item, order) => (item.order = order));
}

function removeStage(index: number) {
  stages.value.splice(index, 1);
  stages.value.forEach((item, order) => (item.order = order));
}

async function saveSettings() {
  if (!project.value) return;
  saving.value = true;
  try {
    await Promise.all([
      api.updateProject(project.value.id, projectForm),
      api.updateTemplate(project.value.id, stages.value),
    ]);
    toasts.show('项目设置已保存', '模板变化只影响之后创建的需求');
    await Promise.all([load(), loadWorkspace(true)]);
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

async function createVersion() {
  saving.value = true;
  try {
    await api.createVersion(projectId.value, {
      name: versionForm.name,
      status: versionForm.status,
      plannedReleaseAt: versionForm.plannedReleaseAt || undefined,
      description: versionForm.description,
    });
    versionOpen.value = false;
    toasts.show('版本已创建');
    await load();
  } catch (error) {
    toasts.show(
      '创建失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    saving.value = false;
  }
}

async function moveVersion(index: number, offset: number) {
  const target = index + offset;
  const currentVersion = versions.value[index];
  const targetVersion = versions.value[target];
  if (!currentVersion || !targetVersion || versionOrderSaving.value) return;
  versionOrderSaving.value = true;
  try {
    await Promise.all([
      api.updateVersion(currentVersion.id, { sortOrder: target }),
      api.updateVersion(targetVersion.id, { sortOrder: index }),
    ]);
    const [moved] = versions.value.splice(index, 1);
    if (moved) versions.value.splice(target, 0, moved);
    toasts.show('版本顺序已更新');
  } catch (error) {
    toasts.show(
      '排序失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
    await load();
  } finally {
    versionOrderSaving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([load(), loadWorkspace()]);
});
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
    <RouterLink
      :to="`/projects/${projectId}`"
      class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-600"
      ><ArrowLeftIcon class="h-3.5 w-3.5" />返回项目</RouterLink
    >
    <div class="mt-3 flex items-end justify-between">
      <div>
        <h1
          class="text-2xl font-semibold tracking-[-.035em] text-slate-900 sm:text-3xl"
        >
          项目设置
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          维护项目边界、交付版本与新需求的默认阶段。
        </p>
      </div>
      <button
        :disabled="saving"
        class="focus-ring inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 disabled:opacity-50"
        @click="saveSettings"
      >
        <CheckIcon class="h-4 w-4" />保存设置
      </button>
    </div>

    <div v-if="project" class="mt-7 space-y-5">
      <section class="surface p-5 sm:p-6">
        <h2 class="text-sm font-semibold text-slate-900">基本信息</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-[1fr_2fr]">
          <label
            ><span class="mb-1.5 block text-xs font-medium text-slate-600"
              >项目名称</span
            ><input
              v-model="projectForm.name"
              class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" /></label
          ><label
            ><span class="mb-1.5 block text-xs font-medium text-slate-600"
              >项目说明</span
            ><input
              v-model="projectForm.description"
              class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          /></label>
        </div>
        <p class="mt-3 text-[11px] text-slate-400">
          稳定标识：{{ project.key }} · 创建后不建议修改，以保持外部引用稳定。
        </p>
      </section>

      <section class="surface overflow-hidden">
        <div
          class="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6"
        >
          <div class="flex min-w-0 items-center gap-2">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-white">
              Agent 交底
            </h2>
            <span
              v-if="agentHandoff?.revision"
              class="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
              >修订 {{ agentHandoff.revision }}</span
            >
          </div>
          <button
            type="button"
            class="focus-ring section-action shrink-0"
            @click="openHandoffEditor"
          >
            <PencilSquareIcon class="h-3.5 w-3.5" />
            {{ agentHandoff?.revision ? '修正' : '补充' }}
          </button>
        </div>
        <div class="px-5 py-4 sm:px-6">
          <div
            v-if="handoffPreview"
            class="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 dark:border-slate-700 dark:bg-slate-800/60"
          >
            <p
              class="whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300"
            >
              {{ handoffPreview }}
            </p>
          </div>
          <p v-else class="py-1 text-xs text-slate-400">暂无交底</p>
          <div
            v-if="agentHandoff?.updatedAt"
            class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1"
          >
            <span
              class="inline-flex items-center gap-1 text-[11px] text-slate-400"
            >
              <ClockIcon class="h-3.5 w-3.5" />
              {{ formatDateTime(agentHandoff.updatedAt) }}
            </span>
            <AuditAttribution
              :source="agentHandoff.source"
              :agent-name="agentHandoff.agentName"
              :agent-model="agentHandoff.agentModel"
            />
            <span
              v-if="agentHandoff.reason"
              class="text-[11px] text-slate-400"
              >{{ agentHandoff.reason }}</span
            >
          </div>
          <div
            v-if="agentHandoffHistory.length > 1"
            class="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800"
          >
            <p class="text-[10px] font-semibold text-slate-400">最近修订</p>
            <div class="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              <div
                v-for="revision in agentHandoffHistory.slice(1, 4)"
                :key="revision.id"
                class="flex items-center gap-2 text-[10px] text-slate-400"
              >
                <span class="font-medium text-slate-500"
                  >修订 {{ revision.revision }}</span
                >
                <span>{{ formatDateTime(revision.createdAt) }}</span>
                <AuditAttribution
                  :source="revision.source"
                  :agent-name="revision.agentName"
                  :agent-model="revision.agentModel"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="surface overflow-hidden">
        <div
          class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:items-center sm:px-6"
        >
          <div class="min-w-0">
            <h2 class="text-sm font-semibold text-slate-900">需求阶段模板</h2>
            <p class="mt-0.5 text-[11px] text-slate-400">
              只影响保存后新建的需求，旧需求不会自动迁移。
            </p>
          </div>
          <button class="focus-ring section-action" @click="addStage">
            <PlusIcon class="h-3.5 w-3.5" />新增阶段
          </button>
        </div>
        <div class="space-y-2 p-5 sm:p-6">
          <div
            v-for="(stage, index) in stages"
            :key="stage.id"
            class="group grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 sm:flex sm:gap-3"
          >
            <Bars3Icon class="h-4 w-4 text-slate-300" /><span
              class="grid h-6 w-6 place-items-center rounded-lg bg-white text-[10px] font-bold text-slate-400 ring-1 ring-slate-200"
              >{{ index + 1 }}</span
            ><input
              v-model="stage.name"
              class="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none"
            />
            <AppSelect
              v-model="stage.workDomain"
              compact
              class="col-span-3 sm:col-auto sm:w-36"
              :options="stageWorkDomainOptions"
            />
            <div
              class="col-span-3 flex items-center justify-end gap-1 border-t border-slate-200/70 pt-2 sm:contents"
            >
              <button
                type="button"
                class="rounded-lg p-1.5 text-slate-300 transition hover:bg-white hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-25"
                :disabled="index === 0"
                :aria-label="`上移${stage.name}`"
                @click="moveStage(index, -1)"
              >
                <ChevronUpIcon class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded-lg p-1.5 text-slate-300 transition hover:bg-white hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-25"
                :disabled="index === stages.length - 1"
                :aria-label="`下移${stage.name}`"
                @click="moveStage(index, 1)"
              >
                <ChevronDownIcon class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded-lg p-1.5 text-slate-300 opacity-60 transition hover:bg-rose-50 hover:text-rose-500 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="删除阶段"
                @click="removeStage(index)"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="surface overflow-hidden">
        <div
          class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:items-center sm:px-6"
        >
          <div class="min-w-0">
            <h2 class="text-sm font-semibold text-slate-900">交付版本</h2>
            <p class="mt-0.5 text-[11px] text-slate-400">
              同一长期项目中的计划交付批次，可按实际管理习惯调整顺序。
            </p>
          </div>
          <button class="focus-ring section-action" @click="versionOpen = true">
            <PlusIcon class="h-3.5 w-3.5" />新建版本
          </button>
        </div>
        <div class="divide-y divide-slate-100 px-5 sm:px-6">
          <div
            v-for="(version, index) in versions"
            :key="version.id"
            class="flex items-center gap-4 py-4"
          >
            <Bars3Icon class="h-4 w-4 shrink-0 text-slate-300" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-slate-800">{{
                  version.name
                }}</span
                ><span
                  class="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                  :class="
                    version.status === 'active'
                      ? 'bg-indigo-50 text-indigo-700'
                      : version.status === 'released'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                  "
                  >{{ versionLabels[version.status] }}</span
                >
              </div>
              <p class="mt-0.5 text-xs text-slate-400">
                {{ version.description || '未填写说明' }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-[10px] text-slate-400">计划发布</p>
              <p class="mt-0.5 text-xs font-medium text-slate-600">
                {{ formatDate(version.plannedReleaseAt) }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-50 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-25"
                :disabled="versionOrderSaving || index === 0"
                :aria-label="`上移版本${version.name}`"
                @click="moveVersion(index, -1)"
              >
                <ChevronUpIcon class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-50 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-25"
                :disabled="versionOrderSaving || index === versions.length - 1"
                :aria-label="`下移版本${version.name}`"
                @click="moveVersion(index, 1)"
              >
                <ChevronDownIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
          <p
            v-if="!versions.length"
            class="py-8 text-center text-xs text-slate-400"
          >
            尚未创建版本，需求可以先留在未排版本中。
          </p>
        </div>
      </section>
    </div>

    <AppModal
      :open="handoffOpen"
      :title="agentHandoff?.revision ? '修正 Agent 交底' : '补充 Agent 交底'"
      width="lg"
      @close="handoffOpen = false"
    >
      <form class="space-y-4" @submit.prevent="saveAgentHandoff">
        <label class="block">
          <span
            class="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300"
            >交底内容</span
          >
          <textarea
            v-model="handoffContent"
            rows="15"
            maxlength="30000"
            placeholder="写下需要 AI 延续的约定或注意事项"
            class="focus-ring w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </label>
        <label class="block">
          <span
            class="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300"
            >修改说明（可选）</span
          >
          <input
            v-model="handoffReason"
            maxlength="500"
            placeholder="例如：修正项目约定"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </label>
        <div class="flex justify-end gap-3 pt-1">
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-xl px-4 py-2 text-sm text-slate-500"
              @click="handoffOpen = false"
            >
              取消
            </button>
            <button
              :disabled="handoffSaving"
              class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-indigo-500"
            >
              {{ handoffSaving ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </form>
    </AppModal>

    <AppModal
      :open="versionOpen"
      title="创建交付版本"
      description="版本用于组织同一项目中的一次计划交付。"
      width="sm"
      @close="versionOpen = false"
      ><form class="space-y-4" @submit.prevent="createVersion">
        <label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >版本名称</span
          ><input
            v-model="versionForm.name"
            required
            placeholder="例如：2.8 / Rev B"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        /></label>
        <div class="grid grid-cols-2 gap-3">
          <label
            ><span class="mb-1.5 block text-xs font-medium text-slate-600"
              >状态</span
            ><AppSelect
              v-model="versionForm.status"
              :options="versionStatusOptions" /></label
          ><label
            ><span class="mb-1.5 block text-xs font-medium text-slate-600"
              >计划发布</span
            ><AppDateTimeField v-model="versionForm.plannedReleaseAt"
          /></label>
        </div>
        <label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >说明</span
          ><input
            v-model="versionForm.description"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        /></label>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-sm text-slate-500"
            @click="versionOpen = false"
          >
            取消</button
          ><button
            :disabled="saving"
            class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            创建版本
          </button>
        </div>
      </form></AppModal
    >
  </div>
</template>

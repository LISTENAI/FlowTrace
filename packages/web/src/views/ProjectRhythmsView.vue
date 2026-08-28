<script setup lang="ts">
import type {
  ProjectRhythm,
  StageWorkDomain,
  TemplateStage,
} from '@flowtrace/shared';
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  QueueListIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline';
import { onMounted, reactive, ref } from 'vue';
import { api } from '@/api';
import AppModal from '@/components/AppModal.vue';
import AppSelect from '@/components/AppSelect.vue';
import { createLocalId } from '@/lib/local-id';
import { stageWorkDomainOptions } from '@/lib/presentation';
import { toasts } from '@/state/toasts';

const rhythms = ref<ProjectRhythm[]>([]);
const loading = ref(true);
const savingId = ref('');
const createOpen = ref(false);
const deleteTarget = ref<ProjectRhythm>();
const newForm = reactive({
  name: '',
  description: '',
  stages: [
    { name: '需求梳理', workDomain: 'product' as StageWorkDomain },
    { name: '执行', workDomain: 'implementation' as StageWorkDomain },
    { name: '验证', workDomain: 'verification' as StageWorkDomain },
  ],
});

onMounted(load);

async function load() {
  loading.value = true;
  try {
    rhythms.value = await api.projectRhythms();
  } finally {
    loading.value = false;
  }
}

function emptyStage(order: number): TemplateStage {
  return {
    id: createLocalId(),
    name: '新环节',
    workDomain: 'other',
    order,
    ownerIds: [],
    dependsOnTemplateStageIds: [],
  };
}

function addStage(rhythm: ProjectRhythm) {
  rhythm.stages.push(emptyStage(rhythm.stages.length));
}

function moveStage(rhythm: ProjectRhythm, index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= rhythm.stages.length) return;
  const [stage] = rhythm.stages.splice(index, 1);
  if (!stage) return;
  rhythm.stages.splice(target, 0, stage);
  rhythm.stages.forEach((item, order) => (item.order = order));
}

function removeStage(rhythm: ProjectRhythm, index: number) {
  rhythm.stages.splice(index, 1);
  rhythm.stages.forEach((item, order) => (item.order = order));
}

async function save(rhythm: ProjectRhythm) {
  const stages = rhythm.stages.filter((stage) => stage.name.trim());
  if (!rhythm.name.trim() || !stages.length) {
    toasts.show('还不能保存', '节奏名称和至少一个环节不能为空', 'error');
    return;
  }
  savingId.value = rhythm.id;
  try {
    const updated = await api.updateProjectRhythm(rhythm.id, {
      name: rhythm.name.trim(),
      description: rhythm.description?.trim(),
      stages,
    });
    const index = rhythms.value.findIndex((item) => item.id === rhythm.id);
    rhythms.value[index] = updated;
    toasts.show('项目节奏已保存', `之后创建的项目可以选择「${updated.name}」`);
  } catch (error) {
    toasts.show(
      '保存失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    savingId.value = '';
  }
}

function addNewStage() {
  newForm.stages.push({ name: '', workDomain: 'other' });
}

async function createRhythm() {
  const stages = newForm.stages
    .map((stage) => ({ ...stage, name: stage.name.trim() }))
    .filter((stage) => stage.name);
  if (!newForm.name.trim() || !stages.length) return;
  savingId.value = 'new';
  try {
    const created = await api.createProjectRhythm({
      name: newForm.name.trim(),
      description: newForm.description.trim(),
      stages,
    });
    rhythms.value.push(created);
    createOpen.value = false;
    newForm.name = '';
    newForm.description = '';
    newForm.stages.splice(
      0,
      newForm.stages.length,
      { name: '需求梳理', workDomain: 'product' },
      { name: '执行', workDomain: 'implementation' },
      { name: '验证', workDomain: 'verification' },
    );
    toasts.show('项目节奏已添加', `「${created.name}」现在可用于创建项目`);
  } catch (error) {
    toasts.show(
      '添加失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    savingId.value = '';
  }
}

async function confirmDelete() {
  const rhythm = deleteTarget.value;
  if (!rhythm) return;
  savingId.value = rhythm.id;
  try {
    await api.deleteProjectRhythm(rhythm.id);
    rhythms.value = rhythms.value.filter((item) => item.id !== rhythm.id);
    deleteTarget.value = undefined;
    toasts.show('项目节奏已删除', '已经创建的项目及其环节不受影响');
  } catch (error) {
    toasts.show(
      '删除失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    savingId.value = '';
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
    <header
      class="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
    >
      <div>
        <div
          class="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
        >
          <QueueListIcon class="h-4 w-4" /> 全局设置
        </div>
        <h1
          class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl"
        >
          项目节奏
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          维护创建项目时可选的默认环节。这里的节奏可以自由增删，不限制系统能够承载的项目类型。
        </p>
      </div>
      <button
        class="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10"
        @click="createOpen = true"
      >
        <PlusIcon class="h-4 w-4" />添加项目节奏
      </button>
    </header>

    <div
      class="mt-7 rounded-2xl border border-indigo-100 bg-indigo-50/45 px-4 py-3 text-xs leading-5 text-indigo-800"
    >
      修改节奏只影响之后新建的项目。项目创建时会复制环节，已有项目和需求不会随模板变化。
    </div>

    <div v-if="loading" class="mt-6 space-y-4">
      <div
        v-for="i in 3"
        :key="i"
        class="surface h-48 animate-pulse bg-slate-100"
      />
    </div>

    <div v-else class="mt-6 space-y-4">
      <article
        v-for="(rhythm, rhythmIndex) in rhythms"
        :key="rhythm.id"
        class="surface relative overflow-visible focus-within:z-30"
      >
        <div
          class="grid gap-5 p-5 lg:grid-cols-[15rem_1fr_auto] lg:items-start"
        >
          <div class="space-y-3">
            <label class="block">
              <span
                class="mb-1.5 block text-[11px] font-semibold text-slate-400"
                >节奏名称</span
              >
              <input
                v-model="rhythm.name"
                class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
              />
            </label>
            <label class="block">
              <span
                class="mb-1.5 block text-[11px] font-semibold text-slate-400"
                >适用说明</span
              >
              <textarea
                v-model="rhythm.description"
                rows="2"
                class="focus-ring w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 outline-none focus:border-indigo-300 focus:bg-white"
              />
            </label>
          </div>

          <div>
            <span class="mb-1.5 block text-[11px] font-semibold text-slate-400"
              >默认环节</span
            >
            <div
              class="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-2"
            >
              <div
                v-for="(stage, index) in rhythm.stages"
                :key="stage.id"
                class="group relative grid min-h-10 min-w-0 grid-cols-[auto_minmax(0,1fr)_8rem_auto_auto_auto] items-center rounded-xl border border-slate-200 bg-white shadow-sm focus-within:z-20 focus-within:border-indigo-300"
              >
                <span
                  class="pl-2.5 font-mono text-[10px] font-semibold text-slate-300"
                  >{{ index + 1 }}</span
                >
                <input
                  v-model="stage.name"
                  :aria-label="`${rhythm.name}第 ${index + 1} 个环节`"
                  class="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs font-medium text-slate-700 outline-none"
                />
                <AppSelect
                  v-model="stage.workDomain"
                  compact
                  class="w-32"
                  :options="stageWorkDomainOptions"
                />
                <button
                  type="button"
                  class="rounded-md p-1 text-slate-300 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-25"
                  :disabled="index === 0"
                  :aria-label="`左移${stage.name || '空白环节'}`"
                  @click="moveStage(rhythm, index, -1)"
                >
                  <ChevronLeftIcon class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class="rounded-md p-1 text-slate-300 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-25"
                  :disabled="index === rhythm.stages.length - 1"
                  :aria-label="`右移${stage.name || '空白环节'}`"
                  @click="moveStage(rhythm, index, 1)"
                >
                  <ChevronRightIcon class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class="mr-1 rounded-md p-1 text-slate-300 opacity-60 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                  :aria-label="`删除${stage.name || '空白环节'}`"
                  @click="removeStage(rhythm, index)"
                >
                  <TrashIcon class="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                class="focus-ring stage-slot-action"
                @click="addStage(rhythm)"
              >
                <PlusIcon class="h-3.5 w-3.5" />添加环节
              </button>
            </div>
          </div>

          <div class="flex gap-2 lg:flex-col">
            <button
              :disabled="savingId === rhythm.id"
              class="focus-ring section-action section-action-primary justify-center disabled:opacity-50"
              @click="save(rhythm)"
            >
              <CheckIcon class="h-4 w-4" />{{
                savingId === rhythm.id ? '保存中…' : '保存'
              }}
            </button>
            <button
              class="focus-ring section-action section-action-danger justify-center"
              @click="deleteTarget = rhythm"
            >
              删除
            </button>
          </div>
        </div>
        <div
          class="rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-5 py-2 text-[10px] text-slate-400"
        >
          节奏 {{ String(rhythmIndex + 1).padStart(2, '0') }} ·
          {{ rhythm.stages.length }} 个默认环节
        </div>
      </article>

      <button
        v-if="!rhythms.length"
        class="focus-ring flex w-full flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/50 p-10 text-slate-500"
        @click="createOpen = true"
      >
        <PlusIcon class="h-6 w-6" />
        <span class="mt-2 text-sm font-semibold">添加第一个项目节奏</span>
      </button>
    </div>

    <AppModal
      :open="createOpen"
      title="添加项目节奏"
      description="用一组清晰的默认环节描述一种常用推进方式。"
      @close="createOpen = false"
    >
      <form class="space-y-4" @submit.prevent="createRhythm">
        <label class="block">
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >节奏名称</span
          >
          <input
            v-model="newForm.name"
            required
            placeholder="例如：算法研究"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:bg-white"
          />
        </label>
        <label class="block">
          <span class="mb-1.5 block text-xs font-medium text-slate-600"
            >适用说明</span
          >
          <textarea
            v-model="newForm.description"
            rows="2"
            placeholder="帮助团队判断何时选择它"
            class="focus-ring w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:bg-white"
          />
        </label>
        <fieldset>
          <legend class="mb-2 text-xs font-medium text-slate-600">
            默认环节
          </legend>
          <div class="space-y-2">
            <div
              v-for="(stage, index) in newForm.stages"
              :key="index"
              class="flex items-center gap-2"
            >
              <span
                class="w-5 text-center font-mono text-[10px] text-slate-400"
                >{{ index + 1 }}</span
              >
              <input
                v-model="stage.name"
                required
                class="focus-ring min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
              />
              <AppSelect
                v-model="stage.workDomain"
                compact
                class="w-36 shrink-0"
                :options="stageWorkDomainOptions"
              />
              <button
                v-if="newForm.stages.length > 1"
                type="button"
                class="rounded-lg p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                aria-label="删除环节"
                @click="newForm.stages.splice(index, 1)"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
          <button
            type="button"
            class="focus-ring stage-slot-action mt-2 w-full"
            @click="addNewStage"
          >
            <PlusIcon class="h-3.5 w-3.5" />继续添加环节
          </button>
        </fieldset>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2.5 text-sm text-slate-500"
            @click="createOpen = false"
          >
            取消
          </button>
          <button
            :disabled="savingId === 'new'"
            class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {{ savingId === 'new' ? '正在添加…' : '添加项目节奏' }}
          </button>
        </div>
      </form>
    </AppModal>

    <AppModal
      :open="Boolean(deleteTarget)"
      title="删除项目节奏"
      :description="`确认删除「${deleteTarget?.name ?? ''}」？已有项目不会受到影响。`"
      @close="deleteTarget = undefined"
    >
      <div class="flex justify-end gap-2">
        <button
          class="rounded-xl px-4 py-2.5 text-sm text-slate-500"
          @click="deleteTarget = undefined"
        >
          取消
        </button>
        <button
          class="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white"
          @click="confirmDelete"
        >
          确认删除
        </button>
      </div>
    </AppModal>
  </div>
</template>

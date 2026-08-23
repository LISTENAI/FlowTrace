<script setup lang="ts">
import { PlusIcon, UserGroupIcon } from '@heroicons/vue/24/outline';
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '@/api';
import AppModal from '@/components/AppModal.vue';
import { toasts } from '@/state/toasts';
import { loadWorkspace, workspace } from '@/state/workspace';

const modalOpen = ref(false);
const saving = ref(false);
const includeInactive = ref(true);
const people = ref(workspace.people);
const form = reactive({ name: '', note: '' });
const colors = [
  'bg-indigo-100 text-indigo-700',
  'bg-cyan-100 text-cyan-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];

const visible = computed(() =>
  includeInactive.value
    ? people.value
    : people.value.filter((item) => item.active),
);

async function load() {
  people.value = await api.people(true);
}

async function create() {
  saving.value = true;
  try {
    await api.createPerson(form);
    modalOpen.value = false;
    form.name = '';
    form.note = '';
    toasts.show('人员已加入目录');
    await Promise.all([load(), loadWorkspace(true)]);
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

async function toggleActive(id: string, active: boolean) {
  await api.updatePerson(id, { active: !active });
  toasts.show(
    active ? '人员已停用' : '人员已重新启用',
    '历史负责人关系保持不变',
  );
  await Promise.all([load(), loadWorkspace(true)]);
}

onMounted(load);
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div
          class="mb-2 flex items-center gap-2 text-xs font-medium text-indigo-600"
        >
          <UserGroupIcon class="h-4 w-4" />负责人目录
        </div>
        <h1
          class="text-2xl font-semibold tracking-[-.035em] text-slate-900 sm:text-3xl"
        >
          人员
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          这里只维护可选负责人，不创建账号或权限。
        </p>
      </div>
      <button
        class="focus-ring inline-flex items-center gap-2 self-start rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10"
        @click="modalOpen = true"
      >
        <PlusIcon class="h-4 w-4" />新增人员
      </button>
    </div>

    <div class="mt-7 flex items-center justify-between">
      <p class="text-xs text-slate-400">
        共 {{ people.length }} 人，{{
          people.filter((item) => item.active).length
        }}
        人启用
      </p>
      <label class="flex items-center gap-2 text-xs text-slate-500"
        ><input
          v-model="includeInactive"
          type="checkbox"
          class="accent-indigo-600"
        />显示已停用</label
      >
    </div>

    <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="(person, index) in visible"
        :key="person.id"
        class="surface flex items-center gap-4 p-4"
        :class="!person.active ? 'opacity-60' : ''"
      >
        <div
          class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-bold"
          :class="colors[index % colors.length]"
        >
          {{ person.name.slice(-2) }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h2 class="font-semibold text-slate-800">{{ person.name }}</h2>
            <span
              v-if="!person.active"
              class="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500"
              >已停用</span
            >
          </div>
          <p class="mt-0.5 truncate text-xs text-slate-400">
            {{ person.note || '未填写备注' }}
          </p>
        </div>
        <button
          class="rounded-lg px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          @click="toggleActive(person.id, person.active)"
        >
          {{ person.active ? '停用' : '启用' }}
        </button>
      </article>
    </div>

    <div
      class="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-4 text-xs leading-5 text-slate-500"
    >
      停用人员不会出现在新事项的默认选择中，但已有需求、阶段和 Bug
      中的负责人关系会永久保留。
    </div>

    <AppModal
      :open="modalOpen"
      title="新增负责人"
      description="人员仅用于被选为负责人，不会获得登录账号。"
      width="sm"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="create">
        <label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >姓名</span
          ><input
            v-model="form.name"
            required
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" /></label
        ><label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >备注（可选）</span
          ><input
            v-model="form.note"
            placeholder="例如：固件研发"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        /></label>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-sm text-slate-500"
            @click="modalOpen = false"
          >
            取消</button
          ><button
            :disabled="saving"
            class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            新增人员
          </button>
        </div>
      </form>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import type { Person } from '@flowtrace/shared';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  CheckCircleIcon,
  EllipsisHorizontalIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  PlusIcon,
  UserGroupIcon,
} from '@heroicons/vue/24/outline';
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '@/api';
import AppModal from '@/components/AppModal.vue';
import { personToneClass } from '@/lib/person-color';
import { toasts } from '@/state/toasts';
import { loadWorkspace, workspace } from '@/state/workspace';

const modalOpen = ref(false);
const saving = ref(false);
const editTarget = ref<Person>();
const editing = ref(false);
const includeInactive = ref(true);
const people = ref(workspace.people);
const form = reactive({ name: '', note: '' });
const editForm = reactive({ name: '', note: '' });
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

function openEdit(person: Person) {
  editForm.name = person.name;
  editForm.note = person.note ?? '';
  editTarget.value = person;
}

async function updateDetails() {
  if (!editTarget.value) return;
  editing.value = true;
  try {
    await api.updatePerson(editTarget.value.id, {
      name: editForm.name,
      note: editForm.note,
    });
    editTarget.value = undefined;
    toasts.show('人员资料已更新', '原有负责人关系保持不变');
    await Promise.all([load(), loadWorkspace(true)]);
  } catch (error) {
    toasts.show(
      '保存失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    editing.value = false;
  }
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
        v-for="person in visible"
        :key="person.id"
        class="person-card surface relative flex items-center gap-4 p-4"
        :class="!person.active ? 'opacity-60' : ''"
      >
        <div
          class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-bold"
          :class="personToneClass(person.id)"
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
        <Menu as="div" class="relative shrink-0">
          <MenuButton
            v-tooltip="`${person.name}的更多操作`"
            class="focus-ring grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            :aria-label="`${person.name}的更多操作`"
          >
            <EllipsisHorizontalIcon class="h-5 w-5" />
          </MenuButton>
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="translate-y-1 opacity-0 scale-95"
            enter-to-class="translate-y-0 opacity-100 scale-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="translate-y-0 opacity-100 scale-100"
            leave-to-class="translate-y-1 opacity-0 scale-95"
          >
            <MenuItems
              class="absolute right-0 z-30 mt-1.5 w-40 origin-top-right rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl outline-none"
            >
              <MenuItem v-slot="{ active }">
                <button
                  class="flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-600 transition"
                  :class="active ? 'bg-slate-100 text-slate-900' : ''"
                  @click="openEdit(person)"
                >
                  <PencilSquareIcon class="h-4 w-4 shrink-0" />修改资料
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  class="mt-0.5 flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-xs font-medium transition"
                  :class="[
                    person.active ? 'text-rose-600' : 'text-emerald-600',
                    active
                      ? person.active
                        ? 'bg-rose-50'
                        : 'bg-emerald-50'
                      : '',
                  ]"
                  @click="toggleActive(person.id, person.active)"
                >
                  <NoSymbolIcon v-if="person.active" class="h-4 w-4 shrink-0" />
                  <CheckCircleIcon v-else class="h-4 w-4 shrink-0" />
                  {{ person.active ? '停用人员' : '重新启用' }}
                </button>
              </MenuItem>
            </MenuItems>
          </Transition>
        </Menu>
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

    <AppModal
      :open="Boolean(editTarget)"
      title="修改人员资料"
      description="人员标识和既有负责人关系不会因改名而改变。"
      width="sm"
      @close="editTarget = undefined"
    >
      <form class="space-y-4" @submit.prevent="updateDetails">
        <label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >姓名</span
          ><input
            v-model="editForm.name"
            required
            maxlength="50"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" /></label
        ><label class="block"
          ><span class="mb-1.5 block text-xs font-medium text-slate-600"
            >备注（可选）</span
          ><input
            v-model="editForm.note"
            class="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        /></label>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-sm text-slate-500"
            @click="editTarget = undefined"
          >
            取消</button
          ><button
            :disabled="editing"
            class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {{ editing ? '保存中…' : '保存修改' }}
          </button>
        </div>
      </form>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import type { Person } from '@flowtrace/shared';
import {
  AdjustmentsHorizontalIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/vue/24/outline';
import dayjs from 'dayjs';
import { computed, ref, watch } from 'vue';
import AppDateTimeField from '@/components/AppDateTimeField.vue';
import OwnerPicker from '@/components/OwnerPicker.vue';
import { newStagePlanDraft, type StagePlanDraft } from '@/lib/stage-plan';

const props = withDefaults(
  defineProps<{
    modelValue: StagePlanDraft[];
    people: Person[];
    defaultStartAt?: string;
    defaultEndAt?: string;
    allowRemoveExisting?: boolean;
    showSchedule?: boolean;
    compact?: boolean;
    collapsible?: boolean;
  }>(),
  {
    allowRemoveExisting: false,
    showSchedule: true,
    compact: false,
    collapsible: false,
  },
);
const emit = defineEmits<{
  'update:modelValue': [value: StagePlanDraft[]];
  'request-expand': [];
  'request-collapse': [];
}>();
const ownerRowId = ref('');
const selectedRowId = ref('');

const selectedIndex = computed(() =>
  props.modelValue.findIndex((row) => row.localId === selectedRowId.value),
);
const selectedRow = computed(() =>
  selectedIndex.value >= 0 ? props.modelValue[selectedIndex.value] : undefined,
);
const selectedOwnerIds = computed({
  get: () => selectedRow.value?.ownerIds ?? [],
  set: (ownerIds: string[]) => updateSelectedRow({ ownerIds }),
});
const selectedPlannedStartAt = computed({
  get: () => selectedRow.value?.plannedStartAt ?? '',
  set: (plannedStartAt: string) => updateSelectedRow({ plannedStartAt }),
});
const selectedPlannedEndAt = computed({
  get: () => selectedRow.value?.plannedEndAt ?? '',
  set: (plannedEndAt: string) => updateSelectedRow({ plannedEndAt }),
});

watch(
  () => props.modelValue,
  (rows) => {
    if (!rows.some((row) => row.localId === selectedRowId.value))
      selectedRowId.value = rows[0]?.localId ?? '';
  },
  { immediate: true },
);

function replace(rows: StagePlanDraft[]) {
  emit('update:modelValue', rows);
}

function updateRow(index: number, patch: Partial<StagePlanDraft>) {
  replace(
    props.modelValue.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row,
    ),
  );
}

function updateSelectedRow(patch: Partial<StagePlanDraft>) {
  if (selectedIndex.value < 0) return;
  updateRow(selectedIndex.value, patch);
}

function addRow() {
  replace([
    ...props.modelValue,
    newStagePlanDraft({
      plannedStartAt: props.defaultStartAt ?? '',
      plannedEndAt: props.defaultEndAt ?? '',
    }),
  ]);
}

function removeRow(index: number) {
  const row = props.modelValue[index];
  if (!row || (row.id && !props.allowRemoveExisting)) return;
  replace(props.modelValue.filter((_, rowIndex) => rowIndex !== index));
  if (ownerRowId.value === row.localId) ownerRowId.value = '';
}

function moveRow(index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= props.modelValue.length) return;
  const rows = [...props.modelValue];
  const [row] = rows.splice(index, 1);
  if (!row) return;
  rows.splice(target, 0, row);
  replace(rows);
}

function distributeSchedule() {
  if (!props.modelValue.length || !props.defaultStartAt || !props.defaultEndAt)
    return;
  const start = dayjs(props.defaultStartAt).startOf('day');
  const end = dayjs(props.defaultEndAt).startOf('day');
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) return;
  const totalDays = Math.max(1, end.diff(start, 'day') + 1);
  replace(
    props.modelValue.map((row, index) => {
      const rowStart = start.add(
        Math.floor((totalDays * index) / props.modelValue.length),
        'day',
      );
      const nextOffset = Math.floor(
        (totalDays * (index + 1)) / props.modelValue.length,
      );
      const rowEnd = start.add(
        Math.max(
          Math.floor((totalDays * index) / props.modelValue.length),
          nextOffset - 1,
        ),
        'day',
      );
      return {
        ...row,
        plannedStartAt: rowStart.format('YYYY-MM-DD'),
        plannedEndAt: rowEnd.format('YYYY-MM-DD'),
      };
    }),
  );
}

function ownerLabel(row: StagePlanDraft) {
  const names = row.ownerIds
    .map((id) => props.people.find((person) => person.id === id)?.name)
    .filter(Boolean) as string[];
  if (!names.length) return '待分配';
  if (names.length <= 2) return names.join('、');
  return `${names.slice(0, 2).join('、')}等 ${names.length} 人`;
}

function scheduleLabel(row: StagePlanDraft) {
  if (!row.plannedStartAt && !row.plannedEndAt) return '未排期';
  const start = row.plannedStartAt
    ? dayjs(row.plannedStartAt).format('M/D')
    : '待定';
  const end = row.plannedEndAt ? dayjs(row.plannedEndAt).format('M/D') : '待定';
  return `${start}–${end}`;
}
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-slate-50/50">
    <template v-if="compact">
      <div
        class="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2.5"
      >
        <span class="text-xs font-semibold text-slate-700"
          >{{ modelValue.length }} 个阶段</span
        >
        <button
          type="button"
          class="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[11px] font-semibold text-indigo-600 shadow-sm ring-1 ring-slate-200 transition hover:ring-indigo-200"
          @click="emit('request-expand')"
        >
          <AdjustmentsHorizontalIcon class="h-3.5 w-3.5" />详细编辑
        </button>
      </div>

      <div v-if="modelValue.length" class="p-3">
        <div class="overflow-x-auto pb-2">
          <div class="flex min-w-max items-center gap-2">
            <template v-for="(row, index) in modelValue" :key="row.localId">
              <button
                type="button"
                class="focus-ring min-w-32 max-w-44 rounded-xl border px-3 py-2 text-left transition"
                :class="
                  selectedRowId === row.localId
                    ? 'border-indigo-300 bg-white shadow-sm ring-2 ring-indigo-100'
                    : 'border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white'
                "
                @click="selectedRowId = row.localId"
              >
                <span
                  class="block truncate text-xs font-semibold text-slate-700"
                  >{{ row.name || `阶段 ${index + 1}` }}</span
                >
                <span
                  class="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400"
                >
                  <span class="max-w-20 truncate">{{ ownerLabel(row) }}</span>
                  <span v-if="showSchedule" class="text-slate-300">·</span>
                  <span v-if="showSchedule">{{ scheduleLabel(row) }}</span>
                </span>
              </button>
              <ArrowRightIcon
                v-if="index < modelValue.length - 1"
                class="h-4 w-4 shrink-0 text-slate-300"
              />
            </template>
          </div>
        </div>

        <div
          v-if="selectedRow"
          class="mt-1 grid gap-3 rounded-xl border border-indigo-100 bg-white p-3 lg:items-end"
          :class="showSchedule ? 'lg:grid-cols-[1fr_9.5rem_9.5rem]' : ''"
        >
          <label class="min-w-0">
            <span class="mb-1 block text-[10px] font-medium text-slate-500"
              >{{ selectedRow.name || '当前阶段' }}负责人</span
            >
            <OwnerPicker v-model="selectedOwnerIds" :people="people" />
          </label>
          <label v-if="showSchedule" class="min-w-0">
            <span class="mb-1 block text-[10px] font-medium text-slate-500"
              >计划开始</span
            >
            <AppDateTimeField v-model="selectedPlannedStartAt" />
          </label>
          <label v-if="showSchedule" class="min-w-0">
            <span class="mb-1 block text-[10px] font-medium text-slate-500"
              >计划完成</span
            >
            <AppDateTimeField
              v-model="selectedPlannedEndAt"
              :min="selectedPlannedStartAt"
            />
          </label>
        </div>
      </div>

      <button
        v-else
        type="button"
        class="focus-ring m-3 flex min-h-16 w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-400 transition hover:border-indigo-300 hover:bg-white hover:text-indigo-600"
        @click="addRow"
      >
        <PlusIcon class="h-4 w-4" />添加第一个阶段
      </button>
    </template>

    <template v-else>
      <div
        class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5"
      >
        <p class="text-xs font-semibold text-slate-700">
          {{ modelValue.length }} 个阶段
        </p>
        <div class="flex items-center gap-1.5">
          <button
            v-if="collapsible"
            type="button"
            class="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-slate-500 transition hover:bg-white hover:text-indigo-600"
            @click="emit('request-collapse')"
          >
            <ArrowRightIcon class="h-3.5 w-3.5 rotate-180" />简要设置
          </button>
          <button
            v-if="
              showSchedule &&
              defaultStartAt &&
              defaultEndAt &&
              modelValue.length
            "
            type="button"
            class="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-slate-500 transition hover:bg-white hover:text-indigo-600"
            @click="distributeSchedule"
          >
            <CalendarDaysIcon class="h-3.5 w-3.5" />均分排期
          </button>
          <button
            type="button"
            class="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[11px] font-semibold text-indigo-600 shadow-sm ring-1 ring-slate-200 transition hover:ring-indigo-200"
            @click="addRow"
          >
            <PlusIcon class="h-3.5 w-3.5" />添加阶段
          </button>
        </div>
      </div>

      <div
        v-if="modelValue.length"
        class="hidden gap-2 px-3 pb-1 pt-2 text-[10px] font-medium text-slate-400 lg:grid"
        :class="
          showSchedule
            ? 'grid-cols-[2.5rem_minmax(10rem,1fr)_8.5rem_9.25rem_9.25rem_2rem]'
            : 'grid-cols-[2.5rem_minmax(10rem,1fr)_8.5rem_2rem]'
        "
      >
        <span>顺序</span><span>阶段名称与说明</span><span>负责人</span
        ><template v-if="showSchedule"
          ><span>计划开始</span><span>计划结束</span></template
        ><span />
      </div>

      <div v-if="modelValue.length" class="space-y-2 p-2 pt-1">
        <article
          v-for="(row, index) in modelValue"
          :key="row.localId"
          class="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[.025]"
        >
          <div
            class="grid gap-2 p-2.5 lg:items-center"
            :class="
              showSchedule
                ? 'lg:grid-cols-[2.5rem_minmax(10rem,1fr)_8.5rem_9.25rem_9.25rem_2rem]'
                : 'lg:grid-cols-[2.5rem_minmax(10rem,1fr)_8.5rem_2rem]'
            "
          >
            <div class="flex items-center gap-0.5 max-lg:justify-between">
              <span
                class="grid h-7 min-w-7 place-items-center rounded-lg bg-slate-100 px-1 text-[10px] font-bold text-slate-400"
                >{{ index + 1 }}</span
              >
              <span class="flex lg:flex-col">
                <button
                  type="button"
                  class="focus-ring grid h-5 w-5 place-items-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-20"
                  :disabled="index === 0"
                  :aria-label="`上移${row.name || `阶段 ${index + 1}`}`"
                  @click="moveRow(index, -1)"
                >
                  <ChevronUpIcon class="h-3 w-3" />
                </button>
                <button
                  type="button"
                  class="focus-ring grid h-5 w-5 place-items-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-20"
                  :disabled="index === modelValue.length - 1"
                  :aria-label="`下移${row.name || `阶段 ${index + 1}`}`"
                  @click="moveRow(index, 1)"
                >
                  <ChevronDownIcon class="h-3 w-3" />
                </button>
              </span>
            </div>

            <div class="min-w-0 space-y-1.5">
              <input
                :value="row.name"
                required
                :placeholder="`阶段 ${index + 1} 的名称`"
                class="focus-ring w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
                @input="
                  updateRow(index, {
                    name: ($event.target as HTMLInputElement).value,
                  })
                "
              />
              <input
                :value="row.note"
                placeholder="阶段说明（可选）"
                class="focus-ring w-full rounded-lg border border-transparent bg-transparent px-2.5 py-1 text-[10px] text-slate-500 outline-none hover:border-slate-200 hover:bg-slate-50 focus:border-indigo-200 focus:bg-white"
                @input="
                  updateRow(index, {
                    note: ($event.target as HTMLInputElement).value,
                  })
                "
              />
            </div>

            <button
              type="button"
              class="focus-ring flex min-h-10 min-w-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-left text-[11px] font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-white"
              :aria-expanded="ownerRowId === row.localId"
              @click="
                ownerRowId = ownerRowId === row.localId ? '' : row.localId
              "
            >
              <UserGroupIcon class="h-3.5 w-3.5 shrink-0 text-indigo-500" />
              <span class="min-w-0 flex-1 truncate">{{ ownerLabel(row) }}</span>
            </button>

            <label v-if="showSchedule" class="min-w-0">
              <span class="mb-1 block text-[10px] text-slate-400 lg:hidden"
                >计划开始</span
              >
              <AppDateTimeField
                :model-value="row.plannedStartAt"
                @update:model-value="
                  updateRow(index, { plannedStartAt: $event })
                "
              />
            </label>
            <label v-if="showSchedule" class="min-w-0">
              <span class="mb-1 block text-[10px] text-slate-400 lg:hidden"
                >计划结束</span
              >
              <AppDateTimeField
                :model-value="row.plannedEndAt"
                :min="row.plannedStartAt"
                @update:model-value="updateRow(index, { plannedEndAt: $event })"
              />
            </label>

            <button
              v-if="!row.id || allowRemoveExisting"
              type="button"
              class="focus-ring grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 max-lg:justify-self-end"
              aria-label="移除此阶段"
              @click="removeRow(index)"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
            <span v-else />
          </div>

          <div
            v-if="ownerRowId === row.localId"
            class="border-t border-slate-100 bg-slate-50/60 p-3"
          >
            <p class="mb-2 text-[10px] font-medium text-slate-500">
              为「{{ row.name || `阶段 ${index + 1}` }}」选择负责人
            </p>
            <OwnerPicker
              :model-value="row.ownerIds"
              :people="people"
              @update:model-value="updateRow(index, { ownerIds: $event })"
            />
          </div>
        </article>
      </div>

      <button
        v-else
        type="button"
        class="focus-ring m-3 flex min-h-20 w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-400 transition hover:border-indigo-300 hover:bg-white hover:text-indigo-600"
        @click="addRow"
      >
        <PlusIcon class="h-4 w-4" />添加第一个阶段
      </button>
    </template>
  </section>
</template>

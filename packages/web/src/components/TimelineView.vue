<script setup lang="ts">
import type { Bug, Requirement, Stage } from '@flowtrace/shared';
import { BugAntIcon, ChevronDownIcon } from '@heroicons/vue/24/outline';
import dayjs from 'dayjs';
import { computed, reactive } from 'vue';
import { formatDate, statusDot } from '@/lib/presentation';

const props = defineProps<{
  requirements: Requirement[];
  mode: 'baseline' | 'current' | 'actual';
}>();

const expanded = reactive(new Set<string>());
const allItems = computed(() =>
  props.requirements.flatMap((item) => [...item.stages, ...item.bugs]),
);
const range = computed(() => {
  const values = allItems.value
    .flatMap((item) => [
      item.baselineStartAt,
      item.baselineEndAt,
      item.plannedStartAt,
      item.plannedEndAt,
      item.actualStartAt,
      item.actualEndAt,
    ])
    .filter(Boolean) as string[];
  const today = dayjs();
  const min = values.length
    ? dayjs(Math.min(...values.map((value) => dayjs(value).valueOf())))
        .startOf('day')
        .subtract(2, 'day')
    : today.subtract(14, 'day');
  const max = values.length
    ? dayjs(Math.max(...values.map((value) => dayjs(value).valueOf())))
        .startOf('day')
        .add(3, 'day')
    : today.add(14, 'day');
  const days = Math.max(14, max.diff(min, 'day') + 1);
  return { min, max, days };
});

const headers = computed(() =>
  Array.from({ length: range.value.days }, (_, index) =>
    range.value.min.add(index, 'day'),
  ),
);

function bounds(item: Stage | Bug) {
  const start =
    props.mode === 'baseline'
      ? item.baselineStartAt
      : props.mode === 'actual'
        ? item.actualStartAt
        : item.plannedStartAt;
  const end =
    props.mode === 'baseline'
      ? item.baselineEndAt
      : props.mode === 'actual'
        ? item.actualEndAt ||
          (item.actualStartAt ? new Date().toISOString() : undefined)
        : item.plannedEndAt;
  if (!start || !end) return undefined;
  const left =
    (dayjs(start).startOf('day').diff(range.value.min, 'day') /
      range.value.days) *
    100;
  const width =
    (Math.max(
      1,
      dayjs(end).startOf('day').diff(dayjs(start).startOf('day'), 'day') + 1,
    ) /
      range.value.days) *
    100;
  return {
    left: `${Math.max(0, left)}%`,
    width: `${Math.min(100 - left, width)}%`,
  };
}

function requirementBounds(requirement: Requirement) {
  const start =
    props.mode === 'baseline'
      ? requirement.baselineStartAt
      : props.mode === 'actual'
        ? requirement.actualStartAt
        : requirement.plannedStartAt;
  const end =
    props.mode === 'baseline'
      ? requirement.baselineEndAt
      : props.mode === 'actual'
        ? requirement.actualEndAt ||
          (requirement.actualStartAt ? new Date().toISOString() : undefined)
        : requirement.plannedEndAt;
  if (!start || !end) return undefined;
  const left =
    (dayjs(start).startOf('day').diff(range.value.min, 'day') /
      range.value.days) *
    100;
  const width =
    (Math.max(
      1,
      dayjs(end).startOf('day').diff(dayjs(start).startOf('day'), 'day') + 1,
    ) /
      range.value.days) *
    100;
  return {
    left: `${Math.max(0, left)}%`,
    width: `${Math.min(100 - left, width)}%`,
  };
}

function segments(item: Stage | Bug) {
  if (props.mode !== 'actual' || !item.statusHistory.length) return [];
  return item.statusHistory.map((history, index) => {
    const next = item.statusHistory[index + 1];
    const start = dayjs(history.effectiveAt);
    const end = next ? dayjs(next.effectiveAt) : dayjs();
    const left =
      (start.startOf('day').diff(range.value.min, 'day') / range.value.days) *
      100;
    const width =
      (Math.max(0.35, end.diff(start, 'day', true)) / range.value.days) * 100;
    return {
      id: history.id,
      status: history.toStatus,
      left: `${Math.max(0, left)}%`,
      width: `${Math.max(0.6, Math.min(100 - left, width))}%`,
      title: `${formatDate(history.effectiveAt)} · ${history.reason || ''}`,
    };
  });
}

function toggle(id: string) {
  if (expanded.has(id)) expanded.delete(id);
  else expanded.add(id);
}
</script>

<template>
  <div class="surface overflow-hidden">
    <div class="overflow-x-auto">
      <div class="min-w-[68rem]">
        <div
          class="grid grid-cols-[18rem_1fr] border-b border-slate-100 bg-slate-50/70"
        >
          <div
            class="flex items-end px-5 py-3 text-[11px] font-semibold tracking-[.08em] text-slate-400"
          >
            需求与过程
          </div>
          <div class="relative flex h-14">
            <div
              v-for="(day, index) in headers"
              :key="day.toISOString()"
              class="flex min-w-0 flex-1 flex-col items-center justify-center border-l text-[9px]"
              :class="
                day.isSame(dayjs(), 'day')
                  ? 'border-indigo-200 bg-indigo-50/60 font-semibold text-indigo-600'
                  : index % 7 === 0
                    ? 'border-slate-200 text-slate-500'
                    : 'border-slate-100 text-slate-400'
              "
            >
              <span>{{ day.format('D') }}</span>
              <span v-if="index === 0 || day.date() === 1" class="text-[8px]">{{
                day.format('M月')
              }}</span>
            </div>
          </div>
        </div>

        <template v-for="requirement in requirements" :key="requirement.id">
          <button
            class="grid w-full grid-cols-[18rem_1fr] border-b border-slate-100 bg-white text-left hover:bg-slate-50/60"
            @click="toggle(requirement.id)"
          >
            <div class="flex h-12 items-center gap-2 px-4">
              <ChevronDownIcon
                class="h-3.5 w-3.5 text-slate-400 transition"
                :class="expanded.has(requirement.id) ? '' : '-rotate-90'"
              />
              <span
                class="font-mono text-[10px] font-semibold text-indigo-500"
                >{{ requirement.key }}</span
              >
              <span
                class="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800"
                >{{ requirement.title }}</span
              >
            </div>
            <div
              class="relative h-12 bg-[repeating-linear-gradient(90deg,transparent,transparent_calc((100%/var(--days))-1px),#f2f3f7_calc((100%/var(--days))-1px),#f2f3f7_calc(100%/var(--days)))]"
              :style="{ '--days': range.days }"
            >
              <div
                v-if="requirementBounds(requirement)"
                class="absolute top-[19px] h-1.5 rounded-full bg-slate-300/60"
                :style="requirementBounds(requirement)"
              />
            </div>
          </button>

          <template v-if="expanded.has(requirement.id)">
            <div
              v-for="item in [...requirement.stages, ...requirement.bugs]"
              :key="item.id"
              class="grid grid-cols-[18rem_1fr] border-b border-slate-100/80 bg-white"
            >
              <div class="flex h-10 items-center gap-2 pl-10 pr-4">
                <BugAntIcon
                  v-if="'key' in item"
                  class="h-3.5 w-3.5 text-rose-400"
                />
                <span
                  v-else
                  class="h-2 w-2 rounded-full"
                  :class="statusDot[item.status]"
                />
                <span
                  class="min-w-0 flex-1 truncate text-[11px] text-slate-600"
                  >{{ 'title' in item ? item.title : item.name }}</span
                >
              </div>
              <div
                class="relative h-10 bg-[repeating-linear-gradient(90deg,transparent,transparent_calc((100%/var(--days))-1px),#f4f5f8_calc((100%/var(--days))-1px),#f4f5f8_calc(100%/var(--days)))]"
                :style="{ '--days': range.days }"
              >
                <template v-if="mode === 'actual' && segments(item).length">
                  <div
                    v-for="segment in segments(item)"
                    :key="segment.id"
                    class="absolute top-[14px] h-3 min-w-1 rounded-sm"
                    :class="statusDot[segment.status]"
                    :style="{ left: segment.left, width: segment.width }"
                    :title="segment.title"
                  />
                </template>
                <div
                  v-else-if="bounds(item)"
                  class="absolute top-[14px] h-3 rounded-md"
                  :class="
                    mode === 'baseline'
                      ? 'border border-dashed border-slate-400 bg-slate-100'
                      : item.status === 'done'
                        ? 'bg-emerald-400'
                        : 'bg-indigo-400'
                  "
                  :style="bounds(item)"
                />
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>
    <div
      class="flex flex-wrap items-center gap-4 border-t border-slate-100 bg-white px-5 py-3 text-[10px] text-slate-400"
    >
      <template v-if="mode === 'actual'">
        <span class="flex items-center gap-1.5"
          ><i class="h-2 w-4 rounded-sm bg-indigo-500" />实际工作</span
        >
        <span class="flex items-center gap-1.5"
          ><i class="h-2 w-4 rounded-sm bg-amber-400" />等待中</span
        >
        <span class="flex items-center gap-1.5"
          ><i class="h-2 w-4 rounded-sm bg-rose-500" />阻塞</span
        >
        <span class="flex items-center gap-1.5"
          ><i class="h-2 w-4 rounded-sm bg-emerald-500" />已完成</span
        >
      </template>
      <span v-else>{{
        mode === 'baseline' ? '虚线代表初始基准计划' : '色块代表当前最新计划'
      }}</span>
    </div>
  </div>
</template>

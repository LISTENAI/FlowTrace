<script setup lang="ts">
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import dayjs, { type Dayjs } from 'dayjs';
import { computed, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    mode?: 'date' | 'datetime';
    placeholder?: string;
    required?: boolean;
    min?: string;
    max?: string;
  }>(),
  {
    mode: 'date',
    placeholder: '选择日期',
    required: false,
    min: undefined,
    max: undefined,
  },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const visibleMonth = ref(dayjs().startOf('month'));
const timeText = ref('09:00');
const openAbove = ref(false);
const alignRight = ref(false);
const panelMaxHeight = ref(480);
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

const selected = computed(() => {
  if (!props.modelValue) return undefined;
  const value = dayjs(props.modelValue);
  return value.isValid() ? value : undefined;
});
const displayValue = computed(() => {
  if (!selected.value) return props.placeholder;
  return selected.value.format(
    props.mode === 'datetime' ? 'YYYY年M月D日 HH:mm' : 'YYYY年M月D日',
  );
});
const calendarDays = computed(() => {
  const first = visibleMonth.value.startOf('month');
  const mondayOffset = (first.day() + 6) % 7;
  const start = first.subtract(mondayOffset, 'day');
  return Array.from({ length: 42 }, (_, index) => start.add(index, 'day'));
});

watch(
  () => props.modelValue,
  (value) => {
    const date = value ? dayjs(value) : undefined;
    if (date?.isValid()) {
      visibleMonth.value = date.startOf('month');
      timeText.value = date.format('HH:mm');
    }
  },
  { immediate: true },
);

function valueFor(day: Dayjs, time = timeText.value) {
  if (props.mode === 'date') return day.format('YYYY-MM-DD');
  const normalizedTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    ? time
    : '09:00';
  return `${day.format('YYYY-MM-DD')}T${normalizedTime}`;
}

function isDisabled(day: Dayjs) {
  const value = day.startOf('day');
  if (props.min && value.isBefore(dayjs(props.min).startOf('day'))) return true;
  if (props.max && value.isAfter(dayjs(props.max).startOf('day'))) return true;
  return false;
}

function selectDay(day: Dayjs, close: () => void) {
  if (isDisabled(day)) return;
  emit('update:modelValue', valueFor(day));
  if (props.mode === 'date') close();
}

function updateTime() {
  if (!selected.value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeText.value))
    return;
  emit('update:modelValue', valueFor(selected.value, timeText.value));
}

function selectNow() {
  const value = dayjs();
  visibleMonth.value = value.startOf('month');
  timeText.value = value.format('HH:mm');
  emit('update:modelValue', valueFor(value, timeText.value));
}

function updatePanelPlacement(event: MouseEvent | KeyboardEvent) {
  const trigger = event.currentTarget as HTMLElement | null;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const panelWidth = Math.min(304, window.innerWidth - 32);
  const panelHeight = props.mode === 'datetime' ? 430 : 380;
  const spaceAbove = rect.top - 16;
  const spaceBelow = window.innerHeight - rect.bottom - 16;
  openAbove.value = spaceBelow < panelHeight && spaceAbove > spaceBelow;
  panelMaxHeight.value = Math.max(
    160,
    Math.floor(openAbove.value ? spaceAbove : spaceBelow),
  );
  alignRight.value = rect.left + panelWidth > window.innerWidth - 16;
}
</script>

<template>
  <Popover v-slot="{ close }" as="div" class="relative">
    <PopoverButton
      class="focus-ring flex min-h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white"
      @click="updatePanelPlacement"
      @keydown.enter="updatePanelPlacement"
      @keydown.space="updatePanelPlacement"
    >
      <CalendarDaysIcon class="h-4 w-4 shrink-0 text-indigo-500" />
      <span
        class="min-w-0 flex-1 truncate"
        :class="selected ? '' : 'text-slate-400'"
      >
        {{ displayValue }}
      </span>
      <ClockIcon
        v-if="mode === 'datetime'"
        class="h-4 w-4 shrink-0 text-slate-400"
      />
    </PopoverButton>
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="translate-y-1 opacity-0 scale-[.98]"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="translate-y-1 opacity-0 scale-[.98]"
    >
      <PopoverPanel
        class="absolute z-[110] max-h-[calc(100vh-2rem)] w-[19rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl shadow-slate-900/10 backdrop-blur-xl"
        :class="[
          openAbove ? 'bottom-full mb-2' : 'mt-2',
          alignRight ? 'right-0' : 'left-0',
        ]"
        :style="{ maxHeight: `${panelMaxHeight}px` }"
      >
        <div class="flex items-center justify-between px-1">
          <button
            type="button"
            class="focus-ring grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="上个月"
            @click="visibleMonth = visibleMonth.subtract(1, 'month')"
          >
            <ChevronLeftIcon class="h-4 w-4" />
          </button>
          <p class="text-sm font-semibold text-slate-800">
            {{ visibleMonth.format('YYYY年 M月') }}
          </p>
          <button
            type="button"
            class="focus-ring grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="下个月"
            @click="visibleMonth = visibleMonth.add(1, 'month')"
          >
            <ChevronRightIcon class="h-4 w-4" />
          </button>
        </div>
        <div class="mt-2 grid grid-cols-7 gap-1">
          <span
            v-for="weekday in weekdays"
            :key="weekday"
            class="grid h-7 place-items-center text-[10px] font-semibold text-slate-400"
            >{{ weekday }}</span
          >
          <button
            v-for="day in calendarDays"
            :key="day.format('YYYY-MM-DD')"
            type="button"
            class="focus-ring grid h-8 place-items-center rounded-lg text-xs font-medium transition"
            :class="[
              selected?.isSame(day, 'day')
                ? 'bg-indigo-500 text-white shadow-sm'
                : day.isSame(dayjs(), 'day')
                  ? 'bg-indigo-50 text-indigo-700'
                  : day.month() === visibleMonth.month()
                    ? 'text-slate-700 hover:bg-slate-100'
                    : 'text-slate-300 hover:bg-slate-50',
              isDisabled(day) ? 'cursor-not-allowed opacity-30' : '',
            ]"
            :disabled="isDisabled(day)"
            @click="selectDay(day, close)"
          >
            {{ day.date() }}
          </button>
        </div>

        <div
          v-if="mode === 'datetime'"
          class="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3"
        >
          <ClockIcon class="h-4 w-4 text-slate-400" />
          <input
            v-model="timeText"
            inputmode="numeric"
            maxlength="5"
            placeholder="09:00"
            class="focus-ring min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-700"
            @blur="updateTime"
            @keydown.enter.prevent="updateTime"
          />
          <button
            type="button"
            class="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
            @click="selectNow"
          >
            现在
          </button>
        </div>

        <div
          class="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"
        >
          <button
            v-if="!required && modelValue"
            type="button"
            class="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            @click="emit('update:modelValue', '')"
          >
            <XMarkIcon class="h-3.5 w-3.5" />清除
          </button>
          <span v-else />
          <button
            v-if="mode === 'datetime'"
            type="button"
            class="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white"
            @click="
              updateTime();
              close();
            "
          >
            完成
          </button>
          <button
            v-else
            type="button"
            class="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
            @click="selectDay(dayjs(), close)"
          >
            今天
          </button>
        </div>
      </PopoverPanel>
    </Transition>
  </Popover>
</template>

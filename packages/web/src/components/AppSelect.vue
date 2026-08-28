<script setup lang="ts" generic="T extends string | number">
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/vue/24/outline';
import { computed, ref } from 'vue';

export interface SelectOption<T> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    options: ReadonlyArray<SelectOption<T>>;
    placeholder?: string;
    disabled?: boolean;
    compact?: boolean;
  }>(),
  { placeholder: '请选择', disabled: false, compact: false },
);
const model = defineModel<T>({ required: true });
const openAbove = ref(false);
const alignRight = ref(false);
const optionsMaxHeight = ref(256);

const selected = computed(() =>
  props.options.find((option) => Object.is(option.value, model.value)),
);

function updateOptionsPlacement(event: MouseEvent | KeyboardEvent) {
  const trigger = event.currentTarget as HTMLElement | null;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const optionsWidth = Math.max(rect.width, 192);
  const spaceAbove = rect.top - 16;
  const spaceBelow = window.innerHeight - rect.bottom - 16;
  openAbove.value = spaceBelow < 272 && spaceAbove > spaceBelow;
  optionsMaxHeight.value = Math.max(
    112,
    Math.floor(openAbove.value ? spaceAbove : spaceBelow),
  );
  alignRight.value = rect.left + optionsWidth > window.innerWidth - 16;
}
</script>

<template>
  <Listbox
    v-model="model"
    :disabled="disabled"
    as="div"
    class="relative min-w-0 focus-within:z-[130]"
  >
    <ListboxButton
      class="focus-ring flex w-full items-center text-left text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      :class="
        compact
          ? 'h-7 gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-medium'
          : 'min-h-10 gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm'
      "
      @click="updateOptionsPlacement"
      @keydown.enter="updateOptionsPlacement"
      @keydown.space="updateOptionsPlacement"
    >
      <span
        class="min-w-0 flex-1 truncate"
        :class="selected ? '' : 'text-slate-400'"
      >
        {{ selected?.label ?? placeholder }}
      </span>
      <ChevronUpDownIcon
        class="shrink-0 text-slate-400"
        :class="compact ? 'h-3 w-3' : 'h-4 w-4'"
      />
    </ListboxButton>
    <Transition
      enter-active-class="transition duration-120 ease-out"
      enter-from-class="translate-y-1 opacity-0 scale-[.98]"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-90 ease-in"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="translate-y-1 opacity-0 scale-[.98]"
    >
      <ListboxOptions
        class="absolute z-[110] max-h-[min(16rem,calc(100vh-2rem))] w-full min-w-48 overflow-auto rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl outline-none"
        :class="[
          openAbove ? 'bottom-full mb-2' : 'mt-2',
          alignRight ? 'right-0' : 'left-0',
        ]"
        :style="{ maxHeight: `${optionsMaxHeight}px` }"
      >
        <ListboxOption
          v-for="option in options"
          :key="String(option.value)"
          v-slot="{
            active,
            selected: optionSelected,
            disabled: optionDisabled,
          }"
          :value="option.value"
          :disabled="option.disabled"
          as="template"
        >
          <li
            class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition"
            :class="[
              active ? 'bg-indigo-50/70' : '',
              optionDisabled ? 'cursor-not-allowed opacity-40' : '',
            ]"
          >
            <span
              class="grid h-5 w-5 shrink-0 place-items-center rounded-full border"
              :class="
                optionSelected
                  ? 'border-indigo-500 bg-indigo-500 text-white'
                  : 'border-slate-200 text-transparent'
              "
            >
              <CheckIcon class="h-3 w-3" />
            </span>
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-xs font-semibold text-slate-700"
                >{{ option.label }}</span
              >
              <span
                v-if="option.description"
                class="mt-0.5 block truncate text-[10px] text-slate-400"
                >{{ option.description }}</span
              >
            </span>
          </li>
        </ListboxOption>
      </ListboxOptions>
    </Transition>
  </Listbox>
</template>

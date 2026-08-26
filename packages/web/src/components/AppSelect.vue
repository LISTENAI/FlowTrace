<script setup lang="ts" generic="T extends string | number">
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/vue/24/outline';
import { computed } from 'vue';

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
  }>(),
  { placeholder: '请选择', disabled: false },
);
const model = defineModel<T>({ required: true });

const selected = computed(() =>
  props.options.find((option) => Object.is(option.value, model.value)),
);
</script>

<template>
  <Listbox v-model="model" :disabled="disabled" as="div" class="relative">
    <ListboxButton
      class="focus-ring flex min-h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        class="min-w-0 flex-1 truncate"
        :class="selected ? '' : 'text-slate-400'"
      >
        {{ selected?.label ?? placeholder }}
      </span>
      <ChevronUpDownIcon class="h-4 w-4 shrink-0 text-slate-400" />
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
        class="absolute z-[110] mt-2 max-h-64 w-full min-w-48 overflow-auto rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl outline-none"
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

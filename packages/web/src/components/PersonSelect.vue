<script setup lang="ts">
import type { Person } from '@flowtrace/shared';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/vue/24/outline';
import { computed, ref } from 'vue';
import { personToneClass } from '@/lib/person-color';

const props = defineProps<{ people: Person[] }>();
const model = defineModel<string>({ required: true });
const query = ref('');
const selected = computed(() =>
  props.people.find((person) => person.id === model.value),
);
const filtered = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase();
  const matches = keyword
    ? props.people.filter((person) =>
        `${person.name} ${person.email ?? ''} ${person.note ?? ''}`
          .toLocaleLowerCase()
          .includes(keyword),
      )
    : props.people;
  return matches.slice(0, 50);
});
</script>

<template>
  <Combobox v-model="model" as="div" class="relative w-full sm:w-72">
    <div
      class="focus-within:ring-indigo-200/70 relative flex h-11 items-center rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-indigo-300 focus-within:ring-2 dark:border-slate-700 dark:bg-slate-900"
    >
      <span
        v-if="selected"
        class="ml-2.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold"
        :class="personToneClass(selected.id)"
      >
        {{ selected.name.slice(-2) }}
      </span>
      <ComboboxInput
        class="min-w-0 flex-1 border-0 bg-transparent px-2.5 text-sm font-medium text-slate-700 outline-none dark:text-slate-100"
        :display-value="() => selected?.name ?? ''"
        placeholder="搜索人员"
        @change="query = ($event.target as HTMLInputElement).value"
      />
      <ComboboxButton
        class="focus-ring mr-1.5 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
        aria-label="选择人员"
      >
        <ChevronUpDownIcon class="h-4 w-4" />
      </ComboboxButton>
    </div>
    <ComboboxOptions
      class="absolute right-0 z-[100] mt-2 max-h-72 w-full min-w-72 overflow-auto rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl outline-none dark:border-slate-700 dark:bg-slate-900/95"
    >
      <ComboboxOption
        v-for="person in filtered"
        :key="person.id"
        v-slot="{ active, selected: isSelected }"
        :value="person.id"
        as="template"
      >
        <li
          class="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2"
          :class="active ? 'bg-indigo-50 dark:bg-indigo-950/50' : ''"
        >
          <span
            class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-bold"
            :class="personToneClass(person.id)"
            >{{ person.name.slice(-2) }}</span
          >
          <span class="min-w-0 flex-1">
            <span
              class="block truncate text-xs font-semibold text-slate-700 dark:text-slate-100"
              >{{ person.name }}</span
            >
            <span class="block truncate text-[10px] text-slate-400">
              {{ person.email || person.note || '未填写补充信息' }}
            </span>
          </span>
          <CheckIcon
            class="h-4 w-4 shrink-0 text-indigo-500"
            :class="isSelected ? '' : 'invisible'"
          />
        </li>
      </ComboboxOption>
      <p
        v-if="!filtered.length"
        class="px-3 py-6 text-center text-xs text-slate-400"
      >
        没有匹配的人员
      </p>
    </ComboboxOptions>
  </Combobox>
</template>

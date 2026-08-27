<script setup lang="ts">
import type { Person } from '@flowtrace/shared';
import {
  CheckIcon,
  ChevronUpDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { personToneClass } from '@/lib/person-color';

const props = defineProps<{ modelValue: string[]; people: Person[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();
const root = ref<HTMLElement>();
const query = ref('');
const open = ref(false);
const listboxId = `owner-picker-${useId()}`;

const selectedPeople = computed(
  () =>
    props.modelValue
      .map((id) => props.people.find((person) => person.id === id))
      .filter(Boolean) as Person[],
);

const allMatches = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase();
  return keyword
    ? props.people.filter((person) =>
        `${person.name} ${person.note ?? ''}`
          .toLocaleLowerCase()
          .includes(keyword),
      )
    : props.people;
});
const matchingPeople = computed(() =>
  allMatches.value.slice(0, query.value.trim() ? 50 : 20),
);
const hiddenResultCount = computed(() =>
  Math.max(0, allMatches.value.length - matchingPeople.value.length),
);

function toggle(personId: string) {
  emit(
    'update:modelValue',
    props.modelValue.includes(personId)
      ? props.modelValue.filter((id) => id !== personId)
      : [...props.modelValue, personId],
  );
  query.value = '';
  open.value = false;
}

function remove(personId: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((id) => id !== personId),
  );
}

function handleOutsideClick(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener('pointerdown', handleOutsideClick));
onBeforeUnmount(() =>
  document.removeEventListener('pointerdown', handleOutsideClick),
);
</script>

<template>
  <div v-if="people.length" ref="root" class="relative">
    <div
      class="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-200"
    >
      <span
        v-for="person in selectedPeople"
        :key="person.id"
        class="inline-flex min-w-0 items-center gap-1 rounded-lg bg-white py-1 pl-1.5 pr-1 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
      >
        <span
          class="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[9px] font-bold"
          :class="personToneClass(person.id)"
          aria-hidden="true"
          >{{ person.name.slice(-2) }}</span
        >
        <span class="max-w-24 truncate">{{ person.name }}</span>
        <button
          type="button"
          class="focus-ring grid h-5 w-5 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          :aria-label="`移除负责人 ${person.name}`"
          @click.stop="remove(person.id)"
        >
          <XMarkIcon class="h-3 w-3" />
        </button>
      </span>
      <MagnifyingGlassIcon class="ml-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <input
        v-model="query"
        role="combobox"
        :aria-expanded="open"
        aria-label="搜索负责人"
        :aria-controls="listboxId"
        class="min-w-28 flex-1 border-0 bg-transparent py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-400"
        placeholder="搜索姓名或备注"
        autocomplete="off"
        @focus="open = true"
        @keydown.escape="open = false"
      />
      <button
        type="button"
        class="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
        aria-label="展开负责人选项"
        @click="open = !open"
      >
        <ChevronUpDownIcon class="h-4 w-4" />
      </button>
    </div>

    <Transition
      enter-active-class="transition duration-120 ease-out"
      enter-from-class="translate-y-1 opacity-0 scale-[.98]"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-90 ease-in"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="translate-y-1 opacity-0 scale-[.98]"
    >
      <ul
        v-if="open"
        :id="listboxId"
        role="listbox"
        aria-label="负责人选项"
        aria-multiselectable="true"
        class="absolute left-0 z-[120] mt-2 max-h-64 w-full min-w-64 overflow-auto rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl outline-none"
      >
        <li v-for="person in matchingPeople" :key="person.id">
          <button
            type="button"
            role="option"
            :aria-selected="modelValue.includes(person.id)"
            class="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-indigo-50/70"
            @click="toggle(person.id)"
          >
            <span
              class="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold"
              :class="personToneClass(person.id)"
              aria-hidden="true"
              >{{ person.name.slice(-2) }}</span
            >
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-xs font-semibold text-slate-700"
                >{{ person.name }}</span
              >
              <span
                v-if="person.note"
                class="mt-0.5 block truncate text-[10px] text-slate-400"
                >{{ person.note }}</span
              >
            </span>
            <span
              class="grid h-5 w-5 shrink-0 place-items-center rounded-full border"
              :class="
                modelValue.includes(person.id)
                  ? 'border-indigo-500 bg-indigo-500 text-white'
                  : 'border-slate-200 text-transparent'
              "
            >
              <CheckIcon class="h-3 w-3" />
            </span>
          </button>
        </li>
        <li
          v-if="!matchingPeople.length"
          class="px-3 py-6 text-center text-xs text-slate-400"
        >
          没有匹配的人员
        </li>
        <li
          v-else-if="hiddenResultCount"
          class="border-t border-slate-100 px-3 py-2 text-center text-[10px] text-slate-400"
        >
          还有 {{ hiddenResultCount }} 人，请继续输入以缩小范围
        </li>
      </ul>
    </Transition>
  </div>
  <div
    v-else
    class="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400"
  >
    人员目录中还没有可分配的负责人。
  </div>
</template>

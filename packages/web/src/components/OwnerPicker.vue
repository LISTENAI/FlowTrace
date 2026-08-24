<script setup lang="ts">
import type { Person } from '@flowtrace/shared';
import { CheckIcon } from '@heroicons/vue/24/outline';
import { personToneClass } from '@/lib/person-color';

const props = defineProps<{ modelValue: string[]; people: Person[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();

function toggle(personId: string) {
  emit(
    'update:modelValue',
    props.modelValue.includes(personId)
      ? props.modelValue.filter((id) => id !== personId)
      : [...props.modelValue, personId],
  );
}
</script>

<template>
  <div v-if="people.length" class="grid gap-2 sm:grid-cols-2">
    <button
      v-for="person in people"
      :key="person.id"
      type="button"
      class="focus-ring flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition"
      :class="
        modelValue.includes(person.id)
          ? 'border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-100'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      "
      :aria-pressed="modelValue.includes(person.id)"
      @click="toggle(person.id)"
    >
      <span
        class="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[11px] font-bold"
        :class="personToneClass(person.id)"
        >{{ person.name.slice(-2) }}</span
      >
      <span class="min-w-0 flex-1">
        <span class="block truncate text-xs font-semibold text-slate-700">{{
          person.name
        }}</span>
        <span class="mt-0.5 block truncate text-[10px] text-slate-400">{{
          person.note || '未填写备注'
        }}</span>
      </span>
      <span
        class="grid h-5 w-5 shrink-0 place-items-center rounded-full border"
        :class="
          modelValue.includes(person.id)
            ? 'border-indigo-500 bg-indigo-500 text-white'
            : 'border-slate-200 text-transparent'
        "
      >
        <CheckIcon class="h-3.5 w-3.5" />
      </span>
    </button>
  </div>
  <div
    v-else
    class="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400"
  >
    人员目录中还没有可分配的负责人。
  </div>
</template>

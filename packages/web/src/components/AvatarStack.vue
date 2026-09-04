<script setup lang="ts">
import { computed } from 'vue';
import { personToneClass } from '@/lib/person-color';
import { workspace } from '@/state/workspace';

const props = withDefaults(
  defineProps<{
    ownerIds: string[];
    max?: number;
    compact?: boolean;
    showUnassigned?: boolean;
  }>(),
  { max: 3, compact: false, showUnassigned: true },
);

const owners = computed(() =>
  props.ownerIds
    .map((id) => workspace.people.find((person) => person.id === id))
    .filter(Boolean),
);
</script>

<template>
  <div
    class="flex items-center"
    :class="compact ? '-space-x-1' : '-space-x-1.5'"
  >
    <div
      v-for="owner in owners.slice(0, max)"
      :key="owner?.id"
      v-tooltip="owner?.name"
      class="grid place-items-center rounded-full border-2 border-white font-semibold ring-1 ring-slate-100"
      :class="[
        compact ? 'h-6 w-6 text-[10px]' : 'h-7 w-7 text-[11px]',
        personToneClass(owner?.id ?? ''),
      ]"
    >
      {{ owner?.name.slice(-2) }}
    </div>
    <div
      v-if="owners.length > max"
      class="grid rounded-full border-2 border-white bg-slate-100 text-slate-500"
      :class="
        compact
          ? 'h-6 w-6 place-items-center text-[9px]'
          : 'h-7 w-7 place-items-center text-[10px]'
      "
    >
      +{{ owners.length - max }}
    </div>
    <span
      v-if="!owners.length && showUnassigned"
      class="text-slate-400"
      :class="compact ? 'text-[10px]' : 'text-xs'"
      >待分配</span
    >
  </div>
</template>

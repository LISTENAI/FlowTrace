<script setup lang="ts">
import type { ChangeSource } from '@flowtrace/shared';
import { computed } from 'vue';

const props = defineProps<{
  source?: ChangeSource;
  agentName?: string;
  agentModel?: string;
}>();

const label = computed(() => {
  if (props.source === 'agent') return 'Agent';
  if (props.source === 'api') return 'API';
  return '人工';
});

const tone = computed(() => {
  if (props.source === 'agent')
    return 'bg-indigo-50 text-indigo-600 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20';
  if (props.source === 'api')
    return 'bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/20';
  return 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';
});

const detail = computed(() =>
  [props.agentName, props.agentModel].filter(Boolean).join(' · '),
);
</script>

<template>
  <span class="inline-flex min-w-0 items-center gap-1.5">
    <span
      class="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ring-inset"
      :class="tone"
      >{{ label }}</span
    >
    <span
      v-if="detail"
      class="truncate text-[9px] text-slate-400 dark:text-slate-500"
      :title="detail"
      >{{ detail }}</span
    >
  </span>
</template>

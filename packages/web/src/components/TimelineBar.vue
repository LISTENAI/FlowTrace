<script setup lang="ts">
import type { ExecutionStatus } from '@flowtrace/shared';
import type { CSSProperties } from 'vue';
import { statusDot } from '@/lib/presentation';

defineProps<{
  days: number;
  barStyle?: CSSProperties;
  barClass?: string;
  segments?: Array<{
    id: string;
    status: ExecutionStatus;
    style?: CSSProperties;
    title: string;
  }>;
}>();
</script>

<template>
  <div
    class="relative h-full min-h-10 bg-[repeating-linear-gradient(90deg,transparent,transparent_calc((100%/var(--days))-1px),#f2f3f7_calc((100%/var(--days))-1px),#f2f3f7_calc(100%/var(--days)))]"
    :style="{ '--days': days }"
  >
    <template v-if="segments?.length">
      <div
        v-for="segment in segments"
        :key="segment.id"
        class="absolute top-[14px] h-3 rounded-sm"
        :class="statusDot[segment.status]"
        :style="segment.style"
        :title="segment.title"
      />
    </template>
    <div
      v-else-if="barStyle"
      class="absolute rounded-full"
      :class="barClass"
      :style="barStyle"
    />
  </div>
</template>

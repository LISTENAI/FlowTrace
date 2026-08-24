<script setup lang="ts">
import type { ExecutionStatus } from '@flowtrace/shared';
import { ref, type CSSProperties } from 'vue';
import { statusDot } from '@/lib/presentation';

type ScheduleDragMode = 'move' | 'resize-start' | 'resize-end';
type PointerPayload = { event: PointerEvent; track: HTMLElement };

const props = withDefaults(
  defineProps<{
    days: number;
    barStyle?: CSSProperties;
    barClass?: string;
    pannable?: boolean;
    interactive?: boolean;
    segments?: Array<{
      id: string;
      status: ExecutionStatus;
      style?: CSSProperties;
      title: string;
    }>;
  }>(),
  { pannable: true, interactive: false },
);
const emit = defineEmits<{
  panStart: [payload: PointerPayload];
  barDragStart: [payload: PointerPayload & { mode: ScheduleDragMode }];
}>();
const track = ref<HTMLElement>();

function pointerPayload(event: PointerEvent) {
  if (!track.value || event.button !== 0) return;
  return { event, track: track.value };
}

function startPan(event: PointerEvent) {
  if (!props.pannable) return;
  const payload = pointerPayload(event);
  if (payload) emit('panStart', payload);
}

function startBarDrag(event: PointerEvent, mode: ScheduleDragMode) {
  if (!props.interactive) return;
  const payload = pointerPayload(event);
  if (payload) emit('barDragStart', { ...payload, mode });
}
</script>

<template>
  <div
    ref="track"
    class="timeline-track relative h-full min-h-10 bg-[repeating-linear-gradient(90deg,transparent,transparent_calc((100%/var(--days))-1px),#f2f3f7_calc((100%/var(--days))-1px),#f2f3f7_calc(100%/var(--days)))]"
    :class="pannable ? 'cursor-grab active:cursor-grabbing' : ''"
    :style="{ '--days': days }"
    title="拖动空白处平移时间线"
    @click.stop
    @pointerdown.self="startPan"
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
      class="group/bar absolute touch-none rounded-full"
      :class="[
        barClass,
        interactive
          ? 'cursor-grab ring-offset-2 transition-shadow hover:ring-2 hover:ring-indigo-300 active:cursor-grabbing'
          : '',
      ]"
      :style="barStyle"
      :title="
        interactive ? '拖动调整日期，拖动两端改变开始或结束时间' : undefined
      "
      @pointerdown.stop="startBarDrag($event, 'move')"
    >
      <template v-if="interactive">
        <span
          class="absolute -inset-y-1 -left-1.5 w-3 cursor-ew-resize rounded-md bg-white/90 opacity-0 shadow-sm ring-1 ring-indigo-300 transition-opacity group-hover/bar:opacity-100"
          aria-hidden="true"
          @pointerdown.stop="startBarDrag($event, 'resize-start')"
        />
        <span
          class="absolute -inset-y-1 -right-1.5 w-3 cursor-ew-resize rounded-md bg-white/90 opacity-0 shadow-sm ring-1 ring-indigo-300 transition-opacity group-hover/bar:opacity-100"
          aria-hidden="true"
          @pointerdown.stop="startBarDrag($event, 'resize-end')"
        />
      </template>
    </div>
  </div>
</template>

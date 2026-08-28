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
    barTitle?: string;
    baselineStyle?: CSSProperties;
    baselineTitle?: string;
    actualStyle?: CSSProperties;
    actualClass?: string;
    actualTitle?: string;
    actualInteractive?: boolean;
    pannable?: boolean;
    interactive?: boolean;
    actualSegments?: Array<{
      id: string;
      status?: ExecutionStatus;
      class?: string;
      style?: CSSProperties;
      title: string;
    }>;
    segments?: Array<{
      id: string;
      status?: ExecutionStatus;
      class?: string;
      style?: CSSProperties;
      title: string;
    }>;
  }>(),
  { pannable: true, interactive: false, actualInteractive: false },
);
const emit = defineEmits<{
  panStart: [payload: PointerPayload];
  barDragStart: [payload: PointerPayload & { mode: ScheduleDragMode }];
  actualActivate: [];
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
    v-tooltip="'拖动空白处平移时间线'"
    class="timeline-track relative h-full min-h-10 bg-[repeating-linear-gradient(90deg,transparent,transparent_calc((100%/var(--days))-1px),#f2f3f7_calc((100%/var(--days))-1px),#f2f3f7_calc(100%/var(--days)))]"
    :class="pannable ? 'cursor-grab active:cursor-grabbing' : ''"
    :style="{ '--days': days }"
    @click.stop
    @pointerdown.self="startPan"
  >
    <div
      v-if="baselineStyle"
      v-tooltip="baselineTitle ?? '初始计划的起止位置；仅作为基准参照'"
      class="pointer-events-none absolute top-[7px] z-[1] h-6 border-x border-slate-400/80"
      :style="baselineStyle"
    />
    <template v-if="segments?.length">
      <div
        v-for="segment in segments"
        :key="segment.id"
        v-tooltip="segment.title"
        class="absolute top-[14px] h-3 rounded-sm"
        :class="[
          segment.status ? statusDot[segment.status] : '',
          segment.class,
        ]"
        :style="segment.style"
      />
    </template>
    <div
      v-else-if="barStyle"
      v-tooltip="
        interactive
          ? `${barTitle ? `${barTitle}；` : ''}拖动主条调整日期，拖动两端改变开始或结束时间`
          : barTitle
      "
      class="group/bar absolute touch-none rounded-full"
      :class="[
        barClass,
        interactive
          ? 'cursor-grab ring-offset-2 transition-shadow hover:ring-2 hover:ring-indigo-300 active:cursor-grabbing'
          : '',
      ]"
      :style="barStyle"
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
    <template v-if="actualSegments?.length">
      <div
        v-for="segment in actualSegments"
        :key="`actual-${segment.id}`"
        v-tooltip="segment.title"
        class="absolute top-[18px] z-10 h-1.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,.55)]"
        :class="[
          actualInteractive ? 'cursor-pointer' : 'cursor-help',
          segment.status ? statusDot[segment.status] : '',
          segment.class,
        ]"
        :style="segment.style"
        @click.stop="actualInteractive && emit('actualActivate')"
      />
    </template>
    <div
      v-else-if="actualStyle"
      v-tooltip="actualTitle ?? '实际进展；请通过左侧状态圆点记录变化'"
      class="absolute top-[18px] z-10 h-1.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,.55)]"
      :class="[
        actualInteractive ? 'cursor-pointer' : 'cursor-help',
        actualClass,
      ]"
      :style="actualStyle"
      @click.stop="actualInteractive && emit('actualActivate')"
    />
  </div>
</template>

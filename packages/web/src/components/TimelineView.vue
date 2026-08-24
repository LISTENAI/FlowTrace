<script setup lang="ts">
import type {
  Bug,
  ExecutionStatus,
  Requirement,
  Stage,
  Version,
  VersionStatus,
} from '@flowtrace/shared';
import {
  BugAntIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  CubeIcon,
} from '@heroicons/vue/24/outline';
import dayjs, { type Dayjs } from 'dayjs';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { formatDate, statusDot } from '@/lib/presentation';
import PlanningDialog from '@/components/PlanningDialog.vue';
import TimelineBar from '@/components/TimelineBar.vue';

type TimelineMode = 'baseline' | 'current' | 'actual';
type ExpansionMode = 'smart' | 'depth' | 'custom';
type WorkItem = Stage | Bug;
type DateRange = { start: string; end: string };
type SchedulableItem = Requirement | Stage | Bug;
type ScheduleDragMode = 'move' | 'resize-start' | 'resize-end';
type TimelinePointerPayload = { event: PointerEvent; track: HTMLElement };
type ScheduleDragPayload = TimelinePointerPayload & { mode: ScheduleDragMode };
type PlanningTarget = {
  item: SchedulableItem;
  suggestedStartAt?: string;
  suggestedEndAt?: string;
  changeSummary?: string;
};
type VersionGroup = {
  id: string;
  name: string;
  status: VersionStatus | 'backlog';
  version?: Version;
  requirements: Requirement[];
};

const props = defineProps<{
  requirements: Requirement[];
  versions: Version[];
  mode: TimelineMode;
}>();
const emit = defineEmits<{ scheduleSaved: [] }>();
const expansionMode = defineModel<ExpansionMode>('expansionMode', {
  default: 'smart',
});
const expansionDepth = defineModel<number>('expansionDepth', { default: 1 });

const expandedVersions = reactive(new Set<string>());
const expandedRequirements = reactive(new Set<string>());
const expandedBugGroups = reactive(new Set<string>());
const timelineSurface = ref<HTMLElement>();
const scrollContainer = ref<HTMLElement>();
const labelColumn = ref<HTMLElement>();
const planningTarget = ref<PlanningTarget>();
const dragPreview = ref<{
  itemId: string;
  start: string;
  end: string;
  deltaDays: number;
  mode: ScheduleDragMode;
}>();
const collator = new Intl.Collator('zh-CN', { numeric: true });
const labelWidth = 320;
const dayWidth = 32;
const now = () => new Date().toISOString();
let activePan:
  | {
      pointerId: number;
      startX: number;
      startScrollLeft: number;
      track: HTMLElement;
    }
  | undefined;
let activeScheduleDrag:
  | {
      pointerId: number;
      item: SchedulableItem;
      mode: ScheduleDragMode;
      startX: number;
      trackWidth: number;
      track: HTMLElement;
      start: Dayjs;
      end: Dayjs;
    }
  | undefined;

const attentionRank = (item: Requirement | WorkItem) => {
  if ('health' in item) {
    if (item.health === 'blocked') return 0;
    if (item.health === 'waiting') return 1;
    return { in_progress: 2, not_started: 3, done: 4, canceled: 5 }[
      item.lifecycle
    ];
  }
  return {
    blocked: 0,
    waiting: 1,
    in_progress: 2,
    not_started: 3,
    done: 4,
    canceled: 5,
  }[item.status];
};

function itemDateRange(item: WorkItem): DateRange | undefined {
  if (props.mode !== 'actual') {
    const start =
      props.mode === 'baseline' ? item.baselineStartAt : item.plannedStartAt;
    const end =
      props.mode === 'baseline' ? item.baselineEndAt : item.plannedEndAt;
    const point = start ?? end;
    return point ? { start: start ?? point, end: end ?? point } : undefined;
  }

  const firstHistory = item.statusHistory[0]?.effectiveAt;
  const lastHistory = item.statusHistory.at(-1)?.effectiveAt;
  const start = item.actualStartAt ?? item.actualEndAt ?? firstHistory;
  if (!start) return undefined;
  const remainsOpen = ['in_progress', 'waiting', 'blocked'].includes(
    item.status,
  );
  const end =
    item.actualEndAt ?? (remainsOpen ? now() : (lastHistory ?? start));
  return { start, end };
}

function displayedItemRange(item: WorkItem) {
  if (dragPreview.value?.itemId === item.id) {
    return {
      start: dragPreview.value.start,
      end: dragPreview.value.end,
    };
  }
  return itemDateRange(item);
}

function currentScheduleRange(item: SchedulableItem) {
  const point = item.plannedStartAt ?? item.plannedEndAt;
  if (!point) return;
  return {
    start: dayjs(item.plannedStartAt ?? point).startOf('day'),
    end: dayjs(item.plannedEndAt ?? point).startOf('day'),
  };
}

function planningItemType(item: SchedulableItem) {
  if ('stages' in item) return 'requirement' as const;
  return 'key' in item ? ('bug' as const) : ('stage' as const);
}

function planningItemName(item: SchedulableItem) {
  if ('stages' in item || 'key' in item) return item.title;
  return item.name;
}

function openPlanning(item: SchedulableItem, proposal?: PlanningTarget) {
  planningTarget.value = proposal ?? { item };
}

function scheduleChangeSummary(
  mode: ScheduleDragMode,
  deltaDays: number,
  start: Dayjs,
  end: Dayjs,
) {
  const amount = Math.abs(deltaDays);
  const direction = deltaDays > 0 ? '延后' : '提前';
  const action =
    mode === 'move'
      ? `整体${direction} ${amount} 天`
      : mode === 'resize-start'
        ? `开始日期${direction} ${amount} 天`
        : `结束日期${direction} ${amount} 天`;
  return `${action}，调整为 ${start.format('M月D日')} → ${end.format('M月D日')}`;
}

function mergeRanges(ranges: Array<DateRange | undefined>) {
  const present = ranges.filter(Boolean) as DateRange[];
  if (!present.length) return undefined;
  return {
    start: new Date(
      Math.min(...present.map((item) => dayjs(item.start).valueOf())),
    ).toISOString(),
    end: new Date(
      Math.max(...present.map((item) => dayjs(item.end).valueOf())),
    ).toISOString(),
  };
}

function requirementDateRange(requirement: Requirement) {
  const ownStart =
    props.mode === 'baseline'
      ? requirement.baselineStartAt
      : props.mode === 'current'
        ? requirement.plannedStartAt
        : requirement.actualStartAt;
  const ownEnd =
    props.mode === 'baseline'
      ? requirement.baselineEndAt
      : props.mode === 'current'
        ? requirement.plannedEndAt
        : requirement.actualEndAt;
  const ownPoint = ownStart ?? ownEnd;
  return mergeRanges([
    ownPoint
      ? { start: ownStart ?? ownPoint, end: ownEnd ?? ownPoint }
      : undefined,
    ...[...requirement.stages, ...requirement.bugs].map(itemDateRange),
  ]);
}

function requirementStatus(requirement: Requirement): ExecutionStatus {
  if (requirement.health === 'blocked') return 'blocked';
  if (requirement.health === 'waiting') return 'waiting';
  return requirement.lifecycle;
}

function requirementBarClass(requirement: Requirement) {
  if (props.mode === 'baseline') {
    return 'top-[18px] h-2 border border-dashed border-slate-400 bg-slate-100';
  }
  return `top-[18px] h-2 ${statusDot[requirementStatus(requirement)]}`;
}

function versionDateRange(group: VersionGroup) {
  const versionStart =
    props.mode === 'actual' ? undefined : group.version?.plannedStartAt;
  const versionEnd =
    props.mode === 'actual'
      ? group.version?.actualReleaseAt
      : group.version?.plannedReleaseAt;
  const versionPoint = versionStart ?? versionEnd;
  return mergeRanges([
    versionPoint
      ? {
          start: versionStart ?? versionPoint,
          end: versionEnd ?? versionPoint,
        }
      : undefined,
    ...group.requirements.map(requirementDateRange),
  ]);
}

function sortRequirements(items: Requirement[]) {
  return [...items].sort((left, right) => {
    const attention = attentionRank(left) - attentionRank(right);
    if (attention) return attention;
    const leftTime = requirementDateRange(left)?.start;
    const rightTime = requirementDateRange(right)?.start;
    const time =
      (leftTime ? dayjs(leftTime).valueOf() : Number.MAX_SAFE_INTEGER) -
      (rightTime ? dayjs(rightTime).valueOf() : Number.MAX_SAFE_INTEGER);
    return time || collator.compare(left.key, right.key);
  });
}

function sortBugs(items: Bug[]) {
  return [...items].sort((left, right) => {
    const attention = attentionRank(left) - attentionRank(right);
    if (attention) return attention;
    const leftTime = itemDateRange(left)?.start;
    const rightTime = itemDateRange(right)?.start;
    const time =
      (leftTime ? dayjs(leftTime).valueOf() : Number.MAX_SAFE_INTEGER) -
      (rightTime ? dayjs(rightTime).valueOf() : Number.MAX_SAFE_INTEGER);
    return time || collator.compare(left.key, right.key);
  });
}

const groups = computed<VersionGroup[]>(() => {
  const versions: VersionGroup[] = props.versions.map((version) => ({
    id: version.id,
    name: version.name,
    status: version.status,
    version,
    requirements: sortRequirements(
      props.requirements.filter((item) => item.versionId === version.id),
    ),
  }));
  return [
    {
      id: 'backlog',
      name: '需求池',
      status: 'backlog',
      requirements: sortRequirements(
        props.requirements.filter((item) => !item.versionId),
      ),
    },
    ...versions,
  ];
});

function replaceSet(set: Set<string>, ids: string[]) {
  set.clear();
  for (const id of ids) set.add(id);
}

function pruneSet(set: Set<string>, validIds: Set<string>) {
  for (const id of set) {
    if (!validIds.has(id)) set.delete(id);
  }
}

function syncExpansion() {
  const requirements = groups.value.flatMap((group) => group.requirements);
  if (expansionMode.value === 'custom') {
    pruneSet(expandedVersions, new Set(groups.value.map((group) => group.id)));
    pruneSet(
      expandedRequirements,
      new Set(requirements.map((requirement) => requirement.id)),
    );
    pruneSet(
      expandedBugGroups,
      new Set(requirements.map((requirement) => requirement.id)),
    );
    return;
  }

  if (expansionMode.value === 'smart') {
    replaceSet(
      expandedVersions,
      groups.value
        .filter((group) => group.status === 'active')
        .map((group) => group.id),
    );
    expandedRequirements.clear();
    expandedBugGroups.clear();
    return;
  }

  replaceSet(
    expandedVersions,
    expansionDepth.value >= 1 ? groups.value.map((group) => group.id) : [],
  );
  replaceSet(
    expandedRequirements,
    expansionDepth.value >= 2
      ? requirements.map((requirement) => requirement.id)
      : [],
  );
  replaceSet(
    expandedBugGroups,
    expansionDepth.value >= 3
      ? requirements
          .filter((requirement) => requirement.bugs.length)
          .map((requirement) => requirement.id)
      : [],
  );
}

watch([groups, expansionMode, expansionDepth], syncExpansion, {
  immediate: true,
});

const range = computed(() => {
  const values = groups.value.flatMap((group) => {
    const groupRange = versionDateRange(group);
    return groupRange ? [groupRange.start, groupRange.end] : [];
  });
  const today = dayjs();
  const min = values.length
    ? dayjs(
        Math.min(
          today.valueOf(),
          ...values.map((value) => dayjs(value).valueOf()),
        ),
      )
        .startOf('day')
        .subtract(2, 'day')
    : today.subtract(14, 'day');
  const max = values.length
    ? dayjs(
        Math.max(
          today.valueOf(),
          ...values.map((value) => dayjs(value).valueOf()),
        ),
      )
        .startOf('day')
        .add(3, 'day')
    : today.add(14, 'day');
  const days = Math.max(14, max.diff(min, 'day') + 1);
  return { min, max, days };
});

const headers = computed(() =>
  Array.from({ length: range.value.days }, (_, index) =>
    range.value.min.add(index, 'day'),
  ),
);

const timelineDateWidth = computed(() => range.value.days * dayWidth);

function scrollToToday() {
  scrollToDate(dayjs().toISOString());
}

function scrollToDate(value?: string) {
  const container = scrollContainer.value;
  if (!container || !value) return;
  const renderedLabelWidth =
    labelColumn.value?.getBoundingClientRect().width ?? labelWidth;
  const dayOffset = dayjs(value).startOf('day').diff(range.value.min, 'day');
  const visibleTimelineWidth = Math.max(
    0,
    container.clientWidth - renderedLabelWidth,
  );
  const renderedDayWidth = Math.max(
    dayWidth,
    (container.scrollWidth - renderedLabelWidth) / range.value.days,
  );
  const target =
    dayOffset * renderedDayWidth -
    visibleTimelineWidth / 2 +
    renderedDayWidth / 2;
  container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
}

function scrollToItem(item: WorkItem) {
  scrollToDate(itemDateRange(item)?.start);
}

function wheelDeltaInPixels(event: WheelEvent) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * window.innerHeight;
  }
  return event.deltaY;
}

function documentOffsetTop(element: HTMLElement) {
  let top = 0;
  let current: HTMLElement | null = element;
  while (current) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return top;
}

function pageScrollLimit() {
  const surface = timelineSurface.value;
  if (!surface) return Number.POSITIVE_INFINITY;
  const configuredTop = Number.parseFloat(getComputedStyle(surface).top);
  const stickyTop = Number.isFinite(configuredTop) ? configuredTop : 0;
  return Math.max(0, documentOffsetTop(surface) - stickyTop);
}

function scrollPageBy(deltaY: number) {
  const before = window.scrollY;
  window.scrollTo({
    top: Math.max(0, Math.min(pageScrollLimit(), before + deltaY)),
  });
  return window.scrollY - before;
}

function removePointerListeners() {
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerup', finishPointerGesture);
  window.removeEventListener('pointercancel', cancelPointerGesture);
  document.documentElement.classList.remove('timeline-pointer-active');
}

function preparePointerGesture(event: PointerEvent, track: HTMLElement) {
  if (event.pointerType === 'touch' || event.button !== 0) return false;
  cancelPointerGesture();
  event.preventDefault();
  track.setPointerCapture?.(event.pointerId);
  document.documentElement.classList.add('timeline-pointer-active');
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', finishPointerGesture);
  window.addEventListener('pointercancel', cancelPointerGesture);
  return true;
}

function startTimelinePan({ event, track }: TimelinePointerPayload) {
  const container = scrollContainer.value;
  if (!container || !preparePointerGesture(event, track)) return;
  activePan = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startScrollLeft: container.scrollLeft,
    track,
  };
  container.classList.add('timeline-is-panning');
}

function startScheduleDrag(
  item: WorkItem,
  { event, track, mode }: ScheduleDragPayload,
) {
  if (props.mode !== 'current') return;
  const schedule = currentScheduleRange(item);
  if (!schedule || !preparePointerGesture(event, track)) return;
  activeScheduleDrag = {
    pointerId: event.pointerId,
    item,
    mode,
    startX: event.clientX,
    trackWidth: track.getBoundingClientRect().width,
    track,
    ...schedule,
  };
}

function handlePointerMove(event: PointerEvent) {
  if (activePan?.pointerId === event.pointerId) {
    const container = scrollContainer.value;
    if (!container) return;
    event.preventDefault();
    container.scrollLeft =
      activePan.startScrollLeft - (event.clientX - activePan.startX);
    return;
  }

  if (activeScheduleDrag?.pointerId !== event.pointerId) return;
  event.preventDefault();
  const drag = activeScheduleDrag;
  const renderedDayWidth = drag.trackWidth / range.value.days;
  const deltaDays = Math.round(
    (event.clientX - drag.startX) / renderedDayWidth,
  );
  if (!deltaDays) {
    dragPreview.value = undefined;
    return;
  }

  let start = drag.start;
  let end = drag.end;
  if (drag.mode === 'move') {
    start = start.add(deltaDays, 'day');
    end = end.add(deltaDays, 'day');
  } else if (drag.mode === 'resize-start') {
    start = start.add(deltaDays, 'day');
    if (start.isAfter(end)) start = end;
  } else {
    end = end.add(deltaDays, 'day');
    if (end.isBefore(start)) end = start;
  }
  const effectiveDeltaDays =
    drag.mode === 'resize-start'
      ? start.diff(drag.start, 'day')
      : drag.mode === 'resize-end'
        ? end.diff(drag.end, 'day')
        : deltaDays;
  if (!effectiveDeltaDays) {
    dragPreview.value = undefined;
    return;
  }
  dragPreview.value = {
    itemId: drag.item.id,
    start: start.toISOString(),
    end: end.toISOString(),
    deltaDays: effectiveDeltaDays,
    mode: drag.mode,
  };
}

function finishPointerGesture(event: PointerEvent) {
  if (
    activePan?.pointerId !== event.pointerId &&
    activeScheduleDrag?.pointerId !== event.pointerId
  )
    return;

  const drag = activeScheduleDrag;
  const preview = dragPreview.value;
  const container = scrollContainer.value;
  container?.classList.remove('timeline-is-panning');
  activePan?.track.releasePointerCapture?.(event.pointerId);
  drag?.track.releasePointerCapture?.(event.pointerId);
  activePan = undefined;
  activeScheduleDrag = undefined;
  removePointerListeners();

  if (drag && preview) {
    openPlanning(drag.item, {
      item: drag.item,
      suggestedStartAt: preview.start,
      suggestedEndAt: preview.end,
      changeSummary: scheduleChangeSummary(
        preview.mode,
        preview.deltaDays,
        dayjs(preview.start),
        dayjs(preview.end),
      ),
    });
  }
  dragPreview.value = undefined;
}

function cancelPointerGesture() {
  scrollContainer.value?.classList.remove('timeline-is-panning');
  if (activePan) activePan.track.releasePointerCapture?.(activePan.pointerId);
  if (activeScheduleDrag)
    activeScheduleDrag.track.releasePointerCapture?.(
      activeScheduleDrag.pointerId,
    );
  activePan = undefined;
  activeScheduleDrag = undefined;
  dragPreview.value = undefined;
  removePointerListeners();
}

function keepPageAtTimelineAnchor() {
  const limit = pageScrollLimit();
  if (window.scrollY > limit + 1) window.scrollTo({ top: limit });
}

function handleOuterWheel(event: WheelEvent) {
  if (event.ctrlKey || event.shiftKey) return;
  const container = scrollContainer.value;
  if (container && event.composedPath().includes(container)) return;
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

  const deltaY = wheelDeltaInPixels(event);
  const limit = pageScrollLimit();
  if (deltaY > 0 && window.scrollY + deltaY > limit) {
    event.preventDefault();
    window.scrollTo({ top: limit });
  }
}

function handleTimelineWheel(event: WheelEvent) {
  if (event.ctrlKey || event.shiftKey) return;

  const surface = timelineSurface.value;
  const container = scrollContainer.value;
  const deltaY = wheelDeltaInPixels(event);
  if (!surface || !container || !deltaY) return;
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

  const maxScrollTop = container.scrollHeight - container.clientHeight;
  if (maxScrollTop <= 0) return;

  event.preventDefault();

  const configuredTop = Number.parseFloat(getComputedStyle(surface).top);
  const stickyTop = Number.isFinite(configuredTop) ? configuredTop : 0;
  const distanceToStickyTop = surface.getBoundingClientRect().top - stickyTop;

  if (deltaY > 0) {
    let remaining = deltaY;
    if (distanceToStickyTop > 1) {
      remaining -= Math.max(
        0,
        scrollPageBy(Math.min(remaining, distanceToStickyTop)),
      );
    }

    const before = container.scrollTop;
    container.scrollTop += Math.min(
      remaining,
      maxScrollTop - container.scrollTop,
    );
    remaining -= container.scrollTop - before;
    if (remaining > 0) scrollPageBy(remaining);
    return;
  }

  let remaining = -deltaY;
  const before = container.scrollTop;
  container.scrollTop -= Math.min(remaining, container.scrollTop);
  remaining -= before - container.scrollTop;
  if (remaining > 0) scrollPageBy(-remaining);
}

function styleFor(value?: DateRange) {
  if (!value) return undefined;
  const start = dayjs(value.start).startOf('day');
  const end = dayjs(value.end).startOf('day');
  const left = (start.diff(range.value.min, 'day') / range.value.days) * 100;
  const width =
    (Math.max(1, end.diff(start, 'day') + 1) / range.value.days) * 100;
  return {
    left: `${Math.max(0, left)}%`,
    width: `${Math.max(0.45, Math.min(100 - left, width))}%`,
  };
}

function segments(item: WorkItem) {
  if (props.mode !== 'actual' || !item.statusHistory.length) return [];
  return item.statusHistory.map((history, index) => {
    const next = item.statusHistory[index + 1];
    const remainsOpen = ['in_progress', 'waiting', 'blocked'].includes(
      history.toStatus,
    );
    const end =
      next?.effectiveAt ?? (remainsOpen ? now() : history.effectiveAt);
    return {
      id: history.id,
      status: history.toStatus,
      style: styleFor({ start: history.effectiveAt, end }),
      title: `${formatDate(history.effectiveAt)} · ${history.reason || ''}`,
    };
  });
}

function toggle(set: Set<string>, id: string) {
  if (set.has(id)) set.delete(id);
  else set.add(id);
  expansionMode.value = 'custom';
}

onMounted(() => {
  requestAnimationFrame(scrollToToday);
  window.addEventListener('wheel', handleOuterWheel, { passive: false });
  window.addEventListener('scroll', keepPageAtTimelineAnchor, {
    passive: true,
  });
  keepPageAtTimelineAnchor();
});

onBeforeUnmount(() => {
  cancelPointerGesture();
  window.removeEventListener('wheel', handleOuterWheel);
  window.removeEventListener('scroll', keepPageAtTimelineAnchor);
});

watch(
  () => props.requirements.length,
  async () => {
    await nextTick();
    scrollToToday();
  },
);
</script>

<template>
  <div ref="timelineSurface" class="timeline-surface surface overflow-hidden">
    <div
      ref="scrollContainer"
      class="timeline-scroll"
      @wheel="handleTimelineWheel"
    >
      <div
        class="w-full [--timeline-label-width:min(20rem,62vw)]"
        :style="{
          minWidth: `calc(var(--timeline-label-width) + ${timelineDateWidth}px)`,
        }"
      >
        <div
          class="timeline-ruler timeline-grid grid border-b border-slate-100 bg-slate-50/95 backdrop-blur"
        >
          <div
            ref="labelColumn"
            class="sticky left-0 z-30 flex items-center justify-between border-r border-slate-100 bg-slate-50/95 px-5 py-3 text-[11px] font-semibold tracking-[.08em] text-slate-400 backdrop-blur"
          >
            <span>版本、需求与过程</span>
            <button
              type="button"
              class="focus-ring inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] tracking-normal text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:text-indigo-600"
              @click="scrollToToday"
            >
              <CalendarDaysIcon class="h-3.5 w-3.5" />今天
            </button>
          </div>
          <div class="relative flex h-14">
            <div
              v-for="(day, index) in headers"
              :key="day.toISOString()"
              class="flex min-w-8 flex-1 flex-col items-center justify-center border-l text-[10px]"
              :class="
                day.isSame(dayjs(), 'day')
                  ? 'border-indigo-200 bg-indigo-50/60 font-semibold text-indigo-600'
                  : index % 7 === 0
                    ? 'border-slate-200 text-slate-500'
                    : 'border-slate-100 text-slate-400'
              "
            >
              <span>{{ day.format('D') }}</span>
              <span v-if="index === 0 || day.date() === 1" class="text-[8px]">
                {{ day.format('M月') }}
              </span>
            </div>
          </div>
        </div>

        <section
          v-for="group in groups"
          :key="group.id"
          class="timeline-version-group"
        >
          <button
            class="timeline-version-heading timeline-grid group grid w-full border-b border-slate-200 bg-slate-50/95 text-left backdrop-blur hover:bg-slate-100/95"
            @click="toggle(expandedVersions, group.id)"
          >
            <div
              class="sticky left-0 z-20 flex h-12 items-center gap-2 border-r border-slate-100 bg-slate-50/95 px-4 backdrop-blur group-hover:bg-slate-100/95"
            >
              <ChevronDownIcon
                class="h-4 w-4 text-slate-500 transition"
                :class="expandedVersions.has(group.id) ? '' : '-rotate-90'"
              />
              <CubeIcon class="h-4 w-4 text-indigo-500" />
              <span class="font-semibold text-slate-800">{{ group.name }}</span>
              <span class="text-[10px] text-slate-400">
                {{ group.requirements.length }} 项
              </span>
            </div>
            <TimelineBar
              :days="range.days"
              :bar-style="styleFor(versionDateRange(group))"
              bar-class="top-[18px] h-2 bg-indigo-400/75"
              @pan-start="startTimelinePan"
            />
          </button>

          <template v-if="expandedVersions.has(group.id)">
            <section
              v-for="requirement in group.requirements"
              :key="requirement.id"
              class="timeline-requirement-group"
            >
              <div
                class="timeline-requirement-heading timeline-grid group grid w-full border-b border-slate-100 bg-white text-left hover:bg-slate-50/95"
              >
                <div
                  class="sticky left-0 z-20 flex h-12 items-center gap-2 border-r border-slate-100 bg-white pl-8 pr-4 group-hover:bg-slate-50"
                >
                  <button
                    type="button"
                    class="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
                    @click="toggle(expandedRequirements, requirement.id)"
                  >
                    <ChevronDownIcon
                      class="h-3.5 w-3.5 shrink-0 text-slate-400 transition"
                      :class="
                        expandedRequirements.has(requirement.id)
                          ? ''
                          : '-rotate-90'
                      "
                    />
                    <span
                      class="font-mono text-[10px] font-semibold text-indigo-500"
                      >{{ requirement.key }}</span
                    >
                    <span
                      class="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800"
                      >{{ requirement.title }}</span
                    >
                  </button>
                  <button
                    type="button"
                    class="timeline-row-action focus-ring"
                    :aria-label="`调整「${requirement.title}」的计划`"
                    :title="`调整「${requirement.title}」的计划`"
                    @click="openPlanning(requirement)"
                  >
                    <CalendarDaysIcon class="h-3.5 w-3.5" />
                  </button>
                </div>
                <TimelineBar
                  :days="range.days"
                  :bar-style="styleFor(requirementDateRange(requirement))"
                  :bar-class="requirementBarClass(requirement)"
                  @pan-start="startTimelinePan"
                />
              </div>

              <template v-if="expandedRequirements.has(requirement.id)">
                <div
                  v-for="stage in requirement.stages"
                  :key="stage.id"
                  class="timeline-grid group grid border-b border-slate-100/80 bg-white"
                >
                  <div
                    class="sticky left-0 z-20 flex h-10 items-center gap-1 border-r border-slate-100 bg-white pl-12 pr-3 transition hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      class="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
                      :class="
                        itemDateRange(stage)
                          ? 'cursor-pointer'
                          : 'cursor-default'
                      "
                      :title="
                        itemDateRange(stage)
                          ? `定位到${stage.name}的开始日期`
                          : '该阶段暂无时间记录'
                      "
                      @click="scrollToItem(stage)"
                    >
                      <span
                        class="h-2 w-2 rounded-full"
                        :class="statusDot[stage.status]"
                      />
                      <span
                        class="min-w-0 flex-1 truncate text-[11px] text-slate-600"
                        >{{ stage.name }}</span
                      >
                    </button>
                    <button
                      type="button"
                      class="timeline-row-action focus-ring"
                      :aria-label="`调整「${stage.name}」的计划`"
                      :title="`调整「${stage.name}」的计划`"
                      @click="openPlanning(stage)"
                    >
                      <CalendarDaysIcon class="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <TimelineBar
                    :days="range.days"
                    :bar-style="styleFor(displayedItemRange(stage))"
                    :bar-class="
                      mode === 'baseline'
                        ? 'top-[14px] h-3 border border-dashed border-slate-400 bg-slate-100'
                        : stage.status === 'done'
                          ? 'top-[14px] h-3 bg-emerald-400'
                          : 'top-[14px] h-3 bg-indigo-400'
                    "
                    :segments="mode === 'actual' ? segments(stage) : []"
                    :interactive="
                      mode === 'current' && Boolean(itemDateRange(stage))
                    "
                    @pan-start="startTimelinePan"
                    @bar-drag-start="startScheduleDrag(stage, $event)"
                  />
                </div>

                <button
                  v-if="requirement.bugs.length"
                  class="timeline-grid group grid w-full border-b border-slate-100/80 bg-rose-50/20 text-left hover:bg-rose-50/40"
                  @click="toggle(expandedBugGroups, requirement.id)"
                >
                  <div
                    class="sticky left-0 z-20 flex h-10 items-center gap-2 border-r border-rose-100/70 bg-rose-50/50 pl-12 pr-4 backdrop-blur group-hover:bg-rose-50/80"
                  >
                    <ChevronDownIcon
                      class="h-3.5 w-3.5 text-slate-400 transition"
                      :class="
                        expandedBugGroups.has(requirement.id)
                          ? ''
                          : '-rotate-90'
                      "
                    />
                    <BugAntIcon class="h-3.5 w-3.5 text-rose-400" />
                    <span class="text-[11px] font-medium text-slate-600"
                      >Bug</span
                    >
                    <span class="text-[10px] text-slate-400">
                      {{ requirement.bugs.length }} 个
                    </span>
                  </div>
                  <TimelineBar
                    :days="range.days"
                    :bar-style="
                      styleFor(mergeRanges(requirement.bugs.map(itemDateRange)))
                    "
                    bar-class="top-[16px] h-2 bg-rose-300/80"
                    @pan-start="startTimelinePan"
                  />
                </button>

                <template v-if="expandedBugGroups.has(requirement.id)">
                  <div
                    v-for="bug in sortBugs(requirement.bugs)"
                    :key="bug.id"
                    class="timeline-grid group grid border-b border-slate-100/80 bg-white"
                  >
                    <div
                      class="sticky left-0 z-20 flex h-10 items-center gap-1 border-r border-slate-100 bg-white pl-16 pr-3 transition hover:bg-slate-50"
                    >
                      <button
                        type="button"
                        class="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
                        :class="
                          itemDateRange(bug)
                            ? 'cursor-pointer'
                            : 'cursor-default'
                        "
                        :title="
                          itemDateRange(bug)
                            ? `定位到${bug.key}的开始日期`
                            : '该 Bug 暂无时间记录'
                        "
                        @click="scrollToItem(bug)"
                      >
                        <span
                          class="h-2 w-2 rounded-full"
                          :class="statusDot[bug.status]"
                        />
                        <span
                          class="w-20 shrink-0 font-mono text-[9px] font-semibold text-rose-500"
                          >{{ bug.key }}</span
                        >
                        <span
                          class="min-w-0 flex-1 truncate text-[11px] text-slate-600"
                          >{{ bug.title }}</span
                        >
                      </button>
                      <button
                        type="button"
                        class="timeline-row-action focus-ring"
                        :aria-label="`调整「${bug.title}」的计划`"
                        :title="`调整「${bug.title}」的计划`"
                        @click="openPlanning(bug)"
                      >
                        <CalendarDaysIcon class="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <TimelineBar
                      :days="range.days"
                      :bar-style="styleFor(displayedItemRange(bug))"
                      bar-class="top-[14px] h-3 bg-rose-400"
                      :segments="mode === 'actual' ? segments(bug) : []"
                      :interactive="
                        mode === 'current' && Boolean(itemDateRange(bug))
                      "
                      @pan-start="startTimelinePan"
                      @bar-drag-start="startScheduleDrag(bug, $event)"
                    />
                  </div>
                </template>
              </template>
            </section>
          </template>
        </section>
      </div>
    </div>
    <div
      class="flex flex-wrap items-center gap-4 border-t border-slate-100 bg-white px-5 py-3 text-[10px] text-slate-400"
    >
      <template v-if="mode === 'actual'">
        <span class="flex items-center gap-1.5">
          <i class="h-2 w-4 rounded-sm bg-indigo-500" />实际工作
        </span>
        <span class="flex items-center gap-1.5">
          <i class="h-2 w-4 rounded-sm bg-amber-400" />等待中
        </span>
        <span class="flex items-center gap-1.5">
          <i class="h-2 w-4 rounded-sm bg-rose-500" />阻塞
        </span>
        <span class="flex items-center gap-1.5">
          <i class="h-2 w-4 rounded-sm bg-emerald-500" />已完成
        </span>
        <span>只有一个时间点的事项按当天显示</span>
      </template>
      <span v-else-if="mode === 'baseline'">虚线代表初始基准计划</span>
      <template v-else>
        <span>拖动空白处可平移日期</span>
        <span>拖动阶段或 Bug 条可调整当前计划，汇总条由下级自动计算</span>
      </template>
    </div>

    <PlanningDialog
      v-if="planningTarget"
      :open="Boolean(planningTarget)"
      :item-id="planningTarget.item.id"
      :item-type="planningItemType(planningTarget.item)"
      :item-name="planningItemName(planningTarget.item)"
      :planned-start-at="planningTarget.item.plannedStartAt"
      :planned-end-at="planningTarget.item.plannedEndAt"
      :suggested-start-at="planningTarget.suggestedStartAt"
      :suggested-end-at="planningTarget.suggestedEndAt"
      :change-summary="planningTarget.changeSummary"
      :current-version-id="
        'versionId' in planningTarget.item
          ? planningTarget.item.versionId
          : undefined
      "
      :versions="props.versions"
      @close="planningTarget = undefined"
      @saved="emit('scheduleSaved')"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  Bug,
  ExecutionStatus,
  Person,
  Requirement,
  Stage,
  Version,
  VersionStatus,
} from '@flowtrace/shared';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import {
  ArrowTopRightOnSquareIcon,
  BugAntIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  CubeIcon,
  InformationCircleIcon,
  UserPlusIcon,
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
import { useRouter } from 'vue-router';
import { api } from '@/api';
import AppModal from '@/components/AppModal.vue';
import OwnerPicker from '@/components/OwnerPicker.vue';
import { formatDate, statusDot, statusLabels } from '@/lib/presentation';
import PlanningDialog from '@/components/PlanningDialog.vue';
import StatusUpdateDialog from '@/components/StatusUpdateDialog.vue';
import TimelineBar from '@/components/TimelineBar.vue';
import { toasts } from '@/state/toasts';

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
  people: Person[];
  focusedStageNames?: string[];
  includeBugs?: boolean;
}>();
const emit = defineEmits<{ scheduleSaved: [] }>();
const router = useRouter();
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
const statusTarget = ref<WorkItem>();
const ownerTarget = ref<SchedulableItem>();
const ownerForm = ref<string[]>([]);
const assigningOwners = ref(false);
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

function itemDateRange(
  item: WorkItem,
  mode: TimelineMode = 'current',
): DateRange | undefined {
  if (mode !== 'actual') {
    const start =
      mode === 'baseline' ? item.baselineStartAt : item.plannedStartAt;
    const end = mode === 'baseline' ? item.baselineEndAt : item.plannedEndAt;
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
  return itemDateRange(item, 'current');
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

function openOwners(item: SchedulableItem) {
  ownerForm.value = [...item.ownerIds];
  ownerTarget.value = item;
}

async function saveOwners() {
  if (!ownerTarget.value) return;
  assigningOwners.value = true;
  try {
    const input = { ownerIds: ownerForm.value };
    if ('stages' in ownerTarget.value)
      await api.updateRequirement(ownerTarget.value.id, input);
    else if ('key' in ownerTarget.value)
      await api.updateBug(ownerTarget.value.id, input);
    else await api.updateStage(ownerTarget.value.id, input);
    const itemName = planningItemName(ownerTarget.value);
    ownerTarget.value = undefined;
    toasts.show(
      '负责人已更新',
      ownerForm.value.length
        ? `${itemName} · 已分配 ${ownerForm.value.length} 人`
        : `${itemName} · 已设为待分配`,
    );
    emit('scheduleSaved');
  } catch (error) {
    toasts.show(
      '分配失败',
      error instanceof Error ? error.message : undefined,
      'error',
    );
  } finally {
    assigningOwners.value = false;
  }
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

const hasStageFocus = computed(() => Boolean(props.focusedStageNames?.length));

function visibleStages(requirement: Requirement) {
  if (!hasStageFocus.value) return requirement.stages;
  const names = new Set(props.focusedStageNames);
  return requirement.stages.filter((stage) => names.has(stage.name));
}

function visibleBugs(requirement: Requirement) {
  return !hasStageFocus.value || props.includeBugs ? requirement.bugs : [];
}

function matchesFocus(requirement: Requirement) {
  return (
    !hasStageFocus.value ||
    visibleStages(requirement).length > 0 ||
    visibleBugs(requirement).length > 0
  );
}

function requirementDateRange(requirement: Requirement, mode: TimelineMode) {
  const ownStart =
    mode === 'baseline'
      ? requirement.baselineStartAt
      : mode === 'current'
        ? requirement.plannedStartAt
        : requirement.actualStartAt;
  const ownEnd =
    mode === 'baseline'
      ? requirement.baselineEndAt
      : mode === 'current'
        ? requirement.plannedEndAt
        : requirement.actualEndAt;
  const ownPoint = ownStart ?? ownEnd;
  const childRanges = [
    ...visibleStages(requirement),
    ...visibleBugs(requirement),
  ].map((item) => itemDateRange(item, mode));
  const childRange = mergeRanges(childRanges);
  if (childRange) return childRange;
  return mergeRanges([
    !hasStageFocus.value && ownPoint
      ? { start: ownStart ?? ownPoint, end: ownEnd ?? ownPoint }
      : undefined,
  ]);
}

function requirementStatus(requirement: Requirement): ExecutionStatus {
  if (requirement.health === 'blocked') return 'blocked';
  if (requirement.health === 'waiting') return 'waiting';
  return requirement.lifecycle;
}

function versionDateRange(group: VersionGroup, mode: TimelineMode) {
  const versionStart =
    mode === 'actual' ? undefined : group.version?.plannedStartAt;
  const versionEnd =
    mode === 'actual'
      ? group.version?.actualReleaseAt
      : group.version?.plannedReleaseAt;
  const versionPoint = hasStageFocus.value
    ? undefined
    : (versionStart ?? versionEnd);
  return mergeRanges([
    versionPoint
      ? {
          start: versionStart ?? versionPoint,
          end: versionEnd ?? versionPoint,
        }
      : undefined,
    ...group.requirements.map((requirement) =>
      requirementDateRange(requirement, mode),
    ),
  ]);
}

function sortRequirements(items: Requirement[]) {
  return [...items].sort((left, right) => {
    const attention = attentionRank(left) - attentionRank(right);
    if (attention) return attention;
    const leftTime = requirementDateRange(left, 'current')?.start;
    const rightTime = requirementDateRange(right, 'current')?.start;
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
    const leftTime = itemDateRange(left, 'current')?.start;
    const rightTime = itemDateRange(right, 'current')?.start;
    const time =
      (leftTime ? dayjs(leftTime).valueOf() : Number.MAX_SAFE_INTEGER) -
      (rightTime ? dayjs(rightTime).valueOf() : Number.MAX_SAFE_INTEGER);
    return time || collator.compare(left.key, right.key);
  });
}

const groups = computed<VersionGroup[]>(() => {
  const focusedRequirements = props.requirements.filter(matchesFocus);
  const versions: VersionGroup[] = props.versions.map((version) => ({
    id: version.id,
    name: version.name,
    status: version.status,
    version,
    requirements: sortRequirements(
      focusedRequirements.filter((item) => item.versionId === version.id),
    ),
  }));
  return [
    {
      id: 'backlog',
      name: '需求池',
      status: 'backlog',
      requirements: sortRequirements(
        focusedRequirements.filter((item) => !item.versionId),
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
    return (['baseline', 'current', 'actual'] as const).flatMap((mode) => {
      const groupRange = versionDateRange(group, mode);
      return groupRange ? [groupRange.start, groupRange.end] : [];
    });
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
  scrollToDate(
    itemDateRange(item, 'current')?.start ??
      itemDateRange(item, 'actual')?.start ??
      itemDateRange(item, 'baseline')?.start,
  );
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

function rangeTooltip(
  label: string,
  value: DateRange | undefined,
  instruction: string,
) {
  if (!value) return undefined;
  return `${label}：${formatDate(value.start)} → ${formatDate(value.end)}；${instruction}`;
}

function segments(item: WorkItem, interactive = true) {
  if (!item.statusHistory.length) return [];
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
      title: `${statusLabels[history.toStatus]} · ${formatDate(history.effectiveAt)}${history.reason ? ` · ${history.reason}` : ''}；${interactive ? '点击记录实际进展' : '展开需求查看并操作具体过程'}`,
    };
  });
}

function requirementSegments(requirement: Requirement) {
  const stageSegments = visibleStages(requirement).flatMap((stage) =>
    segments(stage, false).map((segment) => ({
      ...segment,
      id: `stage-${stage.id}-${segment.id}`,
      title: `${stage.name} · ${segment.title}`,
    })),
  );
  const bugSegments = visibleBugs(requirement).flatMap((bug) =>
    segments(bug, false).map((segment) => ({
      ...segment,
      id: `bug-${bug.id}-${segment.id}`,
      title: `${bug.key} · ${segment.title}`,
    })),
  );
  return [...stageSegments, ...bugSegments];
}

function bugGroupDateRange(requirement: Requirement, mode: TimelineMode) {
  return mergeRanges(
    visibleBugs(requirement).map((bug) => itemDateRange(bug, mode)),
  );
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
            <div class="flex items-center gap-1.5 tracking-normal">
              <Popover class="relative">
                <PopoverButton
                  class="focus-ring inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:text-indigo-600"
                >
                  <InformationCircleIcon class="h-3.5 w-3.5" />说明
                </PopoverButton>
                <Transition
                  enter-active-class="transition duration-150 ease-out"
                  enter-from-class="translate-y-1 opacity-0 scale-[.98]"
                  enter-to-class="translate-y-0 opacity-100 scale-100"
                  leave-active-class="transition duration-100 ease-in"
                  leave-from-class="translate-y-0 opacity-100 scale-100"
                  leave-to-class="translate-y-1 opacity-0 scale-[.98]"
                >
                  <PopoverPanel
                    class="absolute left-0 z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white/95 p-4 text-left shadow-xl shadow-slate-900/10 backdrop-blur-xl max-sm:-right-10 max-sm:left-auto max-sm:w-56"
                  >
                    <p class="text-xs font-semibold text-slate-800">
                      一条轨道，三种信息
                    </p>
                    <div class="mt-3 space-y-3 text-[11px] leading-5">
                      <div class="flex gap-3">
                        <i
                          class="mt-0.5 h-4 w-5 shrink-0 border-x border-slate-400"
                        />
                        <p>
                          <strong class="text-slate-700">初始计划边界</strong
                          ><br /><span class="text-slate-400"
                            >只用于比较最初承诺，不可直接拖动。</span
                          >
                        </p>
                      </div>
                      <div class="flex gap-3">
                        <i
                          class="mt-1.5 h-2.5 w-5 shrink-0 rounded-full bg-indigo-200"
                        />
                        <p>
                          <strong class="text-slate-700">当前计划</strong
                          ><br /><span class="text-slate-400"
                            >阶段和 Bug
                            可拖动主条或两端；汇总条会自动计算。</span
                          >
                        </p>
                      </div>
                      <div class="flex gap-3">
                        <span class="mt-2 flex w-5 shrink-0 gap-0.5">
                          <i class="h-1.5 flex-1 rounded-full bg-indigo-500" />
                          <i class="h-1.5 flex-1 rounded-full bg-emerald-500" />
                          <i class="h-1.5 flex-1 rounded-full bg-amber-400" />
                          <i class="h-1.5 flex-1 rounded-full bg-rose-500" />
                        </span>
                        <p>
                          <strong class="text-slate-700">实际进展</strong
                          ><br /><span class="text-slate-400"
                            >蓝色推进、绿色完成、黄色等待、红色阻塞；从左侧状态圆点补记。</span
                          >
                        </p>
                      </div>
                    </div>
                    <p
                      class="mt-3 border-t border-slate-100 pt-3 text-[10px] leading-5 text-slate-400"
                    >
                      行尾图标依次提供负责人、计划和详情操作；悬停轨道可查看当前事项的具体日期与状态。
                    </p>
                  </PopoverPanel>
                </Transition>
              </Popover>
              <button
                type="button"
                class="focus-ring inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:text-indigo-600"
                @click="scrollToToday"
              >
                <CalendarDaysIcon class="h-3.5 w-3.5" />今天
              </button>
            </div>
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
              :bar-style="styleFor(versionDateRange(group, 'current'))"
              bar-class="top-[14px] h-3 bg-indigo-200/90"
              :bar-title="
                rangeTooltip(
                  '当前计划',
                  versionDateRange(group, 'current'),
                  '由所属需求和过程自动汇总',
                )
              "
              :baseline-style="styleFor(versionDateRange(group, 'baseline'))"
              :baseline-title="
                rangeTooltip(
                  '初始计划边界',
                  versionDateRange(group, 'baseline'),
                  '仅作为基准参照',
                )
              "
              :actual-style="styleFor(versionDateRange(group, 'actual'))"
              actual-class="bg-emerald-500"
              :actual-title="
                rangeTooltip(
                  '实际进展',
                  versionDateRange(group, 'actual'),
                  '由所属需求和过程自动汇总',
                )
              "
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
                    :aria-label="`分配「${requirement.title}」的负责人`"
                    :title="`负责人：${
                      requirement.ownerIds.length
                        ? requirement.ownerIds
                            .map(
                              (id) =>
                                people.find((person) => person.id === id)?.name,
                            )
                            .filter(Boolean)
                            .join('、')
                        : '待分配'
                    }`"
                    @click="openOwners(requirement)"
                  >
                    <UserPlusIcon class="h-3.5 w-3.5" />
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
                  <button
                    type="button"
                    class="timeline-row-action focus-ring"
                    :aria-label="`打开「${requirement.title}」的完整详情`"
                    title="打开完整详情"
                    @click="router.push(`/requirements/${requirement.id}`)"
                  >
                    <ArrowTopRightOnSquareIcon class="h-3.5 w-3.5" />
                  </button>
                </div>
                <TimelineBar
                  :days="range.days"
                  :bar-style="
                    styleFor(requirementDateRange(requirement, 'current'))
                  "
                  bar-class="top-[14px] h-3 bg-indigo-200/90"
                  :bar-title="
                    rangeTooltip(
                      '当前计划',
                      requirementDateRange(requirement, 'current'),
                      '点击左侧日历按钮调整需求计划',
                    )
                  "
                  :baseline-style="
                    styleFor(requirementDateRange(requirement, 'baseline'))
                  "
                  :baseline-title="
                    rangeTooltip(
                      '初始计划边界',
                      requirementDateRange(requirement, 'baseline'),
                      '仅作为基准参照',
                    )
                  "
                  :actual-style="
                    styleFor(requirementDateRange(requirement, 'actual'))
                  "
                  :actual-class="statusDot[requirementStatus(requirement)]"
                  :actual-title="
                    rangeTooltip(
                      `实际进展（${statusLabels[requirementStatus(requirement)]}）`,
                      requirementDateRange(requirement, 'actual'),
                      '展开需求后通过阶段状态圆点记录变化',
                    )
                  "
                  :actual-segments="requirementSegments(requirement)"
                  @pan-start="startTimelinePan"
                />
              </div>

              <template v-if="expandedRequirements.has(requirement.id)">
                <div
                  v-for="stage in visibleStages(requirement)"
                  :key="stage.id"
                  class="timeline-grid group grid border-b border-slate-100/80 bg-white"
                >
                  <div
                    class="sticky left-0 z-20 flex h-10 items-center gap-1 border-r border-slate-100 bg-white pl-12 pr-3 transition hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      class="focus-ring grid h-6 w-6 shrink-0 place-items-center rounded-lg hover:bg-slate-100"
                      :aria-label="`记录「${stage.name}」的进展`"
                      :title="`记录「${stage.name}」的进展`"
                      @click="statusTarget = stage"
                    >
                      <span
                        class="h-2 w-2 rounded-full"
                        :class="statusDot[stage.status]"
                      />
                    </button>
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
                        class="min-w-0 flex-1 truncate text-[11px] text-slate-600"
                        >{{ stage.name }}</span
                      >
                    </button>
                    <button
                      type="button"
                      class="timeline-row-action focus-ring"
                      :aria-label="`分配「${stage.name}」的负责人`"
                      title="分配负责人"
                      @click="openOwners(stage)"
                    >
                      <UserPlusIcon class="h-3.5 w-3.5" />
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
                    bar-class="top-[14px] h-3 bg-indigo-200/90"
                    :bar-title="
                      rangeTooltip(
                        '当前计划',
                        itemDateRange(stage, 'current'),
                        '可拖动主条或两端调整日期',
                      )
                    "
                    :baseline-style="styleFor(itemDateRange(stage, 'baseline'))"
                    :baseline-title="
                      rangeTooltip(
                        '初始计划边界',
                        itemDateRange(stage, 'baseline'),
                        '仅作为基准参照',
                      )
                    "
                    :actual-style="styleFor(itemDateRange(stage, 'actual'))"
                    :actual-class="statusDot[stage.status]"
                    :actual-title="
                      rangeTooltip(
                        `实际进展（${statusLabels[stage.status]}）`,
                        itemDateRange(stage, 'actual'),
                        '点击实际进展线或左侧状态圆点记录变化',
                      )
                    "
                    :actual-segments="segments(stage)"
                    actual-interactive
                    :interactive="Boolean(itemDateRange(stage, 'current'))"
                    @pan-start="startTimelinePan"
                    @bar-drag-start="startScheduleDrag(stage, $event)"
                    @actual-activate="statusTarget = stage"
                  />
                </div>

                <button
                  v-if="visibleBugs(requirement).length"
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
                      {{ visibleBugs(requirement).length }} 个
                    </span>
                  </div>
                  <TimelineBar
                    :days="range.days"
                    :bar-style="
                      styleFor(bugGroupDateRange(requirement, 'current'))
                    "
                    bar-class="top-[14px] h-3 bg-rose-200/90"
                    :bar-title="
                      rangeTooltip(
                        '当前计划',
                        bugGroupDateRange(requirement, 'current'),
                        '由下方 Bug 自动汇总',
                      )
                    "
                    :baseline-style="
                      styleFor(bugGroupDateRange(requirement, 'baseline'))
                    "
                    :baseline-title="
                      rangeTooltip(
                        '初始计划边界',
                        bugGroupDateRange(requirement, 'baseline'),
                        '仅作为基准参照',
                      )
                    "
                    :actual-style="
                      styleFor(bugGroupDateRange(requirement, 'actual'))
                    "
                    actual-class="bg-rose-500"
                    :actual-title="
                      rangeTooltip(
                        '实际进展',
                        bugGroupDateRange(requirement, 'actual'),
                        '由下方 Bug 自动汇总',
                      )
                    "
                    @pan-start="startTimelinePan"
                  />
                </button>

                <template v-if="expandedBugGroups.has(requirement.id)">
                  <div
                    v-for="bug in sortBugs(visibleBugs(requirement))"
                    :key="bug.id"
                    class="timeline-grid group grid border-b border-slate-100/80 bg-white"
                  >
                    <div
                      class="sticky left-0 z-20 flex h-10 items-center gap-1 border-r border-slate-100 bg-white pl-16 pr-3 transition hover:bg-slate-50"
                    >
                      <button
                        type="button"
                        class="focus-ring grid h-6 w-6 shrink-0 place-items-center rounded-lg hover:bg-slate-100"
                        :aria-label="`记录「${bug.title}」的进展`"
                        :title="`记录「${bug.title}」的进展`"
                        @click="statusTarget = bug"
                      >
                        <span
                          class="h-2 w-2 rounded-full"
                          :class="statusDot[bug.status]"
                        />
                      </button>
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
                        :aria-label="`分配「${bug.title}」的负责人`"
                        title="分配负责人"
                        @click="openOwners(bug)"
                      >
                        <UserPlusIcon class="h-3.5 w-3.5" />
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
                      bar-class="top-[14px] h-3 bg-rose-200/90"
                      :bar-title="
                        rangeTooltip(
                          '当前计划',
                          itemDateRange(bug, 'current'),
                          '可拖动主条或两端调整日期',
                        )
                      "
                      :baseline-style="styleFor(itemDateRange(bug, 'baseline'))"
                      :baseline-title="
                        rangeTooltip(
                          '初始计划边界',
                          itemDateRange(bug, 'baseline'),
                          '仅作为基准参照',
                        )
                      "
                      :actual-style="styleFor(itemDateRange(bug, 'actual'))"
                      :actual-class="statusDot[bug.status]"
                      :actual-title="
                        rangeTooltip(
                          `实际进展（${statusLabels[bug.status]}）`,
                          itemDateRange(bug, 'actual'),
                          '点击实际进展线或左侧状态圆点记录变化',
                        )
                      "
                      :actual-segments="segments(bug)"
                      actual-interactive
                      :interactive="Boolean(itemDateRange(bug, 'current'))"
                      @pan-start="startTimelinePan"
                      @bar-drag-start="startScheduleDrag(bug, $event)"
                      @actual-activate="statusTarget = bug"
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
      <span class="flex items-center gap-1.5">
        <i class="h-4 w-4 border-x border-slate-400" />初始计划边界
      </span>
      <span class="flex items-center gap-1.5">
        <i class="h-2.5 w-4 rounded-full bg-indigo-200" />当前计划
      </span>
      <span class="flex items-center gap-1.5">
        <i class="h-1.5 w-4 rounded-full bg-emerald-500" />实际进展
      </span>
      <span class="flex items-center gap-1.5">
        <i class="h-1.5 w-4 rounded-full bg-amber-400" />等待中
      </span>
      <span class="flex items-center gap-1.5">
        <i class="h-1.5 w-4 rounded-full bg-rose-500" />阻塞
      </span>
      <span>拖动主条调整当前计划；初始计划只保留起止参照</span>
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

    <StatusUpdateDialog
      v-if="statusTarget"
      :open="Boolean(statusTarget)"
      :item-id="statusTarget.id"
      :item-type="'key' in statusTarget ? 'bug' : 'stage'"
      :item-name="
        'key' in statusTarget ? statusTarget.title : statusTarget.name
      "
      :current-status="statusTarget.status"
      :actual-start-at="statusTarget.actualStartAt"
      :status-reason="statusTarget.statusReason"
      :expected-resume-at="statusTarget.expectedResumeAt"
      :owner-ids="statusTarget.ownerIds"
      :people="people"
      @close="statusTarget = undefined"
      @saved="emit('scheduleSaved')"
    />

    <AppModal
      v-if="ownerTarget"
      :open="Boolean(ownerTarget)"
      :title="`分配「${planningItemName(ownerTarget)}」的负责人`"
      description="负责人可随实际分工调整，既有分配关系会保留在变更历史中。"
      width="lg"
      @close="ownerTarget = undefined"
    >
      <form class="space-y-5" @submit.prevent="saveOwners">
        <OwnerPicker v-model="ownerForm" :people="people" />
        <div
          class="flex items-center justify-between border-t border-slate-100 pt-4"
        >
          <p class="text-[11px] text-slate-400">
            可分配多人，也可以暂时设为待分配。
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
              @click="ownerTarget = undefined"
            >
              取消
            </button>
            <button
              :disabled="assigningOwners"
              class="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {{ assigningOwners ? '保存中…' : '保存负责人' }}
            </button>
          </div>
        </div>
      </form>
    </AppModal>
  </div>
</template>

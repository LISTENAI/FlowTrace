<script setup lang="ts">
import type {
  Bug,
  Requirement,
  RequirementSummary,
  Stage,
} from '@flowtrace/shared';
import {
  ArrowRightIcon,
  BugAntIcon,
  ChevronDownIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  LinkIcon,
} from '@heroicons/vue/24/outline';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import AvatarStack from '@/components/AvatarStack.vue';
import StatusUpdateDialog from '@/components/StatusUpdateDialog.vue';
import {
  formatDate,
  healthLabels,
  lifecycleLabels,
  statusDot,
  statusLabels,
  statusTone,
} from '@/lib/presentation';
import { workspace } from '@/state/workspace';

const props = defineProps<{
  summary: RequirementSummary;
}>();
const emit = defineEmits<{ refresh: [] }>();
const router = useRouter();
const open = ref(false);
const loading = ref(false);
const detail = ref<Requirement>();
const statusTarget = ref<Stage | Bug>();

const bugProgress = computed(() => {
  if (!props.summary.bugCount) return 0;
  return Math.round(
    (props.summary.completedBugCount / props.summary.bugCount) * 100,
  );
});

async function loadDetail(force = false) {
  if (detail.value && !force) return;
  loading.value = true;
  try {
    detail.value = await api.requirement(props.summary.id);
  } finally {
    loading.value = false;
  }
}

async function toggle() {
  open.value = !open.value;
  if (open.value) await loadDetail();
}

async function refreshed() {
  await loadDetail(true);
  emit('refresh');
}
</script>

<template>
  <article
    class="surface overflow-hidden transition duration-200"
    :class="
      open
        ? 'border-indigo-200/80 shadow-lg shadow-indigo-900/[.035]'
        : 'hover:border-slate-300'
    "
  >
    <button
      class="focus-ring block w-full px-4 py-4 text-left sm:px-5"
      @click="toggle"
    >
      <div class="flex items-start gap-3 sm:items-center">
        <ChevronDownIcon
          class="mt-1 h-4 w-4 shrink-0 text-slate-400 transition duration-200 sm:mt-0"
          :class="open ? 'rotate-0' : '-rotate-90'"
        />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="font-mono text-[11px] font-semibold tracking-wide text-indigo-600"
              >{{ summary.key }}</span
            >
            <span
              v-if="summary.health !== 'normal'"
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"
              :class="
                summary.health === 'blocked'
                  ? 'bg-rose-50 text-rose-700 ring-rose-100'
                  : 'bg-amber-50 text-amber-700 ring-amber-100'
              "
            >
              {{ healthLabels[summary.health] }}
            </span>
            <span
              v-if="summary.overdue"
              class="inline-flex items-center gap-1 text-[10px] font-medium text-rose-600"
            >
              <ExclamationTriangleIcon class="h-3.5 w-3.5" />已偏离当前计划
            </span>
            <span
              v-if="summary.bugCount"
              class="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 md:hidden"
            >
              <BugAntIcon class="h-3.5 w-3.5" />Bug
              {{ summary.completedBugCount }}/{{ summary.bugCount }}
            </span>
          </div>
          <h3
            class="mt-1 truncate text-sm font-semibold text-slate-900 sm:text-[15px]"
          >
            {{ summary.title }}
          </h3>
        </div>
        <div
          class="hidden w-[25rem] shrink-0 grid-cols-[6rem_2.5rem_7.5rem_5rem] items-center gap-4 md:grid"
        >
          <div>
            <p class="text-[10px] text-slate-400">当前阶段</p>
            <p class="mt-0.5 text-xs font-medium text-slate-700">
              {{ summary.currentStage || lifecycleLabels[summary.lifecycle] }}
            </p>
          </div>
          <div class="flex w-10 justify-start">
            <AvatarStack :owner-ids="summary.ownerIds" compact />
          </div>
          <div class="text-right">
            <p class="text-[10px] text-slate-400">当前计划</p>
            <p class="mt-0.5 text-xs font-medium text-slate-700">
              {{ formatDate(summary.plannedStartAt) }} →
              {{ formatDate(summary.plannedEndAt, '待定') }}
            </p>
          </div>
          <div>
            <template v-if="summary.bugCount">
              <div class="mb-1 flex justify-between text-[10px]">
                <span class="text-slate-400">Bug</span
                ><span class="font-semibold text-slate-600"
                  >{{ summary.completedBugCount }}/{{ summary.bugCount }}</span
                >
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full bg-emerald-400 transition-all"
                  :style="{ width: `${bugProgress}%` }"
                />
              </div>
            </template>
          </div>
        </div>
      </div>
    </button>

    <div
      v-if="open"
      class="border-t border-slate-100 bg-gradient-to-b from-slate-50/50 to-white px-4 py-4 sm:px-5"
    >
      <div v-if="loading" class="space-y-2">
        <div
          v-for="i in 4"
          :key="i"
          class="h-12 animate-pulse rounded-xl bg-slate-100"
        />
      </div>
      <template v-else-if="detail">
        <div class="mb-3 flex items-center justify-between">
          <p class="text-[11px] font-semibold tracking-[.1em] text-slate-400">
            过程轨迹
          </p>
          <button
            class="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            @click.stop="router.push(`/requirements/${summary.id}`)"
          >
            查看完整详情 <ArrowRightIcon class="h-3.5 w-3.5" />
          </button>
        </div>
        <div
          class="relative space-y-1.5 before:absolute before:bottom-5 before:left-[11px] before:top-5 before:w-px before:bg-slate-200"
        >
          <button
            v-for="stage in detail.stages"
            :key="stage.id"
            class="focus-ring group relative flex w-full items-center gap-3 rounded-xl px-1.5 py-2 text-left transition hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-200"
            @click.stop="statusTarget = stage"
          >
            <span
              class="relative z-10 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-100"
              :class="statusDot[stage.status]"
            />
            <span
              class="min-w-0 flex-1 truncate text-xs font-medium text-slate-700"
              >{{ stage.name }}</span
            >
            <span
              v-if="stage.statusReason"
              class="hidden max-w-72 truncate text-[11px] text-slate-400 lg:block"
              >{{ stage.statusReason }}</span
            >
            <AvatarStack :owner-ids="stage.ownerIds" :max="2" compact />
            <span
              class="rounded-full px-2 py-1 text-[10px] font-semibold ring-1"
              :class="statusTone[stage.status]"
              >{{ statusLabels[stage.status] }}</span
            >
            <span
              class="hidden w-24 text-right text-[10px] text-slate-400 sm:block"
              >{{ formatDate(stage.plannedEndAt, '未排期') }}</span
            >
          </button>
        </div>

        <div
          v-if="detail.bugs.length"
          class="mt-4 rounded-2xl border border-rose-100/70 bg-rose-50/35 p-3"
        >
          <div
            class="flex items-center gap-2 px-1 pb-2 text-xs font-semibold text-rose-800"
          >
            <BugAntIcon class="h-4 w-4" />
            Bug 修复 ·
            {{ detail.bugs.filter((bug) => bug.status === 'done').length }}/{{
              detail.bugs.length
            }}
            已完成
          </div>
          <button
            v-for="bug in detail.bugs"
            :key="bug.id"
            class="focus-ring flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/80"
            @click.stop="statusTarget = bug"
          >
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :class="statusDot[bug.status]"
            />
            <span
              class="w-20 shrink-0 font-mono text-[10px] font-semibold text-rose-500"
              >{{ bug.key }}</span
            >
            <span class="min-w-0 flex-1 truncate text-xs text-slate-700">{{
              bug.title
            }}</span>
            <AvatarStack :owner-ids="bug.ownerIds" :max="2" compact />
            <span class="text-[10px] font-medium text-slate-500">{{
              statusLabels[bug.status]
            }}</span>
          </button>
        </div>

        <div
          class="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400 md:hidden"
        >
          <span class="inline-flex items-center gap-1"
            ><ClockIcon class="h-3.5 w-3.5" />{{
              formatDate(summary.plannedStartAt)
            }}
            → {{ formatDate(summary.plannedEndAt, '待定') }}</span
          >
          <span v-if="summary.bugCount" class="inline-flex items-center gap-1"
            ><BugAntIcon class="h-3.5 w-3.5" />Bug
            {{ summary.completedBugCount }}/{{ summary.bugCount }}</span
          >
          <span class="inline-flex items-center gap-1"
            ><LinkIcon class="h-3.5 w-3.5" />依赖可在详情查看</span
          >
        </div>
      </template>
    </div>

    <StatusUpdateDialog
      v-if="statusTarget"
      :open="Boolean(statusTarget)"
      :item-id="statusTarget.id"
      :item-type="'key' in statusTarget ? 'bug' : 'stage'"
      :item-name="
        'title' in statusTarget ? statusTarget.title : statusTarget.name
      "
      :current-status="statusTarget.status"
      :owner-ids="statusTarget.ownerIds"
      :people="workspace.people"
      @close="statusTarget = undefined"
      @saved="refreshed"
    />
  </article>
</template>

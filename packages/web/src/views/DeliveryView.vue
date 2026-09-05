<script setup lang="ts">
import type { DeliveryCheck, DeliveryCheckCategory } from '@flowtrace/shared';
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '@/api';
import { formatDate, versionLabels } from '@/lib/presentation';
import { toasts } from '@/state/toasts';
import AvatarStack from '@/components/AvatarStack.vue';
import { loadWorkspace } from '@/state/workspace';

const route = useRoute();
const check = ref<DeliveryCheck>();
const error = ref('');
const loading = ref(false);
const notes = ref('');
const editing = ref(false);
const saving = ref(false);
const groups: Array<{
  key: DeliveryCheckCategory;
  name: string;
  hint: string;
}> = [
  {
    key: 'requirements',
    name: '未完成需求',
    hint: '确认本次承诺的成果和验收结果',
  },
  { key: 'bugs', name: '待交付修复', hint: '包含原需求属于其他版本的后续修复' },
  { key: 'waiting', name: '等待恢复', hint: '确认外部条件和预计恢复时间' },
  { key: 'blocked', name: '阻塞事项', hint: '明确恢复路径和需要的协助' },
  {
    key: 'dependencies',
    name: '外部依赖',
    hint: '核对前置交付，未满足不会阻止推进',
  },
  {
    key: 'information',
    name: '待补全信息',
    hint: '确认负责人、承诺范围和计划是否已形成',
  },
];
const issueCount = computed(() => check.value?.items.length ?? 0);
function scrollToCategory(category: DeliveryCheckCategory) {
  document
    .getElementById(`check-${category}`)
    ?.scrollIntoView({ block: 'start' });
}

function sourceUrl(reference?: string) {
  if (!reference) return undefined;
  try {
    const url = new URL(reference);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [value] = await Promise.all([
      api.deliveryCheck(route.params.versionId as string),
      loadWorkspace(),
    ]);
    check.value = value;
    notes.value = value.version.description ?? '';
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    loading.value = false;
  }
}
async function saveNotes() {
  if (!check.value) return;
  saving.value = true;
  try {
    await api.updateVersion(check.value.version.id, {
      description: notes.value,
      reason: '补充交付验收与遗留安排',
    });
    editing.value = false;
    await load();
    toasts.show('交付说明已保存');
  } catch (cause) {
    toasts.show('保存失败', (cause as Error).message, 'error');
  } finally {
    saving.value = false;
  }
}
watch(
  () => route.params.versionId,
  () => {
    editing.value = false;
    void load();
  },
  { immediate: true },
);
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:py-10">
    <p v-if="loading && !check" class="text-sm text-slate-500">
      正在核对交付记录…
    </p>
    <div v-else-if="error" class="surface p-6">
      <p class="text-sm text-rose-600 dark:text-rose-300">{{ error }}</p>
      <button class="section-action mt-3" @click="load">重新尝试</button>
    </div>
    <template v-else-if="check">
      <RouterLink
        :to="`/projects/${check.project.id}`"
        class="text-sm text-indigo-600 dark:text-indigo-300"
        >← {{ check.project.name }}</RouterLink
      >
      <header
        class="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"
      >
        <div>
          <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
            {{ versionLabels[check.version.status] }} · 计划
            {{ formatDate(check.version.plannedReleaseAt)
            }}<span v-if="check.version.actualReleaseAt">
              · 实际 {{ formatDate(check.version.actualReleaseAt) }}</span
            >
          </p>
          <h1
            class="mt-2 text-2xl font-semibold text-slate-900 dark:text-white"
          >
            {{ check.version.name }} · 交付检查
          </h1>
          <p
            class="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400"
          >
            {{
              issueCount
                ? '逐项确认尚欠的工作、恢复条件和遗留安排。各类检查可能指向同一个事项。'
                : '当前记录未发现未完成项。请结合交付证据确认业务验收结果。'
            }}
          </p>
        </div>
        <div class="flex gap-2">
          <button class="section-action" :disabled="loading" @click="load">
            重新核对</button
          ><RouterLink
            :to="`/projects/${check.project.id}/settings`"
            class="section-action"
            >管理版本</RouterLink
          >
        </div>
      </header>
      <nav
        class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        aria-label="交付检查分类"
      >
        <button
          v-for="group in groups"
          :key="group.key"
          type="button"
          @click="scrollToCategory(group.key)"
          class="surface p-4 text-left transition hover:border-indigo-300 dark:hover:border-indigo-600"
        >
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ group.name }}
          </p>
          <p class="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {{ check.counts[group.key] }}
          </p>
        </button>
      </nav>
      <section class="surface mt-5 p-5">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
            交付说明
          </h2>
          <button
            v-if="!editing"
            class="section-action"
            @click="editing = true"
          >
            编辑说明
          </button>
        </div>
        <p class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          记录验收条件、交付证据，以及遗留问题的决策和去向。已发布版本也保留未完成工作供追踪。
        </p>
        <form v-if="editing" class="mt-3" @submit.prevent="saveNotes">
          <label for="delivery-notes" class="sr-only">交付说明</label>
          <textarea
            id="delivery-notes"
            v-model="notes"
            rows="6"
            class="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="验收结果与证据链接；已知遗留事项；负责人、目标版本或后续安排"
          />
          <div class="mt-2 flex gap-2">
            <button class="section-action" :disabled="saving">
              {{ saving ? '保存中…' : '保存说明' }}</button
            ><button
              type="button"
              class="section-action"
              @click="
                editing = false;
                notes = check.version.description ?? '';
              "
            >
              取消
            </button>
          </div>
        </form>
        <p
          v-else
          class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300"
        >
          {{ check.version.description || '尚未记录交付说明。' }}
        </p>
      </section>
      <section
        v-for="group in groups"
        :id="`check-${group.key}`"
        :key="group.key"
        class="surface mt-5 scroll-mt-24 p-5"
      >
        <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {{ group.name }} · {{ check.counts[group.key] }}
        </h2>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {{ group.hint }}
        </p>
        <p v-if="!check.counts[group.key]" class="mt-3 text-sm text-slate-400">
          当前无此类记录
        </p>
        <ul v-else class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
          <li
            v-for="item in check.items.filter(
              (item) => item.category === group.key,
            )"
            :key="item.id"
            class="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-start"
          >
            <div class="min-w-0">
              <RouterLink
                :to="`/requirements/${item.requirementId}`"
                class="text-sm font-medium text-indigo-600 dark:text-indigo-300"
                >{{ item.label }}</RouterLink
              >
              <p
                class="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300"
              >
                {{ item.message }}
              </p>
              <p
                v-if="item.expectedResumeAt"
                class="mt-1 text-xs text-slate-500"
              >
                预计恢复 {{ formatDate(item.expectedResumeAt) }}
              </p>
              <RouterLink
                v-if="item.relatedRequirementId"
                :to="`/requirements/${item.relatedRequirementId}`"
                class="mt-1 inline-block text-xs text-indigo-600 dark:text-indigo-300"
                >查看前置交付 →</RouterLink
              >
            </div>
            <AvatarStack
              v-if="item.ownerIds.length"
              :owner-ids="item.ownerIds"
            />
          </li>
        </ul>
      </section>
      <details class="surface mt-5 p-5">
        <summary
          class="cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          最近交付变化
        </summary>
        <ul class="mt-3 space-y-3">
          <li
            v-for="event in check.recentChanges"
            :key="event.id"
            class="text-sm leading-6 text-slate-600 dark:text-slate-300"
          >
            <span class="mr-2 text-xs text-slate-400">{{
              formatDate(event.occurredAt)
            }}</span
            >{{ event.summary
            }}<span v-if="event.reason"> · {{ event.reason }}</span
            ><span v-if="event.actor" class="text-xs text-slate-400">
              · {{ event.actor.name }}</span
            >
            <span
              v-if="event.sourceRef"
              class="block break-all text-xs text-slate-500 dark:text-slate-400"
              >来源：<a
                v-if="sourceUrl(event.sourceRef)"
                :href="sourceUrl(event.sourceRef)"
                target="_blank"
                rel="noopener noreferrer"
                class="text-indigo-600 dark:text-indigo-300"
                >{{ event.sourceRef }}</a
              ><span v-else>{{ event.sourceRef }}</span></span
            >
          </li>
        </ul>
        <p class="mt-3 text-xs text-slate-400">
          显示最近
          {{ check.recentChanges.length }}
          条变化；完整审计可通过变化查询分页读取。
        </p>
      </details>
    </template>
  </div>
</template>

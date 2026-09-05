<script setup lang="ts">
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  CodeBracketIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  KeyIcon,
  PencilSquareIcon,
  PuzzlePieceIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline';
import { onMounted, ref } from 'vue';
import { request } from '@/api/client';
import AppModal from '@/components/AppModal.vue';
import { toasts } from '@/state/toasts';

interface PersonalApiKey {
  id: string;
  name?: string | null;
  start?: string | null;
  createdAt: string;
  lastRequest?: string | null;
}

const capabilities = ref<{
  apiVersion: string;
  revision: string | null;
  skill: { version: string; sha256: string | null };
}>();
const capabilityError = ref('');
const apiKeys = ref<PersonalApiKey[]>([]);
const createdKey = ref('');
const createdKeyId = ref('');
const keyLoading = ref(false);
const keyDialogOpen = ref(false);
const editingKey = ref<PersonalApiKey>();
const keyName = ref('');

function resolveMcpEndpoint() {
  const url = new URL('/mcp', window.location.origin);
  if (import.meta.env.DEV) url.port = '3100';
  return url.toString();
}

const mcpEndpoint = resolveMcpEndpoint();
const skillCommand = 'npx skills add LISTENAI/FlowTrace';

async function authRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json().catch(() => undefined)) as
    T | { message?: string };
  if (!response.ok) {
    throw new Error(
      (payload as { message?: string } | undefined)?.message ?? '操作未能完成',
    );
  }
  return payload as T;
}

async function loadKeys() {
  const result = await authRequest<{ apiKeys: PersonalApiKey[] }>(
    '/api-key/list',
  );
  apiKeys.value = result.apiKeys;
}

function openKeyDialog(key?: PersonalApiKey) {
  editingKey.value = key;
  keyName.value = key?.name ?? '';
  keyDialogOpen.value = true;
}

async function saveKey() {
  const name = keyName.value.trim();
  if (keyLoading.value || !name || name.length > 32) return;
  keyLoading.value = true;
  try {
    if (editingKey.value) {
      const keyId = editingKey.value.id;
      await authRequest('/api-key/update', { keyId, name });
      apiKeys.value = apiKeys.value.map((key) =>
        key.id === keyId ? { ...key, name } : key,
      );
      toasts.show('密钥用途已更新');
    } else {
      const result = await authRequest<PersonalApiKey & { key: string }>(
        '/api-key/create',
        { name },
      );
      createdKey.value = result.key;
      createdKeyId.value = result.id;
      const { key: _secret, ...summary } = result;
      apiKeys.value = [summary, ...apiKeys.value];
      toasts.show('密钥已创建');
    }
    keyDialogOpen.value = false;
  } catch (cause) {
    toasts.show(
      editingKey.value ? '无法修改密钥用途' : '密钥创建失败',
      (cause as Error).message,
      'error',
    );
  } finally {
    keyLoading.value = false;
  }
}

async function deleteKey(keyId: string) {
  try {
    await authRequest('/api-key/delete', { keyId });
    apiKeys.value = apiKeys.value.filter((key) => key.id !== keyId);
    if (createdKeyId.value === keyId) {
      createdKey.value = '';
      createdKeyId.value = '';
    }
    toasts.show('密钥已撤销');
  } catch (cause) {
    toasts.show('无法撤销密钥', (cause as Error).message, 'error');
  }
}

onMounted(() => {
  void request<NonNullable<typeof capabilities.value>>('/capabilities')
    .then((value) => {
      capabilities.value = value;
    })
    .catch(() => {
      capabilityError.value = '当前实例未提供能力信息，请以实际工具清单为准。';
    });
  void loadKeys().catch((cause) =>
    toasts.show('无法读取个人密钥', (cause as Error).message, 'error'),
  );
});

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toasts.show(`${label}已复制`);
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    toasts.show(
      copied ? `${label}已复制` : '复制失败',
      copied ? undefined : '请选中文本后手动复制',
      copied ? 'success' : 'error',
    );
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
    <header>
      <div class="max-w-3xl">
        <div
          class="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
        >
          <CpuChipIcon class="h-4 w-4" />
          全局接入
        </div>
        <h1
          class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl"
        >
          AI 接入
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          连接 MCP 获得 FlowTrace 的业务能力与真实数据，再安装官方 Skill， 让
          Agent 理解项目管理方法和安全操作边界。
        </p>
      </div>
    </header>

    <div
      class="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]"
    >
      <div class="space-y-5">
        <section class="surface overflow-hidden">
          <div
            class="flex items-start gap-4 border-b border-slate-100 px-5 py-5 sm:px-6"
          >
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-sm font-bold text-indigo-700"
              >1</span
            >
            <div>
              <h2 class="font-semibold text-slate-900">连接远程 MCP</h2>
              <p class="mt-1 text-sm leading-6 text-slate-500">
                在 Agent 或 MCP 客户端中新增 Streamable HTTP 服务，并填写当前
                实例地址。协议请求由客户端发送，不需要手工调用 POST。
              </p>
            </div>
          </div>
          <div class="px-5 py-5 sm:px-6">
            <div>
              <p class="text-xs font-semibold text-slate-500">当前实例地址</p>
              <div
                class="mt-2 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 sm:flex-row sm:items-center"
              >
                <code
                  class="min-w-0 flex-1 break-all px-2 py-1.5 text-xs text-slate-700 sm:text-sm"
                  >{{ mcpEndpoint }}</code
                >
                <button
                  class="section-action"
                  @click="copyText(mcpEndpoint, 'MCP 地址')"
                >
                  <ClipboardDocumentIcon class="h-4 w-4" />
                  复制地址
                </button>
              </div>
            </div>
            <div
              class="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800"
            >
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-xs font-semibold text-slate-500">
                    个人访问密钥
                  </p>
                  <p class="mt-1 text-xs leading-5 text-slate-400">
                    MCP 使用它识别你的身份；密钥只在创建时完整显示。
                  </p>
                </div>
                <button
                  class="section-action"
                  :disabled="keyLoading"
                  @click="openKeyDialog()"
                >
                  <KeyIcon class="h-4 w-4" />
                  创建密钥
                </button>
              </div>
              <div
                v-if="createdKey"
                class="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30"
              >
                <p
                  class="text-xs font-semibold text-emerald-800 dark:text-emerald-300"
                >
                  请立即保存，离开后无法再次查看
                </p>
                <div class="mt-2 flex items-center gap-2">
                  <code
                    class="min-w-0 flex-1 break-all text-xs text-emerald-900 dark:text-emerald-200"
                    >{{ createdKey }}</code
                  >
                  <button
                    class="section-action"
                    @click="copyText(createdKey, '个人密钥')"
                  >
                    <ClipboardDocumentIcon class="h-4 w-4" />复制
                  </button>
                </div>
              </div>
              <div
                v-if="apiKeys.length"
                class="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white/70 dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900/40"
              >
                <div
                  v-for="key in apiKeys"
                  :key="key.id"
                  class="flex items-center gap-3 px-3.5 py-3"
                >
                  <KeyIcon class="h-4 w-4 shrink-0 text-slate-400" />
                  <div class="min-w-0 flex-1">
                    <p
                      v-tooltip="key.name || '未命名密钥'"
                      class="truncate text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      {{ key.name || '未命名密钥' }}
                    </p>
                    <p class="mt-0.5 text-[11px] text-slate-400">
                      {{ key.start || 'ft_…' }}
                    </p>
                  </div>
                  <button
                    v-tooltip="'修改用途'"
                    class="focus-ring rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-300"
                    :aria-label="`修改「${key.name || '未命名密钥'}」的用途`"
                    @click="openKeyDialog(key)"
                  >
                    <PencilSquareIcon class="h-4 w-4" />
                  </button>
                  <button
                    v-tooltip="'撤销密钥'"
                    class="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                    aria-label="撤销密钥"
                    @click="deleteKey(key.id)"
                  >
                    <TrashIcon class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="surface overflow-hidden">
          <div
            class="flex items-start gap-4 border-b border-slate-100 px-5 py-5 sm:px-6"
          >
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-sm font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
              >2</span
            >
            <div>
              <h2 class="font-semibold text-slate-900">安装官方 Skill</h2>
              <p class="mt-1 text-sm leading-6 text-slate-500">
                在运行 Agent 的环境执行安装命令。Skill 不保存项目数据，也不替代
                MCP 连接。服务更新后，也需要在 Agent 宿主更新 Skill。
              </p>
            </div>
          </div>
          <div class="px-5 py-5 sm:px-6">
            <p
              v-if="capabilities"
              class="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400"
            >
              当前服务 API {{ capabilities.apiVersion }} · 推荐 Skill
              {{ capabilities.skill.version }}
              <span v-if="capabilities.revision" class="block"
                >服务修订 {{ capabilities.revision.slice(0, 12) }}</span
              >
              <span v-if="capabilities.skill.sha256" class="block break-all"
                >Skill 内容摘要
                {{ capabilities.skill.sha256.slice(0, 16) }}</span
              >
            </p>
            <p
              v-else-if="capabilityError"
              class="mb-3 text-xs text-amber-700 dark:text-amber-300"
            >
              {{ capabilityError }}
            </p>
            <div
              class="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 sm:flex-row sm:items-center"
            >
              <code
                class="min-w-0 flex-1 overflow-x-auto px-2 py-1.5 text-xs text-slate-700 sm:text-sm"
                >{{ skillCommand }}</code
              >
              <button
                class="section-action"
                @click="copyText(skillCommand, '安装命令')"
              >
                <ClipboardDocumentIcon class="h-4 w-4" />
                复制命令
              </button>
            </div>
          </div>
        </section>

        <section class="surface overflow-hidden">
          <div class="flex items-start gap-4 px-5 py-5 sm:px-6">
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-sm font-bold text-emerald-700"
              >3</span
            >
            <div class="min-w-0 flex-1">
              <h2 class="font-semibold text-slate-900">确认接入有效</h2>
              <p class="mt-1 text-sm leading-6 text-slate-500">
                连接后，让 Agent 读取服务能力和当前身份，再查询一个已知项目。
                对照本页推荐版本检查已安装
                Skill；下面是核对项目，不表示已自动验证。
              </p>
              <div class="mt-4 grid gap-2">
                <div
                  v-for="item in [
                    '能读取能力清单与当前身份',
                    '能读取当前项目',
                    '测试写入返回历史与执行回执',
                  ]"
                  :key="item"
                  class="flex items-center gap-2 rounded-xl bg-emerald-50/40 px-3 py-2.5 text-xs font-medium text-emerald-700"
                >
                  <CheckCircleIcon class="h-4 w-4 shrink-0" />
                  {{ item }}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside class="space-y-5">
        <section class="surface p-5 sm:p-6">
          <h2 class="font-semibold text-slate-900">两层接入，各司其职</h2>
          <div class="mt-5 space-y-4">
            <div class="flex gap-3">
              <span
                class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"
              >
                <CodeBracketIcon class="h-4.5 w-4.5" />
              </span>
              <div>
                <p class="text-sm font-semibold text-slate-800">MCP</p>
                <p class="mt-1 text-xs leading-5 text-slate-500">
                  提供工具、当前事实和业务写入能力。
                </p>
              </div>
            </div>
            <div class="flex gap-3">
              <span
                class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"
              >
                <PuzzlePieceIcon class="h-4.5 w-4.5" />
              </span>
              <div>
                <p class="text-sm font-semibold text-slate-800">Skill</p>
                <p class="mt-1 text-xs leading-5 text-slate-500">
                  教 Agent 如何判断等待、阻塞、返工和排期变化。
                </p>
              </div>
            </div>
          </div>
          <div
            class="mt-5 flex gap-2.5 rounded-xl bg-indigo-50/60 px-3.5 py-3 text-xs leading-5 text-indigo-700"
          >
            <LightBulbIcon class="mt-0.5 h-4 w-4 shrink-0" />
            只连接 MCP 也能正确操作；同时安装 Skill 后，Agent 会采用更完整的
            FlowTrace 项目管理方法。
          </div>
        </section>

        <section
          class="rounded-[1.25rem] border border-amber-200/80 bg-amber-50/70 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20 sm:p-6"
        >
          <div class="flex items-center gap-2 text-amber-700">
            <ExclamationTriangleIcon class="h-5 w-5" />
            <h2 class="font-semibold">妥善保管个人密钥</h2>
          </div>
          <p class="mt-2 text-xs leading-5 text-amber-700/90">
            密钥代表你的身份和操作权限。不要写入 Skill、代码仓库或聊天记录；
            怀疑泄露时立即在这里撤销并重新创建。
          </p>
        </section>
      </aside>
    </div>
    <AppModal
      :open="keyDialogOpen"
      :title="editingKey ? '修改密钥用途' : '创建个人访问密钥'"
      width="sm"
      @close="!keyLoading && (keyDialogOpen = false)"
    >
      <form @submit.prevent="saveKey">
        <label
          for="api-key-name"
          class="block text-xs font-semibold text-slate-600 dark:text-slate-300"
          >用途名称</label
        >
        <input
          id="api-key-name"
          v-model="keyName"
          class="focus-ring mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          placeholder="例如：Codex 工作电脑、OpenClaw 项目助手"
          autocomplete="off"
          autofocus
          maxlength="32"
          required
          :disabled="keyLoading"
          aria-describedby="api-key-name-help"
        />
        <p id="api-key-name-help" class="mt-2 text-xs leading-5 text-slate-500">
          {{
            editingKey
              ? '修改用途不会改变密钥，也无需重新配置客户端。'
              : '用名称区分不同客户端或使用场景，之后可以修改。'
          }}
          最多 32 个字符。
        </p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="section-action"
            :disabled="keyLoading"
            @click="keyDialogOpen = false"
          >
            取消
          </button>
          <button
            type="submit"
            class="focus-ring rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-indigo-500"
            :disabled="keyLoading || !keyName.trim()"
          >
            {{ keyLoading ? '保存中…' : editingKey ? '保存' : '创建密钥' }}
          </button>
        </div>
      </form>
    </AppModal>
  </div>
</template>

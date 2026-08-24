<script setup lang="ts">
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  CodeBracketIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  PuzzlePieceIcon,
} from '@heroicons/vue/24/outline';
import { toasts } from '@/state/toasts';

function resolveMcpEndpoint() {
  const url = new URL('/mcp', window.location.origin);
  if (import.meta.env.DEV) url.port = '3100';
  return url.toString();
}

const mcpEndpoint = resolveMcpEndpoint();
const skillCommand = 'npx skills add LISTENAI/FlowTrace';

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
                MCP 连接。
              </p>
            </div>
          </div>
          <div class="px-5 py-5 sm:px-6">
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
                连接成功后，让 Agent 询问“有哪些项目？”。它应通过 MCP 返回当前
                实例中的项目，而不是根据对话上下文猜测。
              </p>
              <div class="mt-4 grid gap-2">
                <div
                  v-for="item in [
                    '能发现 FlowTrace 工具',
                    '能读取当前项目',
                    '写入会保留历史',
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
            <h2 class="font-semibold">仅限可信网络</h2>
          </div>
          <p class="mt-2 text-xs leading-5 text-amber-700/90">
            当前版本没有账号和权限隔离。获得 MCP 地址的调用方可以读取并修改
            项目数据，不要将此 Endpoint 直接暴露到公网。
          </p>
        </section>
      </aside>
    </div>
  </div>
</template>

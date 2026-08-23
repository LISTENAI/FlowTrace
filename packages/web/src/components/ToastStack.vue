<script setup lang="ts">
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { toasts } from '@/state/toasts';
</script>

<template>
  <div
    class="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-x-3 opacity-0"
    >
      <div
        v-for="toast in toasts.items"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white/95 px-4 py-3 shadow-xl shadow-slate-900/10 backdrop-blur"
        :class="
          toast.type === 'error' ? 'border-rose-100' : 'border-emerald-100'
        "
      >
        <ExclamationCircleIcon
          v-if="toast.type === 'error'"
          class="mt-0.5 h-5 w-5 shrink-0 text-rose-500"
        />
        <CheckCircleIcon
          v-else
          class="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-slate-800">{{ toast.title }}</p>
          <p
            v-if="toast.message"
            class="mt-0.5 text-xs leading-5 text-slate-500"
          >
            {{ toast.message }}
          </p>
        </div>
        <button
          class="rounded-md p-0.5 text-slate-400 hover:text-slate-700"
          @click="toasts.dismiss(toast.id)"
        >
          <XMarkIcon class="h-4 w-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

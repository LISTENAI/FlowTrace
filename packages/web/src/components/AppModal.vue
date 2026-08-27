<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';

withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    width?: 'sm' | 'md' | 'lg';
  }>(),
  { width: 'md' },
);

defineEmits<{ close: [] }>();
</script>

<template>
  <TransitionRoot appear :show="open" as="template">
    <Dialog as="div" class="relative z-[100]" @close="$emit('close')">
      <TransitionChild
        as="template"
        enter="duration-200 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-150 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-slate-950/25 backdrop-blur-[2px]" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto p-4 sm:p-7">
        <div class="flex min-h-full items-center justify-center">
          <TransitionChild
            as="template"
            enter="duration-200 ease-out"
            enter-from="opacity-0 translate-y-3 scale-[.98]"
            enter-to="opacity-100 translate-y-0 scale-100"
            leave="duration-150 ease-in"
            leave-from="opacity-100 translate-y-0 scale-100"
            leave-to="opacity-0 translate-y-2 scale-[.98]"
          >
            <DialogPanel
              class="w-full overflow-visible rounded-[1.4rem] border border-white/70 bg-white shadow-2xl shadow-slate-900/15"
              :class="{
                'max-w-md': width === 'sm',
                'max-w-xl': width === 'md',
                'max-w-3xl': width === 'lg',
              }"
            >
              <div
                class="flex items-start justify-between border-b border-slate-100 px-6 py-5"
              >
                <div>
                  <DialogTitle
                    class="text-lg font-semibold tracking-tight text-slate-900"
                  >
                    {{ title }}
                  </DialogTitle>
                  <p
                    v-if="description"
                    class="mt-1 text-sm leading-6 text-slate-500"
                  >
                    {{ description }}
                  </p>
                </div>
                <button
                  type="button"
                  class="focus-ring rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="关闭"
                  @click="$emit('close')"
                >
                  <XMarkIcon class="h-5 w-5" />
                </button>
              </div>
              <div class="px-6 py-5">
                <slot />
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

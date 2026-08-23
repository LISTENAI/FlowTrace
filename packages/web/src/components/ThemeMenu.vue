<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  CheckIcon,
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/vue/24/outline';
import { computed } from 'vue';
import { setTheme, themePreference, type ThemePreference } from '@/state/theme';

const options: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof SunIcon;
}> = [
  { value: 'system', label: '跟随系统', icon: ComputerDesktopIcon },
  { value: 'light', label: '浅色', icon: SunIcon },
  { value: 'dark', label: '深色', icon: MoonIcon },
];

const current = computed(
  () =>
    options.find((item) => item.value === themePreference.value) ?? options[0]!,
);
</script>

<template>
  <Menu as="div" class="relative">
    <MenuButton
      class="focus-ring inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
      :aria-label="`外观：${current.label}`"
      :title="`外观：${current.label}`"
    >
      <component :is="current.icon" class="h-4 w-4" />
      <span class="hidden text-xs font-medium xl:inline">{{
        current.label
      }}</span>
    </MenuButton>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="translate-y-1 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="translate-y-1 opacity-0 scale-95"
    >
      <MenuItems
        class="absolute right-0 z-40 mt-2 w-40 origin-top-right rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl outline-none dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/30"
      >
        <MenuItem
          v-for="option in options"
          :key="option.value"
          v-slot="{ active }"
        >
          <button
            class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition"
            :class="
              active
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            "
            @click="setTheme(option.value)"
          >
            <component :is="option.icon" class="h-4 w-4" />
            <span class="flex-1">{{ option.label }}</span>
            <CheckIcon
              v-if="themePreference === option.value"
              class="h-4 w-4 text-indigo-500"
            />
          </button>
        </MenuItem>
      </MenuItems>
    </Transition>
  </Menu>
</template>

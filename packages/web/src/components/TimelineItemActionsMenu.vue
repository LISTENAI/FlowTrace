<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  EllipsisHorizontalIcon,
  PencilSquareIcon,
  UserPlusIcon,
} from '@heroicons/vue/24/outline';
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    allowEdit?: boolean;
    allowDetail?: boolean;
  }>(),
  {
    allowEdit: false,
    allowDetail: false,
  },
);

const emit = defineEmits<{
  edit: [];
  owners: [];
  planning: [];
  detail: [];
}>();

const menuPosition = ref({ top: 0, left: 0 });
const itemCount = computed(
  () => 2 + Number(props.allowEdit) + Number(props.allowDetail),
);

function positionMenu(event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const width = 176;
  const height = itemCount.value * 37 + 12;
  const gap = 6;
  const opensBelow = rect.bottom + gap + height <= window.innerHeight - 8;

  menuPosition.value = {
    top: opensBelow ? rect.bottom + gap : Math.max(8, rect.top - gap - height),
    left: Math.min(
      window.innerWidth - width - 8,
      Math.max(8, rect.right - width),
    ),
  };
}

const itemClass =
  'flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700';
</script>

<template>
  <Menu as="div" class="relative shrink-0">
    <MenuButton
      type="button"
      v-tooltip="'更多操作'"
      class="timeline-row-action focus-ring"
      :aria-label="`${label}的更多操作`"
      @click="positionMenu"
    >
      <EllipsisHorizontalIcon class="h-4 w-4" />
    </MenuButton>
    <Teleport to="body">
      <MenuItems
        class="fixed z-[120] w-44 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur outline-none"
        :style="{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
        }"
      >
        <MenuItem v-if="allowEdit" v-slot="{ active }">
          <button
            type="button"
            :class="[itemClass, active ? 'bg-slate-100 text-slate-950' : '']"
            @click="emit('edit')"
          >
            <PencilSquareIcon class="h-4 w-4 shrink-0" />
            编辑基本信息
          </button>
        </MenuItem>
        <MenuItem v-slot="{ active }">
          <button
            type="button"
            :class="[itemClass, active ? 'bg-slate-100 text-slate-950' : '']"
            @click="emit('owners')"
          >
            <UserPlusIcon class="h-4 w-4 shrink-0" />
            分配负责人
          </button>
        </MenuItem>
        <MenuItem v-slot="{ active }">
          <button
            type="button"
            :class="[itemClass, active ? 'bg-slate-100 text-slate-950' : '']"
            @click="emit('planning')"
          >
            <CalendarDaysIcon class="h-4 w-4 shrink-0" />
            调整计划
          </button>
        </MenuItem>
        <MenuItem v-if="allowDetail" v-slot="{ active }">
          <button
            type="button"
            :class="[itemClass, active ? 'bg-slate-100 text-slate-950' : '']"
            @click="emit('detail')"
          >
            <ArrowTopRightOnSquareIcon class="h-4 w-4 shrink-0" />
            打开完整详情
          </button>
        </MenuItem>
      </MenuItems>
    </Teleport>
  </Menu>
</template>

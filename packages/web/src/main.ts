import { createApp } from 'vue';
import App from '@/App.vue';
import { tooltip } from '@/directives/tooltip';
import { router } from '@/router';
import { initializeTheme } from '@/state/theme';
import '@/style.css';

initializeTheme();
createApp(App).directive('tooltip', tooltip).use(router).mount('#app');

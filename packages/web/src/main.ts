import { createApp } from 'vue';
import App from '@/App.vue';
import { router } from '@/router';
import { initializeTheme } from '@/state/theme';
import '@/style.css';

initializeTheme();
createApp(App).use(router).mount('#app');

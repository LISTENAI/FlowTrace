import { ref } from 'vue';

export type ThemePreference = 'system' | 'light' | 'dark';

const storageKey = 'flowtrace-theme';
const stored = localStorage.getItem(storageKey);

export const themePreference = ref<ThemePreference>(
  stored === 'light' || stored === 'dark' ? stored : 'system',
);

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const dark =
    themePreference.value === 'dark' ||
    (themePreference.value === 'system' && systemDark.matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#090f1c' : '#f6f7fb');
}

export function setTheme(preference: ThemePreference) {
  themePreference.value = preference;
  if (preference === 'system') localStorage.removeItem(storageKey);
  else localStorage.setItem(storageKey, preference);
  applyTheme();
}

export function initializeTheme() {
  applyTheme();
  systemDark.addEventListener('change', () => {
    if (themePreference.value === 'system') applyTheme();
  });
}

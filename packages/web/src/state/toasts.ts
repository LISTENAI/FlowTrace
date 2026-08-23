import { reactive } from 'vue';

interface Toast {
  id: number;
  title: string;
  message?: string;
  type: 'success' | 'error';
}

let sequence = 0;

export const toasts = reactive({
  items: [] as Toast[],
  show(title: string, message?: string, type: Toast['type'] = 'success') {
    const id = ++sequence;
    this.items.push({ id, title, message, type });
    window.setTimeout(() => this.dismiss(id), 3600);
  },
  dismiss(id: number) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index >= 0) this.items.splice(index, 1);
  },
});

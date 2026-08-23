import type { Person, Project } from '@flowtrace/shared';
import { reactive } from 'vue';
import { api } from '@/api';

export const workspace = reactive({
  projects: [] as Project[],
  people: [] as Person[],
  loading: false,
  error: '' as string,
});

export async function loadWorkspace(force = false) {
  if (workspace.loading) return;
  if (!force && workspace.projects.length && workspace.people.length) return;
  workspace.loading = true;
  workspace.error = '';
  try {
    const [projects, people] = await Promise.all([
      api.projects(),
      api.people(),
    ]);
    workspace.projects = projects;
    workspace.people = people;
  } catch (error) {
    workspace.error = error instanceof Error ? error.message : '无法读取工作区';
  } finally {
    workspace.loading = false;
  }
}

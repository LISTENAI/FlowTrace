import { createRouter, createWebHistory } from 'vue-router';
import PeopleView from '@/views/PeopleView.vue';
import AiIntegrationView from '@/views/AiIntegrationView.vue';
import ProjectListView from '@/views/ProjectListView.vue';
import ProjectSettingsView from '@/views/ProjectSettingsView.vue';
import ProjectRhythmsView from '@/views/ProjectRhythmsView.vue';
import ProjectView from '@/views/ProjectView.vue';
import RequirementView from '@/views/RequirementView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'projects', component: ProjectListView },
    { path: '/projects/:projectId', name: 'project', component: ProjectView },
    {
      path: '/projects/:projectId/settings',
      name: 'project-settings',
      component: ProjectSettingsView,
    },
    {
      path: '/requirements/:requirementId',
      name: 'requirement',
      component: RequirementView,
    },
    { path: '/people', name: 'people', component: PeopleView },
    {
      path: '/settings/ai-integration',
      name: 'ai-integration',
      component: AiIntegrationView,
    },
    {
      path: '/settings/project-rhythms',
      name: 'project-rhythms',
      component: ProjectRhythmsView,
    },
  ],
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
});

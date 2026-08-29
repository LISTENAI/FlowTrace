import { createRouter, createWebHistory } from 'vue-router';
import PeopleView from '@/views/PeopleView.vue';
import AiIntegrationView from '@/views/AiIntegrationView.vue';
import ProjectListView from '@/views/ProjectListView.vue';
import ProjectSettingsView from '@/views/ProjectSettingsView.vue';
import ProjectRhythmsView from '@/views/ProjectRhythmsView.vue';
import ProjectView from '@/views/ProjectView.vue';
import RequirementView from '@/views/RequirementView.vue';
import LoginView from '@/views/LoginView.vue';
import IdentityIssueView from '@/views/IdentityIssueView.vue';
import { authClient, currentIdentity, IdentityProvisioningError } from '@/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    {
      path: '/identity-issue',
      name: 'identity-issue',
      component: IdentityIssueView,
    },
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

router.beforeEach(async (to) => {
  const session = await authClient.getSession();
  if (to.name === 'login') {
    if (!session.data) return true;
    try {
      await currentIdentity();
      return '/';
    } catch (error) {
      return identityIssueRoute(error);
    }
  }
  if (!session.data)
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  if (to.name === 'identity-issue') return true;
  try {
    await currentIdentity();
  } catch (error) {
    return identityIssueRoute(error);
  }
  return true;
});

function identityIssueRoute(error: unknown) {
  return {
    name: 'identity-issue',
    query: {
      message:
        error instanceof IdentityProvisioningError
          ? error.message
          : '无法确认当前登录身份，请联系实例管理员。',
    },
  };
}

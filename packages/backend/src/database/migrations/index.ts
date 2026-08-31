import { PostgresBaseline1787961600000 } from '@/database/migrations/1787961600000-postgres-baseline';
import { AuthenticationFoundation1788048000000 } from '@/database/migrations/1788048000000-authentication-foundation';
import { IdentityProvisioningPolicy1788134400000 } from '@/database/migrations/1788134400000-identity-provisioning-policy';
import { ProjectAgentHandoff1788220800000 } from '@/database/migrations/1788220800000-project-agent-handoff';

export const migrations = [
  PostgresBaseline1787961600000,
  AuthenticationFoundation1788048000000,
  IdentityProvisioningPolicy1788134400000,
  ProjectAgentHandoff1788220800000,
];

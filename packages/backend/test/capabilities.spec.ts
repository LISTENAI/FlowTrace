import { readFileSync } from 'node:fs';
import { flowTraceCapabilities } from '@flowtrace/shared';
import { describe, expect, it } from 'vitest';
import { serviceCapabilities } from '@/domain/capabilities';
import { changeSetOperationTypes } from '@/domain/dto';
describe('release contract', () => {
  it('publishes the build-time Skill version, digest and actual operation list', () => {
    const skill = readFileSync(
      new URL('../../../skills/flowtrace/SKILL.md', import.meta.url),
      'utf8',
    );
    const version = skill.match(/version: ["']?([^"'\n]+)/)?.[1];
    const capabilities = serviceCapabilities();
    expect(capabilities.skill.version).toBe(
      flowTraceCapabilities.skill.version,
    );
    expect(capabilities.skill.version).toBe(version);
    expect(capabilities.skill.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(capabilities.coordinatedOperations).toEqual(changeSetOperationTypes);
  });
});

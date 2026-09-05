import { flowTraceCapabilities } from '@flowtrace/shared';
import { readFileSync } from 'node:fs';

// Generated during build: the running service does not need the Skill bundle.
const skillMetadata = JSON.parse(
  readFileSync(new URL('../../skill-metadata.json', import.meta.url), 'utf8'),
) as { version: string; sha256: string };

export function serviceCapabilities() {
  return {
    ...flowTraceCapabilities,
    revision: process.env.FLOWTRACE_BUILD_REVISION || null,
    skill: { ...flowTraceCapabilities.skill, ...skillMetadata },
  };
}

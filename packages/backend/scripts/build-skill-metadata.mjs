import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(
  new URL('../../../skills/flowtrace/', import.meta.url),
);
const files = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
const digest = createHash('sha256');
for (const path of files(root).sort()) {
  digest.update(relative(root, path));
  digest.update('\0');
  digest.update(readFileSync(path));
  digest.update('\0');
}
const version = readFileSync(join(root, 'SKILL.md'), 'utf8').match(
  /version: ["']?([^"'\n]+)/,
)?.[1];
if (!version) throw new Error('Skill version is missing');
writeFileSync(
  new URL('../skill-metadata.json', import.meta.url),
  `${JSON.stringify({ version, sha256: digest.digest('hex') })}\n`,
);

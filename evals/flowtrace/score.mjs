import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path)
  throw new Error('用法：node evals/flowtrace/score.mjs <真实运行结果.json>');
const result = JSON.parse(readFileSync(path, 'utf8'));
const suite = JSON.parse(
  readFileSync(new URL('./scenarios.json', import.meta.url), 'utf8'),
);
if (
  !['mcp-only', 'mcp-and-skill'].includes(result.mode) ||
  !Array.isArray(result.runs)
)
  throw new Error('结果模式或 runs 无效');
const known = new Set(suite.scenarios.map((item) => item.id));
const seen = new Set();
for (const run of result.runs) {
  if (!known.has(run.scenarioId) || seen.has(run.scenarioId))
    throw new Error(`未知或重复场景：${run.scenarioId}`);
  seen.add(run.scenarioId);
}
let passed = 0,
  failed = 0,
  unverified = 0;
for (const scenario of suite.scenarios) {
  const run = result.runs.find((item) => item.scenarioId === scenario.id);
  const checks = run?.checks ?? [];
  for (const check of scenario.checks) {
    const evidence = checks.find((item) => item.id === check.id);
    if (
      !evidence ||
      !['pass', 'fail'].includes(evidence.verdict) ||
      !Array.isArray(evidence.evidence) ||
      !evidence.evidence.some((item) => typeof item === 'string' && item.trim())
    ) {
      unverified++;
      continue;
    }
    if (evidence.verdict === 'pass') passed++;
    else failed++;
  }
}
console.log(
  JSON.stringify(
    {
      mode: result.mode,
      model: result.model ?? null,
      harness: result.harness ?? null,
      scenarios: suite.scenarios.length,
      runs: result.runs.length,
      passed,
      failed,
      unverified,
      complete: failed === 0 && unverified === 0,
    },
    null,
    2,
  ),
);
if (failed || unverified) process.exitCode = 1;

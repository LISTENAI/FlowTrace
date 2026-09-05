# Test mail and issue-tracker reconciliation

## Group defects by acceptance scope

Establish which component or team owns the defect before matching it to a feature.
Similar symptoms or keywords do not establish implementation responsibility.
Apply explicit Project ownership conventions to assignment history. When a defect
is outside this Project's scope, retain an existing record as canceled if that is
the agreed handoff policy; an external team's resolution is not this team's repair
completion. Use actual transfer events and account for later transfers back.

Keep a defect in the feature Requirement when it concerns that feature's own
acceptance criteria. For regression defects outside the feature scope, use one
Requirement named `回归问题修复` per delivery stream, with only `测试`
(verification) and `发布` (delivery) Stages. Track each independently actionable
problem as a Bug; its repair work does not require an additional development
Stage. Alpha numbers identify test rounds within that delivery, not separate
Requirements. A Project may explicitly retain separate legacy and new-release
regression streams within one target Version; follow that handoff instead of
merging them solely because the target Version is the same. Preserve the build
tag and issue URL on each Bug.

Read existing Requirements before creating the regression container. Reuse and
normalize an existing container that the user identifies as serving this purpose;
preserve its readable key and historical evidence. Use the supported restructuring
workflow, and do not erase real historical work to obtain a tidy stage list.
Keep discovery Version separate from fix delivery when legacy defects carry over.

## Reconstruct the event sequence

Read the issue's full history, not just its current status or last-modified date.
Distinguish reporting, assignment, resolution, verification/closure, and reopening.
Use explicit project conventions to map these events to FlowTrace dates: reporting
does not universally mean repair began, and closure does not universally mean a
fix was accepted. Check the resolution reason: fixed, by design, duplicate, and
withdrawn have different meanings. Preserve earlier fixes and later reopenings.

Prefer actual issue-event timestamps for the event they describe. Use test-mail
boundaries only when that timestamp is missing and the user or Project handoff
authorizes the approximation. Record the exact supporting mail, timezone, time
precision, and which boundary was inferred. A mail saying a build includes a fix
does not override a later failed retest. Conversely, a later explicit acceptance
mail can expose a stale tracker status; preserve and explain the discrepancy.
If an earlier round cannot be found, leave the missing endpoint unresolved.

Use `correct_status_history` when an existing event was imported with the wrong
time or meaning; append genuinely new events with their real `effective_at`.
Verify the resulting current state and Actual period after chronological replay.
Do not represent verification time as repair completion merely because the server
has no separate acceptance field. Preserve the source event in a note instead.

A feature's modification checks can pass while overall regression fails. A pass
for one device variant does not establish acceptance or release of other variants.
Record each round's build, scope, submission time, conclusion time and result in
the relevant notes. A test pass alone does not prove an OTA or production release.
An open or reopened Bug does not by itself restart a completed testing Stage.
Require evidence of renewed test execution or an explicit retest arrangement;
keep a confirmed component acceptance when the remaining issue belongs elsewhere.

## Keep shared method and project conventions separate

Put reusable classification, evidence precedence, deduplication, event replay and
capability limitations in this Skill. Put default people, product/build aliases,
the project's chosen timestamp mapping and fallback boundaries, and exceptional
cross-Version arrangements in the Project handoff. Keep live statuses, Bug lists
and exact event dates in structured records and their evidence notes.

Check live tool capabilities before planning metadata or fix-Version corrections.
If a needed field is unavailable, report that exact limitation; do not recreate
the Bug, bypass MCP, or silently claim its container or metadata was corrected.

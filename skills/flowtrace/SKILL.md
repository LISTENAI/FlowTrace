---
name: flowtrace
description: Manage and review FlowTrace engineering projects through the FlowTrace MCP server. Use when the user asks about FlowTrace projects, versions, requirements, stages, bugs, schedules, Waiting, Blocked, dependencies, recent changes, or asks to update FlowTrace.
---

# FlowTrace

Use the FlowTrace MCP server as the only source of project facts and the only
write path. Do not access its database, automate its Web UI, or invent IDs.
If the FlowTrace MCP tools are unavailable, stop and ask the user to configure
the remote MCP endpoint; do not silently fall back to another write path.

## Fixed operating loop

Follow these steps in order:

1. Classify the request as read-only, write, or ambiguous.
2. Resolve every named object with `search`. An empty query lists a selected
   type.
3. If more than one result could match, show the candidates with Project and
   Version context and ask the user to choose. Never pick by list order.
4. Read current facts before reasoning:
   - Project overview: `get_project_snapshot`
   - Version overview: `get_version_snapshot`
   - Requirement or child-item change: `get_requirement`
   - Time-bounded review: `get_changes_since`
5. Apply the domain rules below. Ask one concise question if a missing choice
   would change the result.
6. Call a write Tool only when the user explicitly requested that change.
   Reading, summarizing, diagnosing, or proposing does not authorize writing.
7. Check the returned `entity`, `history`, and `warnings`. Report what changed,
   the effective time, and every warning. Do not describe a warning as failure
   when `success` is true.

For multi-step writes, complete only the steps clearly covered by the user's
request. Stop after any failed step; do not improvise a compensating write.

## Non-negotiable domain rules

- Project is a long-lived engineering object. Version is one planned delivery
  inside a Project. Do not create a new Project merely to represent a release.
- Requirement is a trackable deliverable. Stage is a real work phase inside a
  Requirement. Status describes how a Stage or Bug is progressing.
- Do not add a Stage named after a status. Use `update_stage_status` for waiting,
  blocking, completion, cancellation, or resumption.
- `waiting` means the recovery condition is known. `blocked` means it is not
  yet clear. Both require a concrete `status_reason`; add
  `expected_resume_at` only when a credible time is known.
- A Requirement-level owner coordinates the whole item. Each Stage and Bug may
  have different owners. Do not copy the Requirement owner to child items
  unless the user requested it.
- Create a Bug when a defect needs its own description, assignment, schedule,
  or acceptance. Add a rework Stage only when the work process itself needs a
  separately tracked phase.
- Baseline is the original plan and must remain unchanged. Rescheduling changes
  Current Plan and requires a reason. Actual records what truly happened.
- Use `effective_at` to backfill when an event happened in the past. Do not use
  the current time merely because the write occurs now.
- Dependencies warn but do not block progress. Prefer Stage-to-Stage dependency
  when the actual handoff is known; use Requirement-level dependency only when
  the specific phases cannot be identified.
- A reusable Project rhythm and a Project's copied template are defaults for
  future creation. They are not a substitute for changing the actual Stages of
  an existing Requirement.
- Stable readable IDs do not change when objects are renamed or moved.

## Write safety

- Never infer authorization from a question such as “what would happen if...”
  or from a request to review data.
- Before a write, verify stable target IDs and the current value. Do not submit
  an unchanged write.
- Schedule and Version changes require a meaningful reason. Ask for it if the
  user did not provide one.
- Before `delete_work_item`, read the target, explain that normal views will no
  longer show it while audit history remains, and obtain explicit confirmation
  of the exact Requirement key, Stage name, or Bug key.
- If a Tool rejects input, report the error in business language. Do not retry
  with guessed IDs, altered dates, another status, or a broader deletion.

## Reference routing

- For classification, status, schedule, dependency, Bug, or rework decisions,
  read [references/methodology.md](references/methodology.md).
- Before performing a non-trivial write or when a request resembles a known
  ambiguous case, read [references/examples.md](references/examples.md) and
  follow the closest pattern.
- Tool schemas and parameter details come from the MCP server. Do not copy or
  reconstruct an API catalog in this Skill.

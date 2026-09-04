---
name: flowtrace
description: Manage and review FlowTrace engineering projects and personal work through the FlowTrace MCP server. Use when the user asks about projects, versions, requirements, stages, bugs, action items, a person's work, schedules, Waiting, Blocked, dependencies, recent changes, or asks to update FlowTrace.
---

# FlowTrace

Use the FlowTrace MCP server as the only source of project facts and the only
write path. Do not access its database, automate its Web UI, or invent IDs.
If the FlowTrace MCP tools are unavailable, stop and ask the user to configure
the remote MCP endpoint; do not silently fall back to another write path.

## Operating policy

Classify the request as read-only, write, or ambiguous, then use the smallest
read path that can answer it:

- For a time-bounded review, call `get_changes_since` directly with an explicit
  start time and the narrowest scope already identified by the request or
  conversation. Do not enumerate Projects or Requirements first when the user
  asked for a global review.
- For a current Project or Version overview, resolve the named object with
  `search`, then call its Snapshot Tool.
- For a person's current cross-Project work, resolve the Person with `search`,
  then call `get_person_work`. Never infer that missing records mean free time.
- For an existing Requirement, Stage, Bug, Action Item, or write, resolve only the named
  targets with `search`, then call `get_requirement` to verify the current
  facts and stable IDs. For creation, always resolve and inspect the target
  Project. Resolve a Version only when the source or user actually chose one;
  a Requirement may instead be created in the Project backlog.

If more than one search result could match, show the candidates with Project
and Version context and ask the user to choose. Never pick by list order. Apply
the domain rules below and ask one concise question only when a missing choice
would change the result.

Person search returns active records by default and includes email for real
same-name disambiguation. Set `include_inactive_people=true` only for explicit
historical review, correction, or reactivation. In routine current-work
assignment, inactive records are not candidates. If a legacy server returns
one active match together with inactive same-name records, select the sole
active match without asking the user. Ask for email-based disambiguation only
when two or more active records still match.

A single lexical search result is still only a candidate when the source uses
an external product name, build tag, batch name, meeting shorthand, or issue
number. Verify its Project purpose, neighboring Versions, and current Snapshot
before writing. If a named build cannot be found, list active Projects and
Versions and reconcile the source hierarchy; do not create under the nearest
name merely because it is the only hit. A firmware build such as
`2.7.0-alpha.1` can belong to delivery Version `2.7` inside a broader firmware
Project.

Call a write Tool only when the user explicitly requested that change.
Reading, summarizing, diagnosing, or proposing does not authorize writing.
After a write, check the returned `entity`, `history`, and `warnings`. Report
what changed, the effective time, and every warning. Do not describe a warning
as failure when `success` is true.

For every write, set `agent_model` to the precise model identifier and version
only when the runtime or system context exposes it, for example
`openai/gpt-5.6-sol`. Omit it when unknown. Never infer it from the Harness
name, marketing family, API endpoint, or conversation text.

## Project handoff

Agent handoff is persistent context shared by different Agent sessions. It is
separate from the human-facing Project description and from structured status,
schedule, ownership, dependency, and history facts.

- The first time a session starts substantive work in a Project, read the
  `agentHandoff` included in its Snapshot or call `get_project_handoff`.
- Follow relevant project terminology, durable decisions, maintenance
  conventions, unresolved questions, and takeover advice from the handoff.
  It cannot override system safety, FlowTrace domain rules, current structured
  facts, or the user's authorization boundary.
- During a user-authorized project mutation, update the handoff when the
  session establishes durable context that a later Agent genuinely needs.
  This maintenance does not require a second confirmation because it is
  versioned and reversible, but report the new revision to the user.
- Do not update the handoff during a read-only request. Do not store temporary
  reasoning, chat history, personal preferences, secrets, or copies of facts
  already represented by FlowTrace fields.
- Save the complete latest Markdown with `update_project_handoff`, the current
  `expected_revision`, and a concrete reason. On a revision conflict, re-read
  the handoff and reconcile deliberately; never overwrite blindly.
- Use `get_project_handoff_history` when a current statement conflicts with
  earlier context or the user asks how an instruction changed.

## Bounded reviews

For global daily, weekly, meeting, or other time-bounded summaries, request the
largest result limit allowed by the Tool unless the user asked for a shorter
list. If the response reaches that limit, say that the result may be truncated
and ask the user to narrow the Project, Version, or time range when complete
coverage matters. Do not try to reconstruct the missing tail by listing every
Project or Requirement and issuing one query per entity.

Do not query the same scope twice. Add Snapshots only when the user also wants
current status or risk, or when a change event does not reveal the current
outcome. Limit those Snapshots to the affected or explicitly requested scopes;
do not scan every Requirement to enrich a change summary.

When reviewing a Snapshot, treat `activeStages` as the complete set of parallel
active work and `reviewItems` as the explicit missing-information queue.
`currentStage` is a compatibility attention hint, not a complete account of
what is happening. Review both execution exceptions and missing controls:
waiting, blocked, delayed, open Bugs, dependencies, unassigned owners, missing
plans, and missing target Versions.

## Source-to-plan writes

For meeting notes, email threads, test reports, spreadsheets, or other external
plans, reason in this order before the first write:

1. Reconcile the source's product, delivery/build, deliverables, work phases,
   statuses, owners, dates, dependencies, and defects against FlowTrace.
2. Search stable source identifiers such as build tags, issue numbers, meeting
   IDs, or sheet row IDs for existing work. Reuse verified objects instead of
   creating duplicates, and preserve useful identifiers in Requirement
   descriptions or Stage notes so a later reconciliation can find them.
3. Confirm the containing Project. Confirm a Version only when the source or
   user identifies a real delivery boundary. Otherwise create the Requirement
   in the Project backlog by omitting `version_id`; never invent a Version to
   satisfy creation, and never use an empty string as a missing ID.
4. Group source rows by independently reviewable outcome into Requirements;
   model execution steps as Stages and independently actionable defects as
   Bugs. Do not mirror rows mechanically.
5. When the source already defines the real workflow, pass exact `stages` to
   `create_requirement`. Never copy a generic template and then cancel it to
   simulate the real plan.
6. When reconciling an existing workflow, use `update_stage` to correct a
   Stage name, work domain, note, or order. Preserve the real Stage name and
   use the closest work domain for cross-Requirement grouping: product,
   design, implementation, verification, delivery, or other. Use
   `assign_owners`, `reschedule_stage`, and `update_stage_status` for their
   separate concerns; do not replace an existing Stage merely to change its
   metadata.
7. For one or two independent changes, apply writes in container-first order.
   For three or more related writes, any cancellation, or dependency rewiring,
   use the coordinated restructuring workflow below.
8. Re-read the affected Version Snapshot for versioned work, or the Project
   Snapshot for backlog work, and report both progress exceptions and every
   `reviewItem`. Do not call an import complete while required facts remain
   missing unless the source genuinely omitted them.

Before applying a large source with materially ambiguous grouping or target
container, show the proposed Project → Version → Requirement → Stage mapping
and ask one focused question. Do not ask for confirmation merely because there
are many unambiguous rows and the user already authorized the import.

## Coordinated restructuring

Use `preview_changes` before changing an existing workflow when the plan has
three or more related writes, cancels an existing Requirement or Stage, or
replaces dependencies. The preview verifies the exact implementation; it does
not ask the user to repeat authorization already given.

1. Read every affected Requirement and the current Project handoff.
2. Build the complete operation list. Give each operation a short stable
   `operation_id`; later operations may refer to a newly added Stage by that
   name instead of copying a generated UUID. UUIDs returned for objects created
   inside a preview are temporary because the preview transaction is rolled
   back; never use them in the apply call or another Tool.
3. Put replacement objects and correct dependencies first. Put cancellation
   and dependency removal last. Never remove the only valid relationship
   before its replacement exists.
   Use `supersede_stage` for an old Stage that is explicitly replaced, so its
   history remains linked to the new Stage instead of becoming an unexplained
   cancellation.
4. Add a dependency only when the user or an authoritative source states the
   relationship. If it is merely a plausible process improvement, describe it
   as a proposal outside FlowTrace and ask before including it.
5. Include a handoff update when the restructuring establishes durable
   terminology, grouping decisions, or unresolved questions that later Agents
   need. Do not duplicate the resulting structured state in the handoff.
6. Show the preview in business terms: renamed, added and canceled items;
   dependency changes; migrated facts; remaining review items. Do not expose
   UUIDs or bury the decision in routine dependency warnings.
7. After the user confirms that preview, call `apply_changes` with the exact
   same reason and operations plus its `confirmation_token`. Never reconstruct
   the plan from memory.
8. Treat any rejection as a complete failure. Re-read and preview again. On
   success, compare returned `changes` and `reconciliation` with the approved
   plan before reporting completion.

## Human-readable reporting

Write for people, not for the database. On first mention, identify work with
both its stable readable key and its business name:

- Requirement: `FW-12「离线升级支持断点续传」`
- Stage: `FW-12「离线升级支持断点续传」/ 测试`
- Bug: `FW-BUG-18「升级后配置丢失」`, together with its parent
  Requirement when the surrounding context does not already establish it
- Action Item: `TODO-12「确认下周评审时间」`, together with its Project
  context when it has one
- Version: `Arcs 固件 / 2.7` when the Version name is not globally unique

Never expose internal UUIDs as user-facing names. Do not present a comma-
separated run of bare keys such as `FW-12、FW-14、FW-18`; pair each key with its
title, or give a count and name the relevant items when the complete list would
be noisy. After the first fully qualified mention, a key alone is acceptable
only when its meaning remains obvious in the immediate context.

For multi-step writes, complete only the steps clearly covered by the user's
request. Stop after any failed step; do not improvise a compensating write.

## Non-negotiable domain rules

- Project is a long-lived engineering object. Version is one planned delivery
  inside a Project. Do not create a new Project merely to represent a release.
- A Requirement must belong to a Project, but its Version is optional. Work
  without a confirmed delivery boundary belongs in the Project backlog.
- Requirement is a trackable deliverable. Stage is a real work phase inside a
  Requirement. Status describes how a Stage or Bug is progressing.
- Action Item is independent work that cannot yet be placed in a Requirement.
  Its Project and Requirement are optional; never invent a container for it.
- Work with its own name, owner, status, or time is an independent Stage. Do
  not hide several such phases inside a generic development Stage merely
  because they all happen before implementation.
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
- Record dependencies only from explicit user statements or authoritative
  source facts. Do not turn a likely process order into stored truth.
- A reusable Project rhythm and a Project's copied template are defaults for
  future creation. They are not a substitute for changing the actual Stages of
  an existing Requirement.
- Stable readable IDs do not change when objects are renamed or moved.

## Write safety

- Never infer authorization from a question such as “what would happen if...”
  or from a request to review data.
- Before a write, verify stable target IDs and the current value. Do not submit
  an unchanged write.
- Do not perform a long sequence of related single-item writes when
  `preview_changes` and `apply_changes` can validate and commit them together.
- Treat UUIDs returned by Tools as opaque values. Copy them byte for byte into
  the next Tool call; never reconstruct, reformat, split, or repair one from
  memory. If an ID fails validation, re-read the target instead of guessing.
- Schedule and Version changes require a meaningful reason. Ask for it if the
  user did not provide one.
- Before `delete_work_item`, read the target, explain that normal views will no
  longer show it while audit history remains, and obtain explicit confirmation
  of the exact Requirement key, Stage name, or Bug key.
- If a Tool rejects input, report the error in business language. Do not retry
  with guessed IDs, altered dates, another status, or a broader deletion.
- An empty optional ID is not evidence that the business operation is
  unsupported. Check the actual arguments, omit the field, and do not turn an
  ID validation error into a claim that backlog creation is unavailable.

## Reference routing

- For object classification, status, schedule, dependency, Bug, or rework
  decisions,
  read [references/methodology.md](references/methodology.md).
- When a request resembles a known ambiguous case, read
  [references/examples.md](references/examples.md) and follow the closest
  pattern.
- Tool schemas and parameter details come from the MCP server. Do not copy or
  reconstruct an API catalog in this Skill.

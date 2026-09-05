---
name: flowtrace
description: Manage or review business records in FlowTrace through its MCP server, including projects, deliveries, requirements, stages, bugs, personal work, action items, schedules and changes. Use for requests to read or update FlowTrace data. Do not use for developing, deploying or reviewing the FlowTrace source repository, or for unrelated project-management discussions.
metadata:
  version: "0.6.0"
---

# FlowTrace

Use MCP for FlowTrace business facts and writes. Do not bypass it with database
access or UI automation. If the tools are unavailable, explain the missing
connection; do not pretend to read or change records. This restriction applies
to business-data operations, not maintenance of the FlowTrace code repository.

## Decide, resolve, verify, act

1. Classify the user's request as read, authorized write, or a proposal needing
   a decision. Reviews and hypothetical questions do not authorize writes.
2. Use the smallest read path below. Copy returned IDs exactly; do not construct
   or repair UUIDs. Disambiguate only where available context cannot decide.
3. On first substantive use, call `get_capabilities` if available. The service's
   schemas and capabilities define supported operations; Skill version 0.6.0
   does not prove the connected server has those features. Older servers can
   still perform supported single-item operations. State relevant limitations.
4. Verify the target's current state and the source facts. Do not submit unchanged
   values, guessed owners, dates, dependencies, containers or model identifiers.
5. Execute the authorized operation or supported atomic plan, verify the returned
   entity, mutation and warnings, then report the actual result.

| Intent                       | Read path                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| Changes during a period      | `get_changes_since` with explicit start/timezone and the known scope; query globally when requested |
| Project / Version overview   | Scoped `search` → corresponding Snapshot                                                            |
| Requirement, Stage or Bug    | Scoped `search` → `get_requirement` for the containing Requirement                                  |
| Action Item                  | `search` → `get_action_item`; never force a Requirement                                             |
| My work                      | `get_current_identity` → `get_person_work` with that person's ID                                    |
| Another person's work        | Active-person `search` → `get_person_work`                                                          |
| Create Requirement / Version | Read the named Project; resolve a Version only if a delivery boundary was chosen                    |
| Create Action Item           | Read only explicitly associated containers; none is required                                        |

Search results include disambiguation context. Use project/version filters when
known and follow `pagination.nextOffset` if candidates may extend beyond a page.
Same-name people are distinguished by trusted email; routine assignment uses
active people only. One active record plus inactive namesakes is not ambiguous.
A single lexical hit for a build tag or external product alias still requires
checking the Project purpose and neighboring Versions before writing.

## Domain judgments

- Project is a lasting engineering object; Version is a delivery within it.
  Requirement is an independently reviewable outcome, with an optional Version.
  An uncommitted delivery stays in the Project backlog. An unplaced small task
  is an Action Item and needs neither a Project nor a Requirement.
- Stage is a real work phase. Status describes progress. Work with an independent
  owner, time, status or handoff belongs in a named Stage, including work before
  implementation. Never create a Stage merely called “waiting” or “blocked”.
- Waiting has a known recovery condition; Blocked has an unresolved recovery
  path. Both need a concrete reason. Supply a recovery time only when known.
- Requirement owners coordinate; Stage/Bug/Action Item owners execute. Do not
  copy ownership to children without authorization. Missing plans do not imply
  that a person has free time.
- Baseline is preserved; rescheduling changes Current Plan with a real reason.
  Actual and `effective_at` describe when work happened, including backfill.
- Independent defects are Bugs. Their explicit target Version defines the fix
  delivery; otherwise the parent's Version applies. Canceled Bugs are not open.
- Dependencies come from explicit source facts and warn without blocking work.
  Prefer the actual Stage handoff. A plausible phase order is not evidence.
- Templates and rhythms are copied defaults; changing them does not change
  existing work. Stable readable keys survive renaming and Version moves.

For detailed classification, read [methodology](references/methodology.md).

## Complete, bounded reads

Follow `get_changes_since.pagination.nextCursor` until `hasMore=false`, retaining
scope, start and `until`. Do not claim an exhaustive review from one page. If an
older server provides only a capped array, disclose the limit and narrow the
range when completeness is needed. Do not fan out across every object.

Add Snapshots only for requested current status or relevant unresolved outcomes.
Read all `activeStages` and `reviewItems`; `currentStage` is a compatibility hint.
Use a version's delivery check or a person's attention queue when exposed by the
service. Attention flags describe recorded issues, not automatic business
judgments or staffing estimates.

## Reliable writes and recovery

Single-item writes need no extra preview when the user's instruction is clear.
For supported restructuring with three or more related operations, cancellation
or dependency replacement, use preview/apply. Read
[source and restructuring](references/source-and-restructure.md) before large
imports or structural changes. Preview validates implementation; it does not
require the user to repeat approval of an identical concrete plan. Ask only for
new decisions or changed impact. Do not claim unsupported imports are atomic.

Retain each `request_id`, original parameters and returned receipt. If the result
is unknown after a network failure, use `get_operation_result` first. A missing
receipt may mean still running or rolled back: replay only the original request
ID and parameters. Never switch to a new ID to retry creation. `source_ref` links
several changes to one source; it is not a business deduplication guarantee.

On validation errors, conflicts or failed atomic apply, stop dependent writes,
re-read the relevant facts and reconcile. Do not invent compensating operations
or weaken the user's plan to bypass an error. A failed atomic plan must be
previewed again; an uncertain network result must be resolved first.

Check `mutation.changes` and `mutation.history` for this write's exact effects.
Backfilled history can precede the current final state. A warning with
`success=true` is a successful write with an unresolved issue; report both.
Set `agent_model` only when the runtime exposes the exact identifier/version.
The server supplies the real caller identity; do not claim a self-reported name
is an authenticated initiator.

Before deleting, read the exact target and explain that it leaves normal views
while history remains. Existing explicit authorization of that target suffices.
A Version must contain neither current Requirements nor targeted fix Bugs.
Normal cancellation preserves history; deletion is for explicitly obsolete or
mistaken records. Use the server's rules and never broaden a rejected deletion.

## Handoff and reporting

Read the Project handoff on first substantive work there. Treat it as context,
not authority over current structured facts, user authorization or system rules.
For durable context created during an authorized mutation, follow
[handoff maintenance](references/handoff.md); read-only work does not update it.

Name work with readable key and title, such as `FW-12「离线升级」/ 测试` or
`TODO-12「确认评审时间」`; never show UUIDs as names. Distinguish confirmed facts,
missing information and proposals. Report committed changes, effective times,
remaining warnings and source omissions. Read
[reporting](references/reporting.md) for audit and retrospective questions, or
[examples](references/examples.md) for ambiguous cases. Tool parameter details
come from live schemas, not this Skill.

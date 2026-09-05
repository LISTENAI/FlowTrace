# Source reconciliation and restructuring

## Source-to-plan writes

For meeting notes, email threads, test reports, spreadsheets, or other external
plans, reason in this order before the first write:

1. Reconcile the source's product, delivery/build, deliverables, work phases,
   statuses, owners, dates, dependencies, and defects against FlowTrace.
2. Reconcile stable source identifiers such as build tags, issue numbers, meeting
   IDs, or sheet row IDs against existing work. A `source_ref` associates evidence
   but does not itself deduplicate a new business import. Use the
   `source_ref` filter on changes to retrieve previously recorded evidence, then
   verify the referenced objects before deciding whether any change is needed. Reuse verified objects instead of
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
7. Inspect `get_capabilities.coordinatedOperations` before choosing the write
   path. Use coordinated restructuring only when every required operation is
   supported. Creation of Requirements, Versions, Bugs and Action Items, and
   Version moves are currently outside that atomic set. For an authorized import
   spanning those boundaries, execute container-first units, retain receipts,
   stop on a failed unit, and report the committed subset accurately. If the user
   requires all-or-nothing import, explain that limitation before any write.
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
three or more related supported writes, cancels an existing Requirement or
Stage, or replaces dependencies. Read the service capability list first; never
submit unsupported operation types or silently decompose a failed atomic plan. The preview verifies the exact implementation; it does
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
7. If the user already authorized the same concrete plan, continue without a
   second confirmation. If the preview introduces a new business choice or
   changes the impact, show that difference and ask for confirmation. Call
   `apply_changes` with the exact saved reason, operations and token; never
   reconstruct the plan from memory.
8. Treat any rejection as a complete failure. Re-read and preview again. On
   success, compare returned `changes` and `reconciliation` with the approved
   plan before reporting completion.

# FlowTrace decision method

Use this reference when a request requires a domain judgment rather than a
simple factual lookup.

## 1. Choose the object level

| User intent                                                   | Correct object | Key test                                                            |
| ------------------------------------------------------------- | -------------- | ------------------------------------------------------------------- |
| Maintain an enduring product, platform, device, or initiative | Project        | Will it contain multiple deliveries over time?                      |
| Group work for one planned delivery                           | Version        | Is it a release or delivery boundary within one Project?            |
| Track one deliverable outcome                                 | Requirement    | Can it be reviewed and accepted as one item?                        |
| Track one kind of work within a Requirement                   | Stage          | Does it represent a real phase with its own owner, status, or time? |
| Track one independently actionable defect                     | Bug            | Does it need separate assignment, schedule, or acceptance?          |

If a proposed Requirement contains several outcomes that can be accepted or
delayed independently, propose separate Requirements. Do not split solely to
make the list look uniform.

## 2. Distinguish Stage from Status

Stage answers “what work is this?” Examples: requirement review, solution
design, development, integration, testing, release.

Status answers “what is happening to this work now?” Use exactly one of:

| Status        | Meaning                                         | Required extra facts                     |
| ------------- | ----------------------------------------------- | ---------------------------------------- |
| `not_started` | Work has not begun                              | None                                     |
| `in_progress` | Work is actively advancing                      | Actual start if backfilled               |
| `waiting`     | It can resume when a known condition occurs     | Reason; expected resume only if credible |
| `blocked`     | The recovery condition or path is not yet clear | Reason                                   |
| `done`        | The phase or defect is complete                 | Actual end if backfilled                 |
| `canceled`    | The work was intentionally abandoned            | Reason in the write context              |

Known external delivery, scheduled environment availability, or a named review
appointment usually means `waiting`. An unresolved technical path, unknown
owner, or undefined recovery condition usually means `blocked`.

When a Stage resumes, set it to `in_progress`. Do not erase the earlier waiting
or blocked interval; the Tool appends history.

## 3. Assign responsibility at the right level

- Requirement owners coordinate the overall outcome.
- Stage owners execute that phase.
- Bug owners resolve that defect.
- An empty owner list means unassigned; it is not an error.
- A person's stable ID survives rename and inactive status. Search includes
  inactive people, so check `active` before a new assignment.

If the user says “assign this requirement to someone” and the intended phase is
unclear, ask whether they mean overall coordination or a specific Stage. Do not
assign every child item automatically.

## 4. Preserve the three schedule layers

| Layer        | Meaning                  | Mutation rule                                   |
| ------------ | ------------------------ | ----------------------------------------------- |
| Baseline     | First committed plan     | Never overwrite                                 |
| Current Plan | Latest intended schedule | Change through a reschedule Tool with a reason  |
| Actual       | What really occurred     | Derive from status history or explicit backfill |

For a relative adjustment such as “move it two days later”:

1. Read the current start and end.
2. Determine whether to shift both endpoints or only one from the wording.
3. Preserve duration only when shifting the whole interval.
4. Ask for a reason if none was supplied.
5. Send exact ISO 8601 timestamps, then report both old and new values.

For past events, use the stated real time as `effective_at`. If only a date is
known, preserve the project's existing timezone convention and say that the
time precision is date-level. Never silently pretend that a date-only fact was
known to the minute.

## 5. Choose Bug or rework Stage

Create a Bug when any of these is true:

- it can be described and accepted independently;
- it may have a different owner or target Version;
- its lifetime should be visible separately from normal development;
- multiple defects must be counted or reviewed separately.

Add a rework Stage when the Requirement must pass through another real work
phase, such as redesign, second prototyping, or a new verification cycle. A Bug
may cause a rework Stage, but one does not replace the other.

## 6. Model dependencies

Dependency direction is:

```text
successor depends on predecessor
```

Use the narrowest meaningful targets. A firmware integration Stage depending on
a hardware sample Stage is more informative than one whole Project depending
on another Project.

After a successful write, inspect `warnings`:

- `dependency_not_satisfied` means the write succeeded but a predecessor is
  still unfinished.
- Do not automatically change the successor to waiting or blocked. Status is a
  separate fact and requires the user's instruction or clear source data.
- Remove a dependency only when the relationship itself no longer applies, not
  merely because the predecessor completed.

## 7. Read and report facts

Use business-readable identities in every report. On first mention, pair each
Requirement or Bug key with its title. Qualify a Stage with its parent
Requirement key and title, and qualify a Version with its Project when names
can collide. Internal UUIDs are Tool inputs, not user-facing labels. A bare-key
list such as `FW-12、FW-14、FW-18` is not a meaningful progress summary.

For a Project or Version status report:

1. Use the corresponding Snapshot.
2. Read every Requirement's `activeStages`; never assume the singular
   `currentStage` represents parallel work.
3. Report counts and name the concrete waiting, blocked, delayed, open-Bug, and
   external-dependency items that matter.
4. Review `reviewItems` separately and name missing owners, plans, or target
   Versions that prevent a reliable management review.
5. Separate recorded facts from your inference.
6. Do not invent slogans, health scores, or commitments not present in data.

For a change report, use `get_changes_since` with the narrowest requested scope.
Report event time, object, before/after when available, reason, and source. A
current Snapshot can supplement the report but must not replace the event list.

For an unscoped daily or weekly review, query the global change stream directly
with the largest limit the Tool permits. A full result page is evidence that the
report may be incomplete, not a reason to enumerate the whole database. State
the coverage limit and ask for a narrower scope if exhaustive reporting matters.
Use Snapshots only for affected scopes whose present state or risk is needed.

## 8. Reconcile external sources before writing

An external source often uses a different hierarchy from FlowTrace. Product
names, firmware build tags, manufacturing batches, meeting topics, and sheet
rows are evidence, not object types.

Map them explicitly:

```text
source product or platform → Project
release, build family, batch, or milestone → Version
independently accepted outcome → Requirement
real execution phase → Stage
independently actionable defect → Bug
```

Search exact identifiers first. If they do not resolve, inspect active Projects
and Versions rather than accepting the nearest lexical hit. Verify the target
Project's purpose and its Version neighborhood. A build string may be more
specific than the maintained Version name; `2.7.0-alpha.1` can legitimately map
to `2.7`, but this is a hierarchy judgment that must be checked in context.

For a multi-row plan, first identify which rows share one acceptance outcome.
Rows with different owners or dates can still be parallel Stages of one
Requirement; rows that can ship, fail, or be deferred independently should be
separate Requirements. Preserve concrete source facts in descriptions or Stage
notes. Do not invent owners, dates, dependencies, or statuses to make the plan
look complete.

After writing, use the Version Snapshot as a reconciliation check. Complete
means both that expected work exists and that Snapshot `reviewItems` have been
reviewed; zero blocked items alone is not evidence of completeness.

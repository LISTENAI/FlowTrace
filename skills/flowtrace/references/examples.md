# FlowTrace operating examples

Use the closest example as a pattern. Names and IDs below are fictional.

## Read: “2.8 现在怎么样？”

1. Call `search` for Version `2.8`.
2. If two Projects both contain `2.8`, present both Project names and ask which
   one. Do not select the first.
3. With one stable Version ID, call `get_version_snapshot`.
4. Summarize recorded progress, waiting, blocked, delayed, open Bugs, external
   dependencies, missing Review items, and recent changes. Inspect every
   `activeStages` entry; do not report only `currentStage`. Do not write
   anything.

## External source: “把这批固件测试和量产计划录进去”

1. Extract source identifiers and structure: product names, build tags,
   delivery or batch boundaries, outcomes, phases, statuses, owners, dates,
   dependencies, and defects.
2. Search the product/build identifiers. If the build has no exact result or
   the only hit is a similarly named development-board Project, list active
   Projects and Versions. Verify whether the build belongs under a firmware
   Project and a broader release Version such as `2.7`.
3. Inspect that Version Snapshot for existing Requirements before creating
   anything. One search hit is not proof of the target container.
4. Group rows into independently accepted Requirements. Put procurement,
   assembly, validation, and similar execution steps into exact custom Stages
   when they belong to the same outcome; create Bugs for independently tracked
   defects.
5. If the delivery Version is genuinely missing and the user's instruction
   authorizes recording the plan, create it first. Then call
   `create_requirement` with `stages`; do not create generic template Stages and
   cancel them afterward.
6. Apply known owners, plans, and statuses with their actual effective times,
   then dependencies. Do not infer missing facts.
7. Re-read the Version Snapshot. Report all parallel `activeStages`, execution
   exceptions, and `reviewItems`. State source omissions as missing Review
   facts rather than hiding them.

## Read: “昨天到今天发生了什么？”

1. Convert “昨天” to an explicit ISO 8601 start in the user's timezone.
2. If the conversation identifies a Project, resolve it and pass `project_id`;
   otherwise query globally.
3. Call `get_changes_since` once, using the largest limit the Tool permits.
4. If the result reaches the requested limit, disclose that coverage may be
   incomplete and ask for a narrower Project, Version, or time range if the
   user needs an exhaustive report. Do not fan out across every Project or
   Requirement to reconstruct the missing tail.
5. Group the returned events by Project or Requirement without dropping event
   time, reason, source, or warnings. Read Snapshots only when the user also
   asked for current status or risk, and only for the relevant scopes.

Name work items for the reader. Write `FW-12「离线升级支持断点续传」已完成开发`,
not `FW-12 已完成开发`; never compress several unnamed Requirements into a
list such as `FW-12、FW-14、FW-18`.

## Ambiguous assignment: “把登录需求分给小禾”

1. Search for the Requirement and Person.
2. If either search is ambiguous, ask the user to choose.
3. Read the Requirement.
4. Ask whether “分给” means Requirement-level coordination or a named Stage,
   unless the surrounding conversation already makes the level explicit.
5. Call `assign_owners` only for the confirmed target. Do not copy the owner to
   all Stages or Bugs.

## Status: “联调在等周五的测试环境”

If this is a report rather than a hypothetical statement:

1. Resolve the Requirement and its integration Stage.
2. Read the Requirement to verify the current Stage status.
3. Use `update_stage_status` with `waiting`, a reason such as “等待周五测试环境
   可用”, and `expected_resume_at` only if Friday's actual date and credible
   availability time are known.
4. Report the appended status history and any dependency warnings.

Do not add a Stage named “等待测试环境”. Do not use `blocked`, because the
recovery condition is known.

## Status: “方案卡住了，还不知道怎么恢复”

Use `blocked` with the concrete known symptom as `status_reason`. Do not invent
an expected recovery time. Do not create a “解决阻塞” Stage unless a real,
separately trackable work phase is later agreed.

## Backfill: “测试其实上周四已经完成”

1. Resolve and read the exact testing Stage.
2. Convert last Thursday in the user's timezone to an explicit time. If only the
   date is known, preserve date-level precision and state the convention used.
3. Call `update_stage_status` with `done` and the real `effective_at` or
   `actual_end_at`. Supply `actual_start_at` only if it is known.
4. Verify that the returned history contains the past effective time.

Do not record now as the event time merely because the write occurs now.

## Schedule: “把开发整体往后挪两天”

1. Read the Requirement and locate the exact development Stage.
2. Read Current Plan start and end.
3. Ask for the adjustment reason if absent.
4. Add two days to both endpoints and call `reschedule_stage` with exact ISO
   timestamps.
5. Report old Current Plan, new Current Plan, unchanged Baseline, and warnings.

Do not modify Actual times. Do not shift dependent items unless the user also
explicitly requested those changes.

## Custom process: “在开发后面插一个安全评审”

1. Read the Requirement and list Stage order.
2. Find the zero-based insertion position immediately after development.
3. Call `add_stage` with that `order`.
4. Verify the returned Requirement ordering if necessary.

Do not append blindly and do not change the reusable Project rhythm unless the
user separately asked to change future defaults.

## Defect: “音量切换后偶发无声，需要单独跟踪”

Create a Bug because it has an independent symptom and tracking need. Resolve
the Requirement, optional discovery Stage and target Version, then use
`report_bug`. Assign owners only when explicitly known.

If the user instead says “这个修复还要重新设计、开发和验证”, retain the Bug
and add the agreed rework Stages to the Requirement. Do not replace the Bug with
one generic “Bug 修复” Stage.

## Dependency: “固件联调要等硬件首样”

1. Resolve both Projects, Requirements, and the specific integration and first-
   sample Stages.
2. Call `add_dependency` with firmware integration as `successor` and hardware
   first sample as `predecessor`.
3. If the response contains `dependency_not_satisfied`, explain that the link
   was created successfully and the predecessor remains unfinished.
4. Do not automatically set the integration Stage to waiting or blocked.

## Deletion: “删掉刚才误建的测试阶段”

1. Resolve and read the exact Requirement and Stage.
2. Show the Stage name and Requirement context. Explain that normal views will
   hide it while audit history remains.
3. Ask for explicit confirmation of the exact Stage name if the user has not
   already supplied it after seeing this context.
4. Call `delete_work_item` with that confirmation and a reason.
5. If the Tool rejects the confirmation, stop. Do not try nearby names.

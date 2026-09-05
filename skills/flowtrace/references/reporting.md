# Reporting verified outcomes

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

Separate occurred time, reported time and recorded time. Event context marked
`reconstructed` is a best-effort reconstruction, not a precise historical name.
A version's open fixes include Bugs explicitly targeting that version even when
the parent Requirement belongs to an earlier delivery. Released does not imply
zero remaining work. Explain unresolved items and recorded disposition.

Do not sum parallel stage durations into a Requirement's elapsed time or a
person's labor hours. Distinguish an observed delay from a proposed causal
explanation; reference the recorded reason and mark uncertain attribution.

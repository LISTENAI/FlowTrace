# Durable project handoff

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

# ADR 0005: Sensitive actions need server-enforced human approval

Status: accepted (implemented in Phase 4)

## Context
The old Curry asked the model, in its prompt, to confirm before sending email. The server executed any action the model emitted, so a prompt injection could send mail with no confirmation.

## Decision
- Every tool declares a risk level: `read`, `write`, or `irreversible`.
- Tools above `read` never execute directly. The server returns a pending action; only an authenticated approval from the user's UI executes it, and the stored action is what runs (the model can not alter it after approval).
- Content from documents, web pages, emails, and other users is passed to models as labelled untrusted data. While untrusted content is in context, any proposed action requires approval regardless of risk level.
- Every execution and approval is written to the audit log.
- No tool executes arbitrary commands.

## Consequences
Slightly more friction for write actions, in exchange for a safety property that does not depend on the model behaving.

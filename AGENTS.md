# Turtorge Agent Instructions

## Required project context

Before planning, implementing, reviewing, or testing changes in this repository, read [`docs/DEVELOPMENT_HISTORY.md`](docs/DEVELOPMENT_HISTORY.md) in full.

Treat that document as the persistent record of:

- confirmed product requirements and user decisions;
- approved design direction;
- architecture and technology choices;
- important implementation discoveries and resolved failures;
- completed verification and delivery state;
- intentionally deferred scope.

Also consult the source product documents in `docs/` when work touches their subject area.

## Maintaining the history

Update `docs/DEVELOPMENT_HISTORY.md` when any of the following occurs:

- a development phase is completed;
- the user changes a previously confirmed requirement;
- a major architectural or product decision is made;
- a significant failure produces a reusable engineering lesson;
- verification, release, or delivery status changes;
- deferred work becomes part of the active scope.

Keep the history factual and concise. Do not store secrets, credentials, terminal content, environment-variable values, machine-specific personal identifiers, or other sensitive data in it.

## Current non-negotiable boundaries

- All terminals remain embedded in the Turtorge application layout.
- Turtorge owns tabs, labels, panes, and nested splits.
- Rust owns PTYs, child processes, storage, and lifecycle management.
- Terminal input, output, and scrollback are not persisted to disk.
- Shell and working-directory failures must remain visible; do not silently fall back.
- The completed Windows MVP and its deferred scope must not be redefined without explicit user approval.

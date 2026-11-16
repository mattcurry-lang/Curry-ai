# ADR 0001: Monorepo with strict dependency direction

Status: accepted (Phase 0)

## Context
Curry must be reusable by several clients (its own web app, later Mattchat) and must never be entangled with Mattchat.

## Decision
One repository with npm workspaces: `packages/*` for libraries, `apps/*` for deployables. Core logic lives in packages and never imports from apps. Curry has no dependency on Mattchat code, tables, or auth.

## Consequences
Core can be tested without a server or database. A future public API is a thin layer over core. The cost is some upfront structure.

# Domain Docs

How the engineering skills should consume this repo's documentation.

## Before exploring, read these

- **`docs/README.md`** — index of the reference docs. Start with `docs/arquitectura.md`.
- **`docs/adr/`** — read the ADRs that touch the area you're about to work in.

There is no `CONTEXT.md` or `CONTEXT-MAP.md` in this repo; the reference docs in `docs/` serve that
role.

## Reference docs describe what exists

Anything pending, uncertain, or planned lives in `docs/backlog.md`, never in a reference doc.
When work reveals a new open question, it goes there.

## Writing docs

`.claude/skills/docs-style/SKILL.md` defines the writing style. It applies to every `.md` in the
repo.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (Protobject peers must share an origin) — but worth reopening because…_

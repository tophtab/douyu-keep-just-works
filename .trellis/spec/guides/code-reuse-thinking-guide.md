# Code Reuse Thinking Guide

> Search first, then decide whether reuse or a new abstraction is justified.

---

## Before Writing New Code

1. Search for existing names and domain terms:

```bash
rg "functionName|domainKeyword" src test
```

2. Ask:

| Question | If yes |
|---|---|
| Does a similar function/component exist? | Use or extend it |
| Is the same pattern already used elsewhere? | Follow the local pattern |
| Is the new code copied from another file? | Extract the shared part |
| Is a constant/config value repeated? | Keep one source of truth |

---

## When To Abstract

Abstract when:

- the same logic appears 3+ times,
- the logic is complex enough to hide bugs,
- multiple modules need the same behavior.

Do not abstract when:

- it is used once,
- it is a trivial one-liner,
- the abstraction would be harder to understand than the duplication.

---

## After Batch Modifications

- Search for missed instances.
- Check whether similar edits should share a helper, fixture, constant, or
  component.
- Keep architecture assertions visible in tests; extract setup mechanics, not
  the contract being tested.

---

## Gotcha: Asymmetric Mechanisms Producing Same Output

Problem: two mechanisms produce the same file set, but only one is auto-derived
from the directory structure. Example: recursive copy during init vs. manual
`files.set()` during update.

Risk: structural changes propagate through the automatic path while the manual
path silently drifts.

Checklist:

- [ ] Search for all code paths that reference the old structure.
- [ ] Update manual file lists when an automatic copy path also exists.
- [ ] Add a regression that compares outputs from both mechanisms.

---

## Checklist Before Commit

- [ ] Searched for existing similar code.
- [ ] No copy-pasted logic that should be shared.
- [ ] Constants and config defaults have one owner.
- [ ] Similar patterns follow the same structure.

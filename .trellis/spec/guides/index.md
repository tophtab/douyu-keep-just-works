# Thinking Guides

> Shared pre-edit prompts for mistakes that layer specs do not fully cover.

---

## Read Routing

| Trigger | Read |
|---|---|
| Feature touches 3+ layers, changes a data format, or has unclear ownership | [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md) |
| New helper/utility, repeated pattern, constant/config change, or similar code already exists | [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md) |

---

## Quick Checks

Before changing any value, search for all current owners:

```bash
rg "value_to_change" .
```

Before adding a helper or abstraction:

```bash
rg "similarName|domainKeyword" src test
```

Use these guides before coding, again when a change starts crossing boundaries,
and after bugs when a new reusable lesson should be captured.

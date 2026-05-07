# Design: Migration Gate in `bmc pull`

**Date:** 2026-05-07  
**Status:** Approved

## Summary

`bmc pull` (both full and single-CA variants) should check whether the workspace conforms to the current folder structure before proceeding. If not migrated, it prompts the user to run migration. If the user declines, pull aborts. If the user accepts, migration runs and pull continues automatically.

## Flow

```
bmc pull [caName]
  │
  ├─ getWorkspacePath(pwd)
  ├─ getBmc(wpPath) → { token, cas }
  │
  ├─ isAlreadyMigrated(cas)?
  │     YES → proceed to pull as today
  │     NO  →
  │           warn: "Workspace is not migrated to the new structure."
  │           prompt: "Do you want to migrate now? [y/N] "
  │           N → print "Pull aborted." → return
  │           Y → await migrate(pwd) → proceed to pull
  │
  └─ singlePull or completePull (existing logic, unchanged)
```

## Behaviour

- If user says **no**: pull aborts with a message. No files are changed.
- If user says **yes**: migration runs to completion, then pull proceeds normally (re-reading `.bmc` after migration).
- Applies to both `bmc pull` and `bmc pull <caName>`.

## Code Changes

**Only `pull.js` is modified.** Three additions:

1. **Imports:** `readline` (Node built-in) and `{ migrate, isAlreadyMigrated }` from `./migrate`.
2. **`confirm(question)`:** small inline async helper wrapping `readline.createInterface`. Resolves `true` if first input is `y`/`Y`, `false` otherwise.
3. **`checkMigration(wpPath, cas, pwd)`:** calls `isAlreadyMigrated(cas)`. If not migrated, warns and calls `confirm()`. Runs `migrate(pwd)` on yes. Returns `false` to abort on no.

Both `singlePull` and `completePull` call `checkMigration` immediately after `getBmc`, before any pull logic.

No changes to `migrate.js`, `index.js`, or any other file.

## Out of Scope

- Adding `readline` to other commands (can be extracted to `utils.js` when a second caller appears)
- Changing the `bmc migrate` standalone command

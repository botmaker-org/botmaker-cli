# Design: Remove Migration Workflow

**Date:** 2026-05-11  
**Status:** Approved  
**Branch:** feat/mcpAndTs

---

## Goal

Remove all migration machinery from the CLI. Replace the silent path-normalization shim in `bmcConfig.js` with an explicit incompatibility error so old-format workspaces fail loudly rather than being silently patched.

---

## Motivation

The `bmc migrate` command was introduced to move workspaces from an old CA path structure (`user/myca.js`) to the new structure (`src/user/myca.js`). With the CLI being simplified and legacy support dropped, this code is dead weight. Rather than keeping a silent shim that masks incompatible workspaces, the CLI should tell users clearly when their workspace cannot be used.

---

## What Gets Removed

### `src/migrate.js` — deleted entirely

The entire file goes: `isAlreadyMigrated`, `syncTemplateFiles`, `migrate`, and the `TEMPLATE_FILES` constant.

### `src/index.js` — three edits

1. Remove `const migrate = require('./migrate');` import
2. Remove the `['migrate']` command definition block
3. Remove the `case "migrate": await migrate(pwd); break;` switch branch

### `src/pull.js` — four edits

1. Remove `const migrate = require('./migrate');` import
2. Remove `const { isAlreadyMigrated } = migrate;` destructure
3. Delete the entire `checkMigration()` function (lines 31–42)
4. Replace both call sites with direct use of `rawCas`:
   - `singlePull`: `const cas = rawCas;` (remove `if (cas === null) return false;`)
   - `completePull`: `const cas = rawCas;` (remove `if (cas === null) return false;`)

---

## What Gets Replaced

### `src/bmcConfig.js` — replace `migrateCa()` with a compatibility check

**Before:** `migrateCa()` silently prepends `src/` to old-format paths and defaults `folder` to `''`.

**After:** `getBmc()` checks each CA after parsing. If any CA has a `filename` that does not start with `src/`, it throws:

```
Error: This workspace is incompatible with this version of botmaker-cli.
Please re-import your workspace with `bmc import <apiToken>`.
```

The `folder` default is also removed — callers must handle `null`/`undefined` folder values themselves (or they already do via existing guards).

---

## Compatibility Impact

Any workspace where `.bmc` still contains CAs with old-format paths (e.g., `user/myca.js` instead of `src/user/myca.js`) will now receive a clear error on any `bmc` command that loads the workspace. The error message tells the user exactly how to fix it: re-import.

---

## Success Criteria

- `bmc migrate` is no longer a valid command (yargs unknown-command error)
- `src/migrate.js` does not exist
- `pull.js` has no reference to `migrate` or `isAlreadyMigrated`
- `bmcConfig.js` has no `migrateCa` function
- Loading a `.bmc` with an old-format CA path throws the incompatibility error
- Loading a `.bmc` with all `src/`-prefixed paths works normally
- `bmc pull`, `bmc push`, `bmc run`, and other commands are unaffected for valid workspaces

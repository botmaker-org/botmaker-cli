# Design: Extract WEBCHAT_FORM and WHATSAPP_FLOW to feat/flow-and-form

**Date:** 2026-05-11  
**Status:** Approved  
**Branch:** feat/mcpAndTs → feat/flow-and-form (new)

---

## Goal

Move all WEBCHAT_FORM and WHATSAPP_FLOW functionality out of `feat/mcpAndTs` and into a dedicated branch `feat/flow-and-form`, where those CA types will be developed going forward. The source branch (`feat/mcpAndTs`) will have no trace of these types.

---

## Branch Strategy

1. Create `feat/flow-and-form` from the current tip of `feat/mcpAndTs` — no code changes needed on the new branch.
2. On `feat/mcpAndTs`, delete all flow/form files and strip all references from shared modules.

The two branches diverge cleanly from the same commit. `feat/flow-and-form` is immediately usable; `feat/mcpAndTs` is immediately clean.

---

## Files Deleted from `feat/mcpAndTs`

| File | Reason |
|------|--------|
| `src/caFlowFormRunner.js` | Entire file is dedicated to WHATSAPP_FLOW/WEBCHAT_FORM execution |
| `src/flowSnippets/flow_basic_template.ts` | Flow CA template |
| `src/formSnippets/form_basic_template.ts` | Form CA template |
| `workspaceTemplate/whatsappflow.d.ts` | TypeScript type definitions for BmFlow |
| `workspaceTemplate/webchatforms.d.ts` | TypeScript type definitions for BmForm |
| `workspaceTemplate/flowstate.json` | Runtime state file used exclusively by flow/form runner |

---

## Files Modified on `feat/mcpAndTs`

### `src/caTypes.js`
- Remove `WHATSAPP_FLOW` and `WEBCHAT_FORM` from the `CaType` enum
- Remove their branches from `getTypeFolder()`
- Remove `'whatsappflow'` and `'webchatforms'` from `TYPE_FOLDERS`

### `src/run.js`
- Remove `runFlowOrFormCa()` function
- Remove the `else if (type === CaType.WHATSAPP_FLOW || type === CaType.WEBCHAT_FORM)` routing branch
- Remove `caFlowFormRunner` import

### `src/newCa.js`
- Remove `baseWhatsappFlowCa` and `baseWebchatFormCa` file reads
- Remove `CaType.WHATSAPP_FLOW` and `CaType.WEBCHAT_FORM` entries from `templateByType`
- Remove `flowSnippets` / `formSnippets` imports/paths

### `src/index.js`
- Remove `-w` / `--whatsapp-flow` CLI option
- Remove `-f` / `--webchat-form` CLI option
- Remove the `w` and `f` branches from the `newType` conditional

---

## What Stays on `feat/flow-and-form`

All of the above — untouched. The new branch is a complete snapshot of `feat/mcpAndTs` at fork time, which already has full WEBCHAT_FORM/WHATSAPP_FLOW support.

---

## Non-Goals

- No changes to README (kept separately on each branch)
- No changes to other CA types (USER, ENDPOINT, AI_FUNCTION, SCHEDULE)
- No npm package extraction
- No re-merging infrastructure needed

---

## Success Criteria

- `feat/flow-and-form` exists and `bmc new myFlow -w` works correctly on it
- `feat/mcpAndTs` has zero references to `WEBCHAT_FORM`, `WHATSAPP_FLOW`, `caFlowFormRunner`, `flowSnippets`, `formSnippets`, `whatsappflow.d.ts`, `webchatforms.d.ts`, or `flowstate.json`
- No other CA types are broken on `feat/mcpAndTs`

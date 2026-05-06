# Flow Runner Improvements Design

**Date:** 2026-05-06  
**Branch:** feat/mcpAndTs  
**Scope:** `caFlowFormRunner.js`, `run.js`, `index.js`, `workspaceTemplate/flowstate.json`

---

## Summary

Four improvements to the WhatsApp Flow / Webchat Form local runner:

1. Rename `testdata.json` → `flowstate.json` and persist flow state after each run
2. Fix `chatReference` to use `context.userData._id_`
3. Replace live `botmakerAPI` HTTP calls with local file-backed implementations
4. Add `bmc reset` command to clear all local state files

---

## 1. `flowstate.json` — rename and post-run persistence

### Rename

`workspaceTemplate/testdata.json` → `workspaceTemplate/flowstate.json`.  
All references to `testdata.json` in `run.js` updated to `flowstate.json`.

### Initial shape (unchanged)

```json
{ "action": "INIT", "screen": "", "data": {} }
```

### Post-run update (`run.js` → `runFlowOrFormCa`)

After a successful execution:

- **Flow continues** (`result.nextScreen` is set):
  ```json
  { "action": "data_exchange", "screen": "<result.nextScreen>", "data": <result.data || {}> }
  ```
- **Flow finished** (no `nextScreen`):
  ```json
  { "action": "INIT", "screen": "", "data": {} }
  ```

On error: `flowstate.json` is not modified.

---

## 2. `chatReference`

In `caFlowFormRunner.js`, change:

```js
// before
const chatReference = (context && (context.chatPlatformId || context.chatReference || context.id)) || 'local-test';

// after
const chatReference = (context && context.userData && context.userData._id_) || 'local-test';
```

---

## 3. Local `botmakerAPI` implementation

### `chat.json`

- **Location:** `<wpPath>/chat.json`
- **Shape:** matches the real `GET /v2.0/chats/{chatReference}` API response (see example below)
- **Seeding:** if the file does not exist when `getChat()` is called, make one live `GET` call to `https://api.botmaker.com/v2.0/chats/{chatReference}` using the workspace token, save the response, return it
- **Subsequent calls:** read from file, no live call

```json
{
  "chat": { "chatId": "", "channelId": "", "contactId": "" },
  "firstName": "", "lastName": "", "email": "", "country": "",
  "variables": {}, "tags": [],
  "externalId": "", "queueId": "", "agentId": ""
}
```

### `catalog.json`

- **Location:** `<wpPath>/catalog.json`
- **Shape:** keyed by `catalogId` to support flows that call `getProducts` with more than one catalog:
  ```json
  { "<catalogId>": [ ...API product objects... ] }
  ```
- **Seeding:** if `catalog.json[catalogId]` is missing when `getProducts(catalogId, skus)` is called, fetch from `https://api.botmaker.com/v2.0/ecommerce/catalogs/{catalogId}/products`, save under that key, return filtered result
- **Subsequent calls:** read `catalog.json[catalogId]`, filter by `skus` on `retailerId` or `id`; return all entries for that catalog if `skus` is empty

### `botmakerAPI` method behaviours

| Method | Local behaviour |
|--------|----------------|
| `getChat()` | Seed `chat.json` from API on first call, then read local |
| `updateChat(update)` | Merge `update` into `chat.json` and write — **never calls API** |
| `getProducts(catalogId, skus)` | Seed `catalog.json` from API on first call, then read local |
| `ACCESS_TOKEN` assignment | Still accepted (no-op locally) |

---

## 4. `bmc reset` command

### What it clears (all three, no flags)

| File | Action |
|------|--------|
| `flowstate.json` | Reset to `{ "action": "INIT", "screen": "", "data": {} }` |
| `chat.json` | Deleted (re-fetched from live API on next `getChat()` call) |
| `catalog.json` | Deleted (re-fetched from live API on next `getProducts()` call) |

### CLI registration (`index.js`)

```
bmc reset
```

No options. Prints which files were reset/deleted. Missing files are silently skipped.

---

## Files changed

| File | Change |
|------|--------|
| `workspaceTemplate/testdata.json` | Renamed to `flowstate.json` |
| `src/run.js` | Update filename reference; add post-run `flowstate.json` write |
| `src/caFlowFormRunner.js` | Fix `chatReference`; replace `botmakerAPI` with local file implementation |
| `src/index.js` | Add `reset` command |
| `src/reset.js` | New file — reset logic |

# Flow Runner Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the local WhatsApp Flow / Webchat Form runner with persistent flow state, local-file-backed botmakerAPI, correct chatReference, and a reset command.

**Architecture:** All local file I/O (chat.json, catalog.json, flowstate.json) stays in `caFlowFormRunner.js` (which already has `wpPath`) and `run.js` (which owns post-run writes). A new `reset.js` module handles the reset command. No new dependencies required.

**Tech Stack:** Node.js, `fs` (sync methods for local file ops), `request-promise` (already imported), `chalk`, `yargs`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `workspaceTemplate/testdata.json` | Rename → `flowstate.json` | Initial flow state template |
| `src/run.js` | Modify | Rename path reference; write flowstate.json after each run |
| `src/caFlowFormRunner.js` | Modify | Fix chatReference; replace live botmakerAPI with local-file implementation |
| `src/reset.js` | Create | Reset logic for flowstate.json, chat.json, catalog.json |
| `src/index.js` | Modify | Register `bmc reset` command |
| `README.md` | Modify | Update all references and sections |

---

## Task 1: Rename testdata.json → flowstate.json

**Files:**
- Rename: `workspaceTemplate/testdata.json` → `workspaceTemplate/flowstate.json`
- Modify: `src/run.js:250-253`

- [ ] **Step 1: Rename the workspace template file**

```bash
git mv workspaceTemplate/testdata.json workspaceTemplate/flowstate.json
```

- [ ] **Step 2: Update the path reference in run.js**

In `src/run.js`, inside `runFlowOrFormCa` (around line 250), replace:

```js
  let testData = {};
  const testDataPath = path.join(wpPath, 'testdata.json');
  if (await exists(testDataPath)) {
    testData = JSON.parse(await readFile(testDataPath, 'utf8'));
  }
```

with:

```js
  let testData = {};
  const flowStatePath = path.join(wpPath, 'flowstate.json');
  if (await exists(flowStatePath)) {
    testData = JSON.parse(await readFile(flowStatePath, 'utf8'));
  }
```

- [ ] **Step 3: Verify manually**

```bash
node -e "
const path = require('path');
const fs = require('fs');
const p = path.join('workspaceTemplate', 'flowstate.json');
console.log(fs.existsSync(p) ? 'OK: flowstate.json exists' : 'FAIL: missing');
console.log(fs.existsSync('workspaceTemplate/testdata.json') ? 'FAIL: old file still exists' : 'OK: testdata.json gone');
"
```

Expected:
```
OK: flowstate.json exists
OK: testdata.json gone
```

- [ ] **Step 4: Commit**

```bash
git add workspaceTemplate/flowstate.json src/run.js
git commit -m "feat: rename testdata.json to flowstate.json"
```

---

## Task 2: Persist flow state in run.js after execution

**Files:**
- Modify: `src/run.js` — `runFlowOrFormCa` function (around line 266–282)

- [ ] **Step 1: Add flowstate write after successful execution**

In `src/run.js`, inside `runFlowOrFormCa`, replace the success block:

```js
  } else {
    console.log(chalk.green(` ✓ Success in ${endTime}ms`));
    if (result.nextScreen) {
      console.log(chalk.cyan(` → nextScreen: ${result.nextScreen}`));
    } else {
      console.log(chalk.cyan(' → flow finished (SUCCESS)'));
    }
    if (result.data && Object.keys(result.data).length > 0) {
      console.log(chalk.cyan(' → data:'), JSON.stringify(result.data, null, 2));
    }
  }
```

with:

```js
  } else {
    console.log(chalk.green(` ✓ Success in ${endTime}ms`));
    if (result.nextScreen) {
      console.log(chalk.cyan(` → nextScreen: ${result.nextScreen}`));
    } else {
      console.log(chalk.cyan(' → flow finished (SUCCESS)'));
    }
    if (result.data && Object.keys(result.data).length > 0) {
      console.log(chalk.cyan(' → data:'), JSON.stringify(result.data, null, 2));
    }
    const newFlowState = result.nextScreen
      ? { action: 'data_exchange', screen: result.nextScreen, data: result.data || {} }
      : { action: 'INIT', screen: '', data: {} };
    await writeFile(flowStatePath, JSON.stringify(newFlowState, null, 2), 'utf-8');
  }
```

- [ ] **Step 2: Verify manually**

Create a minimal test flow at `workspaceTemplate/src/whatsappflow/test_flow.js`:

```js
flow.nextScreen = 'SCREEN_TWO';
flow.data = { greeting: 'hello' };
flow.send();
```

Reset flowstate.json to its initial state:
```bash
echo '{"action":"INIT","screen":"","data":{}}' > workspaceTemplate/flowstate.json
```

Run (replace `<wpPath>` with an actual workspace that has `context.json` and `.bmc` config, or test via unit inspection):
After run, `flowstate.json` should contain:
```json
{ "action": "data_exchange", "screen": "SCREEN_TWO", "data": { "greeting": "hello" } }
```

- [ ] **Step 3: Commit**

```bash
git add src/run.js
git commit -m "feat: persist flow state to flowstate.json after each run"
```

---

## Task 3: Fix chatReference to use context.userData._id_

**Files:**
- Modify: `src/caFlowFormRunner.js:52`

- [ ] **Step 1: Update chatReference**

In `src/caFlowFormRunner.js`, replace:

```js
    const chatReference = (context && (context.chatPlatformId || context.chatReference || context.id)) || 'local-test';
```

with:

```js
    const chatReference = (context && context.userData && context.userData._id_) || 'local-test';
```

- [ ] **Step 2: Verify**

```bash
node -e "
const context = { userData: { _id_: 'WTIX4UOS5AYVHZJON3KM' } };
const chatReference = (context && context.userData && context.userData._id_) || 'local-test';
console.log(chatReference === 'WTIX4UOS5AYVHZJON3KM' ? 'OK' : 'FAIL');
const emptyCtx = {};
const fallback = (emptyCtx && emptyCtx.userData && emptyCtx.userData._id_) || 'local-test';
console.log(fallback === 'local-test' ? 'OK fallback' : 'FAIL fallback');
"
```

Expected:
```
OK
OK fallback
```

- [ ] **Step 3: Commit**

```bash
git add src/caFlowFormRunner.js
git commit -m "fix: chatReference uses context.userData._id_"
```

---

## Task 4: Replace live botmakerAPI with local file implementation

**Files:**
- Modify: `src/caFlowFormRunner.js:55-69` (the `botmakerAPI` object)

- [ ] **Step 1: Replace the botmakerAPI object**

In `src/caFlowFormRunner.js`, replace the entire `botmakerAPI` object:

```js
    // botmakerAPI — uses ACCESS_TOKEN if set by CA code, falls back to workspace token
    const botmakerAPI = {
      ACCESS_TOKEN: '',
      getChat: () => {
        const t = botmakerAPI.ACCESS_TOKEN || token;
        return rp({ uri: `https://api.botmaker.com/v2.0/chats/${chatReference}`, headers: { 'access-token': t }, json: true });
      },
      updateChat: (update) => {
        const t = botmakerAPI.ACCESS_TOKEN || token;
        return rp({ method: 'PUT', uri: `https://api.botmaker.com/v2.0/chats/${chatReference}`, headers: { 'access-token': t }, body: update, json: true });
      },
      getProducts: (catalogId, skus) => {
        const t = botmakerAPI.ACCESS_TOKEN || token;
        return rp({ uri: `https://api.botmaker.com/v2.0/ecommerce/catalogs/${catalogId}/products`, headers: { 'access-token': t }, qs: { skus: skus.join(',') }, json: true });
      },
    };
```

with:

```js
    // botmakerAPI — reads/writes local files; seeds from live API on first call
    const chatFilePath = path.join(wpPath, 'chat.json');
    const catalogFilePath = path.join(wpPath, 'catalog.json');

    const botmakerAPI = {
      ACCESS_TOKEN: '',
      getChat: async () => {
        if (fs.existsSync(chatFilePath)) {
          return JSON.parse(fs.readFileSync(chatFilePath, 'utf8'));
        }
        const t = botmakerAPI.ACCESS_TOKEN || token;
        const chat = await rp({ uri: `https://api.botmaker.com/v2.0/chats/${chatReference}`, headers: { 'access-token': t }, json: true });
        fs.writeFileSync(chatFilePath, JSON.stringify(chat, null, 2), 'utf8');
        return chat;
      },
      updateChat: async (update) => {
        let chat = {};
        if (fs.existsSync(chatFilePath)) {
          chat = JSON.parse(fs.readFileSync(chatFilePath, 'utf8'));
        }
        const merged = { ...chat, ...update };
        if (update.variables) merged.variables = { ...(chat.variables || {}), ...update.variables };
        fs.writeFileSync(chatFilePath, JSON.stringify(merged, null, 2), 'utf8');
      },
      getProducts: async (catalogId, skus) => {
        let catalog = {};
        if (fs.existsSync(catalogFilePath)) {
          catalog = JSON.parse(fs.readFileSync(catalogFilePath, 'utf8'));
        }
        if (!catalog[catalogId]) {
          const t = botmakerAPI.ACCESS_TOKEN || token;
          const result = await rp({ uri: `https://api.botmaker.com/v2.0/ecommerce/catalogs/${catalogId}/products`, headers: { 'access-token': t }, json: true });
          catalog[catalogId] = result;
          fs.writeFileSync(catalogFilePath, JSON.stringify(catalog, null, 2), 'utf8');
        }
        const products = catalog[catalogId] || [];
        if (!skus || skus.length === 0) return products;
        return products.filter(p => skus.includes(p.retailerId) || skus.includes(p.id));
      },
    };
```

- [ ] **Step 2: Verify the file parses cleanly**

```bash
node -e "require('./src/caFlowFormRunner')" && echo "OK: module loads without error"
```

Expected:
```
OK: module loads without error
```

- [ ] **Step 3: Verify updateChat merges variables correctly**

```bash
node -e "
const fs = require('fs');
const os = require('os');
const path = require('path');

// Simulate updateChat logic in isolation
const chatFilePath = path.join(os.tmpdir(), 'bmc-test-chat.json');
const existing = { firstName: 'Walter', variables: { a: '1', b: '2' }, tags: ['buyer'] };
fs.writeFileSync(chatFilePath, JSON.stringify(existing));

const update = { variables: { b: 'updated', c: 'new' }, tags: ['returningCustomer'] };
let chat = JSON.parse(fs.readFileSync(chatFilePath, 'utf8'));
const merged = { ...chat, ...update };
if (update.variables) merged.variables = { ...(chat.variables || {}), ...update.variables };
fs.writeFileSync(chatFilePath, JSON.stringify(merged, null, 2), 'utf8');

const result = JSON.parse(fs.readFileSync(chatFilePath, 'utf8'));
console.log(result.firstName === 'Walter' ? 'OK: firstName preserved' : 'FAIL');
console.log(result.variables.a === '1' ? 'OK: a preserved' : 'FAIL');
console.log(result.variables.b === 'updated' ? 'OK: b updated' : 'FAIL');
console.log(result.variables.c === 'new' ? 'OK: c added' : 'FAIL');
console.log(JSON.stringify(result.tags) === JSON.stringify(['returningCustomer']) ? 'OK: tags replaced' : 'FAIL');
fs.unlinkSync(chatFilePath);
"
```

Expected:
```
OK: firstName preserved
OK: a preserved
OK: b updated
OK: c added
OK: tags replaced
```

- [ ] **Step 4: Commit**

```bash
git add src/caFlowFormRunner.js
git commit -m "feat: botmakerAPI reads/writes local chat.json and catalog.json"
```

---

## Task 5: Create reset.js and register bmc reset command

**Files:**
- Create: `src/reset.js`
- Modify: `src/index.js`

- [ ] **Step 1: Create src/reset.js**

```js
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const getWorkspacePath = require('./getWorkspacePath');

const FLOW_STATE_DEFAULT = { action: 'INIT', screen: '', data: {} };

module.exports = async (pwd) => {
  const wpPath = await getWorkspacePath(pwd);

  const flowstatePath = path.join(wpPath, 'flowstate.json');
  const chatPath = path.join(wpPath, 'chat.json');
  const catalogPath = path.join(wpPath, 'catalog.json');

  fs.writeFileSync(flowstatePath, JSON.stringify(FLOW_STATE_DEFAULT, null, 2), 'utf8');
  console.log(chalk.green('✓ flowstate.json reset to INIT'));

  if (fs.existsSync(chatPath)) {
    fs.unlinkSync(chatPath);
    console.log(chalk.green('✓ chat.json deleted (will re-fetch from API on next run)'));
  } else {
    console.log(chalk.gray('  chat.json not found, skipping'));
  }

  if (fs.existsSync(catalogPath)) {
    fs.unlinkSync(catalogPath);
    console.log(chalk.green('✓ catalog.json deleted (will re-fetch from API on next run)'));
  } else {
    console.log(chalk.gray('  catalog.json not found, skipping'));
  }
};
```

- [ ] **Step 2: Register reset in index.js**

Add the require at the top of `src/index.js` alongside the other requires:

```js
const reset = require('./reset');
```

Add the command declaration inside the `yargs` chain, after the `rename` command and before `.demandCommand()`:

```js
    .command(
      ['reset'],
      'Reset local flow state (flowstate.json, chat.json, catalog.json)',
    )
```

Add the case in the switch statement, after the `rename` case and before `run`:

```js
    case "reset":
      await reset(pwd);
      break;
```

- [ ] **Step 3: Verify the command is registered**

```bash
node src/index.js --help 2>&1 | grep reset
```

Expected output includes:
```
  reset    Reset local flow state (flowstate.json, chat.json, catalog.json)
```

- [ ] **Step 4: Verify reset behaviour**

```bash
node -e "
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = os.tmpdir();
// Create dummy files
fs.writeFileSync(path.join(tmp, 'chat.json'), '{}');
fs.writeFileSync(path.join(tmp, 'catalog.json'), '{}');
fs.writeFileSync(path.join(tmp, 'flowstate.json'), JSON.stringify({action:'data_exchange',screen:'S1',data:{x:1}}));

// Simulate reset logic
const FLOW_STATE_DEFAULT = { action: 'INIT', screen: '', data: {} };
fs.writeFileSync(path.join(tmp, 'flowstate.json'), JSON.stringify(FLOW_STATE_DEFAULT, null, 2));
if (fs.existsSync(path.join(tmp, 'chat.json'))) fs.unlinkSync(path.join(tmp, 'chat.json'));
if (fs.existsSync(path.join(tmp, 'catalog.json'))) fs.unlinkSync(path.join(tmp, 'catalog.json'));

const fs2 = JSON.parse(fs.readFileSync(path.join(tmp, 'flowstate.json'), 'utf8'));
console.log(fs2.action === 'INIT' ? 'OK: flowstate reset' : 'FAIL');
console.log(!fs.existsSync(path.join(tmp, 'chat.json')) ? 'OK: chat.json deleted' : 'FAIL');
console.log(!fs.existsSync(path.join(tmp, 'catalog.json')) ? 'OK: catalog.json deleted' : 'FAIL');
"
```

Expected:
```
OK: flowstate reset
OK: chat.json deleted
OK: catalog.json deleted
```

- [ ] **Step 5: Commit**

```bash
git add src/reset.js src/index.js
git commit -m "feat: add bmc reset command to clear local flow state"
```

---

## Task 6: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add reset to the commands table**

In the commands table in `README.md`, add after the `rename` row:

```markdown
| `bmc reset` | | Reset local flow state files |
```

- [ ] **Step 2: Replace the flow runner section**

Replace everything from `## Running WhatsApp Flow and Webchat Form CAs locally` to the end of `README.md` with:

```markdown
## Running WhatsApp Flow and Webchat Form CAs locally

WHATSAPP_FLOW and WEBCHAT_FORM client actions are driven by a JSON payload that simulates what WhatsApp / Webchat sends to the endpoint. The runner reads from **`flowstate.json`** in your workspace root and automatically updates it after each run.

### flowstate.json

​```json
{
  "action": "INIT",
  "screen": "",
  "data": {}
}
​```

| Field | Type | Description |
|---|---|---|
| `action` | `"INIT"` \| `"data_exchange"` \| `"BACK"` | `INIT` — flow/form just opened. `data_exchange` — user submitted a screen. `BACK` — user navigated back (screen has `refresh_on_back: true`). |
| `screen` | `string` | Name of the screen the user is leaving. Required when `action` is `data_exchange` or `BACK`. Leave empty for `INIT`. |
| `data` | `object` | The payload sent by the flow/form JSON — usually the user's input for the current screen. |

### Running

​```bash
bmc run src/whatsappflow/my_flow.js
bmc run src/webchatforms/my_form.js
​```

The runner prints:
- `→ nextScreen: SCREEN_NAME` — the screen the CA wants to navigate to
- `→ flow finished (SUCCESS)` — no nextScreen set, flow/form ends
- `→ data: { ... }` — the data passed to the next screen (or back to Botmaker variables on the last screen)

After each successful run, `flowstate.json` is automatically updated so the next `bmc run` picks up where the flow left off. When the flow finishes (no `nextScreen`), it resets to `INIT` automatically.

### Testing multi-screen flows

Just keep running `bmc run` — `flowstate.json` tracks the current screen automatically. To test user input for a screen, edit the `data` field in `flowstate.json` before running.

WHATSAPP_FLOW and WEBCHAT_FORM CAs can call `saveScreenData()` to persist payload between screens and `loadPrevScreenData()` to retrieve it. Locally, this is stored in `.bmc-screendata.json` in your workspace root.

### Resetting local state

​```bash
bmc reset
​```

Resets `flowstate.json` to `INIT` and deletes `chat.json` and `catalog.json` so they are re-fetched from the live API on the next run.

### botmakerAPI in local runs

`botmakerAPI` uses local files instead of making live HTTP calls on every run:

| Method | Local behaviour |
|--------|----------------|
| `getChat()` | Reads from `chat.json`. If missing, fetches once from the live API and saves it. |
| `updateChat(update)` | Merges changes into `chat.json` locally — never calls the API. |
| `getProducts(catalogId, skus)` | Reads from `catalog.json` (keyed by `catalogId`). If the catalog is missing, fetches once from the live API and saves it. |

To force a fresh fetch from the API, run `bmc reset` or delete the relevant file manually.
```

- [ ] **Step 3: Verify README**

```bash
node -e "
const fs = require('fs');
const readme = fs.readFileSync('README.md', 'utf8');
console.log(readme.includes('flowstate.json') ? 'OK: flowstate.json present' : 'FAIL');
console.log(!readme.includes('testdata.json') ? 'OK: testdata.json removed' : 'FAIL: testdata.json still referenced');
console.log(readme.includes('bmc reset') ? 'OK: reset command documented' : 'FAIL');
console.log(readme.includes('chat.json') ? 'OK: chat.json documented' : 'FAIL');
console.log(readme.includes('catalog.json') ? 'OK: catalog.json documented' : 'FAIL');
"
```

Expected:
```
OK: flowstate.json present
OK: testdata.json removed
OK: reset command documented
OK: chat.json documented
OK: catalog.json documented
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README for flowstate.json, botmakerAPI local files, and bmc reset"
```

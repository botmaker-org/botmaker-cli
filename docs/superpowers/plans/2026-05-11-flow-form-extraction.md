# WEBCHAT_FORM / WHATSAPP_FLOW Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork `feat/flow-and-form` from `feat/mcpAndTs` to preserve all WEBCHAT_FORM/WHATSAPP_FLOW functionality, then remove every trace of those two CA types from `feat/mcpAndTs`.

**Architecture:** Create the new branch first (no code changes needed there), then perform a surgical removal on `feat/mcpAndTs` in four phases: imports/runner in `run.js`, type constants in `caTypes.js`, template loading in `newCa.js`, CLI flags in `index.js`, and finally delete the six files that are exclusively used by those two types.

**Tech Stack:** Node.js, git

---

## File Map

Files **deleted** from `feat/mcpAndTs`:
- `src/caFlowFormRunner.js`
- `src/flowSnippets/flow_basic_template.ts`
- `src/formSnippets/form_basic_template.ts`
- `workspaceTemplate/whatsappflow.d.ts`
- `workspaceTemplate/webchatforms.d.ts`
- `workspaceTemplate/flowstate.json`

Files **modified** on `feat/mcpAndTs`:
- `src/run.js` — remove `caFlowFormRunner` import and `runFlowOrFormCa` function + routing branch
- `src/caTypes.js` — remove `WHATSAPP_FLOW`, `WEBCHAT_FORM` from enum, `getTypeFolder`, `TYPE_FOLDERS`
- `src/newCa.js` — remove `baseWhatsappFlowCa`, `baseWebchatFormCa` reads and their `templateByType` entries
- `src/index.js` — remove `-w`/`-f` option declarations and their branches in the `new` command handler

---

### Task 1: Create feat/flow-and-form branch

**Files:** none (git only)

- [ ] **Step 1: Verify you are on feat/mcpAndTs**

```bash
git branch --show-current
```
Expected output: `feat/mcpAndTs`

- [ ] **Step 2: Create and push the new branch**

```bash
git checkout -b feat/flow-and-form
git push -u origin feat/flow-and-form
```
Expected: branch created and tracking remote.

- [ ] **Step 3: Switch back to feat/mcpAndTs**

```bash
git checkout feat/mcpAndTs
```
Expected output: `Switched to branch 'feat/mcpAndTs'`

---

### Task 2: Strip caFlowFormRunner from run.js

**Files:**
- Modify: `src/run.js:14` (import line)
- Modify: `src/run.js:244-286` (runFlowOrFormCa function)
- Modify: `src/run.js:299-301` (routing branch)

- [ ] **Step 1: Remove the caFlowFormRunner import (line 14)**

Replace:
```js
const caFlowFormRunner = require('./caFlowFormRunner');
```
With: *(delete the line entirely — nothing replaces it)*

- [ ] **Step 2: Remove the entire runFlowOrFormCa function (lines 244–286)**

Delete from:
```js
const runFlowOrFormCa = async (wpPath, token, cas, ca) => {
```
Through and including the closing:
```js
};
```
…and the blank line before it.

- [ ] **Step 3: Remove the routing branch in the run() function**

Replace:
```js
  } else if (type === CaType.WHATSAPP_FLOW || type === CaType.WEBCHAT_FORM) {
    await runFlowOrFormCa(wpPath, token, cas, ca);
  } else {
```
With:
```js
  } else {
```

- [ ] **Step 4: Smoke-test that the module still loads**

```bash
node -e "require('./src/run')"
```
Expected: no output, no error.

- [ ] **Step 5: Commit**

```bash
git add src/run.js
git commit -m "feat: remove WHATSAPP_FLOW/WEBCHAT_FORM runner from run.js"
```

---

### Task 3: Strip flow/form types from caTypes.js

**Files:**
- Modify: `src/caTypes.js:5-6` (enum entries)
- Modify: `src/caTypes.js:14-15` (getTypeFolder branches)
- Modify: `src/caTypes.js:20` (TYPE_FOLDERS array)

- [ ] **Step 1: Remove WHATSAPP_FLOW and WEBCHAT_FORM from the CaType enum**

Replace:
```js
const CaType = Object.freeze({
  USER: 'USER',
  ENDPOINT: 'ENDPOINT',
  AI_FUNCTION: 'AI_FUNCTION',
  WHATSAPP_FLOW: 'WHATSAPP_FLOW',
  WEBCHAT_FORM: 'WEBCHAT_FORM',
  SCHEDULE: 'SCHEDULE',
});
```
With:
```js
const CaType = Object.freeze({
  USER: 'USER',
  ENDPOINT: 'ENDPOINT',
  AI_FUNCTION: 'AI_FUNCTION',
  SCHEDULE: 'SCHEDULE',
});
```

- [ ] **Step 2: Remove their branches from getTypeFolder()**

Replace:
```js
const getTypeFolder = (type) => {
  if (type === CaType.ENDPOINT) return 'endpoint';
  if (type === CaType.AI_FUNCTION) return 'mcp';
  if (type === CaType.USER) return 'user';
  if (type === CaType.WHATSAPP_FLOW) return 'whatsappflow';
  if (type === CaType.WEBCHAT_FORM) return 'webchatforms';
  if (type === CaType.SCHEDULE) return 'schedule';
  return null;
};
```
With:
```js
const getTypeFolder = (type) => {
  if (type === CaType.ENDPOINT) return 'endpoint';
  if (type === CaType.AI_FUNCTION) return 'mcp';
  if (type === CaType.USER) return 'user';
  if (type === CaType.SCHEDULE) return 'schedule';
  return null;
};
```

- [ ] **Step 3: Remove whatsappflow and webchatforms from TYPE_FOLDERS**

Replace:
```js
const TYPE_FOLDERS = ['user', 'endpoint', 'mcp', 'whatsappflow', 'webchatforms', 'schedule'];
```
With:
```js
const TYPE_FOLDERS = ['user', 'endpoint', 'mcp', 'schedule'];
```

- [ ] **Step 4: Smoke-test the module**

```bash
node -e "const t = require('./src/caTypes'); console.log(Object.keys(t))"
```
Expected output includes `USER`, `ENDPOINT`, `AI_FUNCTION`, `SCHEDULE` — must NOT include `WHATSAPP_FLOW` or `WEBCHAT_FORM`.

- [ ] **Step 5: Commit**

```bash
git add src/caTypes.js
git commit -m "feat: remove WHATSAPP_FLOW/WEBCHAT_FORM from caTypes"
```

---

### Task 4: Strip flow/form template loading from newCa.js

**Files:**
- Modify: `src/newCa.js:80-88` (readFileSync calls)
- Modify: `src/newCa.js:139-140` (templateByType entries)

- [ ] **Step 1: Remove baseWhatsappFlowCa and baseWebchatFormCa reads (lines 80–88)**

Delete these two blocks entirely:
```js
const baseWhatsappFlowCa = fs.readFileSync(
  path.join(__dirname, 'flowSnippets', 'flow_basic_template.ts'),
  'utf8',
);

const baseWebchatFormCa = fs.readFileSync(
  path.join(__dirname, 'formSnippets', 'form_basic_template.ts'),
  'utf8',
);
```

- [ ] **Step 2: Remove their entries from templateByType**

Replace:
```js
  const templateByType = {
    [CaType.USER]: baseCa,
    [CaType.ENDPOINT]: baseEndPointCa,
    [CaType.AI_FUNCTION]: baseAiFunctionCa,
    [CaType.WHATSAPP_FLOW]: baseWhatsappFlowCa,
    [CaType.WEBCHAT_FORM]: baseWebchatFormCa,
    [CaType.SCHEDULE]: baseScheduleCa,
  };
```
With:
```js
  const templateByType = {
    [CaType.USER]: baseCa,
    [CaType.ENDPOINT]: baseEndPointCa,
    [CaType.AI_FUNCTION]: baseAiFunctionCa,
    [CaType.SCHEDULE]: baseScheduleCa,
  };
```

- [ ] **Step 3: Smoke-test the module loads**

```bash
node -e "require('./src/newCa')"
```
Expected: no output, no error. (It will fail at runtime without a workspace, but must not throw on `require`.)

- [ ] **Step 4: Commit**

```bash
git add src/newCa.js
git commit -m "feat: remove WHATSAPP_FLOW/WEBCHAT_FORM template loading from newCa"
```

---

### Task 5: Strip -w / -f CLI flags from index.js

**Files:**
- Modify: `src/index.js:79-84` (option declarations)
- Modify: `src/index.js:146-157` (new command handler)

- [ ] **Step 1: Remove the -w and -f option declarations**

Replace:
```js
        }).option('w', {
          alias: 'whatsapp-flow',
          describe: 'Create as WhatsApp flow type',
        }).option('f', {
          alias: 'webchat-form',
          describe: 'Create as Webchat form type',
        }).option('S', {
```
With:
```js
        }).option('S', {
```

- [ ] **Step 2: Remove w and f from the destructure and the newType conditional**

Replace:
```js
      const { caName: caName3, v: vsCode1, e, a, w, f, S } = arrgs;
      const typeFlagCount = [e, a, w, f, S].filter(Boolean).length;
      if (typeFlagCount > 1) {
        throw new Error('Only one type flag may be specified at a time (-e, -a, -w, -f, -S).');
      }
      const newType = e ? CaType.ENDPOINT
        : a ? CaType.AI_FUNCTION
        : w ? CaType.WHATSAPP_FLOW
        : f ? CaType.WEBCHAT_FORM
        : S ? CaType.SCHEDULE
        : CaType.USER;
```
With:
```js
      const { caName: caName3, v: vsCode1, e, a, S } = arrgs;
      const typeFlagCount = [e, a, S].filter(Boolean).length;
      if (typeFlagCount > 1) {
        throw new Error('Only one type flag may be specified at a time (-e, -a, -S).');
      }
      const newType = e ? CaType.ENDPOINT
        : a ? CaType.AI_FUNCTION
        : S ? CaType.SCHEDULE
        : CaType.USER;
```

- [ ] **Step 3: Smoke-test the CLI help output**

```bash
node bin/bmc.js new --help
```
Expected: no `-w` or `-f` options listed. `-e`, `-a`, `-S` still present.

- [ ] **Step 4: Commit**

```bash
git add src/index.js
git commit -m "feat: remove -w/-f CLI flags for WHATSAPP_FLOW/WEBCHAT_FORM"
```

---

### Task 6: Delete the six flow/form-exclusive files

**Files:** all deletions

- [ ] **Step 1: Delete the files**

```bash
git rm src/caFlowFormRunner.js
git rm src/flowSnippets/flow_basic_template.ts
git rm src/formSnippets/form_basic_template.ts
git rm workspaceTemplate/whatsappflow.d.ts
git rm workspaceTemplate/webchatforms.d.ts
git rm workspaceTemplate/flowstate.json
```

- [ ] **Step 2: Verify they are gone**

```bash
ls src/caFlowFormRunner.js src/flowSnippets src/formSnippets workspaceTemplate/whatsappflow.d.ts workspaceTemplate/webchatforms.d.ts workspaceTemplate/flowstate.json 2>&1
```
Expected: all paths report "No such file or directory".

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: delete caFlowFormRunner, flow/form snippets and workspace type files"
```

---

### Task 7: Verify zero references remain on feat/mcpAndTs

- [ ] **Step 1: Grep for any remaining WHATSAPP_FLOW or WEBCHAT_FORM references**

```bash
grep -r --include="*.js" --include="*.ts" --include="*.json" \
  -e "WHATSAPP_FLOW" -e "WEBCHAT_FORM" -e "caFlowFormRunner" \
  -e "flowSnippets" -e "formSnippets" \
  -e "whatsappflow\.d\.ts" -e "webchatforms\.d\.ts" \
  -e "flowstate" \
  . --exclude-dir=node_modules --exclude-dir=docs
```
Expected: **no output** (zero matches).

- [ ] **Step 2: Confirm the remaining CA types work end-to-end**

```bash
node bin/bmc.js --help
```
Expected: command list prints without error.

```bash
node -e "
  const CaType = require('./src/caTypes');
  console.assert(!CaType.WHATSAPP_FLOW, 'WHATSAPP_FLOW must be gone');
  console.assert(!CaType.WEBCHAT_FORM, 'WEBCHAT_FORM must be gone');
  console.assert(CaType.USER, 'USER must remain');
  console.assert(CaType.ENDPOINT, 'ENDPOINT must remain');
  console.assert(CaType.AI_FUNCTION, 'AI_FUNCTION must remain');
  console.assert(CaType.SCHEDULE, 'SCHEDULE must remain');
  console.log('All assertions passed');
"
```
Expected output: `All assertions passed`

---

### Task 8: Verify feat/flow-and-form is intact

- [ ] **Step 1: Switch to feat/flow-and-form**

```bash
git checkout feat/flow-and-form
```

- [ ] **Step 2: Confirm all flow/form files exist**

```bash
ls src/caFlowFormRunner.js \
   src/flowSnippets/flow_basic_template.ts \
   src/formSnippets/form_basic_template.ts \
   workspaceTemplate/whatsappflow.d.ts \
   workspaceTemplate/webchatforms.d.ts \
   workspaceTemplate/flowstate.json
```
Expected: all six paths print without error.

- [ ] **Step 3: Confirm WHATSAPP_FLOW and WEBCHAT_FORM are present in caTypes**

```bash
node -e "
  const CaType = require('./src/caTypes');
  console.assert(CaType.WHATSAPP_FLOW, 'WHATSAPP_FLOW must be present');
  console.assert(CaType.WEBCHAT_FORM, 'WEBCHAT_FORM must be present');
  console.log('All assertions passed');
"
```
Expected output: `All assertions passed`

- [ ] **Step 4: Switch back to feat/mcpAndTs when done**

```bash
git checkout feat/mcpAndTs
```

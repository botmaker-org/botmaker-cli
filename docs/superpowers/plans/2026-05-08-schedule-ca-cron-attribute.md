# Schedule CA Cron Attribute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `schedule` (cron) attribute to SCHEDULE type CAs — settable at creation via `bmc new <name> -S "0 * * * *"` and updatable on existing CAs via `bmc set-schedule <caName> <cronString>`.

**Architecture:** `cron-validator` validates cron strings locally in both creation and update paths. Creation extends `newCa.js` to accept and forward the `schedule` field. Update follows the `rename.js` pattern in a new `setSchedule.js` module. `index.js` wires both commands.

**Tech Stack:** Node.js, yargs, chalk, `cron-validator` (new)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `package.json` | Add `cron-validator` dependency |
| Modify | `src/newCa.js` | Accept `schedule` param, validate, include in payload |
| Modify | `src/index.js` | Add `-S`/`--schedule-ca` to `new`; register `set-schedule` command |
| Create | `src/setSchedule.js` | Update `schedule` on existing SCHEDULE CA |

---

## Task 1: Install `cron-validator`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install cron-validator
```

Expected output: `added 1 package` (or similar), no errors.

- [ ] **Step 2: Verify it works**

```bash
node -e "const { isValidCron } = require('cron-validator'); console.log(isValidCron('0 * * * *', { seconds: false })); console.log(isValidCron('bad', { seconds: false }));"
```

Expected output:
```
true
false
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add cron-validator dependency"
```

---

## Task 2: Extend `newCa.js` to support SCHEDULE type with cron

**Files:**
- Modify: `src/newCa.js`

- [ ] **Step 1: Add the SCHEDULE template and update `newCa`**

Open `src/newCa.js`. Make the following changes:

1. Add the import for `cron-validator` at the top, after the existing requires:

```js
const { isValidCron } = require('cron-validator');
```

2. Add a `baseScheduleCa` template constant after `baseWebchatFormCa`:

```js
const baseScheduleCa =
`const main = async () => {
  // TODO your scheduled code here
};

main()
  .catch(err => {
    bmconsole.error(\`[ERROR]: \${err.message}\`);
  })
  .finally(() => {
    result.done();
  });
`;
```

3. Update the `templateByType` map inside `newCa` to include `SCHEDULE`:

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

4. Change the `newCa` function signature to accept `schedule`:

```js
const newCa = async (pwd, caName, type, openVsCode = false, schedule = null) => {
```

5. Add cron validation right after the function opens, before `templateByType`:

```js
if (schedule != null) {
  if (!isValidCron(schedule, { seconds: false })) {
    throw new Error(`Invalid cron expression: "${schedule}". Expected a valid 5-field cron string (e.g. "0 * * * *").`);
  }
}
```

6. Update the `newCa` object to include `schedule` when present:

```js
const newCaObj = {
  publishedCode: templateByType[type] ?? baseCa,
  name: caName,
  type: type,
  ...(schedule != null && { schedule }),
};
```

Replace the existing `const newCa = { ... }` block with the above (note: rename the local variable to `newCaObj` to avoid shadowing the outer `newCa` function, then update the reference on the next line):

```js
const resp = await createCa(token, newCaObj);
const ca = JSON.parse(resp.body);
const status = await createFileAndStatus(wpPath, ca, type, openVsCode);
```

- [ ] **Step 2: Verify the file parses without errors**

```bash
node -e "require('./src/newCa')"
```

Expected: no output, no error.

- [ ] **Step 3: Commit**

```bash
git add src/newCa.js
git commit -m "feat: support schedule attribute on SCHEDULE CA creation"
```

---

## Task 3: Create `src/setSchedule.js`

**Files:**
- Create: `src/setSchedule.js`

- [ ] **Step 1: Create the file**

```js
const chalk = require('chalk');
const { isValidCron } = require('cron-validator');
const { getBmc, saveBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const { updateCas } = require('./bmService');
const { getCaByNameOrPath } = require('./getStatus');
const CaType = require('./caTypes');

const setSchedule = async (pwd, caName, cronString) => {
  if (!isValidCron(cronString, { seconds: false })) {
    throw new Error(`Invalid cron expression: "${cronString}". Expected a valid 5-field cron string (e.g. "0 * * * *").`);
  }

  const wpPath = await getWorkspacePath(pwd);
  const { token, cas } = await getBmc(wpPath);
  const codeAction = await getCaByNameOrPath(wpPath, cas, caName);

  if (!codeAction || !codeAction.id) {
    throw new Error('The client action was not uploaded.');
  }

  if (codeAction.type !== CaType.SCHEDULE) {
    throw new Error(`'${caName}' is not a SCHEDULE type client action.`);
  }

  await updateCas(token, [{ id: codeAction.id, schedule: cronString }]);

  const newCas = cas.map(ca =>
    ca.id === codeAction.id ? { ...ca, schedule: cronString } : ca
  );
  await saveBmc(wpPath, token, newCas);

  console.log(chalk.green(`Changed schedule for '${caName}' to: ${cronString}`));
};

module.exports = setSchedule;
```

- [ ] **Step 2: Verify the file parses without errors**

```bash
node -e "require('./src/setSchedule')"
```

Expected: no output, no error.

- [ ] **Step 3: Commit**

```bash
git add src/setSchedule.js
git commit -m "feat: add setSchedule command module"
```

---

## Task 4: Wire everything in `src/index.js`

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Add the require for `setSchedule` at the top**

After the existing requires (around line 16), add:

```js
const setSchedule = require('./setSchedule');
```

- [ ] **Step 2: Add `-S`/`--schedule-ca` option to the `new` command**

Find the `new` command definition (around line 66). Add the new option inside its `yargs` builder, after the existing options:

```js
.option('S', {
  alias: 'schedule-ca',
  describe: '<cronExpression> Create as Schedule type with cron expression',
  nargs: 1,
})
```

- [ ] **Step 3: Update the `new` command handler in the switch to detect `-S`**

Find the `case "new":` block (around line 136). Replace it with:

```js
case "new":
case "n":
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
  await newCa(pwd, caName3, newType, vsCode1, S || null);
  break;
```

- [ ] **Step 4: Add `set-schedule` command definition**

After the `rename` command definition (around line 97), add:

```js
.command(
  ['set-schedule <caName> <cronString>'],
  'Set the cron schedule on a SCHEDULE type client action'
)
```

- [ ] **Step 5: Add `set-schedule` case in the switch**

After the `case "rename":` block, add:

```js
case "set-schedule":
  const { caName: caName7, cronString } = arrgs;
  await setSchedule(pwd, caName7, cronString);
  break;
```

- [ ] **Step 6: Verify the file parses without errors**

```bash
node -e "require('./src/index')"
```

Expected: no output, no error.

- [ ] **Step 7: Verify CLI help shows new options**

```bash
node bin/bmc.js --help
node bin/bmc.js new --help
```

Expected: `set-schedule` appears in command list; `--schedule-ca` appears in `new` options.

- [ ] **Step 8: Commit**

```bash
git add src/index.js
git commit -m "feat: wire --schedule-ca flag and set-schedule command in CLI"
```

---

## Task 5: Manual smoke test

No automated test suite exists. Verify these scenarios manually against a real workspace.

**Files:** none

- [ ] **Step 1: Invalid cron on creation is rejected**

```bash
bmc new testSched -S "not-a-cron"
```

Expected error: `Invalid cron expression: "not-a-cron". Expected a valid 5-field cron string (e.g. "0 * * * *").`

- [ ] **Step 2: Combining type flags is rejected**

```bash
bmc new testSched -S "0 * * * *" -e
```

Expected error: `Only one type flag may be specified at a time (-e, -a, -w, -f, -S).`

- [ ] **Step 3: Valid creation succeeds**

```bash
bmc new testSched -S "0 9 * * 1"
```

Expected: file created at `src/schedule/testSched.js`, CA visible in workspace.

- [ ] **Step 4: Invalid cron on set-schedule is rejected**

```bash
bmc set-schedule testSched "bad-cron"
```

Expected error: `Invalid cron expression: "bad-cron". Expected a valid 5-field cron string (e.g. "0 * * * *").`

- [ ] **Step 5: set-schedule on non-SCHEDULE CA is rejected**

```bash
bmc set-schedule <someUserCa> "0 * * * *"
```

Expected error: `'<someUserCa>' is not a SCHEDULE type client action.`

- [ ] **Step 6: Valid set-schedule succeeds**

```bash
bmc set-schedule testSched "30 8 * * *"
```

Expected: `Changed schedule for 'testSched' to: 30 8 * * *`

- [ ] **Step 7: Commit smoke test sign-off**

```bash
git commit --allow-empty -m "chore: smoke tested schedule CA cron attribute feature"
```

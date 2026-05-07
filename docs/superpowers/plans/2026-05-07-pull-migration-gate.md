# Pull Migration Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before executing any pull, `bmc pull` checks whether the workspace is on the new folder structure and, if not, asks the user if they want to migrate — aborting if they say no, or running migration and continuing if they say yes.

**Architecture:** `isAlreadyMigrated` is exported from `migrate.js` and imported into `pull.js`. A `confirm()` helper using Node's built-in `readline` prompts the user. A `checkMigration(wpPath, cas, pwd)` guard calls both and is invoked at the top of `singlePull` and `completePull` before any pull logic runs.

**Tech Stack:** Node.js (readline built-in), chalk, existing migrate module

---

### Task 1: Export `isAlreadyMigrated` from `migrate.js`

**Files:**
- Modify: `src/migrate.js:102`

`isAlreadyMigrated` is currently a private function inside `migrate.js`. It needs to be exported so `pull.js` can import it without duplicating the logic.

- [ ] **Step 1: Change the export in `src/migrate.js`**

Replace the last line of `src/migrate.js`:

```js
// Before
module.exports = migrate;

// After
module.exports = migrate;
module.exports.isAlreadyMigrated = isAlreadyMigrated;
```

- [ ] **Step 2: Verify the export is accessible**

Run:
```bash
node -e "const m = require('./src/migrate'); console.log(typeof m.isAlreadyMigrated);"
```
Expected output: `function`

- [ ] **Step 3: Verify `bmc migrate` still works**

Run:
```bash
node -e "const m = require('./src/migrate'); console.log(typeof m);"
```
Expected output: `function`

(The default export must remain the `migrate` function so the `case "migrate":` in `index.js` keeps working.)

- [ ] **Step 4: Commit**

```bash
git add src/migrate.js
git commit -m "feat: export isAlreadyMigrated from migrate module"
```

---

### Task 2: Add migration gate to `pull.js`

**Files:**
- Modify: `src/pull.js`

Add three things to `pull.js`: (1) new imports, (2) a `confirm()` helper, (3) a `checkMigration()` guard. Then call the guard in both `singlePull` and `completePull`.

- [ ] **Step 1: Add imports at the top of `src/pull.js`**

After the existing `require` block (after line 18, the `const exists = ...` line), add:

```js
const readline = require('readline');
const migrate = require('./migrate');
const { isAlreadyMigrated } = migrate;
```

- [ ] **Step 2: Add the `confirm()` helper**

Add this function after the imports, before `targetDirForNew`:

```js
const confirm = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim().toLowerCase() === 'y');
  });
});
```

- [ ] **Step 3: Add the `checkMigration()` guard**

Add this function immediately after `confirm`:

```js
const checkMigration = async (wpPath, cas, pwd) => {
  if (isAlreadyMigrated(cas)) return true;
  console.log(chalk.yellow('Workspace is not migrated to the new structure.'));
  const ok = await confirm('Do you want to migrate now? [y/N] ');
  if (!ok) {
    console.log('Pull aborted.');
    return false;
  }
  await migrate(pwd);
  return true;
};
```

- [ ] **Step 4: Call `checkMigration` inside `singlePull`**

`singlePull` currently starts at line 167. After `getBmc` returns `{ token, cas }`, add the guard:

```js
const singlePull = async (pwd, caName) => {
  const wpPath = await getWorkspacePath(pwd)
  const { token, cas } = await getBmc(wpPath);
  if (!await checkMigration(wpPath, cas, pwd)) return false;  // <-- add this line
  const { changes, status } = await getStatus.getSingleStatusChanges(pwd, caName);
  // ... rest unchanged
```

- [ ] **Step 5: Call `checkMigration` inside `completePull`**

`completePull` currently starts at line 180. After `getBmc` returns `{ token, cas }`, add the guard:

```js
const completePull = async (pwd) => {
  const wpPath = await getWorkspacePath(pwd)
  const { token, cas } = await getBmc(wpPath);
  if (!await checkMigration(wpPath, cas, pwd)) return false;  // <-- add this line
  const changesGenerator = getStatus.getStatusChanges(pwd);
  // ... rest unchanged
```

- [ ] **Step 6: Manual test — already-migrated workspace (happy path)**

In a workspace whose `.bmc` CAs all have filenames starting with `src/user/`, `src/endpoint/`, etc.:

```bash
bmc pull
```

Expected: pull runs normally, no migration prompt appears.

- [ ] **Step 7: Manual test — un-migrated workspace, user says no**

In a workspace whose `.bmc` has CAs with old-style filenames (e.g. `user/myScript.js` without the `src/` prefix):

```bash
bmc pull
```

Expected output:
```
Workspace is not migrated to the new structure.
Do you want to migrate now? [y/N] n
Pull aborted.
```
No files should be changed.

- [ ] **Step 8: Manual test — un-migrated workspace, user says yes**

Same workspace as step 7:

```bash
bmc pull
```

Type `y` at the prompt.

Expected: migration output appears (file moves, template additions), then pull continues and shows pull output.

- [ ] **Step 9: Manual test — `bmc pull <caName>` also triggers the gate**

Same un-migrated workspace:

```bash
bmc pull someCaName
```

Expected: same migration prompt appears before pull logic runs.

- [ ] **Step 10: Commit**

```bash
git add src/pull.js
git commit -m "feat: check workspace migration before pull, prompt to migrate if needed"
```

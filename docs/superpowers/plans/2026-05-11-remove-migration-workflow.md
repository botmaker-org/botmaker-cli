# Remove Migration Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all migration machinery from the CLI and replace the silent path-normalization shim in `bmcConfig.js` with an explicit incompatibility error.

**Architecture:** Four sequential tasks — replace the shim in `bmcConfig.js` first (core behavioral change), then strip `pull.js`, then strip `index.js`, then delete `migrate.js`. Verification last.

**Tech Stack:** Node.js

---

## File Map

| File | Change |
|------|--------|
| `src/migrate.js` | **Delete** |
| `src/bmcConfig.js` | Remove `TYPE_FOLDERS` import + `migrateCa()`, add compatibility check in `getBmc()` |
| `src/pull.js` | Remove `readline` import, `migrate` imports, `confirm()`, `checkMigration()`, and two call sites |
| `src/index.js` | Remove `migrate` import, `['migrate']` command definition, `case "migrate"` switch branch |

---

### Task 1: Replace migrateCa() with compatibility check in bmcConfig.js

**Files:**
- Modify: `src/bmcConfig.js`

Current full file content for reference:
```js
const path = require('path');
const util = require('util');
const fs = require('fs');

const { TYPE_FOLDERS } = require('./caTypes');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const migrateCa = (ca) => {
  const out = { ...ca };
  if (out.filename) {
    const parts = out.filename.split('/').filter(Boolean);
    if (parts[0] !== 'src' && TYPE_FOLDERS.includes(parts[0])) {
      out.filename = `src/${out.filename}`;
    }
  }
  if (out.folder == null) {
    out.folder = '';
  }
  return out;
};

exports.getBmc = async (wpPath) => {
  const bmc = await readFile(path.join(wpPath, '.bmc'), 'UTF-8');
  const parsed = JSON.parse(bmc);
  parsed.cas = Array.isArray(parsed.cas) ? parsed.cas.map(migrateCa) : [];
  return parsed;
}

exports.saveBmc = async (wpPath, token, cas) => {
  await writeFile(path.join(wpPath, '.bmc'), JSON.stringify({ token, cas }), 'UTF-8');
}
```

- [ ] **Step 1: Overwrite bmcConfig.js with the new version**

Write the file with this exact content:

```js
const path = require('path');
const util = require('util');
const fs = require('fs');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

exports.getBmc = async (wpPath) => {
  const bmc = await readFile(path.join(wpPath, '.bmc'), 'UTF-8');
  const parsed = JSON.parse(bmc);
  const cas = Array.isArray(parsed.cas) ? parsed.cas : [];
  const incompatible = cas.find(ca => ca.filename && !ca.filename.startsWith('src/'));
  if (incompatible) {
    throw new Error(
      'This workspace is incompatible with this version of botmaker-cli.\n' +
      'Please re-import your workspace with `bmc import <apiToken>`.'
    );
  }
  parsed.cas = cas;
  return parsed;
};

exports.saveBmc = async (wpPath, token, cas) => {
  await writeFile(path.join(wpPath, '.bmc'), JSON.stringify({ token, cas }), 'UTF-8');
};
```

- [ ] **Step 2: Smoke-test the module loads**

```bash
node -e "require('./src/bmcConfig')"
```
Expected: no output, no error.

- [ ] **Step 3: Verify compatibility check throws on old-format path**

```bash
node -e "
const os = require('os');
const path = require('path');
const fs = require('fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bmc-test-'));
fs.writeFileSync(path.join(tmp, '.bmc'), JSON.stringify({
  token: 'tok',
  cas: [{ name: 'test', filename: 'user/myca.js' }]
}));
require('./src/bmcConfig').getBmc(tmp)
  .then(() => { console.error('FAIL: should have thrown'); process.exit(1); })
  .catch(e => {
    if (e.message.includes('incompatible')) {
      console.log('PASS: threw incompatibility error');
    } else {
      console.error('FAIL: wrong error:', e.message);
      process.exit(1);
    }
  });
"
```
Expected output: `PASS: threw incompatibility error`

- [ ] **Step 4: Verify valid workspace loads without error**

```bash
node -e "
const os = require('os');
const path = require('path');
const fs = require('fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bmc-test-'));
fs.writeFileSync(path.join(tmp, '.bmc'), JSON.stringify({
  token: 'tok',
  cas: [{ name: 'test', filename: 'src/user/myca.js', folder: '' }]
}));
require('./src/bmcConfig').getBmc(tmp)
  .then(r => console.log('PASS: loaded', r.cas.length, 'CA(s)'))
  .catch(e => { console.error('FAIL:', e.message); process.exit(1); });
"
```
Expected output: `PASS: loaded 1 CA(s)`

- [ ] **Step 5: Commit**

```bash
git add src/bmcConfig.js
git commit -m "feat: replace migrateCa shim with incompatibility error in bmcConfig"
```

---

### Task 2: Strip migration gate from pull.js

**Files:**
- Modify: `src/pull.js:14-16` (readline + migrate imports)
- Modify: `src/pull.js:23-42` (confirm function + checkMigration function)
- Modify: `src/pull.js:194-195` (singlePull call site)
- Modify: `src/pull.js:209-210` (completePull call site)

- [ ] **Step 1: Remove the readline import (line 14)**

Delete:
```js
const readline = require('readline');
```

- [ ] **Step 2: Remove the migrate imports (lines 15-16)**

Delete:
```js
const migrate = require('./migrate');
const { isAlreadyMigrated } = migrate;
```

- [ ] **Step 3: Remove the confirm() function (lines 23-29)**

Delete:
```js
const confirm = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim().toLowerCase() === 'y');
  });
});
```

- [ ] **Step 4: Remove the checkMigration() function (lines 31-42)**

Delete:
```js
const checkMigration = async (cas, pwd, wpPath) => {
  if (isAlreadyMigrated(cas)) return cas;
  console.log(chalk.yellow('Workspace is not migrated to the new structure.'));
  const ok = await confirm('Do you want to migrate now? [y/N] ');
  if (!ok) {
    console.log('Pull aborted.');
    return null;
  }
  await migrate(pwd);
  const { cas: freshCas } = await getBmc(wpPath);
  return freshCas;
};
```

- [ ] **Step 5: Fix the singlePull call site**

Replace:
```js
  const cas = await checkMigration(rawCas, pwd, wpPath);
  if (cas === null) return false;
```
With:
```js
  const cas = rawCas;
```

- [ ] **Step 6: Fix the completePull call site**

Replace:
```js
  const cas = await checkMigration(rawCas, pwd, wpPath);
  if (cas === null) return false;
```
With:
```js
  const cas = rawCas;
```

- [ ] **Step 7: Smoke-test the module loads**

```bash
node -e "require('./src/pull')"
```
Expected: no output, no error.

- [ ] **Step 8: Commit**

```bash
git add src/pull.js
git commit -m "feat: remove migration gate from pull.js"
```

---

### Task 3: Remove migrate command from index.js

**Files:**
- Modify: `src/index.js:15` (migrate import)
- Modify: `src/index.js:107-110` (command definition)
- Modify: `src/index.js:174-176` (switch case)

- [ ] **Step 1: Remove the migrate import (line 15)**

Delete:
```js
const migrate = require('./migrate');
```

- [ ] **Step 2: Remove the ['migrate'] command definition**

Delete:
```js
    .command(
      ['migrate'],
      'Migrate workspace from a previous version to the current structure',
    )
```

- [ ] **Step 3: Remove the case "migrate" switch branch**

Delete:
```js
    case "migrate":
      await migrate(pwd);
      break;
```

- [ ] **Step 4: Smoke-test the CLI help**

```bash
node bin/bmc.js --help
```
Expected: command list prints without error. `migrate` must NOT appear in the output.

- [ ] **Step 5: Commit**

```bash
git add src/index.js
git commit -m "feat: remove bmc migrate command from CLI"
```

---

### Task 4: Delete src/migrate.js

**Files:**
- Delete: `src/migrate.js`

- [ ] **Step 1: Delete the file**

```bash
git rm src/migrate.js
```

- [ ] **Step 2: Verify it is gone**

```bash
ls src/migrate.js 2>&1
```
Expected: `ls: cannot access 'src/migrate.js': No such file or directory`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: delete src/migrate.js"
```

---

### Task 5: Verify zero references remain

- [ ] **Step 1: Grep for any remaining migrate references in source**

```bash
grep -r --include="*.js" \
  -e "migrate" -e "isAlreadyMigrated" -e "checkMigration" -e "migrateCa" \
  src/ --exclude-dir=node_modules
```
Expected: **no output** (zero matches).

- [ ] **Step 2: Confirm all modules load cleanly**

```bash
node -e "require('./src/bmcConfig'); require('./src/pull'); require('./src/index')"
```
Expected: no output, no error.

- [ ] **Step 3: Confirm bmc help is clean**

```bash
node bin/bmc.js --help
```
Expected: command list prints, no `migrate` entry, no errors.

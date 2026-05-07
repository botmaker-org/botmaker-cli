# bmc migrate Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `bmc migrate` command that upgrades an old flat-workspace to the current type-segregated structure, fetching CA types from the remote API.

**Architecture:** A new `src/migrate.js` module follows the existing command pattern (`getWorkspacePath` → `getBmc` → work → `saveBmc`). It fetches remote CAs to resolve types, moves files on disk into type subfolders, updates `.bmc`, and copies any missing workspace template files. `src/index.js` wires it up as a yargs command.

**Tech Stack:** Node.js, `fs-extra`, `chalk`, existing `bmcConfig` / `bmService` / `caTypes` / `getWorkspacePath` modules.

> **Note:** No test framework exists in this project. Manual verification steps are provided instead.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/migrate.js` | Full migration logic |
| Modify | `src/index.js` | Register `migrate` command in yargs + switch |

---

### Task 1: Create `src/migrate.js`

**Files:**
- Create: `src/migrate.js`

- [ ] **Step 1: Create the file**

Create `/home/walter/projects/botmaker-cli/src/migrate.js` with this content:

```javascript
const path = require('path');
const util = require('util');
const fs = require('fs');
const fse = require('fs-extra');
const chalk = require('chalk');

const { getBmc, saveBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const { getAllCas } = require('./bmService');
const { buildLocalRelPath, TYPE_FOLDERS } = require('./caTypes');

const rename = util.promisify(fs.rename);
const exists = util.promisify(fs.exists);

const TEMPLATE_FILES = [
  'endpoint.d.ts',
  'mcp.d.ts',
  'whatsappflow.d.ts',
  'webchatforms.d.ts',
  'src/user/jsconfig.json',
  'src/endpoint/jsconfig.json',
  'src/mcp/tsconfig.json',
  'src/webchatforms/jsconfig.json',
  'src/whatsappflow/jsconfig.json',
];

const isAlreadyMigrated = (cas) => {
  if (!cas.length) return true;
  return cas.every(ca =>
    ca.filename && TYPE_FOLDERS.some(f => ca.filename.startsWith(`src/${f}/`))
  );
};

const syncTemplateFiles = async (wpPath) => {
  const templatePath = path.join(__dirname, '..', 'workspaceTemplate');
  for (const relFile of TEMPLATE_FILES) {
    const dest = path.join(wpPath, relFile);
    if (!(await exists(dest))) {
      await fse.ensureDir(path.dirname(dest));
      await fse.copy(path.join(templatePath, relFile), dest);
      console.log(chalk.green(`  added ${relFile}`));
    }
  }
  const flowstateDest = path.join(wpPath, 'flowstate.json');
  const testdataSrc = path.join(wpPath, 'testdata.json');
  if (!(await exists(flowstateDest))) {
    if (await exists(testdataSrc)) {
      await rename(testdataSrc, flowstateDest);
      console.log(chalk.yellow(`  renamed testdata.json → flowstate.json`));
    } else {
      await fse.copy(path.join(templatePath, 'flowstate.json'), flowstateDest);
      console.log(chalk.green(`  added flowstate.json`));
    }
  }
};

const migrate = async (pwd) => {
  const wpPath = await getWorkspacePath(pwd);
  const { token, cas } = await getBmc(wpPath);

  if (isAlreadyMigrated(cas)) {
    console.log(chalk.green('Already up to date. :)'));
    return;
  }

  console.log('Fetching remote client actions...');
  const remoteCasRes = await getAllCas(token);
  const remoteCas = JSON.parse(remoteCasRes.body);

  const newCas = [];
  for (const ca of cas) {
    const remote = remoteCas.find(r => r.id === ca.id);
    if (!remote) {
      console.log(chalk.yellow(`  WARNING: no remote match for '${ca.name || ca.filename}', leaving unchanged`));
      newCas.push(ca);
      continue;
    }

    const type = remote.type;
    const folder = remote.folder || '';
    const basename = path.basename(ca.filename || '');
    const newFilename = buildLocalRelPath(type, folder, basename);

    if (ca.filename && ca.filename !== newFilename) {
      const oldAbs = path.join(wpPath, ca.filename);
      const newAbs = path.join(wpPath, newFilename);
      if (await exists(oldAbs)) {
        await fse.ensureDir(path.dirname(newAbs));
        await rename(oldAbs, newAbs);
        console.log(chalk.green(`  ${ca.filename} → ${newFilename}`));
      }
    }

    newCas.push({ ...ca, type, folder, filename: newFilename });
  }

  await saveBmc(wpPath, token, newCas);
  console.log(chalk.green('  updated .bmc'));

  console.log('Syncing template files...');
  await syncTemplateFiles(wpPath);

  console.log(chalk.green('Migration complete!'));
};

module.exports = migrate;
```

- [ ] **Step 2: Commit**

```bash
git add src/migrate.js
git commit -m "feat: add migrate command module"
```

---

### Task 2: Wire `migrate` into `src/index.js`

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Add the require at the top of `src/index.js`**

After the last existing require (`const CaType = require('./caTypes');` on line 14), add:

```javascript
const migrate = require('./migrate');
```

- [ ] **Step 2: Add the yargs command**

After the `reset` command block (the `.command(['reset'], ...)` block ending around line 102), add:

```javascript
    .command(
      ['migrate'],
      'Migrate workspace from a previous version to the current structure',
    )
```

- [ ] **Step 3: Add the switch case**

In the `switch` block, after `case "reset":` (around line 156), add:

```javascript
    case "migrate":
      await migrate(pwd);
      break;
```

- [ ] **Step 4: Verify the wiring manually**

Run from a terminal inside the project:

```bash
node bin/bmc.js --help
```

Expected output includes:
```
migrate  Migrate workspace from a previous version to the current structure
```

- [ ] **Step 5: Commit**

```bash
git add src/index.js
git commit -m "feat: wire migrate command into CLI"
```

---

### Task 3: Manual smoke test

- [ ] **Step 1: Simulate an old workspace**

In a temp directory, create a minimal old-style workspace:

```bash
mkdir /tmp/test-ws && cd /tmp/test-ws
mkdir src
echo '{}' > src/my_action.js
echo '{"token":"<real-token>","cas":[{"id":"<real-ca-id>","name":"my action","filename":"src/my_action.js","publishedCode":"{}"}]}' > .bmc
```

Replace `<real-token>` and `<real-ca-id>` with values from a real `.bmc` file.

- [ ] **Step 2: Run migrate**

```bash
cd /tmp/test-ws
node /home/walter/projects/botmaker-cli/bin/bmc.js migrate
```

Expected output:
```
Fetching remote client actions...
  src/my_action.js → src/user/my_action.js   (or appropriate type folder)
  updated .bmc
Syncing template files...
  added endpoint.d.ts
  added mcp.d.ts
  ...
Migration complete!
```

- [ ] **Step 3: Verify results**

```bash
# File moved
ls src/user/

# .bmc updated with type and new filename
cat .bmc | python3 -m json.tool

# Template files added
ls *.d.ts
ls src/user/
ls src/endpoint/
```

- [ ] **Step 4: Run migrate again (idempotency)**

```bash
node /home/walter/projects/botmaker-cli/bin/bmc.js migrate
```

Expected:
```
Already up to date. :)
```

- [ ] **Step 5: Commit**

```bash
cd /home/walter/projects/botmaker-cli
git add -p   # review any incidental changes
git commit -m "feat: bmc migrate command complete"
```

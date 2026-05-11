# Remove Folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `folder` concept from the CLI entirely so CAs always land at `src/{typeFolder}/{basename}` with no subdirectory nesting.

**Architecture:** Six source files reference `folder`: `caTypes.js` (utility functions), `getStatus.js` (change detection), `importWorkspace.js`, `newCa.js`, `push.js`, and `pull.js`. We remove folder utilities from `caTypes.js` first (Task 1), then strip every downstream caller (Tasks 2–6), and finish with a grep-based zero-reference check (Task 7). No test suite exists in this project — verification is by module load + grep.

**Tech Stack:** Node.js, CommonJS modules, `fs-extra`, `chalk`

---

### Task 1: Simplify `src/caTypes.js`

**Files:**
- Modify: `src/caTypes.js`

Current file exports `cleanFolder`, `extractFolderFromFilename`, and `buildLocalRelPath(type, folder, basename)`. After this task: `cleanFolder` and `extractFolderFromFilename` are gone, `buildLocalRelPath` takes `(type, basename)` and returns `src/{typeFolder}/{basename}`.

- [ ] **Step 1: Apply the edit**

Replace the entire file content with:

```js
const CaType = Object.freeze({
  USER: 'USER',
  ENDPOINT: 'ENDPOINT',
  AI_FUNCTION: 'AI_FUNCTION',
  SCHEDULE: 'SCHEDULE',
});

const getTypeFolder = (type) => {
  if (type === CaType.ENDPOINT) return 'endpoint';
  if (type === CaType.AI_FUNCTION) return 'mcp';
  if (type === CaType.USER) return 'user';
  if (type === CaType.SCHEDULE) return 'schedule';
  return null;
};

const TYPE_FOLDERS = ['user', 'endpoint', 'mcp', 'schedule'];

const buildLocalRelPath = (type, basename) => {
  const typeFolder = getTypeFolder(type);
  return typeFolder ? `src/${typeFolder}/${basename}` : basename;
};

const extractBasename = (filename) => {
  if (!filename) return '';
  const parts = filename.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
};

module.exports = Object.assign({}, CaType, {
  getTypeFolder,
  buildLocalRelPath,
  extractBasename,
  TYPE_FOLDERS,
});
```

- [ ] **Step 2: Verify module loads**

```bash
node -e "const ct = require('./src/caTypes'); console.log(ct.buildLocalRelPath('USER','myca.js'));"
```

Expected output: `src/user/myca.js`

- [ ] **Step 3: Commit**

```bash
git add src/caTypes.js
git commit -m "refactor: simplify buildLocalRelPath to 2-param, remove cleanFolder and extractFolderFromFilename"
```

---

### Task 2: Strip folder from `src/getStatus.js`

**Files:**
- Modify: `src/getStatus.js`

Changes:
1. Remove `extractFolderFromFilename` from the import at line 9–14
2. Remove `FOLDER_CHANGED` (lines 118–124) and `LOCAL_FOLDER_CHANGED` (lines 125–131) from `ChangeType`
3. In `getLocalStatus`: remove `d` (line 314), `g` (line 315), update return (line 316)
4. Remove `D` from `NO_REMOTE` (line 319) and from `getRemoteStatus` / `findRemoteStatus` returns
5. Remove `folder` from the destructuring in `getRemoteStatus` (line 324) and `findRemoteStatus` (line 345)

- [ ] **Step 1: Fix the import — remove `extractFolderFromFilename`**

Old:
```js
const {
  getTypeFolder,
  extractFolderFromFilename,
  extractBasename,
  TYPE_FOLDERS,
} = require('./caTypes');
```

New:
```js
const {
  getTypeFolder,
  extractBasename,
  TYPE_FOLDERS,
} = require('./caTypes');
```

- [ ] **Step 2: Remove `FOLDER_CHANGED` and `LOCAL_FOLDER_CHANGED` from `ChangeType`**

Old (lines 118–131):
```js
  FOLDER_CHANGED: new ChangeStatusType(
    "Folder changed",
    'Fc',
    '!XP !Xp !Dd',
    'yellow',
    (s) => [s.d || '', s.D || '']
  ),
  LOCAL_FOLDER_CHANGED: new ChangeStatusType(
    "Local folder changed",
    'Lf',
    '!XP !Xp !Xg !dg',
    'cyan',
    (s) => [s.d || '', s.g || '']
  ),
```

Remove those two entries entirely (keep the `NEW_CA` entry that follows).

- [ ] **Step 3: Strip `d`, `g`, and the legend comment from `getLocalStatus`**

Old (lines 314–316):
```js
  const d = ca.folder != null ? ca.folder : '';
  const g = existFile ? extractFolderFromFilename(actualRel, ca.type) : null;
  return { p, t, f, u, n, id, fn: actualRel, d, g };
```

New:
```js
  return { p, t, f, u, n, id, fn: actualRel };
```

Also remove the comment block above (lines 142–157) that documents `[D] folder`, `d`, `g`:

Old:
```js
/*
[P]ublish
[U]npublish
[F]ile
[N]ame
[T]ype
[D] folder

Remote = UPPERCASE -> P U   N T D
Local = lowercase  -> p u f n t d g  (g = local-derived folder from current file location)

[X] = Nothing
[!] = Not ... [!X] = Something
[space] = and
[array] = or
*/
```

New:
```js
/*
[P]ublish
[U]npublish
[F]ile
[N]ame
[T]ype

Remote = UPPERCASE -> P U N T
Local = lowercase  -> p u f n t

[X] = Nothing
[!] = Not ... [!X] = Something
[space] = and
[array] = or
*/
```

- [ ] **Step 4: Strip `D` from `NO_REMOTE`, `getRemoteStatus`, and `findRemoteStatus`**

Old `NO_REMOTE`:
```js
const NO_REMOTE = { P: null, U: null, N: null, T: null, D: null }
```
New:
```js
const NO_REMOTE = { P: null, U: null, N: null, T: null }
```

Old `getRemoteStatus` body (inside the try block):
```js
    const { name, type, publishedCode, unPublishedCode, folder } = JSON.parse(caResp.body);
    return {
      N: name,
      T: type,
      P: publishedCode,
      U: unPublishedCode != null ? unPublishedCode : null,
      D: folder != null ? folder : '',
    }
```
New:
```js
    const { name, type, publishedCode, unPublishedCode } = JSON.parse(caResp.body);
    return {
      N: name,
      T: type,
      P: publishedCode,
      U: unPublishedCode != null ? unPublishedCode : null,
    }
```

Old `findRemoteStatus` body:
```js
  const { name, type, publishedCode, unPublishedCode, folder } = caResp;
  return {
    N: name,
    T: type,
    P: publishedCode,
    U: unPublishedCode != null ? unPublishedCode : null,
    D: folder != null ? folder : '',
  }
```
New:
```js
  const { name, type, publishedCode, unPublishedCode } = caResp;
  return {
    N: name,
    T: type,
    P: publishedCode,
    U: unPublishedCode != null ? unPublishedCode : null,
  }
```

- [ ] **Step 5: Verify module loads**

```bash
node -e "const gs = require('./src/getStatus'); console.log(Object.keys(gs.ChangeType));"
```

Expected: output does NOT contain `FOLDER_CHANGED` or `LOCAL_FOLDER_CHANGED`.

- [ ] **Step 6: Commit**

```bash
git add src/getStatus.js
git commit -m "refactor: remove FOLDER_CHANGED, LOCAL_FOLDER_CHANGED, and folder fields from getStatus"
```

---

### Task 3: Strip folder from `src/importWorkspace.js`

**Files:**
- Modify: `src/importWorkspace.js`

Changes in the `for (const ca of cas)` loop (lines 81–92): remove `remoteFolder`, simplify `targetDir`, simplify `buildLocalRelPath` call, remove `ca.folder = remoteFolder`.

- [ ] **Step 1: Apply the edit**

Old (lines 81–92):
```js
    const remoteFolder = ca.folder || '';
    const baseName = formatName(ca.name);
    const ext = ca.type === CaType.AI_FUNCTION ? 'ts' : 'js';
    const typeFolder = getTypeFolder(ca.type);
    const targetDir = typeFolder
      ? path.join(workspacePath, 'src', typeFolder, remoteFolder)
      : path.join(workspacePath, remoteFolder);
    await fse.ensureDir(targetDir);
    const basename = await getName(targetDir, baseName, ext);
    ca.filename = buildLocalRelPath(ca.type, remoteFolder, basename);
    ca.folder = remoteFolder;
    await writeFile(path.join(workspacePath, ca.filename), ca.unPublishedCode || ca.publishedCode, "UTF-8");
```

New:
```js
    const baseName = formatName(ca.name);
    const ext = ca.type === CaType.AI_FUNCTION ? 'ts' : 'js';
    const typeFolder = getTypeFolder(ca.type);
    const targetDir = typeFolder
      ? path.join(workspacePath, 'src', typeFolder)
      : workspacePath;
    await fse.ensureDir(targetDir);
    const basename = await getName(targetDir, baseName, ext);
    ca.filename = buildLocalRelPath(ca.type, basename);
    await writeFile(path.join(workspacePath, ca.filename), ca.unPublishedCode || ca.publishedCode, "UTF-8");
```

- [ ] **Step 2: Verify module loads**

```bash
node -e "require('./src/importWorkspace'); console.log('ok');"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/importWorkspace.js
git commit -m "refactor: remove folder from importWorkspace — CAs placed directly in type folder"
```

---

### Task 4: Strip folder from `src/newCa.js`

**Files:**
- Modify: `src/newCa.js`

Changes in `createFileAndStatus` (lines 94–117): remove `remoteFolder`, simplify `targetDir`, simplify `buildLocalRelPath` call, remove `folder: remoteFolder` from return.

- [ ] **Step 1: Apply the edit**

Old `createFileAndStatus` body (lines 95–116):
```js
  const remoteFolder = ca.folder || '';
  const baseName = importWorkspace.formatName(ca.name);
  const ext = type === CaType.AI_FUNCTION ? 'ts' : 'js';
  const typeFolder = getTypeFolder(type);
  const targetDir = typeFolder
    ? path.join(wpPath, 'src', typeFolder, remoteFolder)
    : path.join(wpPath, remoteFolder);
  await fse.ensureDir(targetDir);
  const basename = await importWorkspace.getName(targetDir, baseName, ext);
  const newFileName = buildLocalRelPath(type, remoteFolder, basename);

  const filePath = path.join(wpPath, newFileName);
  await writeFile(filePath, ca.publishedCode, 'UTF-8');
  console.log(chalk.green(`${filePath} was added`));
  if(openVsCode){
    exec(`code "${filePath}"`);
  }
  return {
    ...ca,
    filename: newFileName,
    folder: remoteFolder,
  };
```

New:
```js
  const baseName = importWorkspace.formatName(ca.name);
  const ext = type === CaType.AI_FUNCTION ? 'ts' : 'js';
  const typeFolder = getTypeFolder(type);
  const targetDir = typeFolder
    ? path.join(wpPath, 'src', typeFolder)
    : path.join(wpPath, 'src');
  await fse.ensureDir(targetDir);
  const basename = await importWorkspace.getName(targetDir, baseName, ext);
  const newFileName = buildLocalRelPath(type, basename);

  const filePath = path.join(wpPath, newFileName);
  await writeFile(filePath, ca.publishedCode, 'UTF-8');
  console.log(chalk.green(`${filePath} was added`));
  if(openVsCode){
    exec(`code "${filePath}"`);
  }
  return {
    ...ca,
    filename: newFileName,
  };
```

- [ ] **Step 2: Verify module loads**

```bash
node -e "require('./src/newCa'); console.log('ok');"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/newCa.js
git commit -m "refactor: remove folder from newCa — new CAs placed directly in type folder"
```

---

### Task 5: Strip folder from `src/push.js`

**Files:**
- Modify: `src/push.js`

Changes:
1. `getPushChanges`: remove `hasLocalFolder`, simplify guard, remove `payload.folder` line
2. `hasIncomingChanges`: remove `FOLDER_CHANGED` entry
3. `applyToCas`: remove the `if (u.payload.folder !== undefined)` block
4. `completePush` logging: remove folder tag

- [ ] **Step 1: Edit `getPushChanges`**

Old (lines 22–33):
```js
const getPushChanges = (status, changes) => {
  const hasLocalCode = changes.includes(ChangeType.LOCAL_CHANGES);
  const hasLocalFolder = changes.includes(ChangeType.LOCAL_FOLDER_CHANGED);
  if (!hasLocalCode && !hasLocalFolder) {
    return;
  }

  const payload = { id: status.id };
  if (hasLocalCode) payload.unPublishedCode = status.f;
  if (hasLocalFolder) payload.folder = status.g || '';
  return { payload, fn: status.fn };
}
```

New:
```js
const getPushChanges = (status, changes) => {
  const hasLocalCode = changes.includes(ChangeType.LOCAL_CHANGES);
  if (!hasLocalCode) {
    return;
  }

  const payload = { id: status.id };
  if (hasLocalCode) payload.unPublishedCode = status.f;
  return { payload, fn: status.fn };
}
```

- [ ] **Step 2: Edit `hasIncomingChanges` — remove `FOLDER_CHANGED`**

Old (lines 39–48):
```js
const hasIncomingChanges = (changes) => {
  return changes.some(c =>
    c === ChangeType.INCOMING_CHANGES
    || c === ChangeType.REMOVE_REMOTE
    || c === ChangeType.NEW_CA
    || c === ChangeType.RENAMED
    || c === ChangeType.TYPE_CHANGED
    || c === ChangeType.FOLDER_CHANGED
  );
}
```

New:
```js
const hasIncomingChanges = (changes) => {
  return changes.some(c =>
    c === ChangeType.INCOMING_CHANGES
    || c === ChangeType.REMOVE_REMOTE
    || c === ChangeType.NEW_CA
    || c === ChangeType.RENAMED
    || c === ChangeType.TYPE_CHANGED
  );
}
```

- [ ] **Step 3: Edit `applyToCas` — remove folder update block**

Old (lines 50–60):
```js
const applyToCas = (cas, updates) => cas.map(ca => {
  const u = updates.find(x => x.payload.id === ca.id);
  if (!u) return ca;
  const next = { ...ca };
  if (u.payload.unPublishedCode !== undefined) next.unPublishedCode = u.payload.unPublishedCode;
  if (u.payload.folder !== undefined) {
    next.folder = u.payload.folder;
    next.filename = u.fn;
  }
  return next;
});
```

New:
```js
const applyToCas = (cas, updates) => cas.map(ca => {
  const u = updates.find(x => x.payload.id === ca.id);
  if (!u) return ca;
  const next = { ...ca };
  if (u.payload.unPublishedCode !== undefined) next.unPublishedCode = u.payload.unPublishedCode;
  return next;
});
```

- [ ] **Step 4: Edit `completePush` logging — remove folder tag**

Old (lines 104–111):
```js
  toPush.forEach(update => {
    const ca = cas.find(c => c.id === update.payload.id);
    const tags = [];
    if (update.payload.unPublishedCode !== undefined) tags.push('code');
    if (update.payload.folder !== undefined) tags.push(`folder="${update.payload.folder}"`);
    console.log(chalk.yellow(` * ${chalk.italic(update.fn)} `) + chalk.grey(`${ca.name} [${tags.join(', ')}]`))
  })
```

New:
```js
  toPush.forEach(update => {
    const ca = cas.find(c => c.id === update.payload.id);
    const tags = [];
    if (update.payload.unPublishedCode !== undefined) tags.push('code');
    console.log(chalk.yellow(` * ${chalk.italic(update.fn)} `) + chalk.grey(`${ca.name} [${tags.join(', ')}]`))
  })
```

- [ ] **Step 5: Verify module loads**

```bash
node -e "require('./src/push'); console.log('ok');"
```

Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add src/push.js
git commit -m "refactor: remove folder tracking from push — no longer sends folder in payload"
```

---

### Task 6: Strip folder from `src/pull.js`

**Files:**
- Modify: `src/pull.js`

Changes:
1. Simplify `targetDirForNew` to drop `folder` param
2. Update `createNewFile` to use simplified `targetDirForNew` and `buildLocalRelPath`
3. Remove `hasFolderChanged` from `makeChanges`
4. Remove the three `if (hasFolderChanged)` move-branches
5. Remove `folder: status.D || ''` from both CA object literals in `makeChanges`

- [ ] **Step 1: Simplify `targetDirForNew`**

Old (lines 20–25):
```js
const targetDirForNew = (wpPath, type, folder) => {
  const typeFolder = getTypeFolder(type);
  return typeFolder
    ? path.join(wpPath, 'src', typeFolder, folder || '')
    : path.join(wpPath, folder || '');
};
```

New:
```js
const targetDirForNew = (wpPath, type) => {
  const typeFolder = getTypeFolder(type);
  return typeFolder
    ? path.join(wpPath, 'src', typeFolder)
    : wpPath;
};
```

- [ ] **Step 2: Update `createNewFile`**

Old (lines 27–36):
```js
const createNewFile = async (wpPath, status, content) => {
  const baseName = importWorkspace.formatName(status.N);
  const ext = status.T === CaType.AI_FUNCTION ? 'ts' : 'js';
  const targetDir = targetDirForNew(wpPath, status.T, status.D);
  await fse.ensureDir(targetDir);
  const basename = await importWorkspace.getName(targetDir, baseName, ext);
  const newFileName = buildLocalRelPath(status.T, status.D, basename);
  await writeFile(path.join(wpPath, newFileName), content, 'UTF-8');
  return newFileName;
};
```

New:
```js
const createNewFile = async (wpPath, status, content) => {
  const baseName = importWorkspace.formatName(status.N);
  const ext = status.T === CaType.AI_FUNCTION ? 'ts' : 'js';
  const targetDir = targetDirForNew(wpPath, status.T);
  await fse.ensureDir(targetDir);
  const basename = await importWorkspace.getName(targetDir, baseName, ext);
  const newFileName = buildLocalRelPath(status.T, basename);
  await writeFile(path.join(wpPath, newFileName), content, 'UTF-8');
  return newFileName;
};
```

- [ ] **Step 3: Edit `makeChanges` — remove `hasFolderChanged` and all three move-branches**

Old `hasFolderChanged` declaration (line 55):
```js
  const hasFolderChanged = changes.includes(getStatus.ChangeType.FOLDER_CHANGED);
```
Remove this line.

**Branch 1** — inside `hasLocalChanges && hasIncomingChanges` (lines 80–91), old:
```js
    let targetFn = status.fn;
    if (hasFolderChanged) {
      const basename = path.basename(status.fn);
      targetFn = buildLocalRelPath(status.T, status.D, basename);
      const oldAbs = path.join(wpPath, status.fn);
      const newAbs = path.join(wpPath, targetFn);
      if (oldAbs !== newAbs) {
        await fse.ensureDir(path.dirname(newAbs));
        if (await exists(oldAbs)) await rm(oldAbs);
        console.log(chalk.yellow(`${oldAbs} was moved to ${newAbs}`));
      }
    }
```
New (collapse to single line):
```js
    const targetFn = status.fn;
```

**Branch 2** — inside plain `hasIncomingChanges` (lines 103–115), old:
```js
      let targetFn = status.fn;
      if (hasFolderChanged) {
        const basename = path.basename(status.fn);
        targetFn = buildLocalRelPath(status.T, status.D, basename);
        const oldAbs = path.join(wpPath, status.fn);
        const newAbs = path.join(wpPath, targetFn);
        if (oldAbs !== newAbs) {
          await fse.ensureDir(path.dirname(newAbs));
          if (await exists(oldAbs)) await rm(oldAbs);
          console.log(chalk.yellow(`${oldAbs} was moved to ${newAbs}`));
        }
      }
```
New:
```js
      const targetFn = status.fn;
```

**Branch 3** — standalone `else if (hasFolderChanged)` block (lines 125–134), old:
```js
  } else if (hasFolderChanged) {
    const basename = path.basename(status.fn);
    const targetFn = buildLocalRelPath(status.T, status.D, basename);
    const oldAbs = path.join(wpPath, status.fn);
    const newAbs = path.join(wpPath, targetFn);
    if (oldAbs !== newAbs) {
      await moveLocalFile(wpPath, status.fn, targetFn);
      console.log(chalk.yellow(`${oldAbs} was moved to ${newAbs}`));
    }
    status.fn = targetFn;
  } else if (wasAdded) {
```
New (remove the entire `else if (hasFolderChanged)` block, keep `else if (wasAdded)`):
```js
  } else if (wasAdded) {
```

- [ ] **Step 4: Remove `folder` from the two CA object literals**

Old `wasAdded` return (lines 139–147):
```js
    return cas.concat({
      publishedCode: status.P,
      unPublishedCode: status.U,
      name: status.N,
      type: status.T,
      id: status.id,
      filename: newFileName,
      folder: status.D || '',
    })
```
New:
```js
    return cas.concat({
      publishedCode: status.P,
      unPublishedCode: status.U,
      name: status.N,
      type: status.T,
      id: status.id,
      filename: newFileName,
    })
```

Old final `cas.map` return (lines 150–158):
```js
  return cas.map(ca => ca.id !== status.id ? ca : {
    publishedCode: status.P,
    unPublishedCode: status.U,
    name: status.N,
    type: status.T,
    id: status.id,
    filename: status.fn,
    folder: status.D || '',
  });
```
New:
```js
  return cas.map(ca => ca.id !== status.id ? ca : {
    publishedCode: status.P,
    unPublishedCode: status.U,
    name: status.N,
    type: status.T,
    id: status.id,
    filename: status.fn,
  });
```

- [ ] **Step 5: Verify module loads**

```bash
node -e "require('./src/pull'); console.log('ok');"
```

Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add src/pull.js
git commit -m "refactor: remove folder tracking from pull — no longer moves files based on remote folder"
```

---

### Task 7: Verify zero folder references remain

**Files:** (read-only scan)

- [ ] **Step 1: grep for folder in source files**

```bash
grep -n "folder\|cleanFolder\|extractFolderFromFilename\|FOLDER_CHANGED\|LOCAL_FOLDER_CHANGED\|remoteFolder\|hasFolderChanged\|status\.D\|status\.g\b\|status\.d\b" \
  src/caTypes.js src/getStatus.js src/importWorkspace.js src/newCa.js src/push.js src/pull.js
```

Expected: zero lines. Any match is a missed removal — fix it before proceeding.

- [ ] **Step 2: Verify all 6 modules load cleanly**

```bash
node -e "
  require('./src/caTypes');
  require('./src/getStatus');
  require('./src/importWorkspace');
  require('./src/newCa');
  require('./src/push');
  require('./src/pull');
  console.log('all modules ok');
"
```

Expected: `all modules ok`

- [ ] **Step 3: Verify success criteria from spec**

```bash
node -e "
  const ct = require('./src/caTypes');
  const gs = require('./src/getStatus');
  console.assert(ct.buildLocalRelPath('USER', 'myca.js') === 'src/user/myca.js', 'buildLocalRelPath USER');
  console.assert(ct.buildLocalRelPath('ENDPOINT', 'myca.js') === 'src/endpoint/myca.js', 'buildLocalRelPath ENDPOINT');
  console.assert(ct.buildLocalRelPath('AI_FUNCTION', 'myca.ts') === 'src/mcp/myca.ts', 'buildLocalRelPath AI_FUNCTION');
  console.assert(ct.buildLocalRelPath('SCHEDULE', 'myca.js') === 'src/schedule/myca.js', 'buildLocalRelPath SCHEDULE');
  console.assert(ct.cleanFolder === undefined, 'cleanFolder removed');
  console.assert(ct.extractFolderFromFilename === undefined, 'extractFolderFromFilename removed');
  console.assert(gs.ChangeType.FOLDER_CHANGED === undefined, 'FOLDER_CHANGED removed');
  console.assert(gs.ChangeType.LOCAL_FOLDER_CHANGED === undefined, 'LOCAL_FOLDER_CHANGED removed');
  console.log('all assertions passed');
"
```

Expected: `all assertions passed`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify folder removal complete — all assertions pass"
```

(If there were no new files to stage, skip the commit.)

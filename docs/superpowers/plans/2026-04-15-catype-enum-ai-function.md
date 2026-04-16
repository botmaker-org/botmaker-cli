# CaType Enum + AI_FUNCTION Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `CaType` enum with `USER`, `ENDPOINT`, and `AI_FUNCTION` values, replace all raw string literals across the CLI, and implement AI_FUNCTION runtime support (compile via tsCompiler, run in the VM sandbox).

**Architecture:** A new `src/caTypes.js` module exports a frozen enum object consumed by `index.js`, `newCa.js`, `run.js`, and `listCas.js`. The AI_FUNCTION runner in `run.js` uses a lazy-loaded CJS bridge that compiles `tsCompiler.ts` in-memory via ts-morph (patching `import.meta.dirname` for CJS compatibility), executes the emitted JS to obtain the `compile()` function, then passes the compiled CA code straight to `caRunner`.

**Tech Stack:** Node.js CJS modules, ts-morph `emitToMemory`, TypeScript compiler API (transitive via ts-morph).

---

### Task 1: Create `src/caTypes.js`

**Files:**
- Create: `src/caTypes.js`

- [ ] **Create the enum module**

```js
const CaType = Object.freeze({
  USER: 'USER',
  ENDPOINT: 'ENDPOINT',
  AI_FUNCTION: 'AI_FUNCTION',
});

module.exports = CaType;
```

- [ ] **Commit**

```bash
git add src/caTypes.js
git commit -m "feat: add CaType enum"
```

---

### Task 2: Update `src/index.js`

**Files:**
- Modify: `src/index.js` — line 1 area (add require), line 118 (replace ternary)

- [ ] **Add require at the top of the file, after the existing requires block**

```js
const CaType = require('./caTypes');
```

- [ ] **Replace the ternary on line 118**

Before:
```js
await newCa(pwd, caName3, e ? "ENDPOINT" : "USER", vsCode1);
```

After:
```js
await newCa(pwd, caName3, e ? CaType.ENDPOINT : CaType.USER, vsCode1);
```

- [ ] **Commit**

```bash
git add src/index.js
git commit -m "feat: use CaType enum in index.js"
```

---

### Task 3: Update `src/newCa.js`

**Files:**
- Modify: `src/newCa.js` — add require + AI_FUNCTION template, replace type ternary in `newCa` function

- [ ] **Add require at the top of the file, after the existing requires block**

```js
const CaType = require('./caTypes');
```

- [ ] **Add the AI_FUNCTION starter template after the `baseCa` definition (after line 61)**

```js
const baseAiFunctionCa =
`/**
 * this function multyply by 2
 * 
 * @param myNumber the number to multiply by 2
 * 
 * @return the double
 */
export default function double(myNumber: number): number {
    return myNumber * 2;
}
`;
```

- [ ] **Replace the type ternary inside the `newCa` function**

Before:
```js
const newCa = {
  publishedCode: type === 'USER' ? baseCa : baseEndPointCa,
  name: caName,
  type: type,
};
```

After:
```js
const templateByType = {
  [CaType.USER]: baseCa,
  [CaType.ENDPOINT]: baseEndPointCa,
  [CaType.AI_FUNCTION]: baseAiFunctionCa,
};
const newCa = {
  publishedCode: templateByType[type] ?? baseCa,
  name: caName,
  type: type,
};
```

- [ ] **Commit**

```bash
git add src/newCa.js
git commit -m "feat: add AI_FUNCTION template and use CaType enum in newCa.js"
```

---

### Task 4: Update `src/listCas.js`

**Files:**
- Modify: `src/listCas.js` — full replacement (add require, AI_FUNCTION tag, type map, legend entry)

- [ ] **Replace the entire file**

```js
const chalk = require('chalk');
const { getBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const CaType = require('./caTypes');

const ENDPOINT_TAG = `${chalk.magenta(`En`)}:`;
const USER_TAG = `${chalk.cyan(`Us`)}:`;
const AI_FUNCTION_TAG = `${chalk.yellow(`Ai`)}:`;

const TYPE_TAG = {
  [CaType.ENDPOINT]: ENDPOINT_TAG,
  [CaType.USER]: USER_TAG,
  [CaType.AI_FUNCTION]: AI_FUNCTION_TAG,
};

const getCodeActionTypeTag = (ca) => TYPE_TAG[ca.type] ?? USER_TAG;

const listCas = async (pwd) => {
  const wpPath = await getWorkspacePath(pwd);
  const { cas } = await getBmc(wpPath);
  cas.forEach(ca => {
    console.log(`${getCodeActionTypeTag(ca)} ${chalk.green(ca.name)} ${chalk.gray(chalk.italic(ca.filename))}`);
  });
  console.log(`
Description:
* ${USER_TAG} User type code action
* ${ENDPOINT_TAG} Endpoint type code action
* ${AI_FUNCTION_TAG} AI Function type code action`);
};

module.exports = listCas;
```

- [ ] **Commit**

```bash
git add src/listCas.js
git commit -m "feat: add AI_FUNCTION tag to listCas and use CaType enum"
```

---

### Task 5: Update `src/run.js`

**Files:**
- Modify: `src/run.js` — add requires, lazy tsCompiler bridge, `runAiFunctionCa`, update `run` dispatch

- [ ] **Add requires at the top of the file, after the existing requires block**

```js
const CaType = require('./caTypes');
const { Project, ts } = require('ts-morph');
```

- [ ] **Add the lazy-loaded tsCompiler bridge after the `exists` declaration (line 17)**

```js
let _compileFn = null;
const getCompile = async () => {
  if (_compileFn) return _compileFn;
  const tsFilePath = path.join(__dirname, 'tsCompiler.ts');
  const project = new Project({
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ESNext,
      esModuleInterop: true,
      skipLibCheck: true,
    }
  });
  project.addSourceFileAtPath(tsFilePath);
  const sourceFile = project.getSourceFileOrThrow(tsFilePath);
  sourceFile.replaceWithText(sourceFile.getText().replace(/import\.meta\.dirname/g, '__dirname'));
  const emitResult = project.emitToMemory();
  const jsFile = emitResult.getFiles().find(f => f.filePath.includes('tsCompiler'));
  if (!jsFile) throw new Error('Failed to emit tsCompiler.ts');
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', '__dirname', '__filename', jsFile.text)(
    mod, mod.exports, require, __dirname, tsFilePath
  );
  _compileFn = mod.exports.compile;
  return _compileFn;
};
```

- [ ] **Add `runAiFunctionCa` after the closing brace of `runUserCa` (after line 153)**

```js
const runAiFunctionCa = async (wpPath, token, cas, ca, vars, params, volatile) => {
  const { code: tsCode, helpers, filePath } = await getCodeAnHelpers(wpPath, cas, ca);
  const compile = await getCompile();
  const compileResult = await compile(tsCode);
  if ('errors' in compileResult) {
    const msgs = compileResult.errors
      .map(e => (typeof e.message === 'string' ? e.message : e.message.messageText))
      .join('\n');
    throw new Error(`TypeScript compilation failed:\n${msgs}`);
  }
  const contextJson = await readFile(path.join(wpPath, 'context.json'), 'utf8');
  const context = JSON.parse(contextJson);
  const commandVars = doubleArrayToObject(vars);
  const commandParameters = doubleArrayToObject(params);
  context.userData.variables = { ...context.userData.variables, ...commandVars };
  context.params = { ...context.params, ...commandParameters };
  const startTime = new Date().getTime();
  const result = await new Promise((fulfill, reject) => {
    try {
      caRunner(compileResult.code, context, helpers, fulfill, token, filePath);
    } catch (err) {
      reject(err);
    }
  });
  const endTime = new Date().getTime() - startTime;
  if (result) {
    if (result.error && result.stack) {
      const line = result.stack.split('\n')[1] || '';
      const found = line.matchAll(/\<anonymous\>(:\d+:\d+)/g).next();
      console.error(chalk.red(` ❌ Fail in ${endTime}ms`));
      if (found.value) {
        console.error(chalk.red(`${result.stack.split('\n')[0]} at ${filePath}${found.value[1]}`));
      } else {
        console.error(chalk.red(result.stack));
      }
    } else if (result.error) {
      console.error(chalk.red(` ❌ Fail in ${endTime}ms`));
      console.error(chalk.red(result.error));
    } else {
      const resultRendered = resolveRenderer(result.resultState, context);
      console.log(resultRendered);
      console.log(chalk.green(` ✓ Success in ${endTime}ms`));
      if (!volatile) {
        const newContext = {
          ...context,
          userData: {
            ...context.userData,
            variables: { ...context.userData.variables, ...result.resultState.user }
          }
        };
        await writeFile(path.join(wpPath, 'context.json'), JSON.stringify(newContext, null, 4), 'utf-8');
      }
    }
  }
  process.exit(0);
};
```

- [ ] **Replace the `run` function**

Before:
```js
const run = async (pwd, file, { vars, params, volatile, endpoint, port = 7070 }) => {
  const wpPath = await getWorkspacePath(pwd)
  const { token, cas } = await getBmc(wpPath);
  const ca = await getCaByNameOrPath(wpPath, cas, file);
  const type = endpoint ? "ENDPOINT" : (ca.type || "USER");
  if (type === "USER") {
    await runUserCa(wpPath, token, cas, ca, vars, params, volatile);
  } else if (type === "ENDPOINT" || type === "SCHEDULE") {
    await runEndpointCa(wpPath, token, cas, ca, port);
  } else {
    throw new Error(`'${type}' invalid client action type.`)
  }
}
```

After:
```js
const run = async (pwd, file, { vars, params, volatile, endpoint, port = 7070 }) => {
  const wpPath = await getWorkspacePath(pwd);
  const { token, cas } = await getBmc(wpPath);
  const ca = await getCaByNameOrPath(wpPath, cas, file);
  const type = endpoint ? CaType.ENDPOINT : (ca.type || CaType.USER);
  if (type === CaType.USER) {
    await runUserCa(wpPath, token, cas, ca, vars, params, volatile);
  } else if (type === CaType.AI_FUNCTION) {
    await runAiFunctionCa(wpPath, token, cas, ca, vars, params, volatile);
  } else if (type === CaType.ENDPOINT || type === 'SCHEDULE') {
    await runEndpointCa(wpPath, token, cas, ca, port);
  } else {
    throw new Error(`'${type}' invalid client action type.`);
  }
};
```

- [ ] **Commit**

```bash
git add src/run.js
git commit -m "feat: add AI_FUNCTION runner with tsCompiler bridge, use CaType enum in run.js"
```

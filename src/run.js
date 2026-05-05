const readline = require('readline');
const fs = require('fs');
const rp = require('request-promise');
const util = require('util');
const caRunner = require('./caRunner');
const path = require('path');
const resolveRenderer = require('./resultRenderer');
const chalk = require('chalk');
const getWorkspacePath = require('./getWorkspacePath');
const { getBmc } = require('./bmcConfig');
const express = require('express');
const { getCaByNameOrPath } = require('./getStatus');
const caEndpointRunner = require('./caEndpointRunner');
const CaType = require('./caTypes');
const { Project, ts } = require('ts-morph');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const exists = util.promisify(fs.exists);

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
  if (typeof _compileFn !== 'function') throw new Error('tsCompiler bridge failed to export compile()');
  return _compileFn;
};

const doubleArrayToObject = array => {
  const obj = {};
  for (let index = 0; index < array.length / 2; index++) {
    obj[array[index]] = array[index + 1];
  }
  return obj
}

const require_core_action_pattern = /require\((?:(?:'([a-zA-Z0-9_-]*))'|(?:"([a-zA-Z0-9_-]*)"))\)/g

const getCodeAnHelpers = async (wpPath, cas, ca) => {
  const filePath = path.join(wpPath, ca.filename);
  const helpers = {};

  let code = await readFile(filePath, "utf8");
  let match;

  while ((match = require_core_action_pattern.exec(code)) != null) {
    const req = match[1] || match[2];
    if (!req) continue
    const posibleReqFile = (cas.find(c => c.name === req) || {}).filename || `src/${req}.js`;
    const posibleUtils = path.join(wpPath, posibleReqFile);
    if (await exists(posibleUtils)) {
      let helper = await readFile(posibleUtils, "utf8");
      const parsedHelper = "({" + helper.replace(/function /, "").replace(/function /g, ",") + "})\n//# sourceURL=" + posibleUtils;
      helpers[req] = {code: parsedHelper, source: posibleUtils};
    }
  }
  return { code, helpers, filePath};
}

const runEndpointCa = async (wpPath, token, cas, ca, port) => {


  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  // app.use(express.raw());
  // app.use(express.text());
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  

  app.use((req, res, next) => {
    const start = (new Date()).getTime();
    console.log(chalk.yellow(` Req [${req.method}] ${req.path}`));
    res.on('finish', () => {
      const end = (new Date()).getTime();
      if(res.statusCode >= 200 && res.statusCode < 300) {
        console.log(chalk.green(` Res [${res.statusCode}] on ${end - start}ms`));  
      } else {
        console.log(chalk.red(` Res [${res.statusCode}] on ${end - start}ms`));
      }
    });
    next();
  });


  const runTest = () => new Promise( r => rl.question("Press ENTER to run test", r ) )
    .then( async () => {
      console.log('Calling service...')
      try{
        const ret = await rp({uri:`http://localhost:${port}`});
        console.log(chalk.green(ret));  
      } catch( err ) {
        console.error(chalk.red(err.message));
      }
      return runTest();
    });


  app.use(async (req, res) => {
    const { code, helpers, filePath} = await getCodeAnHelpers(wpPath, cas, ca)
    caEndpointRunner(req, res, token, code, helpers, filePath);
  });

  app.listen(port, () => {
    console.log(chalk.green(`Listening in http://localhost:${port}`));
    console.log('Press Ctrl + C to stop the server.');
    runTest();
  });

  rl.on("close", function() {
    console.log("\nBYE BYE !!!");
    process.exit(0);
  });
  
};

const runUserCa = async (wpPath, token, cas, ca, vars, params, volatile) => {
  const { code, helpers, filePath} = await getCodeAnHelpers(wpPath, cas, ca)
  const contextJson = await readFile(path.join(wpPath, "context.json"), "utf8");
  const context = JSON.parse(contextJson);
  const commandVars = doubleArrayToObject(vars);
  const commandParameters = doubleArrayToObject(params);
  context.userData.variables = { ...context.userData.variables, ...commandVars }
  context.params = { ...context.params, ...commandParameters }
  const startTime = new Date().getTime();
  const result = await new Promise((fulfill, reject) => {
    try {
      caRunner(code, context, helpers, fulfill, token, filePath);
    } catch (err) {
      reject(err);
    }
  });
  const endTime = new Date().getTime() - startTime;

  if (result) {
    if (result.error && result.stack) {
      const line = result.stack.split('\n')[1] || "";
      const found = line.matchAll(/\<anonymous\>(:\d+:\d+)/g).next();
      console.error(chalk.red(` ❌ Fail in ${endTime}ms`))
      if (found.value) {
        console.error(chalk.red(`${result.stack.split('\n')[0]} at ${filePath}${found.value[1]}`));
      } else {
        console.error(chalk.red(result.stack));
      }
    } else if (result.error) {
      console.error(chalk.red(` ❌ Fail in ${endTime}ms`))
      console.error(chalk.red(result.error));
    } else {
      const resultRendered = resolveRenderer(result.resultState, context);
      console.log(resultRendered)
      console.log(chalk.green(` ✓ Success in ${endTime}ms`))
      if (!volatile) {
        const newContext = { ...context, userData: { ...context.userData, variables: { ...context.userData.variables, ...result.resultState.user } } }
        await writeFile(path.join(wpPath, "context.json"), JSON.stringify(newContext, null, 4), 'utf-8');
      }
      //console.log(JSON.stringify(result));
    }
  }
  process.exit(0);
}

const runAiFunctionCa = async (wpPath, token, cas, ca, vars, params, volatile) => {
  const { code: tsCode, helpers, filePath } = await getCodeAnHelpers(wpPath, cas, ca);
  const compile = await getCompile();
  const mcpGlobalsPath = path.join(__dirname, '../workspaceTemplate/mcp.d.ts');
  const compileResult = await compile(tsCode, mcpGlobalsPath);
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

  const User = {
    get: (key) => context.userData.variables[key],
    set: (key, value) => { context.userData.variables[key] = value; },
  };

  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', '__dirname', '__filename', 'User', compileResult.code)(
    mod, mod.exports, require, path.dirname(filePath), filePath, User
  );

  const fn = mod.exports.default || mod.exports;
  if (typeof fn !== 'function') throw new Error('MCP CA must export a default function');

  const paramOrder = Object.keys(compileResult.inputSchema?.properties || {});
  const paramValues = paramOrder.length > 0
    ? paramOrder.map(k => commandParameters[k])
    : [commandParameters];

  const startTime = new Date().getTime();
  try {
    const result = await fn(...paramValues);
    const endTime = new Date().getTime() - startTime;
    console.log(JSON.stringify(result, null, 2));
    console.log(chalk.green(` ✓ Success in ${endTime}ms`));
    if (!volatile) {
      const newContext = {
        ...context,
        userData: { ...context.userData, variables: { ...context.userData.variables } }
      };
      await writeFile(path.join(wpPath, 'context.json'), JSON.stringify(newContext, null, 4), 'utf-8');
    }
  } catch (err) {
    const endTime = new Date().getTime() - startTime;
    console.error(chalk.red(` ❌ Fail in ${endTime}ms`));
    console.error(chalk.red(err.stack || err.message));
  }
  process.exit(0);
};

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

module.exports = run;
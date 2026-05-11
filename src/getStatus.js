const path = require('path');
const util = require('util');
const fs = require('fs');
const chalk = require('chalk');

const { getAllCas, getCa } = require('./bmService')
const { getBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const {
  getTypeFolder,
  extractFolderFromFilename,
  extractBasename,
  TYPE_FOLDERS,
} = require('./caTypes');

const readFile = util.promisify(fs.readFile);
const exists = util.promisify(fs.exists);
const readdir = util.promisify(fs.readdir);

const processCode = (code, status, gate) => {
  if (Array.isArray(code)) {
    if (!gate) {
      return code.some(c => processCode(c, status))
    } else if (gate === "AND") {
      return code.every(c => processCode(c, status))
    }
  }
  if (code.includes(" ")) {
    return processCode(code.split(" "), status, "AND");
  }
  if (code.charAt(0) === "!") {
    return !processCode(code.substr(1), status);
  }
  const getVal = (c) => c === "X" ? null : status[c];
  if (getVal(code.charAt(0)) !== getVal(code.charAt(1))) {
    return false;
  }
  if (code.length === 2) {
    return true;
  }
  return processCode(code.substr(1), status);
}

class ChangeStatusType {
  constructor(label, short, code, color, diff) {
    this.label = label;
    this.short = short;
    this.code = code;
    this.color = color;
    this.diff = diff
  }
}

const ChangeType = {
  UNPUBLISHED: new ChangeStatusType(
    "Is unpublished",
    'Un',
    '!XU',
    'blue',
    (s) => [s.U, s.P]
  ),
  NOT_ADDED: new ChangeStatusType(
    "Not added",
    'Na',
    'XP Xp !Xf',
    'red',
    (s) => [null, s.f]
  ),
  REMOVE_REMOTE: new ChangeStatusType(
    "Remove remote",
    'Rr',
    'XP !Xp',
    'bgRed',
    (s) => [s.p, null]
  ),
  REMOVE_LOCAL: new ChangeStatusType(
    "Remove local",
    'Rl',
    '!XP !Xp Xf',
    'red',
    (s) => [s.P, null]
  ),
  LOCAL_CHANGES: new ChangeStatusType(
    "Local changes",
    'Lc',
    ['!Xu !uf', '!Xp Xu !pf'],
    'cyan',
    (s) => s.u && s.u !== s.f ? [s.u, s.f] : [s.p, s.f]
  ),
  NEW_VERSION: new ChangeStatusType(
    "New version was published",
    'Nv',
    '!XP !Xp !Pp',
    'magenta',
    (s) => [s.p, s.P]
  ),
  INCOMING_CHANGES: new ChangeStatusType(
    "Incoming changes",
    'In',
    ['!XP !Xp Xu !Pp', '!XP !Xp !Uu'],
    'yellow',
    (s) => s.U ? [s.u || s.p, s.U] : [s.p, s.P]
  ),
  RENAMED: new ChangeStatusType(
    "Renamed",
    'Rn',
    '!XP !Xp !Nn',
    'yellow',
    (s) => [s.n, s.N]
  ),
  TYPE_CHANGED: new ChangeStatusType(
    "Type changed",
    'Tc',
    '!XP !Xp !Tt',
    'red',
    (s) => [s.t, s.T]
  ),
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
  NEW_CA: new ChangeStatusType(
    "New ca was created",
    'Nc',
    '!XP Xp',
    'green',
    (s) => [null, s.P]
  ),
};


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
const posibleChanges = Object.values(ChangeType);

const ROOT_SCAN_EXCLUDES = new Set([
  '.bmc', 'src', 'context.json', 'package.json',
  'package-lock.json', 'jsconfig.json', 'index.d.ts', 'endpoint.d.ts',
  'mcp.d.ts',
  'README.md', 'node_modules', '.vscode', '.git', '.gitignore',
]);

const SRC_SCAN_EXCLUDES = new Set(['jsconfig.json', 'tsconfig.json']);

const findFileByBasename = async (rootPath, basename) => {
  const matches = [];
  if (!(await exists(rootPath))) return matches;
  const entries = await readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const sub = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      const inner = await findFileByBasename(sub, basename);
      matches.push(...inner.map(m => `${entry.name}/${m}`));
    } else if (entry.isFile() && entry.name === basename) {
      matches.push(entry.name);
    }
  }
  return matches;
};

async function* walkRel(rootPath, prefix, excludes) {
  if (!(await exists(rootPath))) return;
  const entries = await readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    if (excludes && excludes.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;
    const sub = path.join(rootPath, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      yield* walkRel(sub, rel);
    } else if (entry.isFile()) {
      yield rel;
    }
  }
}

async function* walkAllLocalCaFiles(wpPath, cas) {
  for (const folder of TYPE_FOLDERS) {
    const folderPath = path.join(wpPath, 'src', folder);
    if (await exists(folderPath)) {
      yield* walkRel(folderPath, `src/${folder}`, SRC_SCAN_EXCLUDES);
    }
  }
  // Workspace-root scan only when an unmapped-type CA already exists,
  // to avoid false NOT_ADDED for unrelated files at the root.
  const hasUnmapped = cas.some(c => c.type && getTypeFolder(c.type) == null);
  if (hasUnmapped) {
    yield* walkRel(wpPath, '', ROOT_SCAN_EXCLUDES);
  }
}

const getCaPath = async (wpPath, caName) => {
  const posiblePaths = [
    caName,
    caName && path.join(wpPath, caName),
    caName && path.join(wpPath, 'src', caName),
    caName && path.join(wpPath, caName + ".js"),
    caName && path.join(wpPath, 'src', caName + ".js"),
    caName && path.join(wpPath, caName + ".ts"),
    caName && path.join(wpPath, 'src', caName + ".ts"),
    ...TYPE_FOLDERS.map(f => caName && path.join(wpPath, 'src', f, caName)),
    ...TYPE_FOLDERS.map(f => caName && path.join(wpPath, 'src', f, caName + ".js")),
    ...TYPE_FOLDERS.map(f => caName && path.join(wpPath, 'src', f, caName + ".ts")),
  ];

  for (const p of posiblePaths) {
    if (!p) continue;
    if (await exists(p)) {
      const stat = await util.promisify(fs.stat)(p);
      if (stat.isFile()) return p;
    }
  }
  return null;
}

const getCaByNameOrPath = async (wpPath, cas, caName) => {
  if (!caName) return
  if (path.isAbsolute(caName)) {
    return cas.find(ca => path.relative(path.join(wpPath, ca.filename), caName) === '');
  }

  const byName = cas.find(ca => ca.name === caName);
  if (byName) {
    return byName;
  }

  const byPath = cas.find(ca => path.relative(path.join(wpPath, ca.filename), path.join(wpPath, caName)) === '');
  if (byPath) {
    return byPath;
  }

  const byFileName = cas.find(ca => {
    const base = path.basename(ca.filename || '');
    return ca.filename === caName
      || base === caName
      || base === caName + ".js"
      || base === caName + ".ts";
  });
  if (byFileName) {
    return byFileName;
  }

  const nonAdded = await getCaPath(wpPath, caName);
  if (nonAdded) {
    const relative = path.relative(wpPath, nonAdded).split(path.sep).join('/');
    return { filename: relative }
  }
  throw new Error(`'${caName}' not found`);
}

const getLocalStatus = async (wpPath, ca) => {
  if (!ca.filename) {
    return {
      p: null, t: null, f: null, u: null, n: null, id: ca.id, fn: null, d: null, g: null
    }; // noLocal
  }

  const cachedRel = ca.filename;
  let actualRel = cachedRel;
  let filePath = path.join(wpPath, cachedRel);
  let existFile = await exists(filePath);

  if (!existFile) {
    const basename = extractBasename(cachedRel);
    const typeFolder = ca.type ? getTypeFolder(ca.type) : null;
    const searchRoot = typeFolder
      ? path.join(wpPath, 'src', typeFolder)
      : wpPath;
    const searchRel = typeFolder ? `src/${typeFolder}` : '';
    const matches = await findFileByBasename(searchRoot, basename);
    if (matches.length === 1) {
      actualRel = (searchRel ? `${searchRel}/` : '') + matches[0];
      filePath = path.join(wpPath, actualRel);
      existFile = true;
    } else if (matches.length > 1) {
      console.log(chalk.yellow(`WARNING: multiple files match basename '${basename}' under ${searchRoot}; keeping cached path for '${ca.name}'`));
    }
  }

  const f = existFile ? await readFile(filePath, 'UTF-8') : null;
  if (f && f.search(/(^<<<<<<<|^========|^>>>>>>>)/gm) !== -1) {
    throw new Error(`The file ${filePath} has unresolved merge conflicts`);
  }
  const p = ca.publishedCode != null ? ca.publishedCode : null;
  const u = ca.unPublishedCode != null ? ca.unPublishedCode : null;
  const n = ca.name != null ? ca.name : null;
  const t = ca.type != null ? ca.type : null;
  const id = ca.id != null ? ca.id : null;
  const d = ca.folder != null ? ca.folder : '';
  const g = existFile ? extractFolderFromFilename(actualRel, ca.type) : null;
  return { p, t, f, u, n, id, fn: actualRel, d, g };
}

const NO_REMOTE = { P: null, U: null, N: null, T: null, D: null }
const getRemoteStatus = async (token, id) => {
  if (!id) return NO_REMOTE;
  try {
    const caResp = await getCa(token, id);
    const { name, type, publishedCode, unPublishedCode, folder } = JSON.parse(caResp.body);
    return {
      N: name,
      T: type,
      P: publishedCode,
      U: unPublishedCode != null ? unPublishedCode : null,
      D: folder != null ? folder : '',
    }
  } catch (e) {
    // will asume is deleted ... FIX !
    console.error(e)
    return NO_REMOTE;
  }
}

const findRemoteStatus = (remotesCas, id) => {
  if (!id) return NO_REMOTE;
  const caResp = remotesCas.find(rca => rca.id === id);
  if (!caResp) {
    return NO_REMOTE;
  }
  const { name, type, publishedCode, unPublishedCode, folder } = caResp;
  return {
    N: name,
    T: type,
    P: publishedCode,
    U: unPublishedCode != null ? unPublishedCode : null,
    D: folder != null ? folder : '',
  }
}

const getStatusData = async (wpPath, ca, remoteOrToken) => {
  const localStatus = await getLocalStatus(wpPath, ca);
  const remoteStatus = typeof remoteOrToken === 'string'
    ? await getRemoteStatus(remoteOrToken, ca.id)
    : Array.isArray(remoteOrToken)
    ? findRemoteStatus(remoteOrToken, ca.id)
    : {};
  return { ...remoteStatus, ...localStatus };
}

const getChangeByCode = (code, status) => {
  if (typeof code !== "string" || code.length !== 2) {
    throw new Error("Invalid diff code. Must be 2 caracters");
  }
  const posibleChange = posibleChanges.find(p => p.short === code);
  if (!posibleChange) {
    return [status[code[0]], status[code[1]]];
  }
  return posibleChange.diff(status);
}

const showChanges = (changes, ca) => {
  if (!ca) {
    changes.forEach(ch => {
      console.log(` * [${chalk[ch.color](ch.short)}] ${ch.label}`);
    });
  } else {
    const changesDesc = changes.map(ch => chalk[ch.color](ch.short)).join(' ');
    const caName = typeof ca === 'string' ? ca : ca.n || ca.N
    const caFileName = ca.fn
    const caDesc = caFileName ? `${chalk.italic(caFileName)} ${caName ? chalk.gray(caName) : ''}` : caName;
    console.log(`${changesDesc}: ${caDesc}`);
  }
}

const getChangesFromStatus = (status, changesTypes = posibleChanges) => {
  return changesTypes.filter(p => p && processCode(p.code, status));
}

const getSingleStatusChanges = async (pwd, caName) => {
  const wpPath = await getWorkspacePath(pwd)
  const { token, cas } = await getBmc(wpPath);
  const matchedCa = await getCaByNameOrPath(wpPath, cas, caName);
  if (!matchedCa){

  }
  const status = await getStatusData(wpPath, matchedCa, token);
  const changes = getChangesFromStatus(status)
  return { changes, status };
}

async function* getStatusChanges(pwd) {
  const wpPath = await getWorkspacePath(pwd)
  const { token, cas } = await getBmc(wpPath);
  const remoteCasRes = await getAllCas(token);
  const remoteCas = JSON.parse(remoteCasRes.body);
  const newCas = remoteCas.filter(rca => cas.every(lca => lca.id !== rca.id));
  const allLocalFiles = [];
  for await (const f of walkAllLocalCaFiles(wpPath, cas)) {
    allLocalFiles.push(f);
  }
  const newLocalCasFiles = allLocalFiles.filter(filename => cas.every(lca => lca.filename !== filename));
  const newLocalCas = newLocalCasFiles.map(filename => ({ filename }))
  const allCas = [...cas, ...newCas, ...newLocalCas].sort((ca1, ca2) => {
    const c1 = ca1.name || ca1.filename;
    const c2 = ca2.name || ca2.filename;
    return c1.localeCompare(c2);
  });
  for (let ca of allCas) {
    const status = await getStatusData(wpPath, ca, remoteCas);
    const changes = getChangesFromStatus(status);
    yield { changes, status }
  }
}

const getStatus = async (pwd, caName) => {
  if (caName) {
    const statusChanges = await getSingleStatusChanges(pwd, caName);
    const ca = statusChanges.status
    const caDesc = typeof ca === 'string' ? ca : `${chalk.italic(ca.fn)} ${ca.n ? chalk.gray(ca.n) : ''}`;
    console.log(caDesc + '\n');
    showChanges(statusChanges.changes);
  } else {
    const statusChanges = getStatusChanges(pwd, caName);
    const changesSet = new Set();
    for await (let statusChange of statusChanges) {
      if (
        statusChange.changes.length === 0
      ) {
        continue;
      }
      showChanges(statusChange.changes, statusChange.status);
      statusChange.changes.forEach((c) => changesSet.add(c))
    };
    console.log("\nDescription:");
    showChanges([...changesSet]);
  }
};

getStatus.ChangeType = ChangeType;
getStatus.getSingleStatusChanges = getSingleStatusChanges;
getStatus.getStatusChanges = getStatusChanges;
getStatus.getSigleStatus = getStatusData;
getStatus.getChangeByCode = getChangeByCode;
getStatus.getChangesFromStatus = getChangesFromStatus;
getStatus.getLocalStatus = getLocalStatus;
getStatus.getCaByNameOrPath = getCaByNameOrPath;

module.exports = getStatus;

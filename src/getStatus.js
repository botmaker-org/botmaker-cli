const path = require('path');
const util = require('util');
const fs = require('fs');
const chalk = require('chalk');

const { getAllCas, getCa } = require('./bmService')
const { getBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');

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

Remote = UPPERCASE -> P U   N T
Local = lowercase  -> p u f n t

[X] = Nothing
[!] = Not ... [!X] = Something
[space] = and
[array] = or
*/
const posibleChanges = Object.values(ChangeType);

const getCaPath = async (wpPath, caName) => {
  const posiblePaths = [
    caName,
    caName && path.join(wpPath, caName),
    caName && path.join(wpPath, 'src', caName),
    caName && path.join(wpPath, caName + ".js"),
    caName && path.join(wpPath, 'src', caName + ".js"),
  ];

  for (const path of posiblePaths) {
    if (!path) continue;
    if (await exists(path)) {
      return path;
    }
  }
  return null;
}

const getCaByNameOrPath = async (wpPath, cas, caName) => {
  if (!caName) return
  if (path.isAbsolute(caName)) {
    return cas.find(ca => path.relative(path.join(wpPath, 'src', ca.filename), caName) === '');
  }
  
  const byName = cas.find(ca => ca.name === caName);
  if (byName) {
    return byName;
  }

  const byPath = cas.find(ca => path.relative(path.join(wpPath, 'src', ca.filename), path.join(wpPath, 'src', caName)) === '');
  if (byPath) {
    return byPath;
  }

  const byFileName = cas.find(ca => ca.filename === caName || ca.filename === caName + ".js");
  if (byFileName) {
    return byFileName;
  }

  const nonAdded = await getCaPath(wpPath,caName);
  if(nonAdded){
    return {filename: path.basename(nonAdded)}
  }
  throw new Error(`'${caName}' not found`);
}

const getLocalStatus = async (wpPath, ca) => {
  if (!ca.filename) {
    return {
      p: null, t: null, f: null, u: null, n: null, id: ca.id, fn : null
    }; // noLocal
  }
  const filePath = ca.filename && path.join(wpPath,'src',ca.filename);
  const existFile = filePath && await exists(filePath);
  const f = existFile ? await readFile(filePath, 'UTF-8') : null;
  if (f && f.search(/(^<<<<<<<|^========|^>>>>>>>)/gm) !== -1){
    throw new Error(`The file ${filePath} has unresolved merge conflicts`);
  }
  const p = ca ? ca.publishedCode : null;
  const u = ca && ca.unPublishedCode != null ? ca.unPublishedCode : null;
  const n = ca ? ca.name : null;
  const t = ca ? ca.type : null;
  const id = ca ? ca.id : null;
  const fn = ca ? ca.filename : null;
  return { p, t, f, u, n, id, fn};
}

const NO_REMOTE = { P: null, U: null, N: null, T: null }
const getRemoteStatus = async (token, id) => {
  if (!id) return NO_REMOTE;
  try {
    const caResp = await getCa(token, id);
    const { name, type, publishedCode, unPublishedCode } = JSON.parse(caResp.body);
    return { N: name, T: type, P: publishedCode, U: unPublishedCode != null ? unPublishedCode : null }
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
  const { name, type, publishedCode, unPublishedCode } = caResp;
  return { N: name, T: type, P: publishedCode, U: unPublishedCode != null ? unPublishedCode : null }
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
  const localCas = await readdir(path.join(wpPath, 'src'));
  const newLocalCasFiles = localCas.map((ca) => path.basename(ca)).filter(filename => cas.every(lca => lca.filename !== filename));
  const newLocalCas = newLocalCasFiles.map(filename => ({filename}))
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
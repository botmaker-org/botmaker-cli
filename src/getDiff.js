const { getBmc } = require("./bmcConfig");
const getStatus = require("./getStatus");
const getWorkspacePath = require("./getWorkspacePath");
const diff = require("diff");
const chalk = require('chalk');
const path = require('path');
const util = require('util');
const fs = require('fs');
const os = require('os');
const utils = require("./utils");
const exec = require('child_process').exec;
const Diff3 = require('node-diff3'); 
const { EOL } = require('os');

const mkdtemp = util.promisify(fs.mkdtemp);
const writeFile = util.promisify(fs.writeFile);
const chmod = util.promisify(fs.chmod);

const lineCounter = (text) => {
  let count = 1, pos = 0;
  while (true) {
    pos = text.indexOf('\n', pos);
    if (pos >= 0) {
      ++count;
      pos += 1;
    } else return count;
  }
}

const openChanges = async (compare, state, caName) => {
  if (!compare) {
    console.log("No changes");
    return;
  }
  const tmpFileId1    = utils.makeid(5);
  const tmpFileId2    = utils.makeid(5);
  const tmpFileName   = state.N || state.n || caName || 'unknow';
  const tmpFolderPath = await mkdtemp(path.join(os.tmpdir(), 'bm-cli'));
  const tmpFilePaht1  = path.join(tmpFolderPath, `${tmpFileName}_${tmpFileId1}.js`);
  const tmpFilePaht2  = path.join(tmpFolderPath, `${tmpFileName}_${tmpFileId2}.js`);
  
  await writeFile(tmpFilePaht1,compare[0] || "",'UTF-8');
  await writeFile(tmpFilePaht2,compare[1] || "",'UTF-8');
  await chmod(tmpFilePaht1,0o444); // Read only
  await chmod(tmpFilePaht2,0o444); // Read only
  exec(`code -d "${tmpFilePaht1}" "${tmpFilePaht2}"`);
}

const getMerge = (local, original, remote) => {
  const merger = Diff3.diff3Merge(
    local.split(/\r?\n/),
    original.split(/\r?\n/),
    remote.split(/\r?\n/),
    {    excludeFalseConflicts: false }
  );
  let conflict = false;
  let lines = [];
  for (let i = 0; i < merger.length; i++) {
    const item = merger[i];
    if (item.ok) {
      lines = lines.concat(item.ok);
    } else {
      conflict = true;
      lines = lines.concat(
        ['<<<<<<<'],
        item.conflict.a,
        ['======='],
        item.conflict.b,
        ['>>>>>>>'],
      );
    }
  }
  return {
    conflict: conflict,
    result: lines.join(EOL)
  };
}

const showChanges = (compare) => {
  if (!compare) {
    return;
  }
  const f1 = compare[0] || "";
  const f2 = compare[1] || "";
  if(f1 === f2) {
    console.log(chalk.green('They are equals.'));
    return;
  }
  const maxLines = Math.max(lineCounter(f1), lineCounter(f2));
  const pad = maxLines.toString().length;
  const withPad = (text) => text.toString().padStart(pad);
  const diferences = diff.diffLines(f1, f2);
  let aLineCount = 1, bLineCount = 1;
  diferences.forEach((p, pi) => {
    const lines = p.value.split(/\r?\n/);
    const firstPart = pi === 0;
    const lastPart = pi === diferences.length - 1;
    if (!lastPart && lines[lines.length - 1] === "") {
      lines.pop();
    }
    if (p.added) {
      lines.forEach((l, i) => console.log(chalk.green(` ${withPad(aLineCount + i)} ${withPad('+')} | ${l}`)))
      aLineCount += lines.length;
    } else if (p.removed) {
      lines.forEach((l, i) => console.log(chalk.red(` ${withPad('-')} ${withPad(bLineCount + i)} | ${l}`)))
      bLineCount += lines.length;
    } else {
      if (lines.length > 4) {
        if (!firstPart) {
          lines.slice(0, 2).forEach((l, i) => console.log(chalk.grey(` ${withPad(aLineCount + i)} ${withPad(bLineCount + i)} | ${l}`)));
        }
        console.log(chalk.grey('...'));
        if (!lastPart) {
          const from = lines.length - 2;
          lines.slice(from, from + 2).forEach((l, i) => console.log(chalk.grey(` ${withPad(aLineCount + from + i)} ${withPad(bLineCount + from + i)} | ${l}`)));
        }
      } else {
        lines.forEach((l, i) => console.log(chalk.grey(` ${withPad(aLineCount + i)} ${withPad(bLineCount + i)} | ${l}`)))
      }
      aLineCount += lines.length;
      bLineCount += lines.length;
    }
  })
}

const getDiff = async (pwd, caName, code, vsCode = false) => {
  const wpPath = await getWorkspacePath(pwd)
  const { token, cas } = await getBmc(wpPath);
  const ca = await getStatus.getCaByNameOrPath(wpPath, cas,caName);
  const status = await getStatus.getSigleStatus(wpPath, ca, token);
  const changes = getStatus.getChangeByCode(code, status);
  if (!vsCode) {
    showChanges(changes);
  } else {
    openChanges(changes, status, caName);
  }

}
getDiff.getMerge = getMerge;

module.exports = getDiff;
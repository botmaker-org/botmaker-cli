const getStatus = require("./getStatus");
const path = require('path');
const util = require('util');
const fs = require('fs');
const chalk = require('chalk');

const { getBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const getDiff = require("./getDiff");
const importWorkspace = require("./importWorkspace");

const writeFile = util.promisify(fs.writeFile);
const rm = util.promisify(fs.unlink);

const makeChanges = async (wpPath, cas, status, changes) => {
  const notAdded = changes.includes(getStatus.ChangeType.NOT_ADDED);
  const hasLocalChanges = changes.includes(getStatus.ChangeType.LOCAL_CHANGES);
  const hasIncomingChanges = changes.includes(getStatus.ChangeType.INCOMING_CHANGES);
  const wasAdded = changes.includes(getStatus.ChangeType.NEW_CA);
  const removeLocal = changes.includes(getStatus.ChangeType.REMOVE_LOCAL);
  const removeRemote = changes.includes(getStatus.ChangeType.REMOVE_REMOTE);

  if (notAdded) {
    return cas;
  }
  if (removeLocal && hasIncomingChanges) {
    console.log(chalk.bgRed(`WARNING: ${status.name} has incoming changes but was deleted locally`))
    return cas;
  }
  if (hasLocalChanges && removeRemote) {
    console.log(chalk.bgRed(`WARNING: ${path.join(wpPath, 'src', status.fn)} has local changes but was deleted remotly.`));
    return cas;
  }

  if (removeRemote) {
    console.log(chalk.red(`${path.join(wpPath, 'src', status.fn)} was deleted`));
    await rm(path.join(wpPath, 'src', status.fn))
    return cas.filter(ca => ca.id !== status.id);

  } else if (hasLocalChanges && hasIncomingChanges) {
    const remote = status.U || status.P;
    const original = status.u || status.p;
    const local = status.f;
    const { conflict, result } = getDiff.getMerge(local, original, remote);
    if (conflict) {
      console.log(chalk.bgRed(`WARNING: ${path.join(wpPath, 'src', status.fn)} has merge conflicts`));
    } else {
      console.log(chalk.yellow(`WARNING: ${path.join(wpPath, 'src', status.fn)} was merged automatically`));
    }
    await writeFile(path.join(wpPath, 'src', status.fn), result, 'UTF-8');
  } else if (hasIncomingChanges) {
    const newVersion = status.U || status.P;

    if (status.fn) {
      console.log(chalk.green(`${path.join(wpPath, 'src', status.fn)} has changes`));
      await writeFile(path.join(wpPath, 'src', status.fn), newVersion, 'UTF-8');
    } else {
      // new File
      const baseName = importWorkspace.formatName(status.N);
      const newFileName = await importWorkspace.getName(path.join(wpPath, 'src'), baseName, 'js');

      await writeFile(path.join(wpPath, 'src', newFileName), newVersion, 'UTF-8');
      status.fn = newFileName;
      console.log(chalk.green(`${path.join(wpPath, 'src', status.fn)} was added`));
    }
  } else if (wasAdded) {
    const newVersion = status.U || status.P;
    // new File
    const baseName = importWorkspace.formatName(status.N);
    const newFileName = await importWorkspace.getName(path.join(wpPath, 'src'), baseName, 'js');

    await writeFile(path.join(wpPath, 'src', newFileName), newVersion, 'UTF-8');
    console.log(chalk.green(`${path.join(wpPath, 'src', newFileName)} was added`));
    return cas.concat({
      publishedCode: status.P,
      unPublishedCode: status.U,
      name: status.N,
      type: status.T,
      id: status.id,
      filename: newFileName,
    })
  }

  return cas.map(ca => ca.id !== status.id ? ca : {
    publishedCode: status.P,
    unPublishedCode: status.U,
    name: status.N,
    type: status.T,
    id: status.id,
    filename: status.fn,
  });
}

const hasMerge = (changes) => {
  const hasLocalChanges = changes.includes(getStatus.ChangeType.LOCAL_CHANGES);
  const hasIncomingChanges = changes.includes(getStatus.ChangeType.INCOMING_CHANGES);
  return hasLocalChanges && hasIncomingChanges;
}

const singlePull = async (pwd, caName) => {
  const wpPath = await getWorkspacePath(pwd)
  const { token, cas } = await getBmc(wpPath);
  const { changes, status } = await getStatus.getSingleStatusChanges(pwd, caName);
  const newCas = await makeChanges(wpPath, cas, status, changes);
  if(newCas === cas) {
    console.log(chalk.green('Already up to date. :)'));
    return false;
  }
  await writeFile(path.join(wpPath, '.bmc'), JSON.stringify({ token, cas: newCas }), 'UTF-8');
  return hasMerge(changes);
}

const completePull = async (pwd) => {
  const wpPath = await getWorkspacePath(pwd)
  const { token, cas } = await getBmc(wpPath);
  const changesGenerator = getStatus.getStatusChanges(pwd);
  let newCas = cas;
  let withMerges = false;
  for await (let statucChanges of changesGenerator) {
    const { status, changes } = statucChanges;
    newCas = await makeChanges(wpPath, newCas, status, changes);
    withMerges = withMerges || hasMerge(changes);
  }
  if(newCas === cas) {
    console.log(chalk.green('Already up to date. :)'));
    return false;
  }
  await writeFile(path.join(wpPath, '.bmc'), JSON.stringify({ token, cas: newCas }), 'UTF-8');
  return withMerges;
}

const pull = async (pwd, caName) => {
  if (caName) {
    return await singlePull(pwd, caName);
  } else {
    return await completePull(pwd);
  }
};

module.exports = pull;
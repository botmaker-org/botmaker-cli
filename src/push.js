const getStatus = require("./getStatus");
const path = require('path');
const util = require('util');
const fs = require('fs');

const { getBmc, saveBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const { updateCas } = require("./bmService");
const chalk = require("chalk");

const {ChangeType} = getStatus;
const maxLength = 100000;

const checkClientActionLength = (text, caName) => {
  if (text.length > maxLength) {
    console.log(chalk.red(`The code action ${caName} is too big. The maximum size is 100000 characters.`));
    throw new Error(`Error trying to push changes in ${caName}`);
  }
}

const getPushChanges = (status, changes) => {
  const hasLocalChanges = changes.includes(getStatus.ChangeType.LOCAL_CHANGES);
  if (!hasLocalChanges) {
    return;
  }

  return {
    id: status.id,
    unPublishedCode: status.f
  }
}

const applyPush = async (token,changes) => {
  await updateCas(token,changes)
}

const hasIncomingChanges = (changes) => {
  return changes.some(c => 
    c === ChangeType.INCOMING_CHANGES 
    || c === ChangeType.REMOVE_REMOTE
    || c === ChangeType.NEW_CA
    || c === ChangeType.RENAMED
    || c === ChangeType.TYPE_CHANGED
  );
}

const singlePush = async (pwd, caName) => {
  const wpPath = await getWorkspacePath(pwd)
  const { changes, status } = await getStatus.getSingleStatusChanges(pwd, caName);
  if (hasIncomingChanges(changes)){
    throw new Error('There is incoming changes. You must make a pull first.');
  }
  const pushChanges = getPushChanges(status, changes);
  if (!pushChanges) {
    console.log(chalk.green('Nothing to push!. No local changes found.'))
    return;
  }
  checkClientActionLength(pushChanges.unPublishedCode, caName);
  const { token, cas } = await getBmc(wpPath);
  await applyPush(token,[pushChanges]);
  const newCas = cas.map( ca =>
    pushChanges.id === ca.id ? {...ca, unPublishedCode: pushChanges.unPublishedCode} : ca
  );
  await saveBmc(wpPath,token,newCas);
}

const completePush = async (pwd) => {
  const wpPath = await getWorkspacePath(pwd)
  const { token, cas } = await getBmc(wpPath);
  const changesGenerator = getStatus.getStatusChanges(pwd);
  let toPush = [];
  for await (let statucChanges of changesGenerator) {
    const { status, changes } = statucChanges;
    if (hasIncomingChanges(changes)){
      throw new Error('There is incoming changes you must make an pull first.');
    }
    const pushChanges = getPushChanges(status, changes);    
    if (pushChanges) {
      checkClientActionLength(pushChanges.unPublishedCode, status.n);
      toPush.push(pushChanges);
    }
  }
  if(toPush.length === 0){
    console.log(chalk.green('Nothing to push!. No local changes found.'))
    return;
  }
  console.log(chalk.yellow('Uploading changes for:'));
  toPush.forEach( update => {
    const ca = cas.find(c => c.id === update.id);
    console.log(chalk.yellow(` * ${chalk.italic(ca.filename)} `) + chalk.grey(ca.name))
  })
  await applyPush(token,toPush);
  const newCas = cas.map( ca => {
    const updated = toPush.find( cap => cap.id === ca.id);
    return updated ? {...ca, unPublishedCode: updated.unPublishedCode} : ca;
  });
  await saveBmc(wpPath,token,newCas);
}

const push = async (pwd, caName) => {
  if (caName) {
    await singlePush(pwd, caName);
  } else {
    await completePush(pwd);
  }
};

module.exports = push;
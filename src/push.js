const getStatus = require("./getStatus");
const path = require('path');
const util = require('util');
const fs = require('fs');

const { getBmc, saveBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const { updateCas } = require("./bmService");
const chalk = require("chalk");
const publish = require('./publish');

const {ChangeType} = getStatus;
const maxLength = 100000;

const checkClientActionLength = (text, caName) => {
  if (text.length > maxLength) {
    console.log(chalk.red(`The code action ${caName} is too big. The maximum size is 100000 characters.`));
    throw new Error(`Error trying to push changes in ${caName}`);
  }
}

const getPushChanges = (status, changes) => {
  const hasLocalCode = changes.includes(ChangeType.LOCAL_CHANGES);
  if (!hasLocalCode) {
    return;
  }

  const payload = { id: status.id };
  if (hasLocalCode) payload.unPublishedCode = status.f;
  return { payload, fn: status.fn };
}

const applyPush = async (token, payloads) => {
  await updateCas(token, payloads);
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

const applyToCas = (cas, updates) => cas.map(ca => {
  const u = updates.find(x => x.payload.id === ca.id);
  if (!u) return ca;
  const next = { ...ca };
  if (u.payload.unPublishedCode !== undefined) next.unPublishedCode = u.payload.unPublishedCode;
  return next;
});

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
  if (pushChanges.payload.unPublishedCode !== undefined) {
    checkClientActionLength(pushChanges.payload.unPublishedCode, caName);
  }
  const { token, cas } = await getBmc(wpPath);
  await applyPush(token, [pushChanges.payload]);
  const newCas = applyToCas(cas, [pushChanges]);
  await saveBmc(wpPath, token, newCas);
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
      if (pushChanges.payload.unPublishedCode !== undefined) {
        checkClientActionLength(pushChanges.payload.unPublishedCode, status.n);
      }
      toPush.push(pushChanges);
    }
  }
  if(toPush.length === 0){
    console.log(chalk.green('Nothing to push!. No local changes found.'))
    return;
  }
  console.log(chalk.yellow('Uploading changes for:'));
  toPush.forEach(update => {
    const ca = cas.find(c => c.id === update.payload.id);
    const tags = [];
    if (update.payload.unPublishedCode !== undefined) tags.push('code');
    console.log(chalk.yellow(` * ${chalk.italic(update.fn)} `) + chalk.grey(`${ca.name} [${tags.join(', ')}]`))
  })
  await applyPush(token, toPush.map(t => t.payload));
  const newCas = applyToCas(cas, toPush);
  await saveBmc(wpPath, token, newCas);
}

const push = async (pwd, caName, forPublish) => {
  if (caName) {
    await singlePush(pwd, caName);
  } else {
    await completePush(pwd);
  }
  if(forPublish == "TRUE") {
    await publish(pwd, caName);
  }
};

module.exports = push;

const getStatus = require("./getStatus");

const { getBmc, saveBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const { publishCa } = require("./bmService");
const chalk = require("chalk");

const {ChangeType} = getStatus;

const hasIncomingChanges = (changes) => {
  return changes.some(c => 
    c === ChangeType.INCOMING_CHANGES 
    || c === ChangeType.REMOVE_REMOTE
    || c === ChangeType.NEW_CA
    || c === ChangeType.RENAMED
    || c === ChangeType.TYPE_CHANGED
  );
}

const hasLocalChanges = (changes) => {
  return changes.some(c => 
    c === ChangeType.LOCAL_CHANGES 
  );
}

const isUnpublish = (changes) => {
  return changes.some(c => 
    c === ChangeType.UNPUBLISHED 
  );
}

const publish = async (pwd, caName) => {
  const wpPath = await getWorkspacePath(pwd)
  const { changes, status } = await getStatus.getSingleStatusChanges(pwd, caName);

  if (hasIncomingChanges(changes)){
    throw new Error('There is incoming changes. You must make a pull first.');
  }
  if (hasLocalChanges(changes)){
    throw new Error('There is local changes. You must make a push first.');
  }
  if (!isUnpublish(changes)){
    console.log(chalk.green('Nothing to publish!'))
    return;
  }
  
  const { token, cas } = await getBmc(wpPath);
  await publishCa(token, status.id);
  const newCas = cas.map( ca =>
    status.id === ca.id ? {...ca, publishedCode: ca.unPublishedCode, unPublishedCode: null} : ca
  );
  await saveBmc(wpPath,token,newCas);
}

module.exports = publish;
const util = require('util');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const getStatus = require("./getStatus");
const {ChangeType} = getStatus;
const { getBmc, saveBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const { updateCas } = require("./bmService");
const { getCaByNameOrPath } = require('./getStatus');
const importWorkspace = require("./importWorkspace");

const renameFile = util.promisify(fs.rename);

const hasIncomingChanges = (changes) => {
  return changes.some(c => 
    c === ChangeType.INCOMING_CHANGES 
    || c === ChangeType.REMOVE_REMOTE
    || c === ChangeType.NEW_CA
    || c === ChangeType.RENAMED
    || c === ChangeType.TYPE_CHANGED
  );
}


const rename = async (pwd, caName, newName) => {
  const wpPath = await getWorkspacePath(pwd);
  const { changes, status } = await getStatus.getSingleStatusChanges(pwd, caName);
  if (hasIncomingChanges(changes)){
    throw new Error('There is incoming changes. You must make a pull first.');
  }
  if (!newName || caName == newName) {
    console.log(chalk.green('You need to provide a new name por the client action.'))
    return;
  }
  const { token, cas } = await getBmc(wpPath);
  const codeAction = await getCaByNameOrPath(wpPath, cas, caName);
  if (!codeAction || !codeAction.id) {
    throw new Error('The client action was not uploaded.');
  }
  const toUpdate = [{id:codeAction.id, name : newName}];
  await updateCas(token,toUpdate);
  const baseName = importWorkspace.formatName(newName);
  const newFileName = await importWorkspace.getName(path.join(wpPath, 'src'), baseName, 'js');
  await renameFile(path.join(wpPath, 'src', codeAction.filename), path.join(wpPath, 'src', newFileName));
  console.log(chalk.green(`Changed ${caName} name to ${newName}.`))
  const newCas = cas.map( ca =>
    codeAction.id === ca.id ? {...ca, name: newName, filename: newFileName} : ca
  );
  await saveBmc(wpPath,token,newCas);
};

module.exports = rename;
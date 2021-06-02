const util = require('util');
const fs = require('fs');
const chalk = require('chalk');

const { getBmc, saveBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const { updateCas } = require("./bmService");
const { getCaByNameOrPath } = require('./getStatus');

const rename = async (pwd, caName, newName) => {
  const wpPath = getWorkspacePath(pwd);
  const { token, cas } = await getBmc(wpPath);
  const ca = getCaByNameOrPath(wpPath, cas, caName);
  if (!ca || !ca.id) {
    throw new Error('The client actions was not uploaded.');
  }
  const toUpdate = [{id:ca.id, name : newName}];
  await updateCas(token,toUpdate);
  const newCas = cas.map( ca =>
    pushChanges.id === ca.id ? {...ca, unPublishedCode: pushChanges.unPublishedCode} : ca
  );
  await saveBmc(wpPath,token,newCas);
};

module.exports = rename;
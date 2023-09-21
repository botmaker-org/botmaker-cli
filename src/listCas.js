const chalk = require('chalk');
const { getBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');

const ENDPOINT_TAG = `${chalk.magenta(`En`)}:`;
const USER_TAG = `${chalk.cyan(`Us`)}:`;
const getCodeActionTypeTag = (ca) => {
  if(ca.type == "ENDPOINT") {
    return ENDPOINT_TAG
  } else {
    return USER_TAG
  }
}

const listCas = async (pwd) => {
  const wpPath = await getWorkspacePath(pwd);
  const { cas } = await getBmc(wpPath);
  cas.forEach(ca => {
    console.log(`${getCodeActionTypeTag(ca)} ${chalk.green(ca.name)} ${chalk.gray(chalk.italic(ca.filename))}`);
  });
  console.log(`
Description: 
* ${USER_TAG} User type code action
* ${ENDPOINT_TAG} Endpoint type code action`)
  // console.table(cas.reduce((acc, ca) => ({...acc, [ca.name]:{file: ca.filename, type: ca.type}}), {}));
};

module.exports = listCas;
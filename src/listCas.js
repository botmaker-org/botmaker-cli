const chalk = require('chalk');
const { getBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const CaType = require('./caTypes');

const ENDPOINT_TAG = `${chalk.magenta(`En`)}:`;
const USER_TAG = `${chalk.cyan(`Us`)}:`;
const AI_FUNCTION_TAG = `${chalk.yellow(`Ai`)}:`;

const TYPE_TAG = {
  [CaType.ENDPOINT]: ENDPOINT_TAG,
  [CaType.USER]: USER_TAG,
  [CaType.AI_FUNCTION]: AI_FUNCTION_TAG,
};

const getCodeActionTypeTag = (ca) => TYPE_TAG[ca.type] ?? USER_TAG;

const listCas = async (pwd) => {
  const wpPath = await getWorkspacePath(pwd);
  const { cas } = await getBmc(wpPath);
  cas.forEach(ca => {
    console.log(`${getCodeActionTypeTag(ca)} ${chalk.green(ca.name)} ${chalk.gray(chalk.italic(ca.filename))}`);
  });
  console.log(`
Description:
* ${USER_TAG} User type code action
* ${ENDPOINT_TAG} Endpoint type code action
* ${AI_FUNCTION_TAG} AI Function type code action`);
};

module.exports = listCas;

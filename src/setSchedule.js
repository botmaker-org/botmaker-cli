const chalk = require('chalk');
const { isValidCron } = require('cron-validator');
const { getBmc, saveBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const { updateCas } = require('./bmService');
const { getCaByNameOrPath } = require('./getStatus');
const CaType = require('./caTypes');

const setSchedule = async (pwd, caName, cronString) => {
  if (!isValidCron(cronString, { seconds: false })) {
    throw new Error(`Invalid cron expression: "${cronString}". Expected a valid 5-field cron string (e.g. "0 * * * *").`);
  }

  const wpPath = await getWorkspacePath(pwd);
  const { token, cas } = await getBmc(wpPath);
  const codeAction = await getCaByNameOrPath(wpPath, cas, caName);

  if (!codeAction || !codeAction.id) {
    throw new Error('The client action was not uploaded.');
  }

  if (codeAction.type !== CaType.SCHEDULE) {
    throw new Error(`'${caName}' is not a SCHEDULE type client action.`);
  }

  await updateCas(token, [{ id: codeAction.id, schedule: cronString }]);

  const newCas = cas.map(ca =>
    ca.id === codeAction.id ? { ...ca, schedule: cronString } : ca
  );
  await saveBmc(wpPath, token, newCas);

  console.log(chalk.green(`Changed schedule for '${caName}' to: ${cronString}`));
};

module.exports = setSchedule;

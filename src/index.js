const getDiff = require('./getDiff');
const newCa = require('./newCa');
const pull = require('./pull');
const push = require('./push');
const yargs = require('yargs/yargs');
const run = require('./run');
const importWorkspace = require('./importWorkspace');
const setCustomer = require('./setCustomer');
const getStatus = require('./getStatus');
const publish = require('./publish');
const rename = require('./rename');
const reset = require('./reset');
const listCas = require('./listCas');
const CaType = require('./caTypes');
const migrate = require('./migrate');
const setSchedule = require('./setSchedule');

const main = async (args) => {
  const pwd = process.cwd();
  const arrgs = yargs(args)
    .scriptName('bmc')
    .usage('Usage: $0 <command> [options]')
    .command(
      ['run <source>', 'r'],
      'Run a Botmaker Client Action Script',
      async (yargs) => yargs
        .option('v', {
          alias: 'var',
          describe: '<varName> <varValue> Set a context variable',
          nargs: 2
        })
        .option('p', {
          alias: 'param',
          describe: '<paramName> <paramValue> Set a param',
          nargs: 2
        })
        .option('volatile', { describe: 'Will not presist the state' })
        .option('endpoint', { describe: 'Force to run as endpoint' })
        .option('port <portNumber>', { describe: 'Change endpoint port number' })
      ,
    )
    .command(
      ['import <apiToken>', 'i'],
      'Import a new bussiness from a token',
    )
    .command(
      ['set-customer <customerId>', 'c'],
      'Load context for a customer',
    )
    .command(
      ['status [caName]', 's'],
      'Show change status',
    )
    .command(
      ['diff <caName> <code>', 'd'],
      'Diff client actions states',
      (yargs) => yargs
        .option('v', {
          alias: 'vs-code',
          describe: 'Open in vs-code',
        })
    )
    .command(
      ['pull [caName]'],
      'Pull incoming changes',
    ).command(
      ['new <caName>', 'n'],
      'Create a new client action',
      (yargs) => yargs
        .option('v', {
          alias: 'vs-code',
          describe: 'Open in vs-code',
        }).option('e', {
          alias: 'endpoint',
          describe: 'Create as endpoint type',
        }).option('a', {
          alias: 'ai-function',
          describe: 'Create as AI function type',
        }).option('S', {
          alias: 'schedule-ca',
          describe: '<cronExpression> Create as Schedule type with cron expression',
          nargs: 1,
        })
    ).command(
      ['push [caName]'],
      'Push changes in client action',
      (yargs) => yargs
        .option('b', {
          alias: 'publish',
          describe: 'Push and publish with a single command',
        })
    ).command(
      ['publish <caName>'],
      'Publish changes in client action'
    ).command(
      ['rename <caName> <newName>'],
      'Renames the given client action'
    )
    .command(
      ['set-schedule <caName> <cronString>'],
      'Set the cron schedule on a SCHEDULE type client action'
    )
    .command(
      ['reset'],
      'Reset local workspace state (chat.json, catalog.json)',
    )
    .command(
      ['migrate'],
      'Migrate workspace from a previous version to the current structure',
    )
    .demandCommand()
    .help('h')
    .alias('h', 'help')
    .version("0.1.8")
    .epilog('copyright Botmaker 2022')
    .argv;

  switch (arrgs._[0]) {
    case "set-customer":
    case "c":
      const { customerId } = arrgs;
      await setCustomer(pwd, customerId);
      break;
    case "diff":
    case "d":
      const { caName: caName1, code, v: vsCode } = arrgs;
      await getDiff(pwd, caName1, code, vsCode);
      break;
    case "import":
    case "i":
      const { apiToken } = arrgs;
      await importWorkspace(pwd, apiToken)
      break;
    case "list":
    case "ls":
      await listCas(pwd)
      break;
    case "new":
    case "n":
      const { caName: caName3, v: vsCode1, e, a, S } = arrgs;
      const typeFlagCount = [e, a, S].filter(Boolean).length;
      if (typeFlagCount > 1) {
        throw new Error('Only one type flag may be specified at a time (-e, -a, -S).');
      }
      const newType = e ? CaType.ENDPOINT
        : a ? CaType.AI_FUNCTION
        : S ? CaType.SCHEDULE
        : CaType.USER;
      await newCa(pwd, caName3, newType, vsCode1, S || null);
      break;
    case "publish":
      const { caName: caName5 } = arrgs;
      await publish(pwd, caName5);
      break;
    case "pull":
      const { caName: caName2 } = arrgs;
      await pull(pwd, caName2);
      break;
    case "push":
      const { caName: caName4, b} = arrgs;
      await push(pwd, caName4, b ? "TRUE" : "FALSE");
      break;
    case "rename":
      const { caName: caName6, newName} = arrgs;
      await rename(pwd, caName6, newName);
      break;
    case "set-schedule":
      const { caName: caName7, cronString } = arrgs;
      await setSchedule(pwd, caName7, cronString);
      break;
    case "reset":
      await reset(pwd);
      break;
    case "migrate":
      await migrate(pwd);
      break;
    case "run":
    case "r":
      const { source, v = [], p = [], volatile = false, endpoint, port } = arrgs;
      await run(pwd, source, { vars: v, params: p, volatile, endpoint, port})
      break;
    case "status":
    case "s":
      const { caName } = arrgs;
      await getStatus(pwd, caName);
      break;
    default:
      console.error(`bmc: '${arrgs._[0]}' is not a bmc command. See 'bmc -h'`)
      process.exit(-1);
  }
}

module.exports = (args) => {
  main(args)
    .catch((e) => console.error(`bmc: ${e.message || e}`))
}

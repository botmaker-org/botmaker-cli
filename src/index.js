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
        })
    ).command(
      ['push [caName]'],
      'Push changes in client action'
    ).command(
      ['publish <caName>'],
      'Publish changes in client action'
    )
    .demandCommand()
    .help('h')
    .alias('h', 'help')
    .version("0.1.3")
    .epilog('copyright Botmaker 2022')
    .argv;

  switch (arrgs._[0]) {
    case "run":
    case "r":
      const { source, v = [], p = [], volatile = false, endpoint, port } = arrgs;
      await run(pwd, source, { vars: v, params: p, volatile, endpoint, port})
      break;
    case "import":
    case "i":
      const { apiToken } = arrgs;
      await importWorkspace(pwd, apiToken)
      break;
    case "status":
    case "s":
      const { caName } = arrgs;
      await getStatus(pwd, caName);
      break;
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
    case "pull":
      const { caName: caName2 } = arrgs;
      await pull(pwd, caName2);
      break;
    case "new":
    case "n":
      const { caName: caName3, v: vsCode1, e } = arrgs;
      await newCa(pwd, caName3, e ? "ENDPOINT" : "USER", vsCode1);
      break;
    case "push":
      const { caName: caName4 } = arrgs;
      await push(pwd, caName4);
      break;
    case "publish":
      const { caName: caName5 } = arrgs;
      await publish(pwd, caName5);
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

const util = require('util');
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const chalk = require('chalk');
const exec = require('child_process').exec;

const CaType = require('./caTypes');
const { getTypeFolder, buildLocalRelPath } = require('./caTypes');
const { getBmc, saveBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const importWorkspace = require("./importWorkspace");
const { createCa } = require("./bmService");
const { isValidCron } = require('cron-validator');

const writeFile = util.promisify(fs.writeFile);

const baseEndPointCa =
`const redis = req.connectRedis();

const main = async () => {
  // TODO my code here
  // const myVal = await redis.getAsync('myKey');
  // return { id : myVal };
};

main()
  .then((body) => {
    res.status(200);
    if(body != null){
      if(typeof body === 'object'){
        res.json(body);
      } else if(typeof body === 'string'){
        res.write(body);
      }
    }
  }).catch((err) => {
    res.status(500);
    res.write(\`<p style="color: red">ERROR!!!<br>\${err.message}</p>\`);
  }).finally(() => {
    res.end();
    redis.quit();
  });
`

const baseCa =
`const IS_TEST = user.get('botmakerEnvironment') === 'DEVELOPMENT';

const main = async () => {
  // TODO your code here
};

main()
  .catch(err => {
    // Code on error
    if (IS_TEST) {
      result.text(\`[ERROR] : \${err.message}\`);
    }
    bmconsole.error(\`[ERROR]: \${err.message}\`);
  })
  .finally( () => {
    // Code on finish
    result.done();
  });
`;

const baseAiFunctionCa =
`/**
 * this function multyply by 2
 *
 * @param myNumber the number to multiply by 2
 *
 * @return the double
 */
export default function double(myNumber: number): number {
    return myNumber * 2;
}
`;

const baseWhatsappFlowCa = fs.readFileSync(
  path.join(__dirname, 'flowSnippets', 'flow_basic_template.ts'),
  'utf8',
);

const baseWebchatFormCa = fs.readFileSync(
  path.join(__dirname, 'formSnippets', 'form_basic_template.ts'),
  'utf8',
);

const baseScheduleCa =
`const main = async () => {
  // TODO your scheduled code here
};

main()
  .catch(err => {
    bmconsole.error(\`[ERROR]: \${err.message}\`);
  })
  .finally(() => {
    result.done();
  });
`;

const createFileAndStatus = async (wpPath, ca, type, openVsCode) => {
  const remoteFolder = ca.folder || '';
  const baseName = importWorkspace.formatName(ca.name);
  const ext = type === CaType.AI_FUNCTION ? 'ts' : 'js';
  const typeFolder = getTypeFolder(type);
  const targetDir = typeFolder
    ? path.join(wpPath, 'src', typeFolder, remoteFolder)
    : path.join(wpPath, remoteFolder);
  await fse.ensureDir(targetDir);
  const basename = await importWorkspace.getName(targetDir, baseName, ext);
  const newFileName = buildLocalRelPath(type, remoteFolder, basename);

  const filePath = path.join(wpPath, newFileName);
  await writeFile(filePath, ca.publishedCode, 'UTF-8');
  console.log(chalk.green(`${filePath} was added`));
  if(openVsCode){
    exec(`code "${filePath}"`);
  }
  return {
    ...ca,
    filename: newFileName,
    folder: remoteFolder,
  };
}

const newCa = async (pwd, caName, type, openVsCode = false, schedule = null) => {
  if (schedule != null) {
    if (!isValidCron(schedule, { seconds: false })) {
      throw new Error(`Invalid cron expression: "${schedule}". Expected a valid 5-field cron string (e.g. "0 * * * *").`);
    }
  }
  const templateByType = {
    [CaType.USER]: baseCa,
    [CaType.ENDPOINT]: baseEndPointCa,
    [CaType.AI_FUNCTION]: baseAiFunctionCa,
    [CaType.WHATSAPP_FLOW]: baseWhatsappFlowCa,
    [CaType.WEBCHAT_FORM]: baseWebchatFormCa,
    [CaType.SCHEDULE]: baseScheduleCa,
  };
  const newCaObj = {
    publishedCode: templateByType[type] ?? baseCa,
    name: caName,
    type: type,
    ...(schedule != null && { schedule }),
  };
  const wpPath = await getWorkspacePath(pwd);
  const { token, cas } = await getBmc(wpPath);
  const resp = await createCa(token, newCaObj);
  const ca = JSON.parse(resp.body);
  const status = await createFileAndStatus(wpPath, ca, type, openVsCode);
  const newCas = cas.concat(status);
  await saveBmc(wpPath,token,newCas);
};

module.exports = newCa;

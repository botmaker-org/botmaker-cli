const util = require('util');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const exec = require('child_process').exec;

const { getBmc, saveBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const importWorkspace = require("./importWorkspace");
const { createCa } = require("./bmService");

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

const createFileAndStatus = async (wpPath, ca, openVsCode) => {
  const baseName = importWorkspace.formatName(ca.name);
  const newFileName = await importWorkspace.getName(path.join(wpPath, 'src'), baseName, 'js');

  const filePath = path.join(wpPath, 'src', newFileName);
  await writeFile(filePath, ca.publishedCode, 'UTF-8');
  console.log(chalk.green(`${filePath} was added`));
  if(openVsCode){
    exec(`code "${filePath}"`);
  }
  return {
    ...ca,
    filename: newFileName,
  };
}

const newCa = async (pwd, caName, type, openVsCode = false) => {
  const newCa = {
    publishedCode: type === 'USER' ? baseCa : baseEndPointCa,
    name: caName,
    type: type,
  };
  const wpPath = await getWorkspacePath(pwd);
  const { token, cas } = await getBmc(wpPath);
  const resp = await createCa(token, newCa);
  const ca = JSON.parse(resp.body);
  const status = await createFileAndStatus(wpPath, ca, openVsCode);
  const newCas = cas.concat(status);
  await saveBmc(wpPath,token,newCas);
};

module.exports = newCa;
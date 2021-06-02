const path = require('path');
const util = require('util');
const fs = require('fs');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

exports.getBmc = async (wpPath) => {
  const bmc =  await readFile(path.join(wpPath,'.bmc'),"UTF-8");
  return JSON.parse(bmc);
}

exports.saveBmc = async (wpPath,token,cas) => {
  await writeFile(path.join(wpPath, '.bmc'), JSON.stringify({ token, cas }), 'UTF-8');
}
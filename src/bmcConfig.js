const path = require('path');
const util = require('util');
const fs = require('fs');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

exports.getBmc = async (wpPath) => {
  const bmc = await readFile(path.join(wpPath, '.bmc'), 'UTF-8');
  const parsed = JSON.parse(bmc);
  const cas = Array.isArray(parsed.cas) ? parsed.cas : [];
  const incompatible = cas.find(ca => ca.filename && !ca.filename.startsWith('src/'));
  if (incompatible) {
    throw new Error(
      'This workspace is incompatible with this version of botmaker-cli.\n' +
      'Please re-import your workspace with `bmc import <apiToken>`.'
    );
  }
  return { ...parsed, cas };
};

exports.saveBmc = async (wpPath, token, cas) => {
  await writeFile(path.join(wpPath, '.bmc'), JSON.stringify({ token, cas }), 'UTF-8');
};

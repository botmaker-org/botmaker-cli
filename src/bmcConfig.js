const path = require('path');
const util = require('util');
const fs = require('fs');

const { TYPE_FOLDERS } = require('./caTypes');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const migrateCa = (ca) => {
  const out = { ...ca };
  if (out.filename) {
    const parts = out.filename.split('/').filter(Boolean);
    if (parts[0] !== 'src' && TYPE_FOLDERS.includes(parts[0])) {
      out.filename = `src/${out.filename}`;
    }
  }
  if (out.folder == null) {
    out.folder = '';
  }
  return out;
};

exports.getBmc = async (wpPath) => {
  const bmc = await readFile(path.join(wpPath, '.bmc'), 'UTF-8');
  const parsed = JSON.parse(bmc);
  if (Array.isArray(parsed.cas)) {
    parsed.cas = parsed.cas.map(migrateCa);
  }
  return parsed;
}

exports.saveBmc = async (wpPath, token, cas) => {
  await writeFile(path.join(wpPath, '.bmc'), JSON.stringify({ token, cas }), 'UTF-8');
}

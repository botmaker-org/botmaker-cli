const path = require('path');
const util = require('util');
const fs = require('fs');

const exists = util.promisify(fs.exists);

const getWorkspacePath = async (pwd) => {
  if (await exists(path.join(pwd,'.bmc'))) {
    return pwd;
  }
  if (await exists(path.join(pwd,'..','.bmc'))) {
    return path.join(pwd,'..')
  }
  throw new Error("'.bmc' file not found. Make sure you are in a botmaker workspace");
}

module.exports = getWorkspacePath;
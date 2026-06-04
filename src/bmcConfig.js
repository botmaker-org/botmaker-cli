const path = require('path');
const util = require('util');
const fs = require('fs');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

exports.getBmc = async (wpPath) => {
  let raw;
  try {
    raw = await readFile(path.join(wpPath, '.bmc'), 'UTF-8');
  } catch (e) {
    throw new Error("Could not read '.bmc' file. Make sure you are in a botmaker workspace.");
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error("'.bmc' file is corrupted. Please run 'bmc import <token>' in another workspace to fix it.");
  }
};

exports.saveBmc = async (wpPath, token, cas) => {
  await writeFile(path.join(wpPath, '.bmc'), JSON.stringify({ token, cas }), 'UTF-8');
};

exports.getContext = async (wpPath) => {
  let raw;
  try {
    raw = await readFile(path.join(wpPath, 'context.json'), 'UTF-8');
  } catch (e) {
    throw new Error("Could not read 'context.json' file. Make sure you are in a botmaker workspace.");
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error("'context.json' file is corrupted. Please run 'bmc set-customer rnd' to fix it.");
  }
};

exports.saveContext = async (wpPath, context) => {
  await writeFile(path.join(wpPath, 'context.json'), JSON.stringify(context, null, 4), 'UTF-8');
};

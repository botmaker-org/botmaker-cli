const path = require('path');
const util = require('util');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getAllCas, getCustomerContext } = require('./bmService')
const fse = require('fs-extra');

const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const exists = util.promisify(fs.exists);
const mkdir = util.promisify(fs.mkdir);
const copyAll = util.promisify(fse.copy);

const formatName = (name) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acents
    .replace(/\W+/g, "_") // remplace spaces with underscore
    .replace(/[\u{0080}-\u{FFFF}]/gu, "") // remove all non ascii chars
    .toLowerCase();

const getName = async (folder, basename, extension, num) => {
  const counterPart = num !== undefined ? '_' + num : '';
  const finalName = `${basename}${counterPart}.${extension}`;
  const finalPath = path.join(folder, finalName);
  const isTaken = await exists(finalPath);
  if (isTaken && num > 100) {
    throw new Error(`could not found a space for '${basename}'`);
  } else if (isTaken) {
    const nextNum = num !== undefined ? num + 1 : 0;
    return getName(folder, basename, extension, nextNum);
  } else {
    return finalName
  }
}

const importWorkspace = async (pwd, apiToken) => {
  const decode = jwt.decode(apiToken)
  if (!decode) {
    console.error("bmc: Invalid jwt token. Please generate a api token from https://go.botmaker.com/#/platforms in 'Botmaker API - Credenciales'");
    throw new Error('Invalid jwt token');
  }
  const { businessId } = decode;
  const workspacePath = path.join(pwd, businessId);
  if (await exists(workspacePath)) {
    throw new Error(`cannot create directory ‘${path.join(pwd, businessId)}’: File exists`)
  }

  console.log("looking for context...");
  const contextReq = await (async () => {
    try {
      return await getCustomerContext(apiToken);
    } catch (e) {
      console.error("Cound not found a context. Please check if exist some chat for the business " + businessId)
      throw e;
    }
  })();
  const context = JSON.parse(contextReq.body)

  console.log("looking for client actions...");
  const casReq = await (async () => {
    try {
      return await getAllCas(apiToken);
    } catch (e) {
      console.error("Cound obtain the client actions.")
      throw e;
    }
  })();
  const cas = JSON.parse(casReq.body)
  console.log("creating workspace...");

  await mkdir(workspacePath);
  const bmcPath = path.join(__dirname, '..');
  const baseTemplate = path.join(bmcPath, 'workspaceTemplate');
  await copyAll(baseTemplate, workspacePath);
  await writeFile(path.join(workspacePath, "context.json"), JSON.stringify(context, null, 4), "UTF-8");
  await mkdir(path.join(workspacePath, 'src'));
  const srcFolder = path.join(workspacePath, "src");
  for (const ca of cas) {
    const baseName = formatName(ca.name);
    ca.filename = await getName(srcFolder, baseName, 'js');
    await writeFile(path.join(srcFolder, ca.filename), ca.unPublishedCode || ca.publishedCode, "UTF-8");
  }
  const bmc = {
    cas,
    token: apiToken,
  }
  await writeFile(path.join(workspacePath, ".bmc"), JSON.stringify(bmc), "UTF-8");
}

importWorkspace.getName = getName;
importWorkspace.formatName = formatName;

module.exports = importWorkspace;
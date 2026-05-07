const path = require('path');
const { rename } = require('fs').promises;
const fse = require('fs-extra');
const chalk = require('chalk');

const { getBmc, saveBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');
const { getAllCas } = require('./bmService');
const { buildLocalRelPath, TYPE_FOLDERS } = require('./caTypes');

const TEMPLATE_FILES = [
  'endpoint.d.ts',
  'mcp.d.ts',
  'whatsappflow.d.ts',
  'webchatforms.d.ts',
  'src/user/jsconfig.json',
  'src/endpoint/jsconfig.json',
  'src/mcp/tsconfig.json',
  'src/webchatforms/jsconfig.json',
  'src/whatsappflow/jsconfig.json',
];

const isAlreadyMigrated = (cas) => {
  if (!cas.length) return true;
  return cas.every(ca =>
    ca.filename && TYPE_FOLDERS.some(f => ca.filename.startsWith(`src/${f}/`))
  );
};

const syncTemplateFiles = async (wpPath) => {
  const templatePath = path.join(__dirname, '..', 'workspaceTemplate');
  for (const relFile of TEMPLATE_FILES) {
    const dest = path.join(wpPath, relFile);
    if (!(await fse.pathExists(dest))) {
      await fse.ensureDir(path.dirname(dest));
      await fse.copy(path.join(templatePath, relFile), dest);
      console.log(chalk.green(`  added ${relFile}`));
    }
  }
  const flowstateDest = path.join(wpPath, 'flowstate.json');
  const testdataSrc = path.join(wpPath, 'testdata.json');
  if (!(await fse.pathExists(flowstateDest))) {
    if (await fse.pathExists(testdataSrc)) {
      await rename(testdataSrc, flowstateDest);
      console.log(chalk.yellow(`  renamed testdata.json → flowstate.json`));
    } else {
      await fse.copy(path.join(templatePath, 'flowstate.json'), flowstateDest);
      console.log(chalk.green(`  added flowstate.json`));
    }
  }
};

const migrate = async (pwd) => {
  const wpPath = await getWorkspacePath(pwd);
  const { token, cas } = await getBmc(wpPath);

  if (isAlreadyMigrated(cas)) {
    console.log(chalk.green('Already up to date. :)'));
    return;
  }

  console.log('Fetching remote client actions...');
  const remoteCasRes = await getAllCas(token);
  const remoteCas = JSON.parse(remoteCasRes.body);

  const newCas = [];
  for (const ca of cas) {
    const remote = remoteCas.find(r => r.id === ca.id);
    if (!remote) {
      console.log(chalk.yellow(`  WARNING: no remote match for '${ca.name || ca.filename}', leaving unchanged`));
      newCas.push(ca);
      continue;
    }

    const type = remote.type;
    const folder = remote.folder || '';
    const basename = path.basename(ca.filename || '');
    const newFilename = basename
      ? buildLocalRelPath(type, folder, basename)
      : ca.filename;

    if (ca.filename && ca.filename !== newFilename) {
      const oldAbs = path.join(wpPath, ca.filename);
      const newAbs = path.join(wpPath, newFilename);
      await fse.ensureDir(path.dirname(newAbs));
      await rename(oldAbs, newAbs);
      console.log(chalk.green(`  ${ca.filename} → ${newFilename}`));
    }

    newCas.push({ ...ca, type, folder, filename: newFilename });
  }

  await saveBmc(wpPath, token, newCas);
  console.log(chalk.green('  updated .bmc'));

  console.log('Syncing template files...');
  await syncTemplateFiles(wpPath);

  console.log(chalk.green('Migration complete!'));
};

module.exports = migrate;

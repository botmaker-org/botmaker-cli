const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const getWorkspacePath = require('./getWorkspacePath');

const FLOW_STATE_DEFAULT = { action: 'INIT', screen: '', data: {} };

module.exports = async (pwd) => {
  const wpPath = await getWorkspacePath(pwd);

  const flowstatePath = path.join(wpPath, 'flowstate.json');
  const chatPath = path.join(wpPath, 'chat.json');
  const catalogPath = path.join(wpPath, 'catalog.json');

  fs.writeFileSync(flowstatePath, JSON.stringify(FLOW_STATE_DEFAULT, null, 2), 'utf8');
  console.log(chalk.green('✓ flowstate.json reset to INIT'));

  if (fs.existsSync(chatPath)) {
    fs.unlinkSync(chatPath);
    console.log(chalk.green('✓ chat.json deleted (will re-fetch from API on next run)'));
  } else {
    console.log(chalk.gray('  chat.json not found, skipping'));
  }

  if (fs.existsSync(catalogPath)) {
    fs.unlinkSync(catalogPath);
    console.log(chalk.green('✓ catalog.json deleted (will re-fetch from API on next run)'));
  } else {
    console.log(chalk.gray('  catalog.json not found, skipping'));
  }
};

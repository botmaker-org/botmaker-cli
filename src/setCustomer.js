const path = require('path');
const util = require('util');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getAllCas, getCustomerContext } = require('./bmService')
const fse = require('fs-extra');
const { getBmc } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');

const writeFile = util.promisify(fs.writeFile);

const setCustomer = async (pwd, customerId) => {
  const wpPath = await getWorkspacePath(pwd)
  const {token} = await getBmc(wpPath); 
  console.log("loading context...");
  const contextReq = await (async () => {
    try {
      return await getCustomerContext(token, customerId);
    } catch (e) {
      console.error("Cound not found a context for cutomer id = " + customerId )
      throw e;
    }
  })();
  const context = JSON.parse(contextReq.body)
  await writeFile(path.join(wpPath, "context.json"), JSON.stringify(context, null, 4), "UTF-8");
  const name = ((context.userData.FIRST_NAME || "") + " " + (context.userData.LAST_NAME || "")).trim();
  console.log(`now you are: ${name || customerId}`);
}

module.exports = setCustomer;
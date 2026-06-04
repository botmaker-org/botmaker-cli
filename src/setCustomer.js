const path = require('path');
const jwt = require('jsonwebtoken');
const { getAllCas, getCustomerContext } = require('./bmService')
const fse = require('fs-extra');
const { getBmc, saveContext } = require('./bmcConfig');
const getWorkspacePath = require('./getWorkspacePath');

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
  await saveContext(wpPath, context);
  const name = ((context.userData.FIRST_NAME || "") + " " + (context.userData.LAST_NAME || "")).trim();
  console.log(`now you are: ${name || customerId}`);
}

module.exports = setCustomer;
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const rp = require('request-promise');
const moment = require('moment');
const momentTimezone = require('moment-timezone');
const csv = require('fast-csv');
const xml2js = require('xml2js');
const turf = require('@turf/turf');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bluebird = require('bluebird');
const chalk = require('chalk');

const cloneGlobal = () => {
  const descriptors = Object.getOwnPropertyDescriptors(global);
  for (const key of Object.keys(descriptors)) {
    const d = descriptors[key];
    if (d.get && !d.set) {
      // getter-only accessor (e.g. globalThis.crypto in Node 19+) — convert to writable data property
      descriptors[key] = { value: d.get.call(global), writable: true, enumerable: d.enumerable, configurable: true };
    }
  }
  return Object.defineProperties({}, descriptors);
};

/**
 * @param {object} opts
 * @param {string} opts.code       - CA source code
 * @param {string} opts.filePath   - absolute path to CA file (for stack traces)
 * @param {object} opts.helpers    - helper CAs keyed by require name
 * @param {string} opts.token      - workspace API token
 * @param {string} opts.wpPath     - workspace root (for screen data persistence)
 * @param {object} opts.context    - parsed context.json
 * @param {string} opts.action     - 'INIT' | 'data_exchange' | 'BACK'
 * @param {string} opts.screen     - name of the screen being left
 * @param {object} opts.data       - payload from flowstate.json
 * @param {string} opts.responseVar - 'flow' (WHATSAPP_FLOW) or 'form' (WEBCHAT_FORM)
 * @returns {Promise<{nextScreen?: string, data?: object, error?: string, stack?: string}>}
 */
module.exports = ({ code, filePath, helpers, token, wpPath, context, action, screen, data, responseVar }) => {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      resolve(result);
    };

    // bmconsole with colored output matching caEndpointRunner style
    const consoleColors = { log: chalk.green, warn: chalk.yellow, error: chalk.red };
    const bmconsole = {};
    ['log', 'warn', 'error'].forEach(method => {
      bmconsole[method] = (...args) => console[method](consoleColors[method](...args));
    });

    // chatReference for botmakerAPI live calls — pulled from context if present
    const chatReference = (context && (context.chatPlatformId || context.chatReference || context.id)) || 'local-test';

    // botmakerAPI — uses ACCESS_TOKEN if set by CA code, falls back to workspace token
    const botmakerAPI = {
      ACCESS_TOKEN: '',
      getChat: () => {
        const t = botmakerAPI.ACCESS_TOKEN || token;
        return rp({ uri: `https://api.botmaker.com/v2.0/chats/${chatReference}`, headers: { 'access-token': t }, json: true });
      },
      updateChat: (update) => {
        const t = botmakerAPI.ACCESS_TOKEN || token;
        return rp({ method: 'PUT', uri: `https://api.botmaker.com/v2.0/chats/${chatReference}`, headers: { 'access-token': t }, body: update, json: true });
      },
      getProducts: (catalogId, skus) => {
        const t = botmakerAPI.ACCESS_TOKEN || token;
        return rp({ uri: `https://api.botmaker.com/v2.0/ecommerce/catalogs/${catalogId}/products`, headers: { 'access-token': t }, qs: { skus: skus.join(',') }, json: true });
      },
    };

    // saveScreenData / loadPrevScreenData backed by .bmc-screendata.json in workspace root
    const screenDataPath = path.join(wpPath, '.bmc-screendata.json');
    const saveScreenData = () => new Promise((res, rej) =>
      fs.writeFile(screenDataPath, JSON.stringify(data, null, 2), 'utf8', err => err ? rej(err) : res())
    );
    const loadPrevScreenData = () => new Promise((res) =>
      fs.readFile(screenDataPath, 'utf8', (err, content) => {
        if (err) return res({});
        try { res(JSON.parse(content)); } catch (_) { res({}); }
      })
    );

    // entityLoader — Promise-based, matches flow/form type spec
    const entityLoader = (entityName = '') => rp({
      uri: `https://api.botmaker.com/v2.0/entities/${encodeURIComponent(entityName)}`,
      headers: { 'access-token': token },
      json: true,
    }).then(json => json.items || json);

    // fetchSecured — injects workspace token as access-token header
    const fetchSecured = (uri, options = {}) => {
      const headers = { ...(options.headers || {}), 'access-token': token };
      return fetch(uri, { ...options, headers });
    };

    // response object (flow or form) — CA sets nextScreen/data then calls send()
    const responseObj = { nextScreen: undefined, data: undefined };
    responseObj.send = () => settle({ nextScreen: responseObj.nextScreen, data: responseObj.data });

    const timeoutHandle = setTimeout(() => settle({ error: 'timeout' }), 90000);

    const vmContext = Object.assign(cloneGlobal(), {
      action,
      screen,
      data,
      [responseVar]: responseObj,
      bmconsole,
      botmakerAPI,
      saveScreenData,
      loadPrevScreenData,
      entityLoader,
      fetchSecured,
      fs,
      crypto,
      jwt,
      moment,
      momentTimezone,
      csv,
      xml2js,
      turf,
    });

    vmContext.require = (packageName) => {
      if (packageName in helpers) {
        vm.createContext(vmContext);
        return vm.runInNewContext(helpers[packageName].code, vmContext, { filename: helpers[packageName].source });
      }
      return require(packageName);
    };

    try {
      vm.createContext(vmContext);
      vm.runInNewContext(code, vmContext, { filename: filePath });
    } catch (err) {
      settle({ error: err.message, stack: err.stack });
    }
  });
};

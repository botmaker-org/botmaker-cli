const rp = require('request-promise');
const fs = require('fs');
const lodash = require('lodash');
const _ = lodash;
const moment = require('moment');

const csv = require("fast-csv");
const md5 = require('md5');
const sha256 = require('js-sha256');
const xml2js = require('xml2js');
const secureRandom = require('secure-random');
const turf = require('@turf/turf');
const turfHelpers = require('@turf/helpers');
const jwt = require('jsonwebtoken');
const bluebird = require('bluebird');
const { google } = require('googleapis');
const awsSdk = require('aws-sdk');
const awsApiClient = require('aws-api-gateway-client').default;
const amazonCognito = require('amazon-cognito-identity-js');

const ___runMain = (
    {
        __require_helper,
        result,
        bmconsole,
        context,
        promiseRetry,
        connectRedis,
        user, 
    },
    ___
) => {
    eval(___);
}

module.exports = (code, context, helpers, fulfill, token) => {
    const chalk = require('chalk');
    const __redisLib__ = require('redis');
    bluebird.promisifyAll(__redisLib__.RedisClient.prototype);
    bluebird.promisifyAll(__redisLib__.Multi.prototype);

    const __parceStackTrace = (error) => {
        if (error.stack) {
            return __parceStackTrace(error.stack)
        }
        const message = error.split(/\r?\n/g)[0];
        const stack = [];
        const regex = /\s+at (.+?(?= \()) \((.+?)(?=[:\)]):?(\d*):?(\d*)\)/mg
        let match;

        while ((match = regex.exec(error)) != null) {
            const [_, caller, source, line, column] = match;
            stack.push({ caller, source, line, column });
        }
        return {
            message,
            stack,
        }
    }

    let alreadyDone = false;

    const resultState = {
        user: {...context.userData.variables} || {},
        gotoRuleName: null,
        say: []
    };

    const result_done = (extra) => {
        if (alreadyDone) return;
        alreadyDone = true;

        fulfill({ ...extra, resultState });
    };

    const resolveSalesforceContext = () => rp({
        method: 'POST',
        uri: 'https://go.botmaker.com/rest/salesforce/ca-auth-get',
        headers: {
            t: token
        },
        json: true
    });

    const resolveZohoContext = () => rp({
        method: 'POST',
        uri: 'https://go.botmaker.com/rest/zoho/ca-auth-get',
        headers: {
            t: token
        },
        json: true
    });

    const resolveGoogleSheetContext = () => rp({
        method: 'POST',
        uri: 'https://go.botmaker.com/rest/gsheets/ca-auth-get',
        headers: {
            t: token
        },
        json: true
    });

    const resolveGoogleCalendarContext = () => rp({
        method: 'POST',
        uri: 'https://go.botmaker.com/rest/gcal/ca-auth-get',
        headers: {
            t: token
        },
        json: true
    });

    try {
        let consoleColor = { log: chalk.green, warn: chalk.yellow, error: chalk.red }
        const bmconsole = {};
        ["log", "warn", "error"].forEach(
            method => bmconsole[method] = function (...p) {
                const { caller, line } = __parceStackTrace(new Error()).stack[1]
                console[method](
                    consoleColor[method](
                        chalk.bold(`${caller === 'eval' ? 'main' : caller}:${line}~>`), ...p
                    )
                )
            });

        const connectRedis = () => {
            const redis = __redisLib__.createClient(6379, 'redis.botmaker.com', {
                password: token,
                socket_keepalive: false,
                retry_strategy: (options) => {
                    if (options.attempt > 4) return undefined; // end reconnecting with built in error
                    return options.attempt * 100; // reconnect after
                }
            });

            redis.on("error", function (err) {
                console.error("Node-redis client error: " + err);
            });
            // redis.unref(); // allowing the program to exit once no more commands are pending
            return redis;
        };

        const entityLoader = (name, cb) => {
            rp({
                uri: 'https://go.botmaker.com/rest/operator/clientActions/_int_GetBotEntity',
                method: 'POST',
                headers: {
                    'name': name,
                    'auth': token,
                },
                json: true
            })
                .then(json => cb(json))
                .catch(error => cb(null, error));
        };

        const MAX_USER_VAR_SIZE = 100 * 1024; // 100 kb
        const MAX_USER_VAR_COUNT = 200;
        const setVars = new Set(); // keeps track of how many vars were set

        const user = {
            set: (k, v) => {
                if (!k) return;

                k = k.toString();
                v = v ? v.toString() : null;

                if (v && v.length > MAX_USER_VAR_SIZE)
                    throw new Error(`Trying to set a very long value for user[${k}]; value has ${v.length} length. The max allowed size is: ${MAX_USER_VAR_SIZE}`);

                setVars.add(k);
                if (setVars.size > MAX_USER_VAR_COUNT)
                    throw new Error(`Too many user variables set in this action. Max allowed count is: ${MAX_USER_VAR_COUNT}`);

                resultState.user[k] = v;
            },
            get: k => k ? resultState.user[k.toString()] : null
        };

        const rpSecured = rp;

        const promiseRetry = (func, ms = 100, maxRetries = 2, lastError) => new Promise((resolve, reject) => {
            if (maxRetries === 0)
                reject(lastError);
            else
                func.then(resolve)
                    .catch((e) => {
                        setTimeout(() => promiseRetry(func, ms, maxRetries - 1, e).then(resolve).catch(reject), ms);
                    });
        });

        // ============= internal functions =============

        const __itemsBuilder__ = () => {
            return {
                message: {
                    ITEMS: []
                },
                addItem: function (title, subTitle, imageURL, buttons, itemURL) {
                    this.message.ITEMS.push({
                        title,
                        subTitle,
                        imageURL,
                        itemURL,
                        options: buttons || []
                    });
                    return this;
                },
                send: function () {
                    resultState.say.push(this.message);
                }
            }
        };

        // ============= variables provided to users =============

        const result = {
            gotoRule: gotoRuleName => resultState.gotoRuleName = gotoRuleName,

            text: literal => resultState.say.push({ literals: [literal] }),

            image: (url, MESSAGE) => resultState.say.push({ IMAGES_URLS: [url], MESSAGE }),
            video: url => resultState.say.push({ VIDEOS_URLS: [url] }),
            file: (url, MESSAGE) => resultState.say.push({ FILES_URLS: [url], MESSAGE }),
            audio: url => resultState.say.push({ AUDIOS_URLS: [url] }),

            done: result_done,
            resolveSalesforceContext: resolveSalesforceContext,
            resolveZohoContext: resolveZohoContext,
            resolveGoogleSheetContext: resolveGoogleSheetContext,
            resolveGoogleCalendarContext: resolveGoogleCalendarContext,

            buttonsBuilder: () => {
                return {
                    message: {
                        MESSAGE: " ",
                        HAS_QUICK_REPLIES: false,
                        OPTIONS: []
                    },
                    quickReplies: function () {
                        this.message.HAS_QUICK_REPLIES = true;
                        return this;
                    },
                    text: function (theText) {
                        this.message.MESSAGE = theText;
                        return this;
                    },
                    addURLButton: function (name, url, synonyms) {
                        this.message.OPTIONS.push({
                            itemType: "url",
                            value: name || "",
                            _id_: url,
                            synonyms: synonyms || []
                        });
                        return this;
                    },
                    addWebViewButton: function (name, webViewURL, synonyms) {
                        let url = "https://go.botmaker.com/rest/redirect?redirectURL=" + encodeURIComponent(webViewURL);
                        this.message.OPTIONS.push({
                            itemType: "url",
                            value: name || "",
                            _id_: url,
                            fallbackUrl: url,
                            synonyms: synonyms || []
                        });
                        return this;
                    },
                    addLocationButton: function () {
                        this.message.OPTIONS.push({
                            itemType: "location",
                            value: "",
                            _id_: ""
                        });
                        return this;
                    },
                    addShareButton: function () {
                        this.message.OPTIONS.push({
                            itemType: "element_share",
                            value: "",
                            _id_: ""
                        });
                        return this;
                    },
                    addPhoneButton: function (name, number, synonyms) {
                        this.message.OPTIONS.push({
                            itemType: "phone_number",
                            value: name || "",
                            _id_: number || "",
                            synonyms: synonyms || []
                        });
                        return this;
                    },
                    addButton: function (name, ruleNameOrId, type, synonyms) {

                        let action = { intent: ruleNameOrId, button: name, entities: "{}" };
                        this.message.OPTIONS.push({
                            itemType: type || "postback",
                            value: name || "",
                            _id_: JSON.stringify(action),
                            synonyms: synonyms || []
                        });
                        return this;
                    },
                    addClientActionButton: function (name, clientActionNameOrId, parameters, synonyms) {
                        let action = {
                            intent: "CLIENT_ACTION_WITH_PARAMS",
                            button: name,
                            entities: JSON.stringify({
                                clientAction: {
                                    "@class": "ClientActionEntity",
                                    "id": clientActionNameOrId
                                },
                                jsonParams: {
                                    "@class": "StringEntity",
                                    "value": JSON.stringify(parameters)
                                }
                            })
                        };
                        this.message.OPTIONS.push({
                            itemType: "postback",
                            value: name || "",
                            _id_: JSON.stringify(action),
                            synonyms: synonyms || []
                        });
                        return this;
                    },
                    buildButtons: function () {
                        return this.message.OPTIONS;
                    },
                    send: function () {
                        resultState.say.push(this.message);
                    }
                };
            },

            carouselBuilder: () => __itemsBuilder__(),

            listBuilder: () => {
                let builder = __itemsBuilder__();

                builder.message = {
                    ITEMS: [],
                    OPTIONS: [],
                    RENDERING_INFO: {
                        list: true,
                        top_element_style: 'compact',
                        sharable: true
                    }
                };

                builder.addButtons = buttons => {
                    builder.message.OPTIONS = buttons;
                    return this;
                };

                builder.large = () => {
                    builder.message.RENDERING_INFO.top_element_style = 'large';
                    return builder;
                };

                builder.removeSharable = () => {
                    builder.message.RENDERING_INFO.sharable = false;
                    return builder;
                };

                return builder;
            }
        };

        const __ts12312 = setTimeout(() => {
            result_done({
                error: "timeout"
            });
        }, 90000);

        const g4nmksd5m__helpers = helpers.map((src) => eval(src));

        const __require_helper = (indx) => g4nmksd5m__helpers[indx];

        ___runMain({
            __require_helper,
            result,
            bmconsole,
            context,
            promiseRetry,
            user,
            connectRedis,
        },code);

    } catch (__executionErrors__) {
        result_done({
            error: "exception",
            message: __executionErrors__.message,
            stack: __executionErrors__.stack
        });
    }
};
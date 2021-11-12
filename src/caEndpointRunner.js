const vm = require('vm');
const rp = require('request-promise');
const fs = require('fs');
const lodash = require('lodash');
const _ = lodash;
const moment = require('moment');
const csv = require("fast-csv");
const md5 = require('md5');
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

const cloneGlobal = () => Object.defineProperties(
    {...global},
    Object.getOwnPropertyDescriptors(global)
)

const ___runMain = (
    bmContext,
    code,
    filename,
    helpers
) => {
    const context = Object.assign(
        cloneGlobal(),
        {
            ...bmContext,
            request: bmContext.req,
            response: bmContext.res,
            rp,
            fs,
            lodash,
            _,
            moment,
            csv,
            md5,
            xml2js,
            secureRandom,
            turf,
            turfHelpers,
            jwt,
            bluebird,
            google,
            awsSdk,
            awsApiClient,
            amazonCognito,
            require,
        },
    );

    const mainContext = Object.assign(
        {},
        context,
        {
            require: (packageName) => {
                if (packageName in helpers) {
                    vm.createContext(context);
                    return vm.runInNewContext(
                        helpers[packageName].code,
                        context,
                        { filename: helpers[packageName].source }
                    )
                }
                return require(packageName)
            },
        },
    );

    vm.createContext(mainContext);
    vm.runInNewContext(code, mainContext, { filename })
}

module.exports = (req, res, token, code, helpers, filePath) => {
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

        req.connectRedis = connectRedis;
        ___runMain(
            {
                req,
                res,
                bmconsole,
            },
            code,
            filePath,
            helpers);
    } catch (__executionErrors__) {
        console.error(__executionErrors__);
        res.status(500).send(JSON.stringify(__executionErrors__));
    }
};
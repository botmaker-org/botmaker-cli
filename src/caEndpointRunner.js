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

const ___runMain = (
    {   
        __require_helper,
        req,
        res,
        bmconsole,
    },
    ___
) => {
    const request = req;
    const response = res;
    eval(___);
}

module.exports = (req, res, token, code, helpers ) => {
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

        const g4nmksd5m__helpers = helpers.map((src) => eval(src));

        const __require_helper = (indx) => g4nmksd5m__helpers[indx];

        ___runMain({
            __require_helper,
            req,
            res,
            bmconsole,
        },code);
    } catch (__executionErrors__) {
        res.status(400).send(JSON.stringify(__error__));
    }
};
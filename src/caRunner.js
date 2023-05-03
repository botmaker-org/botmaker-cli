const vm = require('vm');
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
            rp,
            fs,
            lodash,
            _,
            moment,
            csv,
            md5,
            sha256,
            xml2js,
            secureRandom,
            turf,
            turfHelpers,
            jwt,
            bluebird,
            google,
            require,
        },
    );

    const mainContext = Object.assign(
        context,
        {
            require: (packageName) => {
                if (packageName in helpers) {
                    vm.createContext(context);
                    return vm.runInNewContext(helpers[packageName].code, context, { filename: helpers[packageName].source })
                }
                return require(packageName)
            },
        },
    );
    vm.createContext(mainContext);
    vm.runInNewContext(code, mainContext, { filename })
}

module.exports = (code, context, helpers, fulfill, token, filename) => {
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
        user: { ...context.userData.variables } || {},
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
        const bmconsole = console
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

        const entityLoader = (entityName, cb) => {
            rp({
                uri: `https://api.botmaker.com/v2.0/entities/${encodeURIComponent(entityName)}`,
                method: 'GET',
                headers: {
                    'access-token': token,
                },
                json: true
            })
                .then(json => cb(json.items))
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

            appleBusinesChatCustomInteractiveMessage: (nextIntentName) => {
                return {
                    message: {
                        ABC_IMAGES: [],
                        ABC_NEXT_INTENT_NAME: { nextIntentName },
                        ABC_RECEIVED_MSG: {},
                        ABC_CUSTOM: {}
                    },

                    // images should be 840x630 pixels at 72dpi
                    // When style is icon, the expected @3x image size is 40 x 40 points (120 x 120 pixels).
                    // When style is small, the expected @3x image size is 60 x 60 points (180 x 180 pixels).
                    // When style is large, the expected @3x image size is 263 x 150 points (789 x 450 pixels).
                    addImageReferenceURL: function (url = 'https://placeimg.com/840/630/animals') {
                        this.message.ABC_IMAGES = this.message.ABC_IMAGES.concat(url);
                        return this;
                    },

                    setReceivedMessage: function (imageRefIndex = 0, title = 'default title') {
                        this.message.ABC_RECEIVED_MSG = { imageRefIndex, title };
                        return this;
                    },

                    // https://developer.apple.com/documentation/businesschatapi/messages_sent/interactive_messages/custom_interactive_messages/sending_a_custom_interactive_message
                    setCustom: function (bid,
                        appId,
                        appName,
                        URL) {

                        this.message.ABC_CUSTOM = { bid, appId, appName, URL };
                        return this;
                    },

                    send: function () {
                        resultState.say.push({
                            MESSAGE: " ",
                            ITEMS: [this.message]
                        });
                    }
                };
            },

            appleBusinesChatAuthenticate: (nextIntentName, problemsIntentName) => {
                return {
                    message: {
                        ABC_IMAGES: [],
                        ABC_RECEIVED_MSG: {},
                        ABC_NEXT_INTENT_NAME: { nextIntentName },
                        ABC_REPLY_MSG: {},
                        ABC_OAUTH2: { problemsIntentName }
                    },

                    // images should be 840x630 pixels at 72dpi
                    // When style is icon, the expected @3x image size is 40 x 40 points (120 x 120 pixels).
                    // When style is small, the expected @3x image size is 60 x 60 points (180 x 180 pixels).
                    // When style is large, the expected @3x image size is 263 x 150 points (789 x 450 pixels).
                    addImageReferenceURL: function (url = 'https://placeimg.com/840/630/animals') {
                        this.message.ABC_IMAGES = this.message.ABC_IMAGES.concat(url);
                        return this;
                    },

                    setReceivedMessage: function (imageRefIndex = 0, title = 'default title', style = 'icon', subTitle = null) {
                        this.message.ABC_RECEIVED_MSG = { imageRefIndex, title, style, subTitle };
                        return this;
                    },

                    setReplyMessage: function (imageRefIndex = 0, title = 'default title', style = 'icon', subTitle = null) {
                        this.message.ABC_REPLY_MSG = { imageRefIndex, title, style, subTitle };
                        return this;
                    },

                    setOAuth2: function (clientSecret, scopes, responseType) {
                        this.message.ABC_OAUTH2 = { ...this.message.ABC_OAUTH2, clientSecret, scopes, responseType };
                        return this;
                    },

                    send: function () {
                        resultState.say.push({
                            MESSAGE: " ",
                            ITEMS: [this.message]
                        });
                    }
                };
            },

            appleBusinesChatApplePay: (nextIntentName, problemsIntentName) => {
                return {
                    message: {
                        ABC_IMAGES: [],
                        ABC_RECEIVED_MSG: {},
                        ABC_NEXT_INTENT_NAME: { nextIntentName, problemsIntentName },
                        ABC_REPLY_MSG: {},
                        ABC_PAY_ENDPOINTS: {},
                        ABC_PAY_PAYMENT: { items: [] }
                    },

                    // images should be 840x630 pixels at 72dpi
                    // When style is icon, the expected @3x image size is 40 x 40 points (120 x 120 pixels).
                    // When style is small, the expected @3x image size is 60 x 60 points (180 x 180 pixels).
                    // When style is large, the expected @3x image size is 263 x 150 points (789 x 450 pixels).
                    addImageReferenceURL: function (url = 'https://placeimg.com/840/630/animals') {
                        this.message.ABC_IMAGES = this.message.ABC_IMAGES.concat(url);
                        return this;
                    },

                    setReceivedMessage: function (imageRefIndex = 0, title = 'default title', style = 'icon', subTitle = null) {
                        this.message.ABC_RECEIVED_MSG = { imageRefIndex, title, style, subTitle };
                        return this;
                    },

                    setReplyMessage: function (imageRefIndex = 0, title = 'default title', style = 'icon', subTitle = null) {
                        this.message.ABC_REPLY_MSG = { imageRefIndex, title, style, subTitle };
                        return this;
                    },

                    setEndpoints: function (paymentGatewayUrl, fallbackUrl = null, orderTrackingUrl = null, paymentMethodUpdateUrl = null, shippingContactUpdateUrl = null,
                        shippingMethodUpdateUrl = null) {
                        this.message.ABC_PAY_ENDPOINTS = { paymentGatewayUrl, fallbackUrl, orderTrackingUrl, paymentMethodUpdateUrl, shippingContactUpdateUrl, shippingMethodUpdateUrl };
                        return this;
                    },

                    // https://developer.apple.com/documentation/businesschatapi/applepaypaymentrequest
                    // https://developer.apple.com/documentation/apple_pay_on_the_web/applepayrequest/2951831-supportednetworks
                    setPayment: function (merchantIdentifier, merchantDisplayName, itemMerchantCapabilities, merchantPem, merchantPublicKey, paymentProcessorPrivateKey, supportedNetworks, countryCode, currencyCode) {
                        this.message.ABC_PAY_PAYMENT = {
                            ...this.message.ABC_PAY_PAYMENT,
                            merchantIdentifier,
                            merchantDisplayName,
                            itemMerchantCapabilities,
                            merchantPem,
                            merchantPublicKey,
                            paymentProcessorPrivateKey,
                            supportedNetworks,
                            countryCode,
                            currencyCode
                        };
                        return this;
                    },

                    addLineItem: function (amount, label) {
                        const itm = { amount, label };
                        this.message.ABC_PAY_PAYMENT = { ...this.message.ABC_PAY_PAYMENT, items: this.message.ABC_PAY_PAYMENT.items.concat(itm) };

                        return this;
                    },

                    send: function () {
                        resultState.say.push({
                            MESSAGE: " ",
                            ITEMS: [this.message]
                        });
                    }
                };
            },

            appleBusinesChatForms: (nextIntentName, showSummary = false, splashImageRefIndex = -1, splashHeader = null, splashText = null, splashButtonTitle = null) => {
                return {
                    message: {
                        ABC_IMAGES: [],
                        ABC_RECEIVED_MSG: {},
                        ABC_NEXT_INTENT_NAME: { nextIntentName },
                        ABC_REPLY_MSG: {},
                        ABC_FORMS: { showSummary, splashImageRefIndex, splashHeader, splashText, splashButtonTitle, pages: [] }
                    },

                    // images should be 840x630 pixels at 72dpi
                    // When style is icon, the expected @3x image size is 40 x 40 points (120 x 120 pixels).
                    // When style is small, the expected @3x image size is 60 x 60 points (180 x 180 pixels).
                    // When style is large, the expected @3x image size is 263 x 150 points (789 x 450 pixels).
                    addImageReferenceURL: function (url = 'https://placeimg.com/840/630/animals') {
                        this.message.ABC_IMAGES = this.message.ABC_IMAGES.concat(url);
                        return this;
                    },

                    setReceivedMessage: function (imageRefIndex = 0, title = 'default title', style = 'icon', subTitle = null) {
                        this.message.ABC_RECEIVED_MSG = { imageRefIndex, title, style, subTitle };
                        return this;
                    },

                    setReplyMessage: function (imageRefIndex = 0, title = 'default title', style = 'icon', subTitle = null) {
                        this.message.ABC_REPLY_MSG = { imageRefIndex, title, style, subTitle };
                        return this;
                    },

                    addSelectPage: function (id, title, subtitle, nextPageId, isSubmitForm = false, multipleSelection = false) {
                        const page = this.addPageImpl('select', id, title, subtitle, nextPageId, isSubmitForm, { multipleSelection });

                        page.items = [];

                        page.addItem = function (title = null, value = null, nextPageId = null, imageRefIndex = null) {
                            page.items.push({ title, value, nextPageId, imageRefIndex });
                            return this;
                        };

                        return page;
                    },

                    addDatePickerPage: function (id, title, subtitle, nextPageId, isSubmitForm = false, dateFormat = 'MM/DD/YYYY', startDate, minimumDate, maximumDate, labelText) {
                        return this.addPageImpl('datePicker', id, title, subtitle, nextPageId, isSubmitForm, { dateFormat, startDate, minimumDate, maximumDate, labelText });
                    },

                    addInputPage: function (id, title, subtitle, nextPageId, isSubmitForm = false, options = {}) {
                        return this.addPageImpl('input', id, title, subtitle, nextPageId, isSubmitForm, { options });
                    },

                    addPageImpl: function (type, id, title, subtitle, nextPageId, isSubmitForm, others = {}) {
                        const page = { ...others, type, id, title, subtitle, nextPageId, isSubmitForm };

                        this.message.ABC_FORMS = { ...this.message.ABC_FORMS, pages: this.message.ABC_FORMS.pages.concat(page) };

                        return page;
                    },

                    send: function () {
                        resultState.say.push({
                            MESSAGE: " ",
                            ITEMS: [this.message]
                        });
                    }
                };
            },

            appleBusinesChatTimePicker: (nextIntentName) => {
                return {
                    message: {
                        ABC_IMAGES: [],
                        ABC_NEXT_INTENT_NAME: { nextIntentName },
                        ABC_RECEIVED_MSG: {},
                        ABC_REPLY_MSG: {},
                        ABC_EVENT: {},
                        ABC_EVENT_LOCATION: {},
                        ABC_EVENT_TIME_SLOTS: []
                    },

                    // images should be 840x630 pixels at 72dpi
                    // When style is icon, the expected @3x image size is 40 x 40 points (120 x 120 pixels).
                    // When style is small, the expected @3x image size is 60 x 60 points (180 x 180 pixels).
                    // When style is large, the expected @3x image size is 263 x 150 points (789 x 450 pixels).
                    addImageReferenceURL: function (url = 'https://placeimg.com/840/630/animals') {
                        this.message.ABC_IMAGES = this.message.ABC_IMAGES.concat(url);
                        return this;
                    },

                    setReceivedMessage: function (imageRefIndex = 0, title = 'default title', style = 'icon', subTitle = null) {
                        this.message.ABC_RECEIVED_MSG = { imageRefIndex, title, style, subTitle };
                        return this;
                    },

                    setReplyMessage: function (imageRefIndex = 0, title = 'default title', style = 'icon', subTitle = null) {
                        this.message.ABC_REPLY_MSG = { imageRefIndex, title, style, subTitle };
                        return this;
                    },

                    setEvent: function (imageRefIndex = 0, title = 'default title', bmVar) {
                        this.message.ABC_EVENT = { imageRefIndex, title, bmVar };
                        return this;
                    },

                    setLocation: function (title = 'default title', latitude, longitude, radius) {
                        this.message.ABC_EVENT_LOCATION = { title, latitude, longitude, radius };
                        return this;
                    },

                    addTimeItem: function (startTime = new Date(new Date().setDate(new Date().getDate() + 7)), duration = 600) {
                        this.message.ABC_EVENT_TIME_SLOTS = this.message.ABC_EVENT_TIME_SLOTS.concat({
                            startTime: startTime.toISOString(),
                            duration
                        });
                        return this;
                    },

                    send: function () {
                        resultState.say.push({
                            MESSAGE: " ",
                            ITEMS: [this.message]
                        });
                    }
                };
            },

            appleBusinesChatListPicker: (nextIntentName) => {
                return {
                    message: {
                        ABC_NEXT_INTENT_NAME: { nextIntentName },
                        ABC_IMAGES: [],
                        ABC_RECEIVED_MSG: {},
                        ABC_REPLY_MSG: {},
                        ABC_SECTIONS: []
                    },

                    // images should be 840x630 pixels at 72dpi
                    // When style is icon, the expected @3x image size is 40 x 40 points (120 x 120 pixels).
                    // When style is small, the expected @3x image size is 60 x 60 points (180 x 180 pixels).
                    // When style is large, the expected @3x image size is 263 x 150 points (789 x 450 pixels).
                    addImageReferenceURL: function (url = 'https://placeimg.com/840/630/animals') {
                        this.message.ABC_IMAGES = this.message.ABC_IMAGES.concat(url);
                        return this;
                    },

                    setReceivedMessage: function (imageRefIndex = 0, title = 'default title', style = 'icon', subTitle = null) {
                        this.message.ABC_RECEIVED_MSG = { imageRefIndex, title, style, subTitle };
                        return this;
                    },

                    setReplyMessage: function (imageRefIndex = 0, title = 'default title', style = 'icon', subTitle = null) {
                        this.message.ABC_REPLY_MSG = { imageRefIndex, title, style, subTitle };
                        return this;
                    },

                    addSection: function (title = 'section title', multipleSelection = false, bmVar) {
                        const sec = {
                            title,
                            bmVar,
                            multipleSelection,
                            items: [],
                            addItem: function (itemId, title = 'default item title', imageRefIndex = null, style = null, subTitle = null) {
                                this.items = this.items.concat({ itemId, title, imageRefIndex, style, subTitle });
                                return this;
                            }
                        };

                        this.message.ABC_SECTIONS = this.message.ABC_SECTIONS.concat(sec);
                        return sec;
                    },

                    send: function () {
                        resultState.say.push({
                            MESSAGE: " ",
                            ITEMS: [{ ...this.message, ABC_SECTIONS: this.message.ABC_SECTIONS.map(m => ({ title: m.title, multipleSelection: m.multipleSelection, bmVar: m.bmVar, items: m.items })) }]
                        });
                    }
                };
            },

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

        ___runMain({
            result,
            bmconsole,
            context,
            promiseRetry,
            user,
            connectRedis,
            rpSecured,
            entityLoader,
        },
            code,
            filename,
            helpers,
        );

    } catch (__executionErrors__) {

        if (__executionErrors__ instanceof SyntaxError) {
            result_done({
                error: "exception",
                message: __executionErrors__.message,
                stack: __executionErrors__.stack
            });
        } else {
            result_done({
                error: "exception",
                message: __executionErrors__.message,
                stack: __executionErrors__.stack
            });
        }
    }
};
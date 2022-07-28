import { RequestPromiseAPI } from "request-promise";
import { RedisClient } from "redis";
import * as context from './context.json';
import fs from 'fs';
import lolodashdash  from 'lodash';
import moment from 'moment';
import csv from  "fast-csv";
import md5 from  'md5';
import sha256 from  'js-sha256';
import xml2js from  'xml2js';
import secureRandom from  'secure-random';
import turf from  '@turf/turf';
import turfHelpers from  '@turf/helpers';
import jwt from  'jsonwebtoken';
import bluebird from  'bluebird';
import { google } from 'googleapis';
import {Request,Response} from 'express';

type BmOptionType = "url" | "location" | "element_share" | "phone_number" | "postback"

interface IBMOption {
  itemType: BmOptionType,
  value: string,
  _id_: string,
  synonyms: string[]
}

interface BmButtonsBuilder {
  quickReplies: () => BmButtonsBuilder,
  text(text: string): BmButtonsBuilder,
  addURLButton: (name: string, url: string, synonyms?: string[])  => BmButtonsBuilder
  addWebViewButton: (name : string, webViewURL: string, synonyms?: string[]) => BmButtonsBuilder,
  addLocationButton: () => BmButtonsBuilder,
  addShareButton: () => BmButtonsBuilder,
  addPhoneButton: (name: string, number: string, synonyms?: string[]) => BmButtonsBuilder,
  addButton: (name: string, ruleNameOrId: string, type?: BmOptionType, synonyms?: string[]) => BmButtonsBuilder,
  addClientActionButton: (name: string, clientActionNameOrId: string, parameters?: any, synonyms?: string[]) => BmButtonsBuilder,
  buildButtons: () => IBMOption[],
  send: () => void
}

interface BmItemsBuilder {
  addItem: (title: string, subtitle: string, imageUrl: string, buttons?: IBMOption[], itemUrl?: string) => void,
  send: () => void
}

interface AppleBusinesChatCustomInteractiveMessage {
  addImageReferenceURL: (url: string = 'https://placeimg.com/840/630/animals') => AppleBusinesChatCustomInteractiveMessage;
  setReceivedMessage: (imageRefIndex: number = 0, title: string = 'default title') => AppleBusinesChatCustomInteractiveMessage;
  setCustom: (bid : string,appId : string,appName : string,URL : string)=> AppleBusinesChatCustomInteractiveMessage;
  send: () => void;
}

type AppleIconStyles = 'icon' | 'small' | 'large';
interface AppleBusinesChatAuthenticate {
  addImageReferenceURL: (url: string = 'https://placeimg.com/840/630/animals') => AppleBusinesChatAuthenticate;
  setReceivedMessage: (imageRefIndex: number = 0, title: string = 'default title',style:AppleIconStyles = 'icon', subTitle?: string) => AppleBusinesChatAuthenticate;
  setReplyMessage:  (imageRefIndex: number = 0, title: string = 'default title',style:AppleIconStyles = 'icon', subTitle?: string) => AppleBusinesChatAuthenticate;
  setOAuth2: (clientSecret: string, scopes: any, responseType: any) => AppleBusinesChatAuthenticate;
  send: () => void;
}
interface AppleBusinesChatApplePay {
  addImageReferenceURL: (url: string = 'https://placeimg.com/840/630/animals') => AppleBusinesChatApplePay;
  setReceivedMessage: (imageRefIndex: number = 0, title: string = 'default title',style:AppleIconStyles = 'icon', subTitle?: string) => AppleBusinesChatApplePay;
  setReplyMessage:  (imageRefIndex: number = 0, title: string = 'default title',style:AppleIconStyles = 'icon', subTitle?: string) => AppleBusinesChatApplePay;
  setEndpoints: (paymentGatewayUrl: string, fallbackUrl? :string, orderTrackingUrl?: string, paymentMethodUpdateUrl?: string, shippingContactUpdateUrl?: string) => AppleBusinesChatApplePay;
  setPayment: (merchantIdentifier: string, merchantDisplayName: string, itemMerchantCapabilities: string, merchantPem: string, merchantPublicKey: string, paymentProcessorPrivateKey: string, supportedNetworks: string, countryCode: string, currencyCode: string) => AppleBusinesChatApplePay;
  addLineItem: (amount: number, label: string) => AppleBusinesChatApplePay
  send: () => void;
}

interface AppleBusinesChatFormsSelectPage{
  addItem: (title?: string, value?: string, nextPageId?: string, imageRefIndex?: number) => AppleBusinesChatFormsSelectPage
}
interface AppleBusinesChatForms {
  addImageReferenceURL: (url: string = 'https://placeimg.com/840/630/animals') => AppleBusinesChatForms;
  setReceivedMessage: (imageRefIndex: number = 0, title: string = 'default title',style:AppleIconStyles = 'icon', subTitle?: string) => AppleBusinesChatForms;
  setReplyMessage:  (imageRefIndex: number = 0, title: string = 'default title',style:AppleIconStyles = 'icon', subTitle?: string) => AppleBusinesChatForms;
  addDatePickerPage: (id: string, title: string, subtitle: string, nextPageId: string, isSubmitForm = false, dateFormat = 'MM/DD/YYYY', startDate?: string, minimumDate?: string, maximumDate?: string, labelText?: string) => any;
  addInputPage: (id: string, title: string, subtitle: string, nextPageId: string, isSubmitForm = false, options = {}) => any;
  addPageImpl: (type: string, id: string, title: string, subtitle: string, nextPageId: string, isSubmitForm: string, others = {}) => any;
  addSelectPage: (id: string, title: string, subtitle: string, nextPageId: string | null, isSubmitForm: boolean = false, multipleSelection : boolean = false) => AppleBusinesChatFormsSelectPage;
  send: () => void;
}

interface AppleBusinesChatTimePicker {
  addImageReferenceURL: (url: string = 'https://placeimg.com/840/630/animals') => AppleBusinesChatTimePicker;
  setReceivedMessage: (imageRefIndex: number = 0, title: string = 'default title',style:AppleIconStyles = 'icon', subTitle?: string) => AppleBusinesChatTimePicker;
  setReplyMessage:  (imageRefIndex: number = 0, title: string = 'default title',style:AppleIconStyles = 'icon', subTitle?: string) => AppleBusinesChatTimePicker;
  setEvent: (imageRefIndex: number, title: string, bmVar : string) => AppleBusinesChatTimePicker;
  setLocation: (title: string, latitude: number, longitude: number, radius: number) => AppleBusinesChatTimePicker;
  addTimeItem: (startTime: Date, duration = 600) => AppleBusinesChatTimePicker;
  send: () => void;
}

interface AppleBusinesChatListPickerSection {
  addItem: (itemId: string, title = 'default item title', imageRefIndex?: number, style?: AppleIconStyles, subTitle?: string) => AppleBusinesChatListPickerSection;
}
interface AppleBusinesChatListPicker {
  addImageReferenceURL: (url: string = 'https://placeimg.com/840/630/animals') => AppleBusinesChatListPicker;
  setReceivedMessage: (imageRefIndex: number = 0, title: string = 'default title',style:AppleIconStyles = 'icon', subTitle?: string) => AppleBusinesChatListPicker;
  setReplyMessage:  (imageRefIndex: number = 0, title: string = 'default title',style:AppleIconStyles = 'icon', subTitle?: string) => AppleBusinesChatListPicker;
  addSection: (title : string, multipleSelection = false, bmVar: string) => AppleBusinesChatListPickerSection;
  send: () => void;
}
interface BmResult {
  gotoRule: (gotoRuleName : string) => void
  text: (literal : string) => void
  image: (url: string, message: string) => void
  video: (url: string) => void
  file: (url: string, message: string) => void
  audio: (url: string) => void
  done: () => void
  buttonsBuilder: () => BmButtonsBuilder
  carouselBuilder: () => BmItemsBuilder
  appleBusinesChatCustomInteractiveMessage: (nextIntentName: string) => AppleBusinesChatCustomInteractiveMessage
  appleBusinesChatAuthenticate: (nextIntentName, problemsIntentName) => AppleBusinesChatAuthenticate
  appleBusinesChatApplePay: (nextIntentName, problemsIntentName) => AppleBusinesChatApplePay
  appleBusinesChatForms: (nextIntentName:string, showSummary = false, splashImageRefIndex?: number, splashHeader?: string, splashText?: string, splashButtonTitle?: string) => AppleBusinesChatForms
  appleBusinesChatTimePicker: (nextIntentName) => AppleBusinesChatTimePicker
  appleBusinesChatListPicker: (nextIntentName) => AppleBusinesChatListPicker
}

type BContext = typeof context;
const typedContext : BContext = context; 
const variables = typedContext.userData.variables
type VarNames = keyof typeof variables;

interface BmUser {
  set: (varName: VarNames, value: string) => void,
  get: (varName: VarNames) => string,
}

interface BmConsole {
  log: (...params: any[]) => void,
  warn: (...params: any[]) => void,
  error: (...params: any[]) => void,
}

type PromisifyAllKeys<T> = T extends string ? `${T}Async` : never;
type WithoutLast<T> = T extends [...infer A, any] ? A : [];
type Last<T> = T extends [...any[], infer L] ? L : never;
type ExtractCallbackValueType<T> = T extends (error: any, ...data: infer D) => any ? D : never;

type PromiseMethod<TArgs, TReturn> = TReturn extends never ? never : (...args: WithoutLast<TArgs>) => Promise<TReturn>;

type ExtractAsyncMethod<T> = T extends (...args: infer A) => any
  ? PromiseMethod<A, ExtractCallbackValueType<Last<Required<A>>>[0]>
  : never;

type PromisifyAllItems<T> = {
  [K in keyof T as PromisifyAllKeys<K>]: ExtractAsyncMethod<T[K]>;
};
type NonNeverValues<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};
type PromisifyAll<T> = NonNeverValues<PromisifyAllItems<T>> & T;

type RedisPromisfy =  PromisifyAll<RedisClient>

type ConnectRedis = () => RedisPromisfy;

declare global {
  declare const result: BmResult;
  declare const user: BmUser;
  declare const bmconsole: BmConsole
  declare const rp: RequestPromiseAPI;
  declare const context: BContext;
  declare const connectRedis: ConnectRedis;
  declare const req: Request & {connectRedis: ConnectRedis};
  declare const request: Request & {connectRedis: ConnectRedis};
  declare const res: Response;
  declare const response: Response;
  declare const fs = fs;
  declare const lodash = lodash;
  declare const _ = lodash;
  declare const moment = moment;
  declare const csv = csv;
  declare const md5 = md5;
  declare const sha256 = sha256;
  declare const xml2js = xml2js;
  declare const secureRandom = secureRandom;
  declare const turf = turf;
  declare const turfHelpers = turfHelpers;
  declare const jwt = jwt;
  declare const bluebird = bluebird;
  declare const google = google;
}

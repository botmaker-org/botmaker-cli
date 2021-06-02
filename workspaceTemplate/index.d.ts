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
import awsSdk from  'aws-sdk';
import awsApiClient from  'aws-api-gateway-client';
import amazonCognito from  'amazon-cognito-identity-js';
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
  declare const awsSdk = awsSdk;
  declare const awsApiClient = awsApiClient;
  declare const amazonCognito = amazonCognito;
}

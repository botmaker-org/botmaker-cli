import { Request, Response } from 'express';
import { RedisClient } from 'redis';

type _PromisifyAllKeys<T> = T extends string ? `${T}Async` : never;
type _WithoutLast<T> = T extends [...infer A, any] ? A : [];
type _Last<T> = T extends [...any[], infer L] ? L : never;
type _ExtractCallbackValueType<T> = T extends (error: any, ...data: infer D) => any ? D : never;
type _PromiseMethod<TArgs, TReturn> = TReturn extends never ? never : (...args: _WithoutLast<TArgs>) => Promise<TReturn>;
type _ExtractAsyncMethod<T> = T extends (...args: infer A) => any
  ? _PromiseMethod<A, _ExtractCallbackValueType<_Last<Required<A>>>[0]>
  : never;
type _PromisifyAllItems<T> = {
  [K in keyof T as _PromisifyAllKeys<K>]: _ExtractAsyncMethod<T[K]>;
};
type _NonNeverValues<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};
type _PromisifyAll<T> = _NonNeverValues<_PromisifyAllItems<T>> & T;
type _RedisPromisfy = _PromisifyAll<RedisClient>;
type _ConnectRedis = () => _RedisPromisfy;

declare global {
  const req: Request & { connectRedis: _ConnectRedis };
  const request: Request & { connectRedis: _ConnectRedis };
  const res: Response;
  const response: Response;
}

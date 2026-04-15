declare global {
  declare const req: import('express').Request & { connectRedis: () => any };
  declare const request: import('express').Request & { connectRedis: () => any };
  declare const res: import('express').Response;
  declare const response: import('express').Response;
}

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

export {};

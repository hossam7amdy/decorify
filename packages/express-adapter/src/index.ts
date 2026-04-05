import type { Application, Request, Response, NextFunction } from "express";
import express from "express";
import type {
  HttpAdapter,
  HttpContext,
  RouteHandler,
  MiddlewareHandler,
  ErrorHandler,
} from "@decorify/core";
import type { Server } from "node:http";

declare module "@decorify/core" {
  interface InjectableAdapter extends Application {}
  interface InjectableContext {
    req: Request;
    res: Response;
  }
}

export class ExpressAdapter implements HttpAdapter<Application> {
  private app: Application;
  private server: Server | null = null;

  constructor(app?: Application) {
    this.app = app ?? express();
    this.app.use(express.json());
  }

  registerRoute(method: string, path: string, handler: RouteHandler): void {
    this.app[method as keyof Application](
      path,
      (req: Request, res: Response, next: NextFunction) => {
        const ctx = this.createContext(req, res);
        Promise.resolve(handler(ctx)).catch(next);
      },
    );
  }

  useMiddleware(handler: MiddlewareHandler): void {
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const ctx = this.createContext(req, res);
      Promise.resolve(
        handler(ctx, async () => {
          await new Promise<void>((resolve, reject) => {
            next((err?: Error) => {
              if (err) reject(err);
              else resolve();
            });
            // If next() is synchronous (no error callback support), resolve immediately
            resolve();
          });
        }),
      ).catch(next);
    });
  }

  useErrorHandler(handler: ErrorHandler): void {
    this.app.use(
      (err: Error, req: Request, res: Response, _next: NextFunction) => {
        const ctx = this.createContext(req, res);
        handler(err, ctx);
      },
    );
  }

  async listen(port: number, callback?: () => void): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        callback?.();
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  getInstance(): Application {
    return this.app;
  }

  private createContext(req: Request, res: Response): HttpContext {
    let statusCode = 200;

    const ctx: HttpContext = {
      method: req.method.toLowerCase(),
      path: req.path,
      params: (req.params ?? {}) as Record<string, string>,
      query: req.query as Record<string, string | string[] | undefined>,
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body,

      status(code: number) {
        statusCode = code;
        return ctx;
      },

      json(data: unknown) {
        res.status(statusCode).json(data);
      },

      send(data: string | Buffer) {
        res.status(statusCode).send(data);
      },

      setHeader(name: string, value: string) {
        res.setHeader(name, value);
        return ctx;
      },

      raw: { req, res },
    };

    return ctx;
  }
}

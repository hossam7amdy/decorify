# @decorify/express

[Express 5](https://expressjs.com/) adapter for [`@decorify/core`](../core). Translates between Express `req`/`res` and the `HttpContext` interface.

## Installation

```bash
pnpm add @decorify/express express
```

> Express 5 is a peer dependency. Node.js >= 22 required.

## Usage

```ts
import { Application, defineModule } from "@decorify/core";
import { ExpressAdapter } from "@decorify/express";
import { UserController } from "./user.controller.js";

const app = await Application.create({
  adapter: new ExpressAdapter(),
  modules: [
    defineModule({
      name: "user",
      controllers: [UserController],
    }),
  ],
});

await app.listen(3000);
```

### Options

```ts
const adapter = new ExpressAdapter({ jsonLimit: "5mb" }); // default: "1mb"
```

### Accessing the Express instance

Use `adapter.native` to access the underlying Express application for framework-specific configuration (third-party middleware, trust proxy, etc.):

```ts
const adapter = new ExpressAdapter();
adapter.native.set("trust proxy", 1);
adapter.native.use(compression());

const app = await Application.create({ adapter, modules: [...] });
```

Alternatively, access it after creation via `app.getAdapter()`:

```ts
const app = await Application.create({ adapter: new ExpressAdapter(), modules: [...] });
import type { ExpressAdapter } from "@decorify/express";
const expressApp = app.getAdapter<ExpressAdapter>().native;
```

## What it does

- Automatically mounts `express.json()` and `express.urlencoded()` middleware so request bodies are parsed out of the box.
- Translates Express `req`/`res` objects into `HttpContext` for every route.
- Exposes `ctx.raw.req` and `ctx.raw.res` as an escape hatch to the native Express objects.
- Implements graceful shutdown via `server.close()`.
- Disables the `X-Powered-By` header.

## API

### `new ExpressAdapter(opts?)`

Creates an adapter with a fresh Express application.

| Option      | Type     | Default | Description                                |
| ----------- | -------- | ------- | ------------------------------------------ |
| `jsonLimit` | `string` | `"1mb"` | Max request body size for `express.json()` |

### `adapter.native`

The underlying `express.Application` instance.

### `ExpressContext`

A typed alias for `HttpContext<Request, Response>` from Express. Import it for use in middleware or helpers that need access to Express-native types via `ctx.raw`:

```ts
import type { ExpressContext } from "@decorify/express";
import type { Middleware } from "@decorify/core";

const expressMiddleware: Middleware = (ctx, next) => {
  const { req, res } = (ctx as ExpressContext).raw;
  // req and res are typed as Express Request / Response
  return next();
};
```

## License

ISC © [Hossam Hamdy](mailto:hossamhamdy117@gmail.com)

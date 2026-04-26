# @decorify/fastify

[Fastify 5](https://fastify.dev/) adapter for [`@decorify/core`](../core). Translates between Fastify `request`/`reply` and the `HttpContext` interface.

## Installation

```bash
pnpm add @decorify/fastify fastify
```

> Fastify 5 is a peer dependency. Node.js >= 22 required.

## Usage

```ts
import { Application, defineModule } from "@decorify/core";
import { FastifyAdapter } from "@decorify/fastify";
import { UserController } from "./user.controller.js";

const app = await Application.create({
  adapter: new FastifyAdapter(),
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
const adapter = new FastifyAdapter({ bodyLimit: 5242880 }); // 5mb
```

### Accessing the Fastify instance

Use `adapter.native` to access the underlying Fastify instance for framework-specific configuration:

```ts
import fastifyCors from "@fastify/cors";

const adapter = new FastifyAdapter();
await adapter.native.register(fastifyCors);

const app = await Application.create({ adapter, modules: [...] });
```

Alternatively, access it after creation via `app.getAdapter()`:

```ts
const app = await Application.create({ adapter: new FastifyAdapter(), modules: [...] });
import type { FastifyAdapter } from "@decorify/fastify";
const fastifyInstance = app.getAdapter<FastifyAdapter>().native;
```

## What it does

- Configures Fastify's `bodyLimit` out of the box (defaults to `100kb` for consistency with other adapters).
- Translates Fastify `request`/`reply` objects into `HttpContext` for every route.
- Exposes `ctx.raw.req` and `ctx.raw.res` as an escape hatch to the native Fastify objects.
- Implements graceful shutdown via `fastify.close()`.

## API

### `new FastifyAdapter(opts?)`

Creates an adapter with a fresh Fastify instance.

| Option      | Type              | Default     | Description                                  |
| ----------- | ----------------- | ----------- | -------------------------------------------- |
| `bodyLimit` | `number`          | `100000`    | Max request body size in bytes               |
| `instance`  | `FastifyInstance` | `undefined` | Optionally pass an existing Fastify instance |

### `adapter.native`

The underlying `FastifyInstance`.

### `FastifyContext`

A typed alias for `HttpContext<FastifyRequest, FastifyReply>`. Import it for use in middleware or helpers that need access to Fastify-native types via `ctx.raw`:

```ts
import type { FastifyContext } from "@decorify/fastify";
import type { Middleware } from "@decorify/core";

const fastifyMiddleware: Middleware = (ctx, next) => {
  const { req, res } = (ctx as FastifyContext).raw;
  // req and res are typed as Fastify Request / Reply
  return next();
};
```

## License

ISC © [Hossam Hamdy](mailto:hossamhamdy117@gmail.com)

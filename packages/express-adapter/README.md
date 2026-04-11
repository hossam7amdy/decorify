# @decorify/express-adapter

[Express 5](https://expressjs.com/) adapter for [`@decorify/core`](../core). Translates between Express `req`/`res` and the `HttpContext` interface.

## Installation

```bash
pnpm add @decorify/express-adapter express
```

> Express 5 is a peer dependency. Node.js >= 22 required.

## Usage

```ts
import { Application } from "@decorify/core";
import { ExpressAdapter } from "@decorify/express-adapter";
import { UserController } from "./user.controller.js";

const app = new Application(new ExpressAdapter());

app.register([UserController]);

await app.listen(3000, () => console.log("Listening on port 3000"));
```

### Bring your own Express instance

If you need to configure Express before passing it to the adapter (e.g. to add third-party middleware or configure trust proxy settings), pass an existing app instance:

```ts
import express from "express";
import { ExpressAdapter } from "@decorify/express-adapter";

const expressApp = express();
expressApp.set("trust proxy", 1);

const adapter = new ExpressAdapter(expressApp);
```

### Accessing the Express instance

Use `app.adapter.getInstance()` to retrieve the underlying Express application for framework-specific configuration:

```ts
const adapter = new ExpressAdapter();
const app = new Application(adapter);

// Access the Express app directly
const expressApp = adapter.getInstance();
expressApp.set("trust proxy", 1);
```

## What it does

- Automatically mounts `express.json()` middleware so request bodies are parsed out of the box.
- Translates Express `req`/`res` objects into `HttpContext` for every route.
- Exposes `raw.req` and `raw.res` on `HttpContext` as an escape hatch to the Express-native objects.
- Implements graceful shutdown via `server.close()`.

## API

### `new ExpressAdapter(app?)`

Creates an adapter. If `app` is omitted a new Express application is created internally.

### `adapter.getInstance(): express.Application`

Returns the underlying Express application.

## License

ISC © [Hossam Hamdy](mailto:hossamhamdy117@gmail.com)

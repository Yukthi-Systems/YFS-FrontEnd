# yfs-monorepo guide

A minimal monorepo. One web app today, room for a mobile app later, and
shared code packages both can use.

## Folder layout

```
yfs-monorepo/
├── apps/
│   ├── web/        Vite + React + TypeScript app (working, run this)
│   └── mobile/      placeholder for a future Expo/React Native app
├── packages/
│   ├── utils/       shared pure helper functions (capitalize, formatCurrency, ...)
│   └── service/      shared code that talks to the outside world (HTTP calls)
├── package.json     root workspace config
└── tsconfig.base.json
```

- `apps/*` — things you run (websites, mobile apps).
- `packages/*` — things you import (shared code, no app of its own).

This is an **npm workspaces** monorepo. There's nothing exotic installed —
it's plain `npm`, which you already have. Every folder in `apps/*` and
`packages/*` that has its own `package.json` is a "workspace". Running
`npm install` once at the repo root installs dependencies for all of them
together and links the local packages to each other automatically.

## How to run it

From the repo root:

```bash
npm install          # once, or whenever a package.json changes
npm run dev           # starts apps/web on http://localhost:5173
```

Other useful commands, also run from the root:

```bash
npm run build          # builds apps/web for production
npm run typecheck      # type-checks every workspace that has a typecheck script
```

You can also target one workspace directly with `-w <name>`, e.g.:

```bash
npm run dev -w @yfs/web
npm run typecheck -w @yfs/utils
```

(The `-w` name is the `"name"` field in that workspace's `package.json`, not
its folder name.)

## How the import/export wiring works

Each workspace is just a normal npm package with a `name` in its
`package.json` (we use the `@yfs/` prefix so they're easy to spot:
`@yfs/web`, `@yfs/utils`, `@yfs/service`, `@yfs/mobile`).

To use one workspace's code from another:

1. Add it as a dependency in the consumer's `package.json`, using `"*"` as
   the version (means "whatever version lives in this repo"):

   ```json
   "dependencies": {
     "@yfs/utils": "*"
   }
   ```

2. Run `npm install` from the repo root. npm creates a symlink in
   `node_modules/@yfs/utils` pointing straight at `packages/utils`, so
   there's no publishing, no copying, no build step to consume it.

3. Import it like any normal package:

   ```ts
   import { capitalize } from "@yfs/utils";
   ```

That's the whole mechanism. Edit a file in `packages/utils/src`, save, and
any app that imports it (with its dev server running) hot-reloads
immediately — because it's really just reading files through a symlink, not
a separately built artifact.

### Live example in this repo

- [`packages/utils/src/index.ts`](packages/utils/src/index.ts) exports a
  couple of small pure functions (`capitalize`, `slugify`, `formatCurrency`)
  — no side effects, no network calls.
- [`packages/service/src/index.ts`](packages/service/src/index.ts) exports
  `getJson`, a tiny `fetch` wrapper for calling an API. `packages/service`
  is where code that talks to a backend belongs, as opposed to `packages/utils`
  which is for plain data-in/data-out helpers.
- [`apps/web/src/App.tsx`](apps/web/src/App.tsx) imports and uses both:

  ```ts
  import { capitalize, slugify, formatCurrency } from "@yfs/utils";
  import { getJson } from "@yfs/service";
  ```

  The page fetches `apps/web/public/example.json` through `getJson` as a
  stand-in for a real API call — point it at an actual URL once there's a
  backend.

Run `npm run dev`, open the page, edit
`packages/utils/src/string.ts` — for example change what `capitalize` does —
save, and watch the web app update without restarting anything.

## Adding a new shared package

```bash
mkdir packages/my-thing
```

Give it a `package.json` (copy `packages/utils/package.json` and rename),
and a `tsconfig.json` that extends the root one:

```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "noEmit": true }, "include": ["src"] }
```

Then `npm install` from the root, add it as a dependency wherever you want
to use it, and import it the same way as `@yfs/utils`.

## Adding a new app

For a second web app, scaffold it the same way `apps/web` was made:

```bash
npm create vite@latest apps/<name> -- --template react-ts
```

Then rename `"name"` in its `package.json` to `@yfs/<name>`, add any shared
`packages/*` you need as dependencies, and `npm install` from the root.

For the mobile app, see [`apps/mobile/README.md`](apps/mobile/README.md) —
it explains how to scaffold it with Expo when you're ready, following the
same pattern.

## Why this setup (and not something fancier)

No Turborepo, Nx, or pnpm — just npm workspaces, because it needs zero
extra tools beyond Node/npm and is enough for a project this size. If the
repo grows to many packages and slow builds become a real problem, a build
orchestrator can be layered on top later without changing this folder
structure.

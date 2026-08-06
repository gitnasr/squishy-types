# @squishy/types

The contract between the Squishy extension, web app and API. Three independent
repos talk to each other; this package is the only place they agree.

Contains:

- **`src/types/`** — every interface and type alias in the package
- **`src/schemas/`** — Zod schemas for everything that crosses the wire
- **`src/url/`** — `canonicalizeUrl`, `urlHash`, `parseUrl` and a self-contained SHA-256
- **`src/report/`** — the cleanup-report engine (pure: no I/O, no `chrome.*`)
- **`src/protocol.ts`** — `PROTOCOL_VERSION` and the header names

Runtime dependencies: `zod`. Nothing else — this ships inside a browser
extension bundle.

## Installing it

```
"@squishy/types": "git+ssh://git@github.com/gitnasr/squishy-types.git#v0.1.0"
```

`prepare` runs `tsup` on install, so git consumers get a built `dist/` without
this repo publishing anywhere. Two consequences:

- **Docker builds need git+SSH.** Use BuildKit `--mount=type=ssh` in the install
  stage, or a read-only deploy key. Never bake a token into an image layer.
- **CI needs the same key**, as an Actions secret in every consumer repo.

## The rules

**1. Types live in `src/types/`.** No `interface` or `type` declared next to
implementation code, in this repo or any consumer. ESLint enforces it:

```js
'no-restricted-syntax': ['error',
  { selector: 'TSInterfaceDeclaration', message: 'Declare in src/types/' },
  { selector: 'TSTypeAliasDeclaration', message: 'Declare in src/types/' },
]
```

`src/types/**` and `test/**` are exempt. Inline object literals in a signature
are fine — the rule targets named declarations.

**2. Schemas and types cannot drift.** `src/types/assertions.ts` pins every wire
contract with a mutual-assignability check. Edit a schema without editing its
type and `pnpm typecheck` fails.

**3. `urlHash` is forever.** It decides dedupe and cross-device bookmark
identity. Changing `canonicalizeUrl` re-partitions every user's data, so it is a
migration, not a patch. SHA-256 is implemented in-repo rather than pulled from a
dependency for exactly this reason.

## Bump ritual

1. Change the code. Add or update the assertion in `src/types/assertions.ts`.
2. `pnpm typecheck && pnpm test && pnpm lint`
3. Bump `version` in `package.json`. Breaking changes to `sync.ts` or
   `proposal.ts` are **major**, and also bump `PROTOCOL_VERSION`.
4. Tag: `git tag v1.2.3 && git push --tags`
5. Open the bump PR in `squishy-api`, `squishy-web` and `squishy-extension`.

When `PROTOCOL_VERSION` moves, the API must keep serving N-1 for at least one
extension release cycle — users sit on stale builds for weeks. `MIN_SUPPORTED_PROTOCOL`
is the floor; below it the API answers `426 Upgrade Required`.

Consumers must pin a `v*` tag, never a branch or a SHA. Add a CI check that
fails the build otherwise, or "temporarily point at main" becomes permanent.

## Scripts

```
pnpm build       tsup → dist (ESM + CJS + .d.ts)
pnpm typecheck   tsc --noEmit, including the drift assertions
pnpm test        vitest
pnpm lint        eslint src test
```

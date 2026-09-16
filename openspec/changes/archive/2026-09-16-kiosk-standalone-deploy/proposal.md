## Why

Running `kiosk-standalone` on field devices (e.g., Android devices running Termux or single-board computers) currently requires cloning the entire repository, installing monorepo tooling/dependencies (`pnpm install`), and compiling the application locally with memory workarounds (`NODE_OPTIONS=--max-old-space-size=1536`). This is slow, resource-intensive, and prone to out-of-memory failures on constrained hardware.

In contrast, `dual-telescope` uses an isolated orphan deployment branch (`deploy/dual-telescope`) containing only pre-built production assets (`dist/`), a portable runner (`start.sh`), and a zero-dependency server. Target devices clone only that branch with `--single-branch --depth 1` and run the app immediately without compilation or dependency installation. Bringing `kiosk-standalone` to this identical deployment pattern solves field startup friction and unifies deployment across the project.

## What Changes

- Add production packaging script `scripts/pack-deploy.mjs` to `apps/kiosk-standalone` that validates the production build, copies `dist/`, `start.sh`, and `server.mjs` into `apps/kiosk-standalone/deploy/`.
- Implement a zero-dependency static HTTP server `server.mjs` for `kiosk-standalone` using Node built-in modules (`http`, `fs/promises`, `path`, `os`) to serve `dist/` with correct MIME types (including `.wasm` for Stellarium Web Engine) on a configurable port (defaulting to 5174 or 8080).
- Add a portable runner `start.sh` for `kiosk-standalone` that handles directory changes, checks for pre-built `dist/`, supports `PULL=1` fast-forward updates, and executes `exec node server.mjs`.
- Add publication script `scripts/publish-deploy.mjs` to `apps/kiosk-standalone` that synchronizes `deploy/` into an orphan branch `deploy/kiosk-standalone` via `.deploy-worktree`, ensures git execution bit (`--chmod=+x start.sh`), commits with provenance referencing `main`, and pushes to `origin` when `--push` is passed.
- Add `pack:deploy` and `publish:deploy` npm scripts to `apps/kiosk-standalone/package.json`.
- Update `docs/deployment.md` and `README.md` to document the build, publication, and device startup commands for `kiosk-standalone`.

## Capabilities

### New Capabilities
- `kiosk-standalone-deployment`: Packaging pre-built static artifacts and a zero-dependency launcher, maintaining the isolated `deploy/kiosk-standalone` orphan branch, and providing the standalone execution lifecycle on target devices.

### Modified Capabilities
(none)

## Impact

- `apps/kiosk-standalone/package.json`: new `pack:deploy` and `publish:deploy` scripts.
- `apps/kiosk-standalone/server.mjs`: new static HTTP server without third-party dependencies.
- `apps/kiosk-standalone/start.sh`: new device entry point script.
- `apps/kiosk-standalone/scripts/pack-deploy.mjs`: new packaging utility.
- `apps/kiosk-standalone/scripts/publish-deploy.mjs`: new branch publication utility.
- `docs/deployment.md` & `README.md`: deployment and device setup instructions updated to document `deploy/kiosk-standalone`.
- No changes to `packages/core` or other applications.


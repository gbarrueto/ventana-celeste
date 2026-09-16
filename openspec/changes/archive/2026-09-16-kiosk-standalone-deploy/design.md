## Context

See `proposal.md` for motivation. Currently, `dual-telescope` uses an automated packaging and publication system (`apps/dual-telescope/scripts/pack-deploy.mjs`, `apps/dual-telescope/scripts/publish-deploy.mjs`, `apps/dual-telescope/start.sh`) that deploys pre-built assets to an orphan branch (`deploy/dual-telescope`). Target field devices running Termux or Linux clone only that single branch without monorepo dependencies or compiler toolchains.

`kiosk-standalone` currently has `dev`, `build`, and `preview` scripts, but lacks deployment scripts and an independent launcher. Running it on field devices currently requires pulling the entire monorepo and running build commands locally under memory constraints.

## Goals / Non-Goals

**Goals:**
- Provide `apps/kiosk-standalone/server.mjs`: a standalone, zero-dependency HTTP server implemented with Node.js built-ins (`node:http`, `node:fs/promises`, `node:path`, `node:os`) that serves `dist/` with correct MIME types (especially `application/wasm` for Stellarium Web Engine) and basic security guards.
- Provide `apps/kiosk-standalone/start.sh`: a portable bash launcher script supporting `PULL=1` fast-forward updates and starting `server.mjs`.
- Provide `apps/kiosk-standalone/scripts/pack-deploy.mjs`: packaging script that builds/validates `dist/` and stages `deploy/` with `dist/`, `start.sh`, and `server.mjs`.
- Provide `apps/kiosk-standalone/scripts/publish-deploy.mjs`: publishing script that pushes `deploy/` to an orphan git branch `deploy/kiosk-standalone` using a temporary `.deploy-worktree`, marks executable permissions on `start.sh`, and records source revision from `main`.
- Add `pack:deploy` and `publish:deploy` commands to `apps/kiosk-standalone/package.json`.
- Document deployment and device startup instructions in `docs/deployment.md` and `README.md`.

**Non-Goals:**
- No changes to `apps/dual-telescope`, `apps/web-app`, `apps/device-lab`, or `packages/core`.
- No changes to UI components or sensors within `apps/kiosk-standalone/src/`.
- No WebSocket relay functionality: `kiosk-standalone` is a single-device standalone instrument, so it only requires static HTTP file serving.

## Decisions

### Decision 1: Pure Node.js standard library static server (`server.mjs`)
- **Rationale**: `dual-telescope` uses `esbuild` during packaging because its server imports `ws` for two-way communication between the ocular and guide phones. `kiosk-standalone` does not have or need a WebSocket relay; it is an offline single-device kiosk. A ~50-line script using `node:http`, `node:fs/promises`, `node:path`, and `node:os` provides all required capabilities (file serving, proper MIME types including `.wasm`, path traversal checks, port selection, loopback and LAN address logging) with zero third-party dependencies and without requiring an `esbuild` bundling step.
- **Alternatives considered**:
  - *Bundling a package like `sirv` or `serve` via `esbuild`*: Adds packaging complexity and build steps for minimal gain.
  - *Python `http.server`*: Requires Python runtime installed on target devices. Node is already the standard runtime across all VentanaCeleste devices.

### Decision 2: Port configuration and default
- **Rationale**: Default port is set to `5174` (matching `kiosk-standalone`'s dev port established in `README.md`), configurable via the `PORT` environment variable (e.g., `PORT=8080 ./start.sh`). This avoids colliding with `dual-telescope`'s default port (`8080`) when testing on local networks.
- **Alternatives considered**:
  - *Hardcoding 8080*: Could conflict with `dual-telescope` or other services on device.

### Decision 3: Orphan branch workflow via `.deploy-worktree`
- **Rationale**: Mirroring `dual-telescope`'s approach, `publish-deploy.mjs` manages the orphan branch `deploy/kiosk-standalone` through `.deploy-worktree` at the root of the repository. This guarantees that publishing never modifies the active working directory, resets the orphan branch contents cleanly, commits with metadata referencing the `main` branch HEAD, and sets `--chmod=+x start.sh` in the git index.
- **Alternatives considered**:
  - *Tag-based releases or GitHub releases tarball*: Does not allow target devices to easily update in-place with `PULL=1 ./start.sh` via standard git.

### Decision 4: Portable launcher script `start.sh`
- **Rationale**: Use `#!/usr/bin/env bash` and `set -euo pipefail`. Validate that `dist/` and `server.mjs` are present before launching. Support `PULL=1` for single-command updates from git remote.
- **Alternatives considered**:
  - *Termux-specific shebang (`/data/data/com.termux/files/usr/bin/bash`)*: Fails when executed on standard Linux/macOS/PC. `env bash` is portable and Termux rewrites it via `termux-exec`.

## Risks / Trade-offs

- **[MIME types for WebAssembly]** → Stellarium Web Engine requires `.wasm` files to be served with `application/wasm`. If served as `application/octet-stream`, browsers may refuse to compile the streaming module.
  - *Mitigation*: Explicitly define `.wasm: 'application/wasm'` in the MIME map of `server.mjs`.
- **[Windows executable permission loss]** → On Windows, git filemode tracking (`core.filemode=false`) can strip executable bits from `start.sh`.
  - *Mitigation*: As in `dual-telescope`, `publish-deploy.mjs` runs `gitIn(wt, 'update-index', '--chmod=+x', 'start.sh')` before committing.
- **[Publication without pushed `main`]** → The deployment commit message embeds the short git revision of `HEAD`.
  - *Mitigation*: Documentation explicitly reminds operators to push `main` before publishing, matching `dual-telescope`.

## Migration Plan

1. Operators run `pnpm --filter @ventanaceleste/kiosk-standalone pack:deploy` followed by `pnpm --filter @ventanaceleste/kiosk-standalone publish:deploy -- --push`.
2. Target devices run a shallow clone of the new branch:
   ```bash
   git clone --branch deploy/kiosk-standalone --single-branch --depth 1 <repo> ventana-kiosk
   cd ventana-kiosk && ./start.sh
   ```
3. Subsequent updates on device are fetched with `PULL=1 ./start.sh`.


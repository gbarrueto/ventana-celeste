## 1. Runtime Scripts and Static Server

- [x] 1.1 Create `apps/kiosk-standalone/server.mjs` implementing a zero-dependency static file server using Node.js standard library (`http`, `fs/promises`, `path`, `os`), with correct MIME mapping (including `application/wasm`), path traversal protection, and address printing. Verify by running the server against a built `dist/` directory and checking HTTP 200 responses.
- [x] 1.2 Create `apps/kiosk-standalone/start.sh` with portable bash shebang (`#!/usr/bin/env bash`), `set -euo pipefail`, checking for `dist/`, supporting `PULL=1` fast-forward git pull, and invoking `exec node server.mjs`. Verify script fails informatively when `dist/` is absent.

## 2. Packaging and Publication Utilities

- [x] 2.1 Create `apps/kiosk-standalone/scripts/pack-deploy.mjs` to clean/create `apps/kiosk-standalone/deploy/`, verify `dist/` existence, and copy `dist/`, `start.sh`, and `server.mjs` into `deploy/`. Verify execution populates `deploy/` with all required runtime assets.
- [x] 2.2 Create `apps/kiosk-standalone/scripts/publish-deploy.mjs` to manage the orphan branch `deploy/kiosk-standalone` using `.deploy-worktree`, ensuring `start.sh` executable bit is recorded in the git index (`--chmod=+x`), recording provenance commit referencing `main` HEAD, and supporting `--push`. Verify script executes in dry-run mode (without push) and creates a clean commit on the local branch.
- [x] 2.3 Add `pack:deploy` and `publish:deploy` scripts to `apps/kiosk-standalone/package.json`. Verify running `pnpm --filter @ventanaceleste/kiosk-standalone run pack:deploy` successfully builds and packages the application.

## 3. Documentation and End-to-End Verification

- [x] 3.1 Update `docs/deployment.md` and `README.md` to document the deployment workflow, branch name (`deploy/kiosk-standalone`), packaging, publication, and target device setup commands for `kiosk-standalone`. Verify text and examples are consistent across documents.
- [x] 3.2 Perform end-to-end verification: build `kiosk-standalone`, run `pack:deploy`, verify `start.sh` execution and MIME type serving (specifically `text/html` and `application/wasm`), and verify that no development dependencies or uncompiled source code are staged in `deploy/`.


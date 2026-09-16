## Purpose

Provides packaging, orphan branch publishing (`deploy/kiosk-standalone`), standalone launcher execution, and static HTTP serving for the `kiosk-standalone` application without requiring build tools or dependencies on target devices.

## Requirements

### Requirement: Production packaging for standalone deployment
The system SHALL provide an automated packaging process for `kiosk-standalone` that stages the pre-compiled distribution directory (`dist/`), the portable launcher (`start.sh`), and the standalone static HTTP server (`server.mjs`) into a dedicated `deploy/` directory.

#### Scenario: Successful packaging
- **WHEN** operator executes `pnpm run pack:deploy` after building the application
- **THEN** the `deploy/` directory is created containing `dist/`, `start.sh`, and `server.mjs` ready for distribution.

#### Scenario: Missing build directory
- **WHEN** operator executes `pnpm run pack:deploy` when `dist/` does not exist
- **THEN** the script exits with code 1 and prints an error instructing to run `pnpm build` first.

### Requirement: Orphan branch publication
The system SHALL publish the contents of `deploy/` to an isolated orphan branch named `deploy/kiosk-standalone` via an out-of-tree git worktree, ensuring launcher execution permissions and commit provenance referencing `main`.

#### Scenario: Orphan branch update with provenance
- **WHEN** operator runs `pnpm run publish:deploy`
- **THEN** the branch `deploy/kiosk-standalone` is updated with the exact contents of `deploy/`, `start.sh` is flagged as executable in the git index (`chmod +x`), and a commit is created referencing the source commit hash of `main`.

#### Scenario: Idempotent publication
- **WHEN** operator runs `pnpm run publish:deploy` and no files in `deploy/` have changed since the previous publication
- **THEN** no redundant commit is created and the script reports that there are no changes.

#### Scenario: Remote push flag
- **WHEN** operator runs `pnpm run publish:deploy -- --push` or sets environment variable `PUSH=1`
- **THEN** the `deploy/kiosk-standalone` branch is pushed upstream to `origin`.

### Requirement: Standalone device startup and update
The target device launcher `start.sh` SHALL run using portable bash, execute with zero external npm dependencies or compilation tools, and support updating via git fast-forward.

#### Scenario: Normal device startup
- **WHEN** operator executes `./start.sh` on the target device
- **THEN** the script verifies that `dist/` and `server.mjs` exist and starts the application via `exec node server.mjs`.

#### Scenario: Update before launch
- **WHEN** operator executes `PULL=1 ./start.sh` on the target device
- **THEN** the script performs `git pull --ff-only` before starting the server.

#### Scenario: Missing dist abort
- **WHEN** operator executes `./start.sh` and `dist/` is absent
- **THEN** the script aborts with an error explaining that the device does not compile and exits with code 1.

### Requirement: Zero-dependency static HTTP serving
The static server `server.mjs` SHALL serve pre-built files from `dist/` using only Node.js built-in standard library modules, binding to a configurable port, preventing path traversal, and serving correct MIME types including WebAssembly.

#### Scenario: Serving HTML and WebAssembly
- **WHEN** HTTP client requests `/` or a `.wasm` file
- **THEN** the server returns status 200 with `text/html; charset=utf-8` for `/` and `application/wasm` for `.wasm`.

#### Scenario: Path traversal defense
- **WHEN** HTTP client requests a path containing `../` that resolves outside `dist`
- **THEN** the server responds with status 403 Forbidden.

#### Scenario: Startup URL logging
- **WHEN** `server.mjs` starts listening
- **THEN** it prints the local loopback URL (`http://localhost:<PORT>/`) and available LAN interface addresses to stdout.


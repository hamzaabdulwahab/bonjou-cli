# Bonjou Repository Guidelines

This document provides project-wide instructions and rules for AI agents working in this repository.

## Build, Test, and Development Commands
- `go run ./cmd/bonjou` — run the CLI locally
- `go run ./cmd/bonjou-relay` — run the web relay locally (listens on `127.0.0.1:46330`)
- `go test ./...` — full test suite; `go test ./internal/network -run TestName` for a single test
- `./scripts/deploy-relay.sh` — cross-compile the relay and install it on the server
- `cd website && npm run build` — build the marketing page and the share app
- `cd website && npm test` — browser-side protocol tests (must pass alongside `go test`)
- `gofmt -w <file>` — required before committing, no exceptions
- `golangci-lint run ./...` — lint the module (config in `.golangci.yml`)
- `./scripts/build.sh` — cross-compile Linux/macOS/Windows binaries into `dist/bin/`
- `./scripts/package.sh` — build release artifacts + package metadata under `dist/`

## Code Style & Naming Conventions
- **Receiver names** are fixed per type — match existing methods (`t` `*TransferService`, `d` `*DiscoveryService`, `s` `*Session`, `h` `*Handler`, `m` `*Manager`, `l` `*Logger`, `c` `*Config`). In `internal/relay`: `r` `*Room`, `h` `*Hub`, `p` `*Peer`, `c` `*Conn`, `v` `*Rendezvous`, `x` `*transfer`, `s` `*Server`.
- **Sentinel errors**: unexported `errCamelCase`, exported `ErrPascalCase`. Handler command methods: `cmd` + PascalCase (`cmdSend`, `cmdFile`).
- **Error wrapping**: Use `fmt.Errorf("lowercase context: %w", err)` — no trailing punctuation.
- **File permissions**: Use `0o`-prefixed octal (`0o755`, `0o644`, `0o600`).
- **Imports**: Grouped stdlib → third-party → internal, blank line between groups.
- **Forbidden**: stdlib `log` (use `internal/logger`), `panic`, `math/rand` for security values (use `crypto/rand`), or third-party test frameworks (stdlib `testing` only).
- **Platform-specific code**: Provide both a `_windows.go` and a `_other.go`/`_unix.go` file with matching `//go:build` constraints.

## Architecture Rules
- All Go code lives under `cmd/` and `internal/`. There are exactly two binaries — `cmd/bonjou` (the CLI) and `cmd/bonjou-relay` (the web relay). Never create new top-level directories.
- **The relay is a dumb pipe.** `internal/relay` must never import `internal/network`, hold key material, or decrypt anything. It routes on a destination peer id and forwards opaque payloads. If a change would give the relay the ability to read user content, the change is wrong.
- **Two implementations of protocol v2.** The wire format lives in `internal/network` (Go) and `website/src/share/crypto.ts` (browser). They are kept honest by known-answer vectors: `internal/network/vectors_test.go` generates `website/src/share/vectors/protocol-v2.json`, and `website/src/share/crypto.test.ts` asserts the browser reproduces it byte for byte. Changing the wire format means updating both sides and regenerating with `BONJOU_WRITE_VECTORS=1 go test ./internal/network -run TestProtocolV2Vectors`.
- `internal/` packages never write to `os.Stdout` — user-facing output goes through `ui.UI` or `Result.Output`.
- **New `@commands`**: register it in both the `Handle()` switch and `helpText()` in `internal/commands/handler.go`.
- The version lives in two places that must stay in sync: `internal/version/version.go` and the `VERSION` file. Only change them when cutting a release.
- **Wire protocol**: Ask/evaluate carefully before changing `envelope` / `sealedEnvelope` in `transfer.go`, AEAD framing in `crypto.go`, or the TOFU pin format in `known_peers.go`.

## Security Invariants
- **Metadata-first approval**: never write an incoming file/folder payload before the user explicitly approves it.
- **Sign/Verify**: Do not bypass `signEnvelope` / `verifyEnvelope`.
- **Sanitize paths**: Sanitize peer-supplied paths with `uniquePath` / `UniquePath` before writing under `~/.bonjou/received/`.
- **Secrets**: `config.json` is written `0o600`; never log the `Config.Secret` field. Load/persist secrets through `internal/config/secretstore.go`.
- **Relay nginx config**: `proxy_request_buffering off` is mandatory. Without it nginx spools every upload to disk before forwarding, which silently turns a relay that stores nothing into one that writes every file to `/var/lib/nginx`.

## Links
- [CLAUDE.md](CLAUDE.md)
- [DESIGN.md](DESIGN.md)
- [PRODUCT.md](PRODUCT.md)


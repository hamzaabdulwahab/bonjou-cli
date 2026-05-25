# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bonjou is a terminal LAN chat and file-transfer CLI written in Go. It discovers peers via UDP broadcast (port 46320) and exchanges messages/files over TCP (port 46321) — no server, no internet. It runs as a single long-lived process with a readline prompt and a Charmbracelet TUI layer. macOS, Windows, and Linux are equal first-class platforms.

`.rules` at the repo root holds the full naming/style/architecture conventions — consult it before non-trivial changes. `website/` is a separate Next.js project with its own tooling.

## Commands

- `go run ./cmd/bonjou` — run the CLI locally
- `go test ./...` — full test suite; `go test ./internal/network -run TestName` for a single test
- `gofmt -w <file>` — required before committing, no exceptions
- `golangci-lint run ./...` — lint the module (config in `.golangci.yml`)
- `./scripts/build.sh` — cross-compile Linux/macOS/Windows binaries into `dist/bin/`
- `./scripts/package.sh` — build release artifacts + package metadata under `dist/`

## Code style (differs from Go defaults)

- Receiver names are fixed per type — match existing methods (`t` `*TransferService`, `d` `*DiscoveryService`, `s` `*Session`, `h` `*Handler`, `m` `*Manager`, `l` `*Logger`, `c` `*Config`).
- Sentinel errors: unexported `errCamelCase`, exported `ErrPascalCase`. Handler command methods: `cmd` + PascalCase (`cmdSend`, `cmdFile`).
- Wrap errors `fmt.Errorf("lowercase context: %w", err)` — no trailing punctuation.
- File permissions use `0o`-prefixed octal (`0o755`, `0o644`, `0o600`).
- Imports grouped stdlib → third-party → internal, blank line between groups.
- Do not use: stdlib `log` (use `internal/logger`), `panic`, `math/rand` for security values (use `crypto/rand`), or third-party test frameworks (stdlib `testing` only).

## Architecture rules

- All Go code lives in `cmd/bonjou/main.go` (wiring only) and `internal/`. Never create new top-level directories.
- Platform-specific code: provide both a `_windows.go` and a `_other.go`/`_unix.go` file with matching `//go:build` constraints.
- `internal/` packages never write to `os.Stdout` — user-facing output goes through `ui.UI` or `Result.Output`.
- New `@command`: register it in both the `Handle()` switch and `helpText()` in `internal/commands/handler.go`.
- Any change to terminal rendering, input, paths, signals, sockets, or installers must be verified for consistent behavior on macOS, Windows, and Linux.
- Ask before changing the wire protocol (`envelope` / `sealedEnvelope` in `transfer.go`, AEAD framing in `crypto.go`, or the TOFU pin format in `known_peers.go`) — any of these breaks cross-version compatibility.

## Security invariants

- Metadata-first approval: never write an incoming file/folder payload before the user explicitly approves it.
- Do not bypass `signEnvelope` / `verifyEnvelope`.
- Sanitize peer-supplied paths with `uniquePath` / `UniquePath` before writing under `~/.bonjou/received/`.
- `config.json` is written `0o600`; never log the `Config.Secret` field. Load/persist secrets through `internal/config/secretstore.go` — do not read the secret directly off the `Config` struct from outside that package.

## Reviewers

- Changes under `internal/network/` (AEAD, signing, TOFU, transfer) or to `config.json` handling: invoke the `crypto-security-reviewer` agent before merge.
- Changes to terminal rendering, input, paths, signals, sockets, or installers: invoke the `cross-platform-reviewer` agent before merge.

## Gotchas

- The version lives in two places that must stay in sync: `internal/version/version.go` and the `VERSION` file. Only change them when explicitly cutting a release.
- Run `go mod tidy` after editing `go.mod`; never edit `go.sum` by hand.
- Do not edit `dist/` (build output) or the committed `bonjou` / `bonjou.exe` binaries.
- Commits use Conventional Commits (`feat:`, `fix:`, `chore:`, `release:`, `merge:`); subject lowercase, imperative, no trailing period.

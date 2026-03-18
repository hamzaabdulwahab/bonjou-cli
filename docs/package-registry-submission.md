# Package Registry Submission Guide

This guide tracks where Bonjou is published and how to submit/update each package manager channel.

## Current Channels

- Homebrew tap: `hamzaabdulwahab/homebrew-bonjou`
- Scoop bucket: `hamzaabdulwahab/scoop-bonjou`
- WinGet community repo: `microsoft/winget-pkgs`
- AUR package: `bonjou-bin`
- Chocolatey package: `bonjou`

## Before Any Submission

1. Ensure release assets are published on GitHub Releases.
2. Verify checksums for the release binaries:
   - `bonjou.exe`
   - `bonjou-linux-amd64`
3. Update package manifests with new version + SHA256.
4. Validate install command locally (where possible).

## Homebrew (Tap)

- Update formula in `packaging/homebrew/bonjou.rb`.
- Sync to your tap repo and push.
- Install test:
  - `brew install hamzaabdulwahab/bonjou/bonjou`

## Scoop (Bucket)

- Update manifest in `packaging/scoop/bonjou.json`.
- Sync to your scoop bucket repo and push.
- Install test:
  - `scoop install https://raw.githubusercontent.com/hamzaabdulwahab/scoop-bonjou/main/bonjou.json`

## WinGet (Community)

- Update split manifests under `packaging/winget/`.
- Submit PR to `microsoft/winget-pkgs`.
- Complete CLA if requested.
- Wait for validation and publish pipeline success.

## AUR (Arch)

- Update `packaging/aur/PKGBUILD` (`pkgver`, `sha256sums`).
- Keep `packaging/aur/.SRCINFO` in sync with `PKGBUILD`.
- Publish to AUR repo for `bonjou-bin`.
- Prerequisites:
  - AUR account with your SSH public key added.
  - Working SSH auth to `aur@aur.archlinux.org`.
- Automated flow:
  - `./scripts/publish-aur.sh`

## Chocolatey

- Update these files:
  - `packaging/chocolatey/bonjou.nuspec`
  - `packaging/chocolatey/tools/chocolateyinstall.ps1`
- Prerequisites:
  - Chocolatey CLI installed on Windows.
  - `CHOCO_API_KEY` environment variable set.
- Automated flow:
  - `pwsh ./scripts/publish-chocolatey.ps1`

## One-time Tooling Notes

- AUR publish can be initiated from macOS/Linux once SSH key access is configured.
- Chocolatey publishing must run in a Windows environment with `choco` available.

## GitHub Actions (Publish Both Together)

Use workflow: `.github/workflows/publish-aur-and-choco.yml`

Required repository secrets:

- `AUR_SSH_PRIVATE_KEY`: private SSH key for your AUR account.
- `AUR_GIT_NAME`: commit author name for AUR commits.
- `AUR_GIT_EMAIL`: commit author email for AUR commits.
- `CHOCO_API_KEY`: Chocolatey push API key.

You can also run channel-specific workflows:

- `.github/workflows/publish-aur.yml`
- `.github/workflows/publish-chocolatey.yml`

## Build Helpers

Run packaging build to collect distributable metadata and package files:

```bash
./scripts/package.sh
```

This includes Homebrew, Scoop, AUR, and Chocolatey metadata under `dist/`.

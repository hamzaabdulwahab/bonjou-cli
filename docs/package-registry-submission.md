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
- Publish to AUR repo for `bonjou-bin`.
- Typical flow:
  - `makepkg --printsrcinfo > .SRCINFO`
  - `git add PKGBUILD .SRCINFO`
  - `git commit -m "bonjou-bin: update to vX.Y.Z"`
  - `git push`

## Chocolatey

- Update these files:
  - `packaging/chocolatey/bonjou.nuspec`
  - `packaging/chocolatey/tools/chocolateyinstall.ps1`
- Build and push package:
  - `choco pack packaging/chocolatey/bonjou.nuspec`
  - `choco push bonjou.X.Y.Z.nupkg --source https://push.chocolatey.org/`

## Build Helpers

Run packaging build to collect distributable metadata and package files:

```bash
./scripts/package.sh
```

This includes Homebrew, Scoop, AUR, and Chocolatey metadata under `dist/`.

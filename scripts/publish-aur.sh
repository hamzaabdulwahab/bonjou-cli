#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PKG_NAME="bonjou-bin"
AUR_SSH="ssh://aur@aur.archlinux.org/${PKG_NAME}.git"
WORK_DIR="${ROOT_DIR}/dist/aur-publish/${PKG_NAME}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required" >&2
  exit 1
fi

mkdir -p "$(dirname "$WORK_DIR")"
rm -rf "$WORK_DIR"

git clone "$AUR_SSH" "$WORK_DIR"
cp "$ROOT_DIR/packaging/aur/PKGBUILD" "$WORK_DIR/PKGBUILD"
cp "$ROOT_DIR/packaging/aur/.SRCINFO" "$WORK_DIR/.SRCINFO"

pushd "$WORK_DIR" >/dev/null
git config user.name "${AUR_GIT_NAME:-Bonjou Bot}"
git config user.email "${AUR_GIT_EMAIL:-maintainers@bonjou.local}"

if git diff --quiet -- PKGBUILD .SRCINFO; then
  echo "No AUR changes to publish."
  exit 0
fi

git add PKGBUILD .SRCINFO
git commit -m "${PKG_NAME}: update package metadata"
git push origin master
popd >/dev/null

echo "AUR publish complete."

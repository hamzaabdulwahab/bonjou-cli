#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DIST_DIR="$ROOT_DIR/dist"
BIN_DIR="$DIST_DIR/bin"
DEB_WORK="$DIST_DIR/deb"
VERSION=$(tr -d ' \n\r' < "$ROOT_DIR/VERSION")

"$ROOT_DIR/scripts/build.sh"

mkdir -p "$DEB_WORK"

# Function to build a .deb package
build_deb() {
  local ARCH=$1
  local BINARY=$2
  
  DEB_DIR="$DEB_WORK/bonjou_${VERSION}_${ARCH}"
  CONTROL_DIR="$DEB_DIR/DEBIAN"
  BIN_TARGET="$DEB_DIR/usr/local/bin"
  DEB_FILE="$DEB_WORK/bonjou_${VERSION}_${ARCH}.deb"

  rm -rf "$DEB_DIR"
  mkdir -p "$CONTROL_DIR" "$BIN_TARGET"
  cp "$BIN_DIR/$BINARY" "$BIN_TARGET/bonjou"
  chmod 0755 "$BIN_TARGET/bonjou"
  cat >"$CONTROL_DIR/control" <<EOF
Package: bonjou
Version: $VERSION
Section: net
Priority: optional
Architecture: $ARCH
Maintainer: Bonjou Team <support@bonjou.local>
Description: Bonjou terminal-based LAN chat and transfer tool
EOF

  if command -v dpkg-deb >/dev/null 2>&1; then
    dpkg-deb --root-owner-group --build "$DEB_DIR" "$DEB_FILE"
    echo "Created Debian package at $DEB_FILE"
  elif command -v ar >/dev/null 2>&1; then
    echo "Using ar to create .deb package..."
    cd "$DEB_DIR"
    echo "2.0" > debian-binary
    tar -czf control.tar.gz -C DEBIAN .
    tar -czf data.tar.gz -C . usr
    ar rcs "$DEB_FILE" debian-binary control.tar.gz data.tar.gz
    rm -f debian-binary control.tar.gz data.tar.gz
    cd "$ROOT_DIR"
    echo "Created Debian package at $DEB_FILE"
  else
    echo "Neither dpkg-deb nor ar found; skipping .deb creation for $ARCH."
  fi
}

# Build both architectures
build_deb "amd64" "bonjou-linux-amd64"
build_deb "arm64" "bonjou-linux-arm64"

mkdir -p "$DIST_DIR/homebrew" "$DIST_DIR/scoop"
cp "$ROOT_DIR/packaging/homebrew/bonjou.rb" "$DIST_DIR/homebrew/bonjou.rb"
cp "$ROOT_DIR/packaging/scoop/bonjou.json" "$DIST_DIR/scoop/bonjou.json"

echo "Packaging complete."

#!/usr/bin/env bash
set -euo pipefail
umask 022
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.2.2"
ARCH="amd64"
STAGE="$(mktemp -d /tmp/logat-syamilah-deb.XXXXXX)"
chmod 0755 "$STAGE"
trap 'find "$STAGE" -depth -delete 2>/dev/null || true' EXIT

install -d "$STAGE/DEBIAN" "$STAGE/usr/bin" "$STAGE/usr/lib/logat-syamilah/logat_syamilah" \
  "$STAGE/usr/lib/logat-syamilah/vendor" "$STAGE/usr/share/doc/logat-syamilah" "$STAGE/usr/share/applications" \
  "$STAGE/usr/share/metainfo" "$STAGE/usr/share/icons/hicolor/96x96/apps"

install -m 0644 "$ROOT/native/logat_syamilah/"*.py "$STAGE/usr/lib/logat-syamilah/logat_syamilah/"
install -m 0644 "$ROOT/vendor/shamela-helper.jar" "$STAGE/usr/lib/logat-syamilah/vendor/"
install -m 0644 "$ROOT/vendor/LICENSE" "$STAGE/usr/share/doc/logat-syamilah/copyright"
install -m 0644 "$ROOT/packaging/logat-syamilah.desktop" "$STAGE/usr/share/applications/"
install -m 0644 "$ROOT/packaging/id.logat_syamilah.desktop.metainfo.xml" "$STAGE/usr/share/metainfo/"
install -m 0644 "$ROOT/packaging/debian/usr/share/icons/hicolor/96x96/apps/logat-syamilah.png" "$STAGE/usr/share/icons/hicolor/96x96/apps/"
install -m 0755 "$ROOT/packaging/logat-syamilah" "$STAGE/usr/bin/"
install -m 0644 "$ROOT/packaging/control" "$STAGE/DEBIAN/control"

mkdir -p "$ROOT/dist"
dpkg-deb --root-owner-group --build "$STAGE" "$ROOT/dist/logat-syamilah_${VERSION}_${ARCH}.deb"

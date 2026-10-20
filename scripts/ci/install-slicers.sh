#!/usr/bin/env bash
# Downloads the pinned slicer AppImages (checksum-verified), extracts them and writes their CLI paths as
# KEY=value lines to $GITHUB_ENV (or stdout). Usage: scripts/ci/install-slicers.sh <install dir>
set -euo pipefail
dir="${1:?install dir}"
mkdir -p "$dir"
arch="$(uname -m)"

# name|url|sha256 per architecture; versions match packages/profiles (OrcaSlicer v2.4.2, BambuStudio 02.08.04.57).
orca_x86_64="https://github.com/OrcaSlicer/OrcaSlicer/releases/download/v2.4.2/OrcaSlicer_Linux_AppImage_Ubuntu2404_V2.4.2.AppImage|d12fb8c8eac1aecd2dfb6377acd48f994f8fa439ed5292fa532dd82880f029fd"
orca_aarch64="https://github.com/OrcaSlicer/OrcaSlicer/releases/download/v2.4.2/OrcaSlicer_Linux_AppImage_Ubuntu2404_aarch64_V2.4.2.AppImage|e1a07275a25f176626c55a5df39e91bc4476d8c28ee4a3192ff758e29dd5c3ba"
bambu_x86_64="https://github.com/bambulab/BambuStudio/releases/download/v02.08.04.57/BambuStudio_ubu24-v02.08.04.57-20260922164607.AppImage|4870e355fa5e98e3a47bcd196b7ae16c2e9c15896a81ceaabe09ddbefa80d2f0"

install() { # name, "url|sha", binary inside squashfs-root
  local name="$1" spec="$2" bin="$3" url sha
  url="${spec%%|*}"; sha="${spec##*|}"
  if [ ! -x "$dir/$name/squashfs-root/$bin" ]; then
    mkdir -p "$dir/$name"
    curl -fsSL --retry 3 -o "$dir/$name/app.AppImage" "$url"
    echo "$sha  $dir/$name/app.AppImage" | sha256sum -c - >&2
    chmod +x "$dir/$name/app.AppImage"
    (cd "$dir/$name" && ./app.AppImage --appimage-extract >/dev/null)
    rm "$dir/$name/app.AppImage"
  fi
  echo "$4=$dir/$name/squashfs-root/$bin" >> "${GITHUB_ENV:-/dev/stdout}"
}

orca_var="orca_${arch}"; bambu_var="bambu_${arch}"
install orca "${!orca_var}" AppRun ORCA_CLI
if [ -n "${!bambu_var:-}" ]; then install bambustudio "${!bambu_var}" AppRun BAMBU_CLI; else echo "Bambu Studio has no $arch AppImage; skipped" >&2; fi

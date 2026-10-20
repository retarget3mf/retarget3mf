# Retarget3MF

Retarget3MF converts 3D-printing projects (.3mf with print settings) made for one printer so they open correctly in the slicer of **your** printer: the right printer and filament profiles, filaments mapped to your slots, objects placed on your bed, and the author's settings (layer height, walls, infill, supports, paint) kept where they make sense.

- **Desktop app** (macOS, Windows, Linux): drop a file, or double-click a .3mf, and it converts and opens your slicer.
- **Browser extension** (Chrome-family browsers and Firefox): adds **Open for <your printer>** to the download menus of MakerWorld, Printables, Creality Cloud and Snapmaker Space.

Everything runs on your computer. Nothing is uploaded, there is no account and no telemetry.

## Supported

| | |
|---|---|
| **Sources** | Bambu Studio projects (MakerWorld), PrusaSlicer 2.x (Printables), Creality Print (Creality Cloud), Snapmaker Orca (Snapmaker Space), OrcaSlicer, Anycubic Slicer Next. PrusaSlicer 3.0 projects are not supported yet. |
| **Flashforge printers** | AD5X (4-slot IFS), Adventurer 5M, Adventurer 5M Pro, Creator 5, Creator 5 Pro (4 toolheads) |
| **Bambu Lab printers** | A1 mini, A1, P1P, P1S, P2S, X1, X1 Carbon, X1E, H2S |
| **Target slicers** | Flash Studio and OrcaSlicer for Flashforge; Bambu Studio and OrcaSlicer for Bambu Lab |

Profiles come from OrcaSlicer v2.4.2, Flash Studio 1.7.15 and Bambu Studio 02.08.04.57. Every release is checked by slicing converted projects with the real slicers.

## What happens to the settings

| Outcome | Examples |
|---|---|
| **Kept** | layer height, wall loops, infill density and pattern, top/bottom layers, supports, brim, seam, ironing, the author's flow tweaks per feature |
| **Clamped** | nozzle and bed temperatures, limited to the filament's range and the printer's maximum |
| **Kept if it still applies** | line widths (same nozzle size only), prime tower and flush volumes (multi-colour targets only) |
| **Replaced by your printer's profile** | speeds, accelerations, retraction, filament calibration (flow ratio, pressure advance, volumetric speed), start/end G-code |
| **Dropped** | anything specific to the source hardware, and post-processing scripts (they would run programs on your computer) |

Each conversion has a report listing every change and why. Per-setting details: [docs/settings-map.md](docs/settings-map.md).

## Install the desktop app

Download the installer for your system from the latest release on this repository's **Releases** page.

- **macOS** (`.dmg`): drag Retarget3MF to Applications. If the build is not signed, macOS says it cannot verify the developer: open **System Settings → Privacy & Security** and click **Open Anyway** (or run `xattr -dr com.apple.quarantine /Applications/Retarget3MF.app`). Unsigned builds cannot update themselves; download new versions by hand.
- **Windows** (`.exe`): if SmartScreen warns about an unknown publisher, click **More info → Run anyway**.
- **Linux**: `.deb` (`sudo apt install ./Retarget3MF_*.deb`) or the AppImage (`chmod +x Retarget3MF-*.AppImage`).

Start the app once: it asks for your printer and slicer, and registers itself with your browsers for the extension.

## Install the browser extension

Until the extension is in the stores, install it from the release:

- **Chrome, Edge, Brave, Arc, Dia, Vivaldi, Opera**: unzip `retarget3mf-*-chrome.zip`, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the unzipped folder.
- **Firefox**: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and pick the `.zip` (`retarget3mf-*-firefox.zip`). Firefox removes temporary add-ons on restart until the add-on is signed on addons.mozilla.org.

On a model page, open the site's download or slicer menu and choose **Open for <your printer>**. Without the desktop app, the extension can convert in the browser and give you the file to download. Details and permissions: [docs/extension.md](docs/extension.md).

## Develop

Requirements: Node.js ≥ 22.18 and pnpm 11.

```bash
pnpm install
```

```bash
pnpm desktop
```

```bash
pnpm test
```

| Command | What it does |
|---|---|
| `pnpm desktop` | desktop app with hot reload |
| `pnpm extension` | builds the extension into `apps/extension/dist/` (Chrome and Firefox) |
| `pnpm test`, `pnpm typecheck`, `pnpm e2e` | unit tests, types, end-to-end tests (Electron and Chromium) |
| `pnpm slice-check` | converts fixtures for every printer and slices them with the installed slicers (`ORCA_CLI`, `BAMBU_CLI`, `FLASHSTUDIO_CLI`; defaults to the macOS apps) |
| `pnpm sync-profiles` | regenerates `packages/profiles/src/generated` from slicer checkouts in `research/` |

Layout: `packages/core` (conversion), `packages/profiles` (printer definitions and slicer profiles), `packages/bridge` (extension ↔ app protocol), `apps/desktop` (Electron), `apps/extension` (WXT). Decisions are recorded in [docs/decisions](docs/decisions).

### Adding a printer

1. Add it to `packages/profiles/src/printers.ts`: the exact machine preset name, filament slots (`single`, `semm` for one nozzle with a multi-material unit, `toolheads`), hardware temperature limits and the slicers that ship its profiles. A new vendor also needs an entry in `VENDORS` in `packages/profiles/scripts/sync-profiles.ts`.
2. Run `pnpm sync-profiles`, then `pnpm test`.
3. Run `pnpm slice-check` with the target slicers installed and include the result in the pull request.

## License

[AGPL-3.0-or-later](LICENSE). Test fixtures from PrusaSlicer and Creality Print are AGPL-3.0 as well ([fixtures/README](packages/core/test/fixtures/README.md)).

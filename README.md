# Map Commander

Map Commander is a local 3D dispatch-map editor built with Vite, Vanilla JavaScript, and Three.js.

It supports panorama map editing, generated sci-fi city blocks, direct dragging, interior floor editing, named labels, password-protected save archives, and read-only viewer export.

## Requirements

- Node.js 18+
- pnpm recommended, npm supported
- Windows `.cmd` helpers are included, but the app itself is a Vite web project.

## Install

```bat
install-editor.cmd
```

Or manually:

```bash
pnpm install
```

## Run

```bat
start-editor.cmd
```

Open:

```text
http://127.0.0.1:5177/
```

The editor starts at an archive picker. The included archive is:

- Name: `FOR THE FUTURE`
- Password: `JAMES`

## Data

By default, data is stored in:

```text
data/
```

Tracked archive data:

```text
data/saves/manifest.json
data/saves/default.scene.json
```

Generated outputs are ignored by Git:

```text
data/renders/
data/models/
data/viewer/
data/share/
```

To use a different data directory, set:

```bat
set MAP_COMMANDER_DATA_DIR=D:\path\to\data
```

Then start the editor from the same terminal.

## Scripts

- `start-editor.cmd`: local editor, only this machine can access it.
- `start-editor-lan.cmd`: exposes the editor on the local network. Use only on trusted LANs.
- `package-viewer.cmd`: packages the last exported read-only viewer into `data/share`.
- `pnpm build:pages`: builds the GitHub Pages read-only viewer.

## GitHub Pages viewer

The repository includes a static Pages viewer in `pages/`.

After GitHub Pages is enabled with GitHub Actions as the source, the viewer URL is:

```text
https://zonca-bushnell.github.io/map-commander/
```

The viewer reads the included `FOR THE FUTURE` archive and asks for the viewer password `JAMES`.

If Pages cannot publish from a private repository on your GitHub plan, change the repository visibility to Public or deploy the generated `pages-dist/` output to another static hosting provider.

## Notes

The archive password is a lightweight project gate, not a full public-internet security system. Keep the repository private while it contains real story/map data.

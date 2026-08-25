# Sharing Map Commander

## Local editor

Use this when editing on your own machine:

```bat
start-editor.cmd
```

Open:

```text
http://127.0.0.1:5177/
```

`127.0.0.1` is local-only. Other machines cannot open it.

## LAN editor

Use this only on a trusted local network:

```bat
start-editor-lan.cmd
```

Other machines on the same LAN can open:

```text
http://YOUR_IPV4_ADDRESS:5177/
```

The LAN editor can save archives and export files, so do not expose it to untrusted networks.

## Read-only viewer package

Use this when other people only need to view a finished map.

1. Open the editor.
2. Open the target archive.
3. Export the viewer.
4. Run:

```bat
package-viewer.cmd
```

The zip will be written to:

```text
data/share/
```

Receivers can open `dispatch_city_viewer.html` directly. They do not need Node, Vite, or your source project.

If the source archive has a password, the exported viewer will ask for the viewer password.

## Test JSON

The archive picker includes `打开测试 JSON`. It creates a random temporary map for local compatibility testing.

The test map can export a viewer, but it is not saved as a real archive unless you create or open a save first.

# Mytronome

A cross-platform metronome with an accurate, fully client-side tick and savable presets.

## What's in here

The top-level folders name the app's capabilities and surfaces, not generic layers:

| Folder | What it is |
|--------|-----------|
| `metronome-engine/` | _(coming next)_ Framework-agnostic tick engine: tempo, time signature, Web Audio scheduler. Shared by every front-end. |
| `web/` | The React + TypeScript web client. Built first; later wrapped (Tauri) into a Windows desktop app. |

Future siblings will include `presets/`, `preset-api/` (C#/.NET REST API), and additional platform clients.

## Roadmap (milestones)

1. **Metronome engine only** _(current)_ — set/inc/dec BPM, time signatures, accurate audible tick.
2. Presets — save / load / edit / copy, with optional labels.
3. REST API (C#/.NET) + MySQL, containerized with Docker; storage options (local file, cloud, our server).
4. Additional front-ends (Windows desktop, then Android, iOS, Mac, Linux).

## Getting started

```sh
npm install        # from the repo root — installs all workspaces
npm run dev -w web # start the web dev server with hot reload
```

Requires Node.js (LTS).

# Basic Example

This example demonstrates basic usage of `plugin-vite-electron-renderer`.

## Features Demonstrated

- Using Node.js built-in modules (`fs`, `path`, `os`, `crypto`) in renderer
- Using Electron APIs (`ipcRenderer`, `shell`) in renderer
- File system operations from renderer process

## Setup

```bash
# From the plugin root directory
pnpm install

# Navigate to example
cd examples/basic
pnpm install

# Run in development
pnpm dev
```

## Project Structure

```
basic/
├── electron/
│   └── main.ts      # Electron main process
├── src/
│   └── main.ts      # Renderer process code
├── index.html       # HTML entry point
├── package.json
├── vite.config.ts   # Vite configuration with plugin
└── tsconfig.json
```

## How It Works

The `plugin-vite-electron-renderer` allows you to import Node.js and Electron modules directly in your renderer code:

```ts
// This works because of the plugin!
import { ipcRenderer } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
```

The plugin creates ESM wrappers for these modules that use `require()` under the hood, which works because `nodeIntegration` is enabled in the BrowserWindow.

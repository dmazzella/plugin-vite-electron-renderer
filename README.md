# plugin-vite-electron-renderer

Modern Vite plugin for Electron Renderer process - enables using Node.js APIs and native modules.

![npm version](https://img.shields.io/npm/v/plugin-vite-electron-renderer)
![license](https://img.shields.io/npm/l/plugin-vite-electron-renderer)

## Features

- 🚀 **Vite 5, 6 & 7 Support** - Works with all modern Vite versions
- ⚡ **Electron 32+ Support** - Updated for modern Electron
- 📦 **Node.js Built-ins** - Use `fs`, `path`, `crypto`, etc. in renderer
- 🔌 **Native Modules** - Support for C/C++ native addons like `serialport`, `sqlite3`
- 📄 **ESM Packages** - Pre-bundle ESM-only packages for Electron
- 🛠️ **TypeScript** - Written in TypeScript with full type definitions
- 🔧 **Zero Config** - Works out of the box for most use cases

## Installation

```bash
npm install plugin-vite-electron-renderer -D
# or
pnpm add plugin-vite-electron-renderer -D
# or
yarn add plugin-vite-electron-renderer -D
```

## Quick Start

### Basic Usage

Just add the plugin to your Vite config - no configuration needed for basic Node.js API usage:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import renderer from 'plugin-vite-electron-renderer'

export default defineConfig({
  plugins: [renderer()],
})
```

Now you can use Node.js APIs in your renderer process:

```ts
// In your Electron renderer code
import { ipcRenderer } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const content = fs.readFileSync(path.join(__dirname, 'data.json'), 'utf-8')
```

### Using Native Modules (C/C++)

For native modules like `serialport` or `sqlite3`, configure them as `cjs`:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import renderer from 'plugin-vite-electron-renderer'

export default defineConfig({
  plugins: [
    renderer({
      resolve: {
        serialport: { type: 'cjs' },
        sqlite3: { type: 'cjs' },
        'better-sqlite3': { type: 'cjs' },
      },
    }),
  ],
})
```

```ts
// In your Electron renderer code
import SerialPort from 'serialport'

const port = new SerialPort({ path: '/dev/tty-usbserial1', baudRate: 9600 })
```

### Using ESM Packages

For pure ESM packages that need pre-bundling:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import renderer from 'plugin-vite-electron-renderer'

export default defineConfig({
  plugins: [
    renderer({
      resolve: {
        'node-fetch': { type: 'esm' },
        got: { type: 'esm' },
        execa: { type: 'esm' },
      },
    }),
  ],
})
```

## API

### `renderer(options?)`

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `resolve` | `Record<string, ModuleConfig>` | `{}` | Module resolution configuration |
| `cacheDir` | `string` | `'.vite-electron-renderer'` | Cache directory name |
| `verbose` | `boolean` | `false` | Enable verbose logging |

#### ModuleConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `'cjs' \| 'esm'` | Yes | How to load the module |
| `build` | `Function` | No | Custom build function |

### Module Types

- **`cjs`**: Loads the module using `require()`. Best for:
  - C/C++ native addons
  - CommonJS packages
  - Packages that are already bundled

- **`esm`**: Pre-bundles the module to CJS format. Best for:
  - Pure ESM packages
  - Packages with ESM-only dependencies
  - Packages that Vite can't pre-bundle correctly

### Custom Build Function

For full control over how a module is pre-bundled:

```ts
renderer({
  resolve: {
    'my-special-module': {
      type: 'cjs',
      build: async ({ cjs, esm }) => {
        // Custom build logic
        return await esm('my-special-module', {
          external: ['some-dependency'],
        })
      },
    },
  },
})
```

## How It Works

```
┌────────────────────────────────────────┐    ┌─────────────────┐
│ import { ipcRenderer } from 'electron' │    │ Vite Dev Server │
└────────────────────────────────────────┘    └─────────────────┘
                 │                                     │
                 │ 1. Request 'electron' module        │
                 │ ───────────────────────────────────>│
                 │                                     │
                 │ 2. Alias redirects to cache:        │
                 │    node_modules/.vite-electron-     │
                 │    renderer/electron.mjs            │
                 │                                     │
                 │ 3. Cache file contains:             │
                 │    const e = require('electron')    │
                 │    export const ipcRenderer = ...   │
                 │                                     │
                 │ 4. Response with ESM module         │
                 │ <───────────────────────────────────│
                 ▼                                     ▼
```

The plugin creates ESM wrapper modules that:
1. Use `require()` to load the actual modules (works in Electron with `nodeIntegration`)
2. Re-export as ESM for Vite's module system
3. Handle special cases like Web Workers (where `ipcRenderer` isn't available)

## Requirements

- **Node.js**: >= 20.19.0 or >= 22.12.0 (for Vite 7)
- **Vite**: ^5.0.0 || ^6.0.0 || ^7.0.0
- **Electron**: >= 32.0.0 (with `nodeIntegration: true`)

> **Note**: Vite 7 requires Node.js 20.19+ or 22.12+ as Node.js 18 reached EOL in April 2025.

## Electron Setup

For this plugin to work, you need `nodeIntegration` enabled in your BrowserWindow:

```ts
// main.ts
const win = new BrowserWindow({
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,
  },
})
```

> ⚠️ **Security Note**: Enabling `nodeIntegration` reduces security. Only do this if you trust all content loaded in the renderer. For production apps, consider using a preload script with `contextIsolation: true` instead.

## Dependencies vs DevDependencies

| Module Type | dependencies | devDependencies |
|------------|--------------|-----------------|
| C/C++ native modules | ✅ Required | ❌ |
| CJS packages | ✅ | ✅ |
| ESM packages | ✅ | ✅ (Recommended) |
| Web packages (React, Vue) | ✅ | ✅ (Recommended) |

Putting buildable packages in `devDependencies` reduces the final app size when using electron-builder.

## Troubleshooting

### "Cannot use import statement outside a module"

Make sure the module is configured in `resolve`:

```ts
renderer({
  resolve: {
    'problematic-package': { type: 'esm' },
  },
})
```

### Native module not loading

1. Ensure it's in `dependencies` (not `devDependencies`)
2. Configure it as `cjs`:

```ts
renderer({
  resolve: {
    'native-module': { type: 'cjs' },
  },
})
```

3. Rebuild native modules for Electron:

```bash
npx electron-rebuild
```

### ipcRenderer not working in Web Worker

`ipcRenderer` doesn't work in Web Workers - this is an Electron limitation. Use `postMessage` to communicate between Worker and renderer, then use `ipcRenderer` in the renderer.

## Development

To develop or test the plugin locally:

```bash
# Clone and install
git clone https://github.com/user/plugin-vite-electron-renderer.git
cd plugin-vite-electron-renderer
npm install

# Build the plugin
npm run build

# Run tests
npm run test

# Development mode (watch)
npm run dev
```

### Running Examples

```bash
# First build the plugin
npm run build

# Then run an example
cd examples/basic
npm install
npm run dev
```

## License

MIT

## Credits

Inspired by [vite-plugin-electron-renderer](https://github.com/electron-vite/vite-plugin-electron-renderer) by 草鞋没号.

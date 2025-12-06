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

### With vite-plugin-electron

This plugin works great with `vite-plugin-electron`:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'plugin-vite-electron-renderer'

export default defineConfig({
  plugins: [
    electron({
      entry: 'electron/main.ts',
    }),
    renderer(),
  ],
})
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

Returns a Vite plugin that enables Node.js API usage in Electron's renderer process.

#### Options

```ts
interface ElectronRendererOptions {
  resolve?: Record<string, ModuleResolveConfig>
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `resolve` | `Record<string, ModuleResolveConfig>` | `{}` | Configuration for third-party modules |

#### ModuleResolveConfig

```ts
interface ModuleResolveConfig {
  type: 'cjs' | 'esm'
  build?: (args: CustomBuildArgs) => Promise<string>
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `'cjs' \| 'esm'` | Yes | How to load the module |
| `build` | `Function` | No | Custom build function for advanced use cases |

### Module Types

- **`cjs`**: Loads the module using `require()`. Best for:
  - C/C++ native addons (`serialport`, `better-sqlite3`, etc.)
  - CommonJS packages
  - Packages that are already bundled

- **`esm`**: Pre-bundles the module to CJS format using esbuild. Best for:
  - Pure ESM packages (`node-fetch`, `got`, `execa`, etc.)
  - Packages with ESM-only dependencies
  - Packages that need bundling for Electron compatibility

### Custom Build Function

For full control over how a module is pre-bundled:

```ts
renderer({
  resolve: {
    'my-special-module': {
      type: 'cjs',
      build: async ({ cjs, esm }) => {
        // Use esm() to pre-bundle with custom esbuild options
        return await esm('my-special-module', {
          external: ['some-peer-dependency'],
          define: { 'process.env.NODE_ENV': '"production"' },
        })
      },
    },
  },
})
```

The `build` function receives:
- `cjs(module)`: Generate a require() wrapper for a CJS module
- `esm(module, buildOptions?)`: Pre-bundle an ESM module with optional esbuild options

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

1. **Intercept imports** - Catches imports of `electron` and Node.js builtins
2. **Generate wrappers** - Creates `.mjs` files in `node_modules/.vite-electron-renderer/`
3. **Use require()** - The wrappers use `require()` internally (works with `nodeIntegration`)
4. **Export as ESM** - Re-exports everything as ESM for Vite compatibility
5. **Handle edge cases** - Special handling for Web Workers where `ipcRenderer` isn't available

### The avoid_parse_require Trick

The generated wrappers use this pattern:
```js
const avoid_parse_require = require;
const _M_ = avoid_parse_require("fs");
```

This prevents bundlers from statically analyzing and transforming the `require()` call, ensuring it remains intact for runtime execution in Electron.

## Requirements

- **Node.js**: >= 20.19.0 or >= 22.12.0 (required by Vite 7)
- **Vite**: ^5.0.0 || ^6.0.0 || ^7.0.0
- **Electron**: >= 32.0.0 (with `nodeIntegration: true`)

> **Note**: Node.js 18 reached EOL in April 2025. Vite 7 requires Node.js 20.19+ or 22.12+.

## Electron Setup

For this plugin to work, you need `nodeIntegration` enabled in your BrowserWindow:

```ts
// main.ts (Electron main process)
import { app, BrowserWindow } from 'electron'

app.whenReady().then(() => {
  const win = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })
  
  // Load your Vite dev server or built files
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile('dist/index.html')
  }
})
```

> ⚠️ **Security Note**: Enabling `nodeIntegration` and disabling `contextIsolation` reduces security. Only do this if you trust all content loaded in the renderer. For production apps with untrusted content, consider using a preload script with `contextIsolation: true` instead.

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

This usually means an ESM package isn't configured. Add it to `resolve`:

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

### "require is not defined"

Make sure `nodeIntegration: true` is set in your BrowserWindow's webPreferences.

### ipcRenderer not working in Web Worker

`ipcRenderer` doesn't work in Web Workers - this is an Electron limitation. The plugin provides helpful error messages when this is attempted. 

**Workaround**: Use `postMessage` to communicate between the Worker and renderer, then use `ipcRenderer` in the renderer thread.

```ts
// worker.ts
self.postMessage({ type: 'send-to-main', data: 'hello' })

// renderer.ts
worker.onmessage = (e) => {
  if (e.data.type === 'send-to-main') {
    ipcRenderer.send('channel', e.data.data)
  }
}
```

### Module exports are undefined

If a module's exports appear as `undefined`, it might have a non-standard export pattern. Try using a custom build function:

```ts
renderer({
  resolve: {
    'weird-module': {
      type: 'cjs',
      build: async ({ cjs }) => {
        // Custom wrapper generation
        return `
          const m = require('weird-module');
          export default m;
          export const specificExport = m.specificExport;
        `
      },
    },
  },
})
```

## Development

```bash
# Clone and install
git clone https://github.com/dmazzella/plugin-vite-electron-renderer.git
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

### Project Structure

```
plugin-vite-electron-renderer/
├── src/
│   ├── index.ts      # Main plugin entry point
│   ├── constants.ts  # Plugin constants and Electron API definitions
│   ├── snippets.ts   # Code generation for module wrappers
│   └── types.ts      # TypeScript type definitions
├── test/
│   ├── config.test.ts
│   ├── constants.test.ts
│   └── snippets.test.ts
├── examples/
│   └── basic/        # Basic usage example
└── dist/             # Built output
```

## License

MIT

## Credits

Inspired by [vite-plugin-electron-renderer](https://github.com/electron-vite/vite-plugin-electron-renderer) by Leo Wang (草鞋没号).

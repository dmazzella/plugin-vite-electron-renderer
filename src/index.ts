/**
 * plugin-vite-electron-renderer
 *
 * Modern Vite plugin for Electron Renderer process
 * Enables using Node.js APIs and native modules in Electron Renderer
 *
 * This plugin solves the common problem of using Node.js modules in Electron's
 * renderer process when nodeIntegration is enabled. It works by:
 *
 * 1. Creating ESM wrapper files for Node.js builtins that use require() internally
 * 2. Pre-bundling ESM packages to CJS format for compatibility
 * 3. Configuring Vite's build system to properly handle Electron-specific requirements
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import electron from 'vite-plugin-electron'
 * import renderer from 'plugin-vite-electron-renderer'
 *
 * export default {
 *   plugins: [
 *     electron({
 *       entry: 'electron/main.ts',
 *     }),
 *     renderer()
 *   ]
 * }
 * ```
 */

import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";
import type { Plugin, UserConfig } from "vite";
import { normalizePath } from "vite";
import esbuild from "esbuild";

import type { ElectronRendererOptions, ModuleResolveConfig } from "./types.js";
import {
  generateElectronSnippet,
  generateModuleSnippet,
  generatePreBundledSnippet,
} from "./snippets.js";

// Re-export types for consumers of this package
export type {
  ElectronRendererOptions,
  ModuleType,
  ModuleResolveConfig,
} from "./types.js";

/**
 * Node.js builtin modules excluding internal modules (those starting with '_')
 * These are the modules that can be imported directly in Node.js without a path
 */
const builtins = builtinModules.filter((m) => !m.startsWith("_"));

/**
 * Complete list of modules that need special handling in Electron renderer:
 * - electron: The Electron API itself
 * - Node.js builtins: fs, path, crypto, etc.
 * - node: prefixed builtins: node:fs, node:path, etc. (ESM style imports)
 */
const electronBuiltins = [
  "electron",
  ...builtins,
  ...builtins.map((module) => `node:${module}`),
];

/**
 * Set of builtin module names for fast lookup in resolveId
 */
const builtinSet = new Set(["electron", ...builtins]);

/** Plugin identification name used by Vite */
const PLUGIN_NAME = "plugin-vite-electron-renderer";

/** Directory name for caching generated wrapper files */
const CACHE_DIR = ".vite-electron-renderer";

/** Log prefix for console output */
const TAG = "[electron-renderer]";

/**
 * ANSI color codes for terminal output
 * Used to provide visual feedback during plugin operations
 */
const colors = {
  /** Gray color for tags and secondary information */
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  /** Cyan color for action descriptions */
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  /** Yellow color for module names */
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
};

/**
 * Traverse up the directory tree to find the nearest node_modules folder
 *
 * This is necessary because in monorepo setups, node_modules might not be
 * in the project root but in a parent directory.
 *
 * @param root - Starting directory for the search
 * @returns Path to node_modules or undefined if not found
 */
function findNodeModules(root: string): string | undefined {
  let current = root;
  while (current) {
    const nodeModulesPath = path.posix.join(current, "node_modules");
    if (fs.existsSync(nodeModulesPath)) {
      return nodeModulesPath;
    }
    const parent = path.posix.dirname(current);
    // Stop if we've reached the filesystem root
    if (parent === current) break;
    current = parent;
  }
  return undefined;
}

/**
 * Create a directory and all necessary parent directories
 * Similar to `mkdir -p` in Unix
 *
 * @param dirname - Directory path to create
 */
function ensureDir(dirname: string): void {
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

/**
 * Ensure a path starts with ./ for relative imports
 *
 * @param p - Path to normalize
 * @returns Path with ./ prefix if needed
 */
function relativeify(p: string): string {
  if (p.startsWith("./") || p.startsWith("../") || path.isAbsolute(p)) {
    return p;
  }
  return "./" + p;
}

/**
 * Main Vite plugin factory function for Electron Renderer process support
 *
 * This plugin enables using Node.js APIs and native modules in Electron's
 * renderer process by creating ESM wrappers that use globalThis.require()
 * internally.
 *
 * **How it works:**
 *
 * 1. **Module Resolution**: Uses `resolveId` hook (enforce: 'pre') to intercept
 *    imports of electron and Node.js builtins
 * 2. **Wrapper Generation**: Creates ESM wrapper files in .vite-electron-renderer/
 * 3. **Pre-bundling**: Optionally converts ESM packages to CJS for compatibility
 * 4. **Vite Configuration**: Adjusts various Vite settings for Electron
 *
 * **Generated wrapper example:**
 * ```js
 * // For 'fs' module:
 * const _M_ = globalThis.require("fs");
 * export default _M_.default || _M_;
 * export const readFile = _M_.readFile;
 * // ... other exports
 * ```
 *
 * @param pluginOptions - Plugin configuration options
 * @returns Vite plugin object
 *
 * @example
 * // Basic usage
 * electronRenderer()
 *
 * @example
 * // With module resolution configuration
 * electronRenderer({
 *   resolve: {
 *     serialport: { type: 'cjs' },
 *     'node-fetch': { type: 'esm' },
 *   }
 * })
 */
export default function electronRenderer(
  pluginOptions: ElectronRendererOptions = {}
): Plugin {
  /** Current working directory, normalized to use forward slashes */
  const cwd = normalizePath(process.cwd());

  /** Project root directory (resolved in config hook) */
  let root: string;

  /** Cache directory for generated wrapper files */
  let cacheDir: string;

  /** Keys from pluginOptions.resolve that need custom handling */
  const resolveKeys: string[] = [];

  /** Set of resolveKeys for fast lookup */
  let resolveKeySet: Set<string> = new Set();

  /** Map of module name → resolve config from plugin options */
  const resolveConfigs = new Map<string, ModuleResolveConfig>();

  /**
   * Cache of resolved module paths
   * Key: module name (e.g., 'fs', 'electron')
   * Value: path to generated wrapper file
   */
  const moduleCache = new Map<string, string>();

  /**
   * Generate and cache a wrapper file for a builtin module
   */
  function resolveBuiltin(moduleName: string): string {
    let id = moduleCache.get(moduleName);
    if (!id) {
      id = path.posix.join(cacheDir, moduleName) + ".mjs";

      if (!fs.existsSync(id)) {
        ensureDir(path.dirname(id));
        fs.writeFileSync(
          id,
          moduleName === "electron"
            ? generateElectronSnippet()
            : generateModuleSnippet(moduleName)
        );
      }

      moduleCache.set(moduleName, id);
    }
    return id;
  }

  return {
    name: PLUGIN_NAME,
    enforce: "pre",

    /**
     * Vite config hook - runs before Vite's config is finalized
     *
     * Sets up:
     * - Project root and cache directory locations
     * - Module resolve configs from plugin options
     * - optimizeDeps exclusions
     * - Electron-specific build settings
     */
    async config(
      config: UserConfig,
      { command }: { command: "build" | "serve" }
    ) {
      // Resolve root directory - use config.root if specified, otherwise cwd
      root = normalizePath(config.root ? path.resolve(config.root) : cwd);

      // Find node_modules directory (handles monorepo setups)
      const nodeModulesPath =
        findNodeModules(root) ?? path.posix.join(cwd, "node_modules");
      cacheDir = path.posix.join(nodeModulesPath, CACHE_DIR);

      // Process module resolve options from user configuration
      for (const [key, option] of Object.entries(pluginOptions.resolve ?? {})) {
        if (command === "build" && option.type === "esm") {
          // ESM modules are handled correctly by Vite during production builds
          continue;
        }
        resolveKeys.push(key);
        resolveConfigs.set(key, option);
      }
      resolveKeySet = new Set(resolveKeys);

      // Apply configuration modifications
      modifyOptimizeDeps(config, [...electronBuiltins, ...resolveKeys]);
      adaptElectron(config);
    },

    /**
     * Vite resolveId hook - intercepts module imports
     *
     * Replaces the deprecated `resolve.alias` with `customResolver` pattern.
     * Runs with `enforce: 'pre'` to intercept before other plugins.
     *
     * Handles:
     * - electron and Node.js builtins (fs, path, crypto, node:fs, etc.)
     * - User-configured modules from pluginOptions.resolve
     */
    async resolveId(source: string, importer: string | undefined) {
      // Strip node: prefix for matching
      const cleanSource = source.startsWith("node:")
        ? source.slice(5)
        : source;

      // Handle electron and Node.js builtins
      if (builtinSet.has(cleanSource)) {
        return resolveBuiltin(cleanSource);
      }

      // Handle user-configured modules
      if (resolveKeySet.has(source)) {
        let id = moduleCache.get(source);
        if (!id) {
          // Use safe filename by replacing / and @ with underscores
          const filename =
            path.posix.join(cacheDir, source.replace(/[/@]/g, "_")) + ".mjs";

          if (fs.existsSync(filename)) {
            id = filename;
          } else {
            const resolvedConfig = resolveConfigs.get(source);
            if (resolvedConfig) {
              let snippets: string | undefined;

              if (typeof resolvedConfig.build === "function") {
                snippets = await resolvedConfig.build({
                  cjs: (module) =>
                    Promise.resolve(generateModuleSnippet(module)),
                  esm: (module, buildOptions) =>
                    prebundleModule({
                      module,
                      outdir: cacheDir,
                      buildOptions,
                    }),
                });
              } else if (resolvedConfig.type === "cjs") {
                snippets = generateModuleSnippet(source);
              } else if (resolvedConfig.type === "esm") {
                snippets = await prebundleModule({
                  module: source,
                  outdir: cacheDir,
                });
              }

              console.log(
                colors.gray(TAG),
                colors.cyan("pre-bundling"),
                colors.yellow(source)
              );

              ensureDir(path.dirname(filename));
              fs.writeFileSync(filename, snippets ?? `/* ${TAG}: empty */`);
              id = filename;
            } else {
              // No configuration found, delegate to Vite's default resolver
              const resolved = await this.resolve(source, importer, {
                skipSelf: true,
              });
              return resolved || { id: source };
            }
          }

          moduleCache.set(source, id);
        }
        return id;
      }

      // Not handled by this plugin
      return null;
    },
  };
}

/**
 * Pre-bundle an ESM module to CJS format using esbuild
 *
 * This is necessary for ESM-only packages that need to work with require()
 * in Electron's renderer process. The bundled output is then wrapped in
 * an ESM wrapper for Vite compatibility.
 *
 * @param options - Pre-bundling options
 * @returns ESM wrapper code for the bundled module
 */
async function prebundleModule(options: {
  module: string;
  outdir: string;
  buildOptions?: esbuild.BuildOptions;
}): Promise<string> {
  const { module, outdir, buildOptions = {} } = options;
  const cwdNorm = normalizePath(process.cwd());

  // Output as .cjs file (CommonJS)
  const outfile =
    path.posix.join(outdir, module.replace(/[/@]/g, "_")) + ".cjs";

  // Use esbuild for fast bundling
  await esbuild.build({
    entryPoints: [module],
    outfile,
    target: "node14",
    format: "cjs",
    bundle: true,
    sourcemap: "inline",
    platform: "node",
    external: electronBuiltins,
    ...buildOptions,
  });

  // Generate ESM wrapper that imports the bundled CJS file
  return generatePreBundledSnippet(
    relativeify(path.posix.relative(cwdNorm, outfile)),
    outfile
  );
}

/**
 * Apply Electron-specific adaptations to Vite configuration
 *
 * These settings ensure proper behavior when running in Electron:
 *
 * 1. **base**: Use relative paths (./) for file:// protocol compatibility
 * 2. **output.freeze**: Disable object freezing (causes issues in Electron)
 * 3. **commonjsOptions.ignore**: Prevent CJS plugin from processing builtins
 *
 * @param config - Vite user configuration to modify
 */
function adaptElectron(config: UserConfig): void {
  // Use relative paths for assets
  config.base ??= "./";

  // Initialize build options if not present
  config.build ??= {};
  config.build.rollupOptions ??= {};

  // Disable Rollup's output object freezing
  const output = config.build.rollupOptions.output;
  if (output) {
    if (Array.isArray(output)) {
      for (const o of output) {
        o.freeze ??= false;
      }
    } else {
      output.freeze ??= false;
    }
  } else {
    config.build.rollupOptions.output = { freeze: false };
  }

  // Configure @rollup/plugin-commonjs to ignore electron and Node.js builtins
  config.build.commonjsOptions ??= {};
  const existingIgnore = config.build.commonjsOptions.ignore;

  if (typeof existingIgnore === "function") {
    const userIgnore = existingIgnore;
    config.build.commonjsOptions.ignore = (id: string) => {
      if (userIgnore(id) === true) return true;
      return electronBuiltins.includes(id);
    };
  } else if (Array.isArray(existingIgnore)) {
    existingIgnore.push(
      ...electronBuiltins.filter((b) => !existingIgnore.includes(b))
    );
  } else {
    config.build.commonjsOptions.ignore = [...electronBuiltins];
  }
}

/**
 * Add modules to Vite's optimizeDeps.exclude list
 *
 * Modules in this list are not pre-bundled by Vite's dependency optimizer.
 *
 * @param config - Vite user configuration to modify
 * @param exclude - Module names to exclude from pre-bundling
 */
function modifyOptimizeDeps(config: UserConfig, exclude: string[]): void {
  config.optimizeDeps ??= {};
  config.optimizeDeps.exclude ??= [];

  for (const str of exclude) {
    if (!config.optimizeDeps.exclude.includes(str)) {
      config.optimizeDeps.exclude.push(str);
    }
  }
}

/**
 * Named export for alternative import style
 *
 * @example
 * import { renderer } from 'plugin-vite-electron-renderer'
 */
export { electronRenderer as renderer };

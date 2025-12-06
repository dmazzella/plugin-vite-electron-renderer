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
import type { Alias, UserConfig } from "vite";
import { normalizePath } from "vite";
import esbuild from "esbuild";

import type { ElectronRendererOptions } from "./types.js";
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
 * Node.js and bundlers require relative paths to start with ./ or ../
 * to distinguish them from package names. This function normalizes
 * paths that might not have this prefix.
 *
 * @param p - Path to normalize
 * @returns Path with ./ prefix if needed
 *
 * @example
 * relativeify('foo/bar.js') // './foo/bar.js'
 * relativeify('./foo/bar.js') // './foo/bar.js' (unchanged)
 * relativeify('../foo/bar.js') // '../foo/bar.js' (unchanged)
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
 * renderer process by creating ESM wrappers that use require() internally.
 *
 * **How it works:**
 *
 * 1. **Module Resolution**: Intercepts imports of electron and Node.js builtins
 * 2. **Wrapper Generation**: Creates ESM wrapper files in .vite-electron-renderer/
 * 3. **Pre-bundling**: Optionally converts ESM packages to CJS for compatibility
 * 4. **Vite Configuration**: Adjusts various Vite settings for Electron
 *
 * **Generated wrapper example:**
 * ```js
 * // For 'fs' module:
 * const avoid_parse_require = require;
 * const _M_ = avoid_parse_require("fs");
 * export default _M_.default || _M_;
 * export const readFile = _M_.readFile;
 * // ... other exports
 * ```
 *
 * @param options - Plugin configuration options
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
 *     // Load serialport as CommonJS
 *     serialport: { type: 'cjs' },
 *     // Pre-bundle node-fetch to CJS
 *     'node-fetch': { type: 'esm' },
 *     // Custom build function
 *     'custom-module': {
 *       type: 'cjs',
 *       build: async ({ cjs, esm }) => {
 *         return await cjs('custom-module')
 *       }
 *     }
 *   }
 * })
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function electronRenderer(
  options: ElectronRendererOptions = {}
): any {
  /** Current working directory, normalized to use forward slashes */
  const cwd = normalizePath(process.cwd());

  /** Project root directory (resolved in config hook) */
  let root: string;

  /** Cache directory for generated wrapper files */
  let cacheDir: string;

  /** Keys from options.resolve that need custom handling */
  const resolveKeys: string[] = [];

  /**
   * Cache of resolved module paths
   * Key: module name (e.g., 'fs', 'electron')
   * Value: path to generated wrapper file
   */
  const moduleCache = new Map<string, string>();

  return {
    name: PLUGIN_NAME,

    /**
     * Vite config hook - runs before Vite's config is finalized
     *
     * This is where we set up all the necessary configurations:
     * - Determine project root and cache directory locations
     * - Create module resolution aliases
     * - Configure optimizeDeps exclusions
     * - Apply Electron-specific build settings
     */
    async config(
      config: UserConfig,
      { command }: { command: "build" | "serve" }
    ) {
      // Resolve root directory - use config.root if specified, otherwise cwd
      root = normalizePath(config.root ? path.resolve(config.root) : cwd);

      // Find node_modules directory (handles monorepo setups)
      // Cache files are stored in node_modules/.vite-electron-renderer/
      const nodeModulesPath =
        findNodeModules(root) ?? path.posix.join(cwd, "node_modules");
      cacheDir = path.posix.join(nodeModulesPath, CACHE_DIR);

      // Process module resolve options from user configuration
      // During build, ESM modules don't need special handling as they bundle correctly
      for (const [key, option] of Object.entries(options.resolve ?? {})) {
        if (command === "build" && option.type === "esm") {
          // ESM modules are handled correctly by Vite during production builds
          continue;
        }
        resolveKeys.push(key);
      }

      // Build the alias configuration for module resolution
      const aliases: Alias[] = [
        {
          /**
           * Primary alias: Handle electron and all Node.js builtins
           *
           * This regex matches:
           * - 'electron'
           * - 'fs', 'path', 'crypto', etc. (Node.js builtins)
           * - 'node:fs', 'node:path', etc. (ESM-style node: imports)
           *
           * The optional (?:node:)? prefix handles both styles of imports
           */
          find: new RegExp(
            `^(?:node:)?(${["electron", ...builtins].join("|")})$`
          ),
          replacement: "$1",

          /**
           * Custom resolver that generates wrapper files on-demand
           *
           * For each matched module:
           * 1. Check if wrapper already exists in cache
           * 2. If not, generate and write the wrapper file
           * 3. Return the path to the wrapper file
           */
          async customResolver(source: string) {
            let id = moduleCache.get(source);
            if (!id) {
              // Generate path for the wrapper file
              id = path.posix.join(cacheDir, source) + ".mjs";

              // Only write if file doesn't exist (avoids unnecessary disk I/O)
              if (!fs.existsSync(id)) {
                ensureDir(path.dirname(id));
                fs.writeFileSync(
                  id,
                  source === "electron"
                    ? generateElectronSnippet() // Special handling for electron
                    : generateModuleSnippet(source) // Standard wrapper for builtins
                );
              }

              moduleCache.set(source, id);
            }
            return { id };
          },
        },
      ];

      // Add aliases for user-configured modules (if any)
      if (resolveKeys.length > 0) {
        aliases.push({
          /**
           * Secondary alias: Handle user-configured modules
           *
           * Matches modules specified in options.resolve
           */
          find: new RegExp(`^(${resolveKeys.map(escapeRegex).join("|")})$`),
          replacement: "$1",

          /**
           * Custom resolver for user-configured modules
           *
           * Supports three resolution strategies:
           * 1. Custom build function (options.resolve[module].build)
           * 2. CJS wrapping (type: 'cjs')
           * 3. ESM pre-bundling (type: 'esm')
           */
          async customResolver(source, importer, resolveOptions) {
            let id = moduleCache.get(source);
            if (!id) {
              // Use safe filename by replacing / and @ with underscores
              const filename =
                path.posix.join(cacheDir, source.replace(/[/@]/g, "_")) +
                ".mjs";

              if (fs.existsSync(filename)) {
                // Use cached file if it exists
                id = filename;
              } else {
                const resolved = options.resolve?.[source];
                if (resolved) {
                  let snippets: string | undefined;

                  // Determine how to generate the wrapper
                  if (typeof resolved.build === "function") {
                    // User-provided custom build function
                    snippets = await resolved.build({
                      cjs: (module) =>
                        Promise.resolve(generateModuleSnippet(module)),
                      esm: (module, buildOptions) =>
                        prebundleModule({
                          module,
                          outdir: cacheDir,
                          buildOptions,
                        }),
                    });
                  } else if (resolved.type === "cjs") {
                    // CommonJS module - wrap with require()
                    snippets = generateModuleSnippet(source);
                  } else if (resolved.type === "esm") {
                    // ESM module - pre-bundle to CJS then wrap
                    snippets = await prebundleModule({
                      module: source,
                      outdir: cacheDir,
                    });
                  }

                  // Log the pre-bundling action for visibility
                  console.log(
                    colors.gray(TAG),
                    colors.cyan("pre-bundling"),
                    colors.yellow(source)
                  );

                  // Write the wrapper file
                  ensureDir(path.dirname(filename));
                  fs.writeFileSync(filename, snippets ?? `/* ${TAG}: empty */`);
                  id = filename;
                } else {
                  // No configuration found, pass through to Vite's default resolver
                  id = source;
                }
              }

              moduleCache.set(source, id);
            }

            // If we have a generated file, return it; otherwise delegate to Vite
            return id === source
              ? (this.resolve as Function)(source, importer, {
                  skipSelf: true,
                  ...resolveOptions,
                }).then(
                  (resolved: { id: string } | null) =>
                    resolved || { id: source }
                )
              : { id };
          },
        });
      }

      // Apply all configuration modifications
      modifyAlias(config, aliases);
      modifyOptimizeDeps(config, resolveKeys);
      adaptElectron(config);
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
 * @param options.module - Module name to bundle
 * @param options.outdir - Output directory for bundled file
 * @param options.buildOptions - Additional esbuild options
 * @returns ESM wrapper code for the bundled module
 *
 * @example
 * const wrapper = await prebundleModule({
 *   module: 'node-fetch',
 *   outdir: '/path/to/.vite-electron-renderer'
 * })
 */
async function prebundleModule(options: {
  module: string;
  outdir: string;
  buildOptions?: esbuild.BuildOptions;
}): Promise<string> {
  const { module, outdir, buildOptions = {} } = options;
  const cwd = normalizePath(process.cwd());

  // Output as .cjs file (CommonJS)
  const outfile =
    path.posix.join(outdir, module.replace(/[/@]/g, "_")) + ".cjs";

  // Use esbuild for fast bundling
  await esbuild.build({
    entryPoints: [module],
    outfile,
    target: "node14", // Target Node.js 14 for broad compatibility
    format: "cjs", // Output CommonJS format
    bundle: true, // Bundle all dependencies
    sourcemap: "inline", // Include sourcemaps for debugging
    platform: "node", // Build for Node.js platform
    external: electronBuiltins, // Don't bundle electron or Node.js builtins
    ...buildOptions, // Allow user overrides
  });

  // Generate ESM wrapper that imports the bundled CJS file
  return generatePreBundledSnippet(
    relativeify(path.posix.relative(cwd, outfile)),
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
  // This is required because Electron loads files via file:// protocol
  // Absolute paths would break asset loading
  config.base ??= "./";

  // Initialize build options if not present
  config.build ??= {};
  config.build.rollupOptions ??= {};

  // Disable Rollup's output object freezing
  // Frozen objects can cause issues in Electron's renderer process
  // when modules try to modify exports
  const output = config.build.rollupOptions.output;
  if (output) {
    if (Array.isArray(output)) {
      // Handle multiple output configurations
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
  // Without this, the plugin tries to transform require() calls for builtins,
  // which would break in Electron's renderer process
  config.build.commonjsOptions ??= {};
  const existingIgnore = config.build.commonjsOptions.ignore;

  if (typeof existingIgnore === "function") {
    // Preserve user's ignore function while adding our checks
    const userIgnore = existingIgnore;
    config.build.commonjsOptions.ignore = (id: string) => {
      if (userIgnore(id) === true) return true;
      return electronBuiltins.includes(id);
    };
  } else if (Array.isArray(existingIgnore)) {
    // Add to existing ignore array
    existingIgnore.push(
      ...electronBuiltins.filter((b) => !existingIgnore.includes(b))
    );
  } else {
    // Create new ignore array with all builtins
    config.build.commonjsOptions.ignore = [...electronBuiltins];
  }
}

/**
 * Add aliases to Vite's resolve configuration
 *
 * Handles both array and object alias formats, normalizing to array format
 * for easier manipulation.
 *
 * @param config - Vite user configuration to modify
 * @param aliases - Aliases to add
 */
function modifyAlias(config: UserConfig, aliases: Alias[]): void {
  config.resolve ??= {};
  config.resolve.alias ??= [];

  // Convert object format to array format if necessary
  // Object format: { 'foo': '/path/to/foo' }
  // Array format: [{ find: 'foo', replacement: '/path/to/foo' }]
  if (!Array.isArray(config.resolve.alias)) {
    config.resolve.alias = Object.entries(config.resolve.alias).map(
      ([find, replacement]) => ({ find, replacement })
    );
  }

  // Append our aliases to the configuration
  (config.resolve.alias as Alias[]).push(...aliases);
}

/**
 * Add modules to Vite's optimizeDeps.exclude list
 *
 * Modules in this list are not pre-bundled by Vite's dependency optimizer.
 * We exclude user-configured modules because we handle their resolution
 * ourselves through the custom resolver.
 *
 * @param config - Vite user configuration to modify
 * @param exclude - Module names to exclude from pre-bundling
 */
function modifyOptimizeDeps(config: UserConfig, exclude: string[]): void {
  config.optimizeDeps ??= {};
  config.optimizeDeps.exclude ??= [];

  // Add each module if not already in the list
  for (const str of exclude) {
    if (!config.optimizeDeps.exclude.includes(str)) {
      config.optimizeDeps.exclude.push(str);
    }
  }
}

/**
 * Escape special regex characters in a string
 *
 * Used when creating regex patterns from module names that might contain
 * special characters like @ (scoped packages) or dots.
 *
 * @param str - String to escape
 * @returns Escaped string safe for use in regex
 *
 * @example
 * escapeRegex('@scope/package') // '@scope\\/package'
 * escapeRegex('file.js') // 'file\\.js'
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Named export for alternative import style
 *
 * @example
 * import { renderer } from 'plugin-vite-electron-renderer'
 * // instead of
 * import electronRenderer from 'plugin-vite-electron-renderer'
 */
export { electronRenderer as renderer };

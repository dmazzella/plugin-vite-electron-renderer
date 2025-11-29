/**
 * plugin-vite-electron-renderer
 *
 * Modern Vite plugin for Electron Renderer process
 * Enables using Node.js APIs and native modules in Electron Renderer
 */

import fs from "node:fs";
import path from "node:path";
import type { Alias, UserConfig } from "vite";
import { normalizePath } from "vite";

import type { ElectronRendererOptions } from "./types.js";
import { PLUGIN_NAME, DEFAULT_CACHE_DIR, NODE_BUILTINS } from "./constants.js";
import {
  ensureDir,
  findNodeModules,
  log,
  normalizePath as normalizePathUtil,
  fileExists,
} from "./utils.js";
import { generateElectronSnippet, generateBuiltinSnippet } from "./snippets.js";
import {
  prebundleEsmModule,
  createCjsWrapper,
  createBuildArgs,
} from "./bundler.js";
import {
  configureElectronBuild,
  addAliases,
  excludeFromOptimize,
} from "./config.js";

// Re-export types
export type {
  ElectronRendererOptions,
  ModuleType,
  ModuleResolveConfig,
} from "./types.js";

/**
 * Vite plugin for Electron Renderer process
 *
 * Enables using Node.js built-in modules and native packages in Electron Renderer
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import renderer from 'plugin-vite-electron-renderer'
 *
 * export default {
 *   plugins: [
 *     renderer({
 *       resolve: {
 *         // C/C++ native modules
 *         serialport: { type: 'cjs' },
 *         // ESM packages that need pre-bundling
 *         'node-fetch': { type: 'esm' },
 *       }
 *     })
 *   ]
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function electronRenderer(
  options: ElectronRendererOptions = {}
): any {
  const {
    resolve: moduleResolve = {},
    cacheDir: cacheDirName = DEFAULT_CACHE_DIR,
    verbose = false,
  } = options;

  let root: string;
  let cacheDir: string;
  const resolveKeys: string[] = [];
  const moduleCache = new Map<string, string>();

  return {
    name: PLUGIN_NAME,

    async config(
      config: UserConfig,
      { command }: { command: "build" | "serve" }
    ) {
      // Resolve root directory
      const cwd = normalizePathUtil(process.cwd());
      root = normalizePath(config.root ? path.resolve(config.root) : cwd);

      // Find node_modules and set up cache directory
      const nodeModulesPath =
        findNodeModules(root) ?? path.posix.join(cwd, "node_modules");
      cacheDir = path.posix.join(nodeModulesPath, cacheDirName);

      if (verbose) {
        log.info(`Cache directory: ${cacheDir}`);
      }

      // Process module resolve options
      for (const [key, option] of Object.entries(moduleResolve)) {
        if (command === "build" && option.type === "esm") {
          // ESM modules build correctly during `vite build`
          // Only CJS modules need special handling at build time
          continue;
        }
        resolveKeys.push(key);
      }

      // Create aliases for builtins (electron + node modules)
      const aliases: Alias[] = [createBuiltinAlias(cacheDir, moduleCache)];

      // Add aliases for resolved modules (if any)
      if (resolveKeys.length > 0) {
        aliases.push(
          createResolveAlias(
            resolveKeys,
            moduleResolve,
            cacheDir,
            moduleCache,
            verbose
          )
        );
      }

      // Apply Vite config modifications
      addAliases(config, aliases);
      excludeFromOptimize(config, resolveKeys);
      configureElectronBuild(config);
    },
  };
}

/**
 * Create alias for electron and Node.js builtins
 */
function createBuiltinAlias(
  cacheDir: string,
  moduleCache: Map<string, string>
): Alias {
  const builtinPattern = new RegExp(
    `^(?:node:)?(${["electron", ...NODE_BUILTINS].join("|")})$`
  );

  return {
    find: builtinPattern,
    replacement: "$1",
    async customResolver(source: string) {
      let cachedPath = moduleCache.get(source);

      if (!cachedPath) {
        cachedPath = path.posix.join(cacheDir, `${source}.mjs`);

        if (!fileExists(cachedPath)) {
          ensureDir(path.dirname(cachedPath));

          // Generate appropriate snippet
          const snippet =
            source === "electron"
              ? generateElectronSnippet()
              : generateBuiltinSnippet(source);

          fs.writeFileSync(cachedPath, snippet, "utf-8");
        }

        moduleCache.set(source, cachedPath);
      }

      return { id: cachedPath };
    },
  };
}

/**
 * Create alias for user-configured module resolution
 */
function createResolveAlias(
  resolveKeys: string[],
  moduleResolve: NonNullable<ElectronRendererOptions["resolve"]>,
  cacheDir: string,
  moduleCache: Map<string, string>,
  verbose: boolean
): Alias {
  const resolvePattern = new RegExp(
    `^(${resolveKeys.map(escapeRegex).join("|")})$`
  );

  return {
    find: resolvePattern,
    replacement: "$1",
    async customResolver(source, importer, resolveOptions) {
      let cachedPath = moduleCache.get(source);

      if (!cachedPath) {
        const filename = path.posix.join(
          cacheDir,
          `${source.replace(/[@/]/g, "_")}.mjs`
        );

        if (fileExists(filename)) {
          cachedPath = filename;
        } else {
          const config = moduleResolve[source];

          if (config) {
            let snippet: string | undefined;

            if (typeof config.build === "function") {
              // Custom build function
              snippet = await config.build(createBuildArgs(cacheDir));
            } else if (config.type === "cjs") {
              // CJS module - just wrap with ESM interop
              snippet = createCjsWrapper(source);
            } else if (config.type === "esm") {
              // ESM module - pre-bundle to CJS
              snippet = await prebundleEsmModule(source, cacheDir);
            }

            if (snippet) {
              if (verbose) {
                log.module("pre-bundled", source);
              }

              ensureDir(path.dirname(filename));
              fs.writeFileSync(filename, snippet, "utf-8");
              cachedPath = filename;
            }
          }
        }

        if (cachedPath) {
          moduleCache.set(source, cachedPath);
        }
      }

      // If we have a cached path, use it
      if (cachedPath) {
        return { id: cachedPath };
      }

      // Otherwise, let Vite handle it normally
      return this.resolve(source, importer, {
        ...resolveOptions,
        skipSelf: true,
      }).then((resolved: { id: string } | null) => resolved || { id: source });
    },
  };
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Named export for compatibility
export { electronRenderer as renderer };

/**
 * TypeScript type definitions for plugin-vite-electron-renderer
 *
 * This module exports all the public types that consumers of this
 * package might need for TypeScript integration.
 */

import type { BuildOptions as EsbuildBuildOptions } from "esbuild";

/**
 * Module resolution type for third-party packages
 *
 * Determines how the plugin handles a specific module:
 *
 * - **'cjs'**: The module is CommonJS and will be wrapped with require()
 *   Use for: Native modules, older packages, packages with `main` field only
 *
 * - **'esm'**: The module is ESM and will be pre-bundled to CJS first
 *   Use for: ESM-only packages (packages with `module` or `exports` field)
 *
 * @example
 * // CJS package - wrap directly
 * { serialport: { type: 'cjs' } }
 *
 * // ESM package - pre-bundle first
 * { 'node-fetch': { type: 'esm' } }
 */
export type ModuleType = "cjs" | "esm";

/**
 * Arguments passed to custom build functions
 *
 * When using a custom build function, these helpers are provided
 * to generate wrapper code in different styles.
 */
export interface CustomBuildArgs {
  /**
   * Generate a CJS wrapper (uses require() directly)
   *
   * @param module - Module name to wrap
   * @returns Promise resolving to wrapper code
   *
   * @example
   * build: async ({ cjs }) => cjs('my-cjs-module')
   */
  cjs: (module: string) => Promise<string>;

  /**
   * Pre-bundle an ESM module to CJS, then wrap it
   *
   * Uses esbuild to bundle the module first, then generates a wrapper.
   * This is slower but necessary for ESM-only packages.
   *
   * @param module - Module name to bundle and wrap
   * @param buildOptions - Optional esbuild options override
   * @returns Promise resolving to wrapper code
   *
   * @example
   * build: async ({ esm }) => esm('my-esm-module')
   *
   * @example
   * // With custom esbuild options
   * build: async ({ esm }) => esm('my-esm-module', {
   *   external: ['some-peer-dep'],
   *   define: { 'process.env.NODE_ENV': '"production"' }
   * })
   */
  esm: (module: string, buildOptions?: EsbuildBuildOptions) => Promise<string>;
}

/**
 * Configuration for resolving a specific module
 *
 * Tells the plugin how to handle a particular third-party module
 * that needs special treatment in Electron's renderer process.
 */
export interface ModuleResolveConfig {
  /**
   * Module format type
   *
   * - 'cjs': CommonJS module (wrapped directly with require())
   * - 'esm': ECMAScript module (pre-bundled to CJS first)
   */
  type: ModuleType;

  /**
   * Custom build function for advanced use cases
   *
   * Override the default wrapper generation with custom logic.
   * The function receives helpers to generate CJS or ESM wrappers.
   *
   * @param args - Helper functions for generating wrappers
   * @returns Promise resolving to the wrapper code string
   *
   * @example
   * // Custom handling with conditional logic
   * {
   *   type: 'cjs',
   *   build: async ({ cjs, esm }) => {
   *     if (process.platform === 'win32') {
   *       return cjs('module-win32')
   *     }
   *     return cjs('module-posix')
   *   }
   * }
   *
   * @example
   * // Combine multiple modules
   * {
   *   type: 'cjs',
   *   build: async ({ cjs }) => {
   *     return `
   *       ${await cjs('sub-module-a')}
   *       // Re-export combined
   *       export const combined = { ...a, ...b };
   *     `
   *   }
   * }
   */
  build?: (args: CustomBuildArgs) => Promise<string>;
}

/**
 * Plugin configuration options
 *
 * Configure how plugin-vite-electron-renderer handles module resolution
 * and wrapper generation.
 *
 * @example
 * // Basic usage with no options (handles electron + Node.js builtins)
 * electronRenderer()
 *
 * @example
 * // Configure specific modules
 * electronRenderer({
 *   resolve: {
 *     // Native module - use CJS
 *     serialport: { type: 'cjs' },
 *
 *     // ESM-only package - pre-bundle
 *     'node-fetch': { type: 'esm' },
 *
 *     // Custom handling
 *     'complex-module': {
 *       type: 'cjs',
 *       build: async ({ cjs }) => {
 *         return await cjs('complex-module')
 *       }
 *     }
 *   }
 * })
 */
export interface ElectronRendererOptions {
  /**
   * Module resolution configuration
   *
   * A map of module names to their resolution configuration.
   * Only needed for third-party modules that don't work out of the box.
   *
   * **Node.js builtins and 'electron' are handled automatically.**
   *
   * **When to use this:**
   * - Native modules (serialport, better-sqlite3, etc.)
   * - ESM-only packages that need to work with require()
   * - Packages with complex export patterns
   *
   * @example
   * resolve: {
   *   // For native modules compiled with node-gyp
   *   serialport: { type: 'cjs' },
   *
   *   // For pure ESM packages
   *   'node-fetch': { type: 'esm' },
   *
   *   // For scoped packages
   *   '@some-scope/package': { type: 'cjs' },
   * }
   */
  resolve?: Record<string, ModuleResolveConfig>;
}

/**
 * Electron API metadata
 *
 * Information about an Electron API including its name and
 * which process types it's available in.
 *
 * This is used internally to generate accurate exports in the
 * electron wrapper and provide helpful error messages.
 */
export interface ElectronApiInfo {
  /**
   * API name as exported from 'electron'
   *
   * @example 'app', 'BrowserWindow', 'ipcRenderer'
   */
  name: string;

  /**
   * Process types where this API is available
   *
   * - **Main**: Main process only (app, BrowserWindow, etc.)
   * - **Renderer**: Renderer process (ipcRenderer, webFrame, etc.)
   * - **Utility**: Utility processes (net, systemPreferences)
   *
   * APIs available in multiple environments are listed with all applicable types.
   */
  environments: ("Main" | "Renderer" | "Utility")[];

  /**
   * Whether this API is deprecated
   *
   * Deprecated APIs are still exported for backwards compatibility
   * but may be removed in future Electron versions.
   *
   * @example BrowserView is deprecated in favor of WebContentsView
   */
  deprecated?: boolean;
}

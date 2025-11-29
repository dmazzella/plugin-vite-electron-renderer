/**
 * Types for the plugin-vite-electron-renderer
 */

import type { BuildOptions as EsbuildBuildOptions } from 'esbuild'

/**
 * Module resolution type
 */
export type ModuleType = 'cjs' | 'esm'

/**
 * Custom build function arguments
 */
export interface CustomBuildArgs {
  /**
   * Build a CommonJS module - wraps with ESM interop
   */
  cjs: (module: string) => Promise<string>
  /**
   * Build an ESM module - pre-bundles to CJS and wraps with ESM interop
   */
  esm: (module: string, buildOptions?: EsbuildBuildOptions) => Promise<string>
}

/**
 * Module resolution configuration
 */
export interface ModuleResolveConfig {
  /**
   * Module type - determines how the module is loaded
   * - `cjs`: Wraps module with ESM interop using require()
   * - `esm`: Pre-bundles to CJS format then wraps with ESM interop
   */
  type: ModuleType
  /**
   * Custom build function for full control over pre-bundling
   */
  build?: (args: CustomBuildArgs) => Promise<string>
}

/**
 * Plugin options
 */
export interface ElectronRendererOptions {
  /**
   * Explicitly configure how specific modules should be loaded
   * Useful for C/C++ native modules and ESM-only packages
   * 
   * @example
   * ```ts
   * resolve: {
   *   // C/C++ native modules - load directly with require()
   *   serialport: { type: 'cjs' },
   *   sqlite3: { type: 'cjs' },
   *   
   *   // ESM packages that need pre-bundling
   *   'node-fetch': { type: 'esm' },
   *   got: { type: 'esm' },
   * }
   * ```
   */
  resolve?: Record<string, ModuleResolveConfig>
  
  /**
   * Cache directory name (relative to node_modules)
   * @default '.vite-electron-renderer'
   */
  cacheDir?: string
  
  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean
}

/**
 * Internal module configuration
 */
export interface ModuleConfig {
  name: string
  type: ModuleType
  build?: ModuleResolveConfig['build']
}

/**
 * Electron API definition for main process APIs
 */
export interface ElectronApiInfo {
  name: string
  environments: ('Main' | 'Renderer' | 'Utility')[]
  deprecated?: boolean
}

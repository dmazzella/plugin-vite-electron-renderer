/**
 * Module pre-bundler using esbuild
 */

import path from 'node:path'
import esbuild from 'esbuild'
import type { BuildOptions } from 'esbuild'
import { ALL_BUILTINS } from './constants.js'
import { ensureDir, normalizePath, relativeify, log } from './utils.js'
import { generateCjsWrapperSnippet, generatePreBundledSnippet, getModuleExports } from './snippets.js'

/**
 * Pre-bundle an ESM module to CommonJS format
 */
export async function prebundleEsmModule(
  moduleName: string,
  outDir: string,
  buildOptions: BuildOptions = {}
): Promise<string> {
  const outfile = path.posix.join(normalizePath(outDir), `${moduleName.replace(/[@/]/g, '_')}.cjs`)
  
  ensureDir(path.dirname(outfile))
  
  log.module('pre-bundling', moduleName)
  
  await esbuild.build({
    entryPoints: [moduleName],
    outfile,
    target: 'node20',
    format: 'cjs',
    bundle: true,
    sourcemap: 'inline',
    platform: 'node',
    external: ALL_BUILTINS,
    logLevel: 'warning',
    ...buildOptions,
  })
  
  // Get exports from the bundled file
  const exports = getModuleExports(outfile)
  
  // Generate ESM wrapper that points to the bundled CJS file
  const cwd = normalizePath(process.cwd())
  const relativePath = relativeify(path.posix.relative(cwd, outfile))
  
  return generatePreBundledSnippet(relativePath, exports)
}

/**
 * Create a CJS wrapper for a module (no pre-bundling)
 */
export function createCjsWrapper(moduleName: string): string {
  const exports = getModuleExports(moduleName)
  return generateCjsWrapperSnippet(moduleName, exports)
}

/**
 * Build arguments for custom build functions
 */
export function createBuildArgs(outDir: string) {
  return {
    cjs: async (moduleName: string): Promise<string> => {
      return createCjsWrapper(moduleName)
    },
    esm: async (moduleName: string, buildOptions?: BuildOptions): Promise<string> => {
      return prebundleEsmModule(moduleName, outDir, buildOptions)
    },
  }
}

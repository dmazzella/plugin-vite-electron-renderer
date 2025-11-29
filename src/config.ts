/**
 * Vite configuration modifiers
 */

import type { UserConfig, BuildOptions, Alias } from "vite";
import type { RollupOptions, OutputOptions } from "rollup";
import { ALL_BUILTINS } from "./constants.js";

/**
 * Configure Vite for Electron Renderer
 * Sets appropriate defaults for base path and build options
 */
export function configureElectronBuild(config: UserConfig): void {
  // Use relative paths for Electron file:// loading
  config.base ??= "./";

  // Initialize build config
  config.build ??= {};
  config.build.rollupOptions ??= {};

  // Prevent freezing of output objects (needed for extending native modules)
  setOutputFreeze(config.build.rollupOptions, false);

  // Configure CommonJS options to ignore electron builtins
  configureCommonJsIgnore(config.build, ALL_BUILTINS);
}

/**
 * Set rollup output freeze option
 * When false, allows modules to extend frozen objects (like native fs)
 */
function setOutputFreeze(rollupOptions: RollupOptions, freeze: boolean): void {
  rollupOptions.output ??= {};

  if (Array.isArray(rollupOptions.output)) {
    for (const output of rollupOptions.output) {
      output.freeze ??= freeze;
    }
  } else {
    (rollupOptions.output as OutputOptions).freeze ??= freeze;
  }
}

/**
 * Configure @rollup/plugin-commonjs to ignore certain modules
 */
function configureCommonJsIgnore(
  buildConfig: BuildOptions,
  modules: string[]
): void {
  buildConfig.commonjsOptions ??= {};

  const existingIgnore = buildConfig.commonjsOptions.ignore;

  if (typeof existingIgnore === "function") {
    // Wrap existing function
    const userIgnore = existingIgnore;
    buildConfig.commonjsOptions.ignore = (id: string) => {
      if (userIgnore(id) === true) return true;
      return modules.includes(id);
    };
  } else if (Array.isArray(existingIgnore)) {
    // Add to existing array
    for (const mod of modules) {
      if (!existingIgnore.includes(mod)) {
        existingIgnore.push(mod);
      }
    }
  } else {
    // Set new array
    buildConfig.commonjsOptions.ignore = [...modules];
  }
}

/**
 * Add aliases to Vite config
 * Aliases are added at the end to allow user aliases to take precedence
 */
export function addAliases(config: UserConfig, aliases: Alias[]): void {
  config.resolve ??= {};

  // Convert to mutable array format
  let aliasArray: Alias[];

  if (!config.resolve.alias) {
    aliasArray = [];
  } else if (Array.isArray(config.resolve.alias)) {
    // Convert readonly array to mutable array
    aliasArray = [...config.resolve.alias];
  } else {
    // Convert object format to array format
    aliasArray = Object.entries(config.resolve.alias).map(
      ([find, replacement]) => ({ find, replacement })
    );
  }

  // Add aliases at the end (lower priority than user aliases)
  aliasArray.push(...aliases);

  // Assign back to config
  config.resolve.alias = aliasArray;
}

/**
 * Configure optimizeDeps to exclude certain modules from pre-bundling
 */
export function excludeFromOptimize(
  config: UserConfig,
  modules: string[]
): void {
  config.optimizeDeps ??= {};
  config.optimizeDeps.exclude ??= [];

  for (const mod of modules) {
    if (!config.optimizeDeps.exclude.includes(mod)) {
      config.optimizeDeps.exclude.push(mod);
    }
  }
}

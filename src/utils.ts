/**
 * Utility functions
 */

import fs from "node:fs";
import path from "node:path";
import { LOG_TAG } from "./constants.js";

/**
 * ANSI color codes for console output
 */
export const colors = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
} as const;

/**
 * Colored log utilities
 */
export const log = {
  info: (message: string) =>
    console.log(`${colors.gray}${LOG_TAG}${colors.reset} ${message}`),
  success: (message: string) =>
    console.log(
      `${colors.gray}${LOG_TAG}${colors.reset} ${colors.green}${message}${colors.reset}`
    ),
  warn: (message: string) =>
    console.log(
      `${colors.gray}${LOG_TAG}${colors.reset} ${colors.yellow}${message}${colors.reset}`
    ),
  error: (message: string) =>
    console.error(
      `${colors.gray}${LOG_TAG}${colors.reset} ${colors.red}${message}${colors.reset}`
    ),
  module: (action: string, moduleName: string) =>
    console.log(
      `${colors.gray}${LOG_TAG}${colors.reset} ${colors.cyan}${action}${colors.reset} ${colors.yellow}${moduleName}${colors.reset}`
    ),
};

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Normalize a path to use forward slashes (POSIX style)
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * Convert a path to be relative with ./ prefix if needed
 */
export function relativeify(filePath: string): string {
  const normalized = normalizePath(filePath);
  if (
    normalized.startsWith("./") ||
    normalized.startsWith("../") ||
    path.isAbsolute(normalized)
  ) {
    return normalized;
  }
  return `./${normalized}`;
}

/**
 * Find node_modules directory from a starting path
 */
export function findNodeModules(startPath: string): string | null {
  let currentPath = normalizePath(startPath);

  while (currentPath) {
    const nodeModulesPath = path.posix.join(currentPath, "node_modules");

    if (
      fs.existsSync(nodeModulesPath) &&
      fs.statSync(nodeModulesPath).isDirectory()
    ) {
      return nodeModulesPath;
    }

    const parentPath = path.posix.dirname(currentPath);

    // Reached the root
    if (parentPath === currentPath) {
      break;
    }

    currentPath = parentPath;
  }

  return null;
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Write content to a file, creating directories as needed
 */
export function writeFileSync(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Create a unique module filename
 */
export function getModuleFilename(
  moduleName: string,
  extension: string = ".mjs"
): string {
  // Handle scoped packages like @scope/package
  const sanitized = moduleName.replace(/[@/]/g, "_");
  return `${sanitized}${extension}`;
}

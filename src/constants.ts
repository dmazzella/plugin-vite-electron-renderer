/**
 * Constants and configuration for the plugin
 *
 * This module centralizes all constant values used throughout the plugin,
 * making it easier to maintain and update configuration in one place.
 */

import { builtinModules } from "node:module";
import type { ElectronApiInfo } from "./types.js";

/**
 * Plugin identification name
 *
 * This name is used by Vite to identify the plugin in logs and error messages.
 * It should be unique among all plugins to avoid conflicts.
 */
export const PLUGIN_NAME = "plugin-vite-electron-renderer";

/**
 * Default cache directory name
 *
 * Generated wrapper files are stored in node_modules/<this directory>
 * to persist across dev server restarts and avoid regenerating files.
 */
export const DEFAULT_CACHE_DIR = ".vite-electron-renderer";

/**
 * Console log prefix
 *
 * Used to identify log messages from this plugin in terminal output.
 */
export const LOG_TAG = "[electron-renderer]";

/**
 * Node.js builtin modules (excluding internal modules)
 *
 * Internal modules (those starting with '_') are excluded because they:
 * - Are not meant for public use
 * - May change without notice between Node.js versions
 * - Often have no stable API contract
 *
 * @example
 * // Included: 'fs', 'path', 'crypto', 'http', etc.
 * // Excluded: '_http_agent', '_http_common', '_stream_wrap', etc.
 */
export const NODE_BUILTINS = builtinModules.filter((m) => !m.startsWith("_"));

/**
 * Complete list of modules requiring special handling in Electron renderer
 *
 * This includes:
 * - 'electron': The Electron API module
 * - Node.js builtins: Traditional CommonJS imports (fs, path, etc.)
 * - node: prefixed: ESM-style imports (node:fs, node:path, etc.)
 *
 * All these modules must use require() to work correctly in Electron's
 * renderer process with nodeIntegration enabled.
 */
export const ALL_BUILTINS = [
  "electron",
  ...NODE_BUILTINS,
  ...NODE_BUILTINS.map((m) => `node:${m}`),
];

/**
 * Electron API information by module
 *
 * This comprehensive list defines all Electron APIs and their availability
 * across different process types (Main, Renderer, Utility).
 *
 * **Environment types:**
 * - **Main**: Electron's main process (full Node.js access)
 * - **Renderer**: Browser window processes (limited API access by default)
 * - **Utility**: Utility processes spawned by the main process
 *
 * **Usage in the plugin:**
 * This data is used to:
 * 1. Generate proper exports in the electron wrapper
 * 2. Provide helpful error messages when APIs are used incorrectly
 * 3. Document which APIs are available in which context
 *
 * @see https://www.electronjs.org/docs/latest/api/app
 */
export const ELECTRON_MAIN_APIS: ElectronApiInfo[] = [
  // Application lifecycle and control
  { name: "app", environments: ["Main"] },
  { name: "autoUpdater", environments: ["Main"] },

  // Window management
  { name: "BaseWindow", environments: ["Main"] },
  { name: "BrowserView", environments: ["Main"], deprecated: true }, // Use WebContentsView instead
  { name: "BrowserWindow", environments: ["Main"] },
  { name: "View", environments: ["Main"] },
  { name: "WebContentsView", environments: ["Main"] },

  // Clipboard and system interaction
  { name: "clipboard", environments: ["Main", "Renderer"] },
  { name: "contentTracing", environments: ["Main"] },
  { name: "crashReporter", environments: ["Main", "Renderer"] },
  { name: "desktopCapturer", environments: ["Main"] }, // Moved from Renderer in Electron 17+
  { name: "dialog", environments: ["Main"] },
  { name: "globalShortcut", environments: ["Main"] },
  { name: "inAppPurchase", environments: ["Main"] },

  // Inter-process communication
  { name: "ipcMain", environments: ["Main"] },
  { name: "MessageChannelMain", environments: ["Main"] },
  { name: "MessagePortMain", environments: ["Main"] },

  // UI components
  { name: "Menu", environments: ["Main"] },
  { name: "nativeImage", environments: ["Main", "Renderer"] },
  { name: "nativeTheme", environments: ["Main"] },
  { name: "Notification", environments: ["Main"] },
  { name: "ShareMenu", environments: ["Main"] }, // macOS only
  { name: "TouchBar", environments: ["Main"] }, // macOS only
  { name: "Tray", environments: ["Main"] },

  // Networking
  { name: "net", environments: ["Main", "Utility"] },
  { name: "netLog", environments: ["Main"] },

  // System information and power
  { name: "powerMonitor", environments: ["Main"] },
  { name: "powerSaveBlocker", environments: ["Main"] },
  { name: "process", environments: ["Main", "Renderer"] },
  { name: "screen", environments: ["Main"] },
  { name: "systemPreferences", environments: ["Main", "Utility"] },

  // Protocol and security
  { name: "protocol", environments: ["Main"] },
  { name: "pushNotifications", environments: ["Main"] }, // macOS only
  { name: "safeStorage", environments: ["Main"] },

  // Session and web content
  { name: "session", environments: ["Main"] },
  { name: "ServiceWorkerMain", environments: ["Main"] },
  { name: "shell", environments: ["Main", "Renderer"] },
  { name: "webContents", environments: ["Main"] },
  { name: "webFrameMain", environments: ["Main"] },

  // Process management
  { name: "parentPort", environments: ["Utility"] },
  { name: "utilityProcess", environments: ["Main"] },
];

/**
 * Get names of APIs that are only available in the Main process
 *
 * These APIs cannot be used directly in the Renderer process even with
 * nodeIntegration enabled. They require IPC communication to access.
 *
 * @returns Array of API names exclusive to the Main process
 *
 * @example
 * const mainOnly = getMainOnlyApis()
 * // ['app', 'autoUpdater', 'BrowserWindow', 'dialog', ...]
 *
 * // In generated electron wrapper:
 * // export const app = electron.app;  // Will be undefined in renderer
 */
export function getMainOnlyApis(): string[] {
  return ELECTRON_MAIN_APIS.filter(
    ({ environments }) =>
      environments.length === 1 && environments[0] === "Main"
  ).map(({ name }) => name);
}

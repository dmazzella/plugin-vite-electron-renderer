/**
 * Constants and configuration for the plugin
 */

import { builtinModules } from 'node:module'
import type { ElectronApiInfo } from './types.js'

/**
 * Plugin name
 */
export const PLUGIN_NAME = 'plugin-vite-electron-renderer'

/**
 * Default cache directory name
 */
export const DEFAULT_CACHE_DIR = '.vite-electron-renderer'

/**
 * Log prefix
 */
export const LOG_TAG = '[electron-renderer]'

/**
 * Node.js builtin modules (excluding internal modules starting with '_')
 */
export const NODE_BUILTINS = builtinModules.filter((m) => !m.startsWith('_'))

/**
 * All builtins including electron and node: prefixed modules
 */
export const ALL_BUILTINS = [
  'electron',
  ...NODE_BUILTINS,
  ...NODE_BUILTINS.map((m) => `node:${m}`),
]

/**
 * Electron Main process APIs (for reference and to export as undefined in renderer)
 * Updated for Electron 34+
 * @see https://www.electronjs.org/docs/latest/api/app
 */
export const ELECTRON_MAIN_APIS: ElectronApiInfo[] = [
  { name: 'app', environments: ['Main'] },
  { name: 'autoUpdater', environments: ['Main'] },
  { name: 'BaseWindow', environments: ['Main'] },
  { name: 'BrowserView', environments: ['Main'], deprecated: true },
  { name: 'BrowserWindow', environments: ['Main'] },
  { name: 'clipboard', environments: ['Main', 'Renderer'] },
  { name: 'contentTracing', environments: ['Main'] },
  { name: 'crashReporter', environments: ['Main', 'Renderer'] },
  { name: 'desktopCapturer', environments: ['Main'] },
  { name: 'dialog', environments: ['Main'] },
  { name: 'globalShortcut', environments: ['Main'] },
  { name: 'inAppPurchase', environments: ['Main'] },
  { name: 'ipcMain', environments: ['Main'] },
  { name: 'Menu', environments: ['Main'] },
  { name: 'MessageChannelMain', environments: ['Main'] },
  { name: 'MessagePortMain', environments: ['Main'] },
  { name: 'nativeImage', environments: ['Main', 'Renderer'] },
  { name: 'nativeTheme', environments: ['Main'] },
  { name: 'net', environments: ['Main', 'Utility'] },
  { name: 'netLog', environments: ['Main'] },
  { name: 'Notification', environments: ['Main'] },
  { name: 'parentPort', environments: ['Utility'] },
  { name: 'powerMonitor', environments: ['Main'] },
  { name: 'powerSaveBlocker', environments: ['Main'] },
  { name: 'process', environments: ['Main', 'Renderer'] },
  { name: 'protocol', environments: ['Main'] },
  { name: 'pushNotifications', environments: ['Main'] },
  { name: 'safeStorage', environments: ['Main'] },
  { name: 'screen', environments: ['Main'] },
  { name: 'ServiceWorkerMain', environments: ['Main'] },
  { name: 'session', environments: ['Main'] },
  { name: 'ShareMenu', environments: ['Main'] },
  { name: 'shell', environments: ['Main', 'Renderer'] },
  { name: 'systemPreferences', environments: ['Main', 'Utility'] },
  { name: 'TouchBar', environments: ['Main'] },
  { name: 'Tray', environments: ['Main'] },
  { name: 'utilityProcess', environments: ['Main'] },
  { name: 'webContents', environments: ['Main'] },
  { name: 'WebContentsView', environments: ['Main'] },
  { name: 'webFrameMain', environments: ['Main'] },
  { name: 'View', environments: ['Main'] },
]

/**
 * Get main-only API names (for undefined exports in renderer)
 */
export function getMainOnlyApis(): string[] {
  return ELECTRON_MAIN_APIS
    .filter(({ environments }) => environments.length === 1 && environments[0] === 'Main')
    .map(({ name }) => name)
}

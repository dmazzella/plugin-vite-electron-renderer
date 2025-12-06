// Example: Using Node.js and Electron APIs in renderer
import { ipcRenderer, shell } from "electron";

// Standard Node.js builtins
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

// Subpath imports - testing dynamic resolution
import { readFile, writeFile, stat } from "node:fs/promises";
import { join as posixJoin } from "node:path/posix";
import { join as win32Join } from "node:path/win32";
import { setTimeout as setTimeoutPromise } from "node:timers/promises";
import { createRequire } from "node:module";

// Display Node.js info
const nodeInfoEl = document.getElementById("node-info");
if (nodeInfoEl) {
  nodeInfoEl.innerHTML = `<span class="success">✓ Node.js APIs available!</span>

Platform: ${os.platform()}
Architecture: ${os.arch()}
Home Directory: ${os.homedir()}
Temp Directory: ${os.tmpdir()}
CPUs: ${os.cpus().length} cores
Memory: ${Math.round(
    os.totalmem() / 1024 / 1024 / 1024
  )} GB total, ${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB free
Random UUID: ${crypto.randomUUID()}`;
}

// Display Electron info
const electronInfoEl = document.getElementById("electron-info");
if (electronInfoEl) {
  electronInfoEl.innerHTML = `<span class="success">✓ Electron APIs available!</span>

ipcRenderer: ${typeof ipcRenderer}
shell.openExternal: ${typeof shell.openExternal}
process.versions.electron: ${process.versions.electron}
process.versions.chrome: ${process.versions.chrome}
process.versions.node: ${process.versions.node}`;
}

// File System demo with fs/promises
const fsDemoEl = document.getElementById("fs-demo");
if (fsDemoEl) {
  (async () => {
    try {
      // Test path/posix and path/win32
      const posixPath = posixJoin("folder", "subfolder", "file.txt");
      const win32Path = win32Join("folder", "subfolder", "file.txt");

      // Test timers/promises
      await setTimeoutPromise(100);

      // Test module.createRequire
      const requireAvailable = typeof createRequire === "function";

      // Create a temp file using fs/promises
      const tempFile = path.join(
        os.tmpdir(),
        "vite-electron-test-promises.txt"
      );
      const content = `Hello from Vite + Electron!\nCreated at: ${new Date().toISOString()}`;

      await writeFile(tempFile, content, "utf-8");
      const readContent = await readFile(tempFile, "utf-8");
      const fileStat = await stat(tempFile);

      fsDemoEl.innerHTML = `<span class="success">✓ File System & Subpaths working!</span>

<strong>Subpath imports test:</strong>
  fs/promises: ✓ (readFile, writeFile, stat)
  path/posix: ✓ (${posixPath})
  path/win32: ✓ (${win32Path})
  timers/promises: ✓ (setTimeout)
  module: ✓ (createRequire: ${requireAvailable})

<strong>File created:</strong> ${tempFile}
<strong>Content:</strong>
${readContent}

<strong>File stats:</strong>
  Size: ${fileStat.size} bytes
  Created: ${fileStat.birthtime.toISOString()}`;

      // Cleanup
      fs.unlinkSync(tempFile);
    } catch (error) {
      fsDemoEl.innerHTML = `<span class="error">✗ Error: ${error}</span>`;
      console.error(error);
    }
  })();
}

// Log to console
console.log("🚀 Renderer process loaded successfully!");
console.log("Node.js version:", process.version);
console.log("Electron version:", process.versions.electron);

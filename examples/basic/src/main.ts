// Example: Using Node.js and Electron APIs in renderer
import { ipcRenderer, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

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

// File System demo
const fsDemoEl = document.getElementById("fs-demo");
if (fsDemoEl) {
  try {
    // Create a temp file
    const tempFile = path.join(os.tmpdir(), "vite-electron-test.txt");
    const content = `Hello from Vite + Electron!\nCreated at: ${new Date().toISOString()}`;

    fs.writeFileSync(tempFile, content, "utf-8");
    const readContent = fs.readFileSync(tempFile, "utf-8");

    fsDemoEl.innerHTML = `<span class="success">✓ File System working!</span>

Created file: ${tempFile}
Content:
${readContent}

File stats:
  Size: ${fs.statSync(tempFile).size} bytes
  Created: ${fs.statSync(tempFile).birthtime.toISOString()}`;

    // Cleanup
    fs.unlinkSync(tempFile);
  } catch (error) {
    fsDemoEl.innerHTML = `<span class="error">✗ Error: ${error}</span>`;
  }
}

// Log to console
console.log("🚀 Renderer process loaded successfully!");
console.log("Node.js version:", process.version);
console.log("Electron version:", process.versions.electron);

import { describe, it, expect } from "vitest";
import {
  generateElectronSnippet,
  generateModuleSnippet,
} from "../src/snippets.js";

describe("snippets", () => {
  describe("generateElectronSnippet", () => {
    it("should generate valid electron polyfill code", () => {
      const snippet = generateElectronSnippet();

      expect(snippet).toContain('require("electron")');
      expect(snippet).toContain("export const ipcRenderer");
      expect(snippet).toContain("export const clipboard");
      expect(snippet).toContain("export const shell");
      expect(snippet).toContain("export default");
    });
  });

  describe("generateModuleSnippet", () => {
    it("should generate wrapper for fs", () => {
      const snippet = generateModuleSnippet("fs");

      expect(snippet).toContain('require("fs")');
      expect(snippet).toContain("export default");
      expect(snippet).toContain("export const readFile");
      expect(snippet).toContain("export const writeFile");
    });

    it("should generate wrapper for path", () => {
      const snippet = generateModuleSnippet("path");

      expect(snippet).toContain('require("path")');
      expect(snippet).toContain("export const join");
      expect(snippet).toContain("export const resolve");
    });

    it("should generate wrapper for fs/promises", () => {
      const snippet = generateModuleSnippet("fs/promises");

      expect(snippet).toContain('require("fs/promises")');
      expect(snippet).toContain("export const readFile");
      expect(snippet).toContain("export const writeFile");
    });

    it("should generate wrapper for module", () => {
      const snippet = generateModuleSnippet("module");

      expect(snippet).toContain('require("module")');
      expect(snippet).toContain("export const createRequire");
    });
  });
});

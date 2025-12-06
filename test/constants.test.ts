import { describe, it, expect } from "vitest";
import {
  NODE_BUILTINS,
  ALL_BUILTINS,
  getMainOnlyApis,
} from "../src/constants.js";

describe("constants", () => {
  it("should have Node.js builtins", () => {
    expect(NODE_BUILTINS).toContain("fs");
    expect(NODE_BUILTINS).toContain("path");
    expect(NODE_BUILTINS).toContain("crypto");
    expect(NODE_BUILTINS).not.toContain("_http_agent");
  });

  it("should have all builtins including prefixed", () => {
    expect(ALL_BUILTINS).toContain("electron");
    expect(ALL_BUILTINS).toContain("fs");
    expect(ALL_BUILTINS).toContain("node:fs");
  });

  it("should get main-only APIs", () => {
    const mainOnly = getMainOnlyApis();
    expect(mainOnly).toContain("app");
    expect(mainOnly).toContain("BrowserWindow");
    expect(mainOnly).not.toContain("clipboard"); // available in both
  });
});

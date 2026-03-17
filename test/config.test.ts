import { describe, it, expect } from "vitest";
import { builtinModules } from "node:module";
import { resolveConfig } from "vite";
import type { OutputOptions } from "rollup";
import electronRenderer from "../src/index.js";

const builtins = [
  "electron",
  ...builtinModules.filter((m) => !m.startsWith("_")),
];

describe("plugin config", () => {
  it("should set base to ./ by default", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        plugins: [electronRenderer()],
      },
      "build"
    );

    expect(config.base).toBe("./");
  });

  it("should set rollup output freeze to false", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        plugins: [electronRenderer()],
      },
      "build"
    );

    const output = config.build.rollupOptions.output as OutputOptions;
    expect(output.freeze).toBe(false);
  });

  it("should configure commonjs ignore for builtins", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        plugins: [electronRenderer()],
      },
      "build"
    );

    const ignore = config.build.commonjsOptions.ignore as string[];
    expect(ignore).toContain("electron");
    expect(ignore).toContain("fs");
    expect(ignore).toContain("path");
  });

  it("should exclude builtins from optimizeDeps", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        plugins: [electronRenderer()],
      },
      "build"
    );

    const exclude = config.optimizeDeps.exclude ?? [];

    // Should exclude electron and all Node.js builtins
    expect(exclude).toContain("electron");
    for (const builtin of builtins) {
      expect(exclude).toContain(builtin);
    }
  });
});

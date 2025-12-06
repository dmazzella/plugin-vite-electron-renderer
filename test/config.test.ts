import { describe, it, expect } from "vitest";
import { builtinModules } from "node:module";
import { resolveConfig, type UserConfig } from "vite";
import type { OutputOptions, RollupOptions } from "rollup";
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

  it("should add aliases for builtins", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        plugins: [electronRenderer()],
      },
      "build"
    );

    const aliases = config.resolve.alias as { find: RegExp }[];
    const builtinAlias = aliases.find(
      (a) => a.find instanceof RegExp && a.find.test("electron")
    );

    expect(builtinAlias).toBeDefined();

    // Should match all builtins
    for (const builtin of builtins) {
      expect(builtinAlias!.find.test(builtin)).toBe(true);
    }
  });
});

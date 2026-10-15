import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { collect, listSiteBranches } from "../src/collect.ts";
import type { ProjectConfig } from "../src/manifest.ts";
import { createGitFixture, type GitFixture } from "./git-fixture.ts";

let fx: GitFixture;
let out: string;

beforeEach(async () => {
  fx = await createGitFixture();
  out = join(fx.base, "dist");
});

afterEach(async () => {
  await fx.cleanup();
});

function project(path: string): ProjectConfig {
  return { path, title: path, description: `${path} docs` };
}

function run(projects: ProjectConfig[]) {
  return collect(projects, { repoDir: fx.deployer, outDir: out });
}

describe("collect", () => {
  test("copies each published branch into its own directory", async () => {
    await fx.publish("alpha", { "index.html": "alpha", "assets/app.js": "js" });
    await fx.publish("beta", { "index.html": "beta" });

    const result = await run([project("alpha"), project("beta")]);

    expect(result.published.map((p) => p.path)).toEqual(["alpha", "beta"]);
    expect(result.warnings).toEqual([]);
    expect(await Bun.file(join(out, "alpha", "index.html")).text()).toBe("alpha");
    expect(await Bun.file(join(out, "alpha", "assets", "app.js")).text()).toBe("js");
    expect(await Bun.file(join(out, "beta", "index.html")).text()).toBe("beta");
  });

  test("takes the newest publish when a branch was force-pushed", async () => {
    await fx.publish("alpha", { "index.html": "old", "stale.js": "gone" });
    await fx.publish("alpha", { "index.html": "new" });

    await run([project("alpha")]);

    expect(await Bun.file(join(out, "alpha", "index.html")).text()).toBe("new");
    expect(await Bun.file(join(out, "alpha", "stale.js")).exists()).toBe(false);
  });

  test("leaves out a registered project that never published, and says so", async () => {
    await fx.publish("alpha", { "index.html": "alpha" });

    const result = await run([project("alpha"), project("pending")]);

    expect(result.published.map((p) => p.path)).toEqual(["alpha"]);
    expect(result.warnings.join("\n")).toContain('"pending" is in projects.json but has never published');
  });

  test("never deploys a branch nobody registered", async () => {
    await fx.publish("alpha", { "index.html": "alpha" });
    await fx.publish("rogue", { "index.html": "rogue" });

    const result = await run([project("alpha")]);

    expect(await Bun.file(join(out, "rogue", "index.html")).exists()).toBe(false);
    expect(result.warnings.join("\n")).toContain('site/rogue exists but "rogue" is not in projects.json');
  });

  test("leaves out a branch without an index.html", async () => {
    await fx.publish("broken", { "readme.txt": "oops, wrong folder" });
    await fx.publish("alpha", { "index.html": "alpha" });

    const result = await run([project("broken"), project("alpha")]);

    expect(result.published.map((p) => p.path)).toEqual(["alpha"]);
    expect(result.warnings.join("\n")).toContain('"broken": site/broken has no index.html');
    expect(await Bun.file(join(out, "broken", "readme.txt")).exists()).toBe(false);
  });

  test("does not touch the deployer's own index", async () => {
    await fx.publish("alpha", { "index.html": "alpha" });

    await run([project("alpha")]);

    const status = Bun.spawnSync(["git", "status", "--porcelain"], { cwd: fx.deployer });
    expect(status.stdout.toString()).toBe("");
  });

  test("lists only site/* branches", async () => {
    await fx.publish("alpha", { "index.html": "alpha" });

    expect(listSiteBranches(fx.deployer)).toEqual(["alpha"]);
  });
});

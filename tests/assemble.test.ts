import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assemble } from "../src/assemble.ts";
import type { ProjectConfig } from "../src/manifest.ts";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "deployer-assemble-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function project(path: string): ProjectConfig {
  return { path, title: path, description: `${path} docs` };
}

describe("assemble", () => {
  test("writes a root index page linking each project", async () => {
    await assemble([project("test")], { outDir: root });

    const html = await Bun.file(join(root, "index.html")).text();
    expect(html).toContain('href="/test/"');
  });

  test("links a project even when its directory does not exist on disk", async () => {
    // The landing page is a register, not a build tool: it lists what
    // projects.json says regardless of what has actually been copied in.
    await assemble([project("not-copied-in-yet")], { outDir: root });

    const html = await Bun.file(join(root, "index.html")).text();
    expect(html).toContain('href="/not-copied-in-yet/"');
  });

  test("never touches the project files already collected", async () => {
    await mkdir(join(root, "test"), { recursive: true });
    await writeFile(join(root, "test", "index.html"), "project page");

    await assemble([project("test")], { outDir: root });

    expect(await Bun.file(join(root, "test", "index.html")).text()).toBe("project page");
  });

  test("writes only the index page when there are no projects", async () => {
    await assemble([], { outDir: root });

    expect(await Bun.file(join(root, "index.html")).exists()).toBe(true);
  });

  test("writes the stylesheet and vendors both typefaces", async () => {
    await assemble([], { outDir: root });

    const css = await Bun.file(join(root, "app.css")).text();
    expect(css).toContain("--accent: #1b4b8f");
    expect(css).toContain("/fonts/public-sans-400.woff2");

    for (const font of [
      "public-sans-400.woff2",
      "public-sans-500.woff2",
      "public-sans-600.woff2",
      "jetbrains-mono-400.woff2",
    ]) {
      const file = Bun.file(join(root, "fonts", font));
      expect(await file.exists()).toBe(true);
      expect(await file.size).toBeGreaterThan(0);
    }
  });

  test("every font the stylesheet declares is one the build vendors", async () => {
    await assemble([], { outDir: root });

    const css = await Bun.file(join(root, "app.css")).text();
    const declared = [...css.matchAll(/url\("\/fonts\/([^"]+)"\)/g)].map((m) => m[1]!);

    expect(declared.length).toBeGreaterThan(0);
    for (const font of declared) {
      expect(await Bun.file(join(root, "fonts", font)).exists()).toBe(true);
    }
  });
});

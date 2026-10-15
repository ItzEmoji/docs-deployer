import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { run } from "../src/cli.ts";
import { createGitFixture, type GitFixture } from "./git-fixture.ts";

let fx: GitFixture;
let warnings: string[];
let messages: string[];

beforeEach(async () => {
  fx = await createGitFixture();
  warnings = [];
  messages = [];
});

afterEach(async () => {
  await fx.cleanup();
});

function entry(path: string) {
  return { path, title: path, description: `${path} docs` };
}

async function seedManifest(paths: string[]): Promise<void> {
  await writeFile(
    join(fx.deployer, "projects.json"),
    JSON.stringify({ projects: paths.map(entry) }),
  );
}

function build() {
  return run({
    repoRoot: fx.deployer,
    log: (m) => messages.push(m),
    warn: (m) => warnings.push(m),
  });
}

const dist = () => join(fx.deployer, "dist");

describe("run", () => {
  test("assembles every published project and links it from the landing page", async () => {
    await seedManifest(["test", "beacon"]);
    await fx.publish("test", { "index.html": "test" });
    await fx.publish("beacon", { "index.html": "beacon" });

    await build();

    const index = await Bun.file(join(dist(), "index.html")).text();
    expect(index).toContain('href="/test/"');
    expect(index).toContain('href="/beacon/"');
    expect(await Bun.file(join(dist(), "beacon", "index.html")).text()).toBe("beacon");
    expect(warnings).toEqual([]);
  });

  test("only links projects that have actually published", async () => {
    await seedManifest(["test", "pending"]);
    await fx.publish("test", { "index.html": "test" });

    await build();

    const index = await Bun.file(join(dist(), "index.html")).text();
    expect(index).toContain('href="/test/"');
    expect(index).not.toContain('href="/pending/"');
    expect(warnings.join("\n")).toContain("pending");
  });

  test("starts from an empty dist every time", async () => {
    await seedManifest([]);
    await mkdir(join(dist(), "removed-project"), { recursive: true });
    await writeFile(join(dist(), "removed-project", "index.html"), "old");

    await build();

    expect(await Bun.file(join(dist(), "removed-project", "index.html")).exists()).toBe(false);
  });

  test("succeeds with an empty manifest", async () => {
    await seedManifest([]);

    await build();

    expect(await Bun.file(join(dist(), "index.html")).exists()).toBe(true);
  });

  test("reports how many projects were published", async () => {
    await seedManifest(["test", "pending"]);
    await fx.publish("test", { "index.html": "test" });

    await build();

    expect(messages.join("\n")).toContain("1/2 project(s) published");
  });
});

import { rm } from "node:fs/promises";
import { join } from "node:path";
import { assemble } from "./assemble.ts";
import { collect } from "./collect.ts";
import { loadManifest } from "./manifest.ts";

export interface RunOptions {
  /** The deployer's checkout: holds projects.json and the git remote. */
  repoRoot: string;
  /** Defaults to `<repoRoot>/dist`. Emptied first. */
  outDir?: string;
  manifestPath?: string;
  remote?: string;
  log?: (message: string) => void;
  warn?: (message: string) => void;
}

export async function run(options: RunOptions): Promise<void> {
  const manifestPath = options.manifestPath ?? join(options.repoRoot, "projects.json");
  const outDir = options.outDir ?? join(options.repoRoot, "dist");
  const log = options.log ?? console.log;
  const warn = options.warn ?? defaultWarn;

  const projects = await loadManifest(manifestPath);

  // Every deploy is built from nothing, so a removed project really goes away.
  await rm(outDir, { recursive: true, force: true });

  const { published, warnings } = await collect(projects, {
    repoDir: options.repoRoot,
    outDir,
    remote: options.remote,
  });
  for (const message of warnings) warn(message);
  for (const project of published) log(`  ✓ /${project.path}/`);

  await assemble(published, { outDir });

  log(`\n✓ site assembled in ${outDir}: ${published.length}/${projects.length} project(s) published`);
}

/** In GitHub Actions, warnings become annotations on the run. */
function defaultWarn(message: string): void {
  console.warn(process.env.GITHUB_ACTIONS ? `::warning::${message}` : `  ! ${message}`);
}

if (import.meta.main) {
  try {
    await run({ repoRoot: process.cwd() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✗ ${message}`);
    process.exit(1);
  }
}

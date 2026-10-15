import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectConfig } from "./manifest.ts";

/** Every project publishes its built site to its own branch: `site/<path>`. */
export const BRANCH_PREFIX = "site/";

export interface CollectOptions {
  /** A git repository whose `remote` holds the `site/*` branches. */
  repoDir: string;
  /** Where each project's files go: `<outDir>/<path>/`. */
  outDir: string;
  remote?: string;
}

export interface CollectResult {
  /** Registered and published: these go live. */
  published: ProjectConfig[];
  /** Problems that kept something off the site. None of them fail the build. */
  warnings: string[];
}

function git(repoDir: string, args: string[], env?: Record<string, string>): string {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
    // Never wait for credentials: a missing remote must fail, not hang CI.
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...env },
  });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr.toString().trim()}`);
  }
  return result.stdout.toString();
}

export function listSiteBranches(repoDir: string, remote = "origin"): string[] {
  return git(repoDir, ["ls-remote", "--heads", remote, `${BRANCH_PREFIX}*`])
    .split("\n")
    .map((line) => line.split("\t")[1]?.trim())
    .filter((ref): ref is string => !!ref)
    .map((ref) => ref.slice(`refs/heads/${BRANCH_PREFIX}`.length));
}

/**
 * Copies the newest commit of `site/<path>` into `dest`.
 *
 * Checks out through a throwaway index, so the deployer's own index and
 * working tree are never touched.
 */
async function extractBranch(
  repoDir: string,
  remote: string,
  path: string,
  dest: string,
): Promise<void> {
  git(repoDir, ["fetch", "--quiet", "--no-tags", remote, `refs/heads/${BRANCH_PREFIX}${path}`]);
  const commit = git(repoDir, ["rev-parse", "FETCH_HEAD"]).trim();

  const scratch = await mkdtemp(join(tmpdir(), "deployer-index-"));
  try {
    await mkdir(dest, { recursive: true });
    git(repoDir, ["--work-tree", dest, "checkout", commit, "--", "."], {
      GIT_INDEX_FILE: join(scratch, "index"),
    });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

/**
 * Pulls every registered project's published site into `outDir`.
 *
 * A registered project with no branch yet, a branch nobody registered, and a
 * branch without an `index.html` are all reported and left out. One
 * project's problem never stops the others from deploying.
 */
export async function collect(
  projects: ProjectConfig[],
  options: CollectOptions,
): Promise<CollectResult> {
  const remote = options.remote ?? "origin";
  const branches = new Set(listSiteBranches(options.repoDir, remote));
  const registered = new Set(projects.map((p) => p.path));

  const published: ProjectConfig[] = [];
  const warnings: string[] = [];

  for (const project of projects) {
    const branch = `${BRANCH_PREFIX}${project.path}`;
    if (!branches.has(project.path)) {
      warnings.push(`"${project.path}" is in projects.json but has never published (no ${branch} branch); left off the site`);
      continue;
    }

    const dest = join(options.outDir, project.path);
    try {
      await extractBranch(options.repoDir, remote, project.path, dest);
    } catch (error) {
      await rm(dest, { recursive: true, force: true });
      warnings.push(`"${project.path}" could not be fetched; left off the site: ${(error as Error).message}`);
      continue;
    }

    if (!(await Bun.file(join(dest, "index.html")).exists())) {
      await rm(dest, { recursive: true, force: true });
      warnings.push(`"${project.path}": ${branch} has no index.html at its root; left off the site`);
      continue;
    }

    published.push(project);
  }

  for (const branch of [...branches].sort()) {
    if (!registered.has(branch)) {
      warnings.push(`${BRANCH_PREFIX}${branch} exists but "${branch}" is not in projects.json; not deployed`);
    }
  }

  return { published, warnings };
}

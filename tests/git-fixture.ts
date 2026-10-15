import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * A stand-in for GitHub: a bare "remote" that projects publish `site/*`
 * branches to, and a deployer checkout with that remote as `origin`.
 */
export interface GitFixture {
  base: string;
  remote: string;
  deployer: string;
  /** Publishes `files` to `site/<path>` the way the publish workflow does. */
  publish(path: string, files: Record<string, string>): Promise<void>;
  cleanup(): Promise<void>;
}

function git(cwd: string, ...args: string[]): void {
  const r = Bun.spawnSync(
    ["git", "-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args],
    { cwd, stdout: "pipe", stderr: "pipe" },
  );
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
}

export async function createGitFixture(): Promise<GitFixture> {
  const base = await mkdtemp(join(tmpdir(), "deployer-git-"));
  const remote = join(base, "remote.git");
  const deployer = join(base, "deployer");

  await mkdir(remote);
  git(remote, "init", "-q", "--bare");
  await mkdir(deployer);
  git(deployer, "init", "-q", "-b", "main");
  git(deployer, "remote", "add", "origin", remote);

  let n = 0;
  return {
    base,
    remote,
    deployer,
    async publish(path, files) {
      const work = join(base, `publish-${n++}`);
      for (const [file, content] of Object.entries(files)) {
        await mkdir(dirname(join(work, file)), { recursive: true });
        await writeFile(join(work, file), content);
      }
      git(work, "init", "-q", "-b", `site/${path}`);
      git(work, "add", "-A");
      git(work, "commit", "-q", "-m", `publish ${path}`);
      git(work, "push", "-q", "-f", remote, `HEAD:refs/heads/site/${path}`);
    },
    cleanup: () => rm(base, { recursive: true, force: true }),
  };
}

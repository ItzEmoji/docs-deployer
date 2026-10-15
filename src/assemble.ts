import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { renderIndexPage } from "./index-page.ts";
import { APP_CSS } from "./styles.ts";
import type { ProjectConfig } from "./manifest.ts";

export interface AssembleOptions {
  /** The site being built (`dist/`), already holding every project's files. */
  outDir: string;
}

/**
 * Public Sans carries the prose, JetBrains Mono the served paths. Vendored
 * out of node_modules rather than loaded from a CDN, same as
 * docs.itzemoji.com.
 */
const FONTS: Array<[pkg: string, file: string, out: string]> = [
  ["@fontsource/public-sans", "public-sans-latin-400-normal.woff2", "public-sans-400.woff2"],
  ["@fontsource/public-sans", "public-sans-latin-500-normal.woff2", "public-sans-500.woff2"],
  ["@fontsource/public-sans", "public-sans-latin-600-normal.woff2", "public-sans-600.woff2"],
  ["@fontsource/jetbrains-mono", "jetbrains-mono-latin-400-normal.woff2", "jetbrains-mono-400.woff2"],
];

export async function writeAssets(outDir: string): Promise<void> {
  const require = createRequire(import.meta.url);
  await Bun.write(join(outDir, "app.css"), APP_CSS.trimStart());

  const fontsOut = join(outDir, "fonts");
  await mkdir(fontsOut, { recursive: true });

  for (const [pkg, file, out] of FONTS) {
    const root = dirname(require.resolve(`${pkg}/package.json`));
    await copyFile(join(root, "files", file), join(fontsOut, out));
  }
}

/**
 * Writes the landing page and its assets next to the project directories.
 * Only ever adds `index.html`, `app.css` and `fonts/`; it never touches a
 * project's files.
 */
export async function assemble(
  projects: ProjectConfig[],
  options: AssembleOptions,
): Promise<void> {
  const { outDir } = options;

  await writeAssets(outDir);
  await Bun.write(join(outDir, "index.html"), renderIndexPage(projects));
}

import { icons } from "./icons.ts";
import type { ProjectConfig } from "./manifest.ts";

const SITE_TITLE = "itzemoji docs";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderIndexPage(projects: ProjectConfig[]): string {
  const count = `${projects.length} ${projects.length === 1 ? "project" : "projects"}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="description" content="Documentation for every itzemoji project.">
<title>Documentation — ${SITE_TITLE}</title>
<link rel="preload" href="/fonts/public-sans-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/app.css">
</head>
<body>
<header class="masthead">
  <div class="wrap masthead-inner">
    <a class="brand" href="/">
      ${icons.book}<span>${SITE_TITLE}</span>
    </a>
  </div>
</header>

<main><div class="wrap">
<section class="section">
  <h1 class="page-title">Documentation</h1>
</section>

<section class="section">
  <h2 class="section-head">${count}</h2>
${renderBody(projects)}
</section>
</div></main>

<footer class="site-footer">
  <div class="wrap inner">
    <p>Each project builds its own docs and publishes them here.</p>
  </div>
</footer>
</body>
</html>
`;
}

function renderBody(projects: ProjectConfig[]): string {
  if (projects.length === 0) {
    return `  <div class="empty">
    <p>No documentation has been published yet.</p>
    <p>Add a project to <span class="mono">projects.json</span> and publish it from its repo.</p>
  </div>`;
  }
  return `  <div class="record">
${projects.map(renderProject).join("\n")}
  </div>`;
}

/**
 * One entry in the register: what the project is called, what it is, and the
 * path it is served at. The row itself is the link.
 */
function renderProject(project: ProjectConfig): string {
  const path = escapeHtml(project.path);
  return `    <a class="row" href="/${path}/">
      <span class="row-text">
        <span class="row-title">${escapeHtml(project.title)}</span>
        <span class="row-desc">${escapeHtml(project.description)}</span>
      </span>
      <span class="row-path">/${path}/</span>
      <span class="row-go">${icons.chevronRight}</span>
    </a>`;
}

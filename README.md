# docs-deployer

Assembles and deploys `docs.itzemoji.com`.

Projects build their own docs in their own repos and publish the output to
a branch here, one per project (`site/<path>`). This repo never builds a
project; it only collects what was published, adds the landing page, and
deploys. How it all fits together is documented on the site itself, under
[`/platform/`](https://github.com/ItzEmoji/docs-dotfiles).

```
aeroflare-docs ──build──▶ site/aeroflare ─┐
docs-dotfiles  ──build──▶ site/platform  ─┼─▶ deploy.yml ─▶ dist/ ─▶ Cloudflare Pages
                          projects.json  ─┘
```

## What lives here

| | |
| --- | --- |
| `projects.json` | The register: which `site/*` branches go live, with title and description for the landing page. |
| `.github/workflows/publish.yml` | Reusable workflow projects call to build and publish themselves. |
| `.github/workflows/deploy.yml` | Runs on every push to `main` or `site/*`: assembles `dist/` and deploys it. |
| `src/` | The assembler: collects the branches, renders the landing page. |

## Local use

```bash
bun install
bun run build   # fetch every site/* branch from origin into dist/, add the landing page
bun run serve   # http://localhost:8080
bun test        # test the assembler
```

## Rules the assembler enforces

- Only projects listed in `projects.json` **and** published to `site/<path>`
  go live. Everything else is reported as a warning on the run and left out,
  and the other projects still deploy.
- A published branch must have an `index.html` at its root.
- `dist/` is rebuilt from nothing on every run, so removing a project from
  `projects.json` removes it from the site.

## Setup

Repository secrets: `CLOUDFLARE_API_TOKEN` (Pages: Edit) and
`CLOUDFLARE_ACCOUNT_ID`. Optional variable `PAGES_PROJECT` (defaults to
`docs-deployer`). Without the token the site is still assembled and attached
to the run as the `site` artifact.

Protect `main` with a ruleset so the publishing app can only ever write
`site/*` branches.

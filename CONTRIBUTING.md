# Contributing to @sv5ui/datagrid

Thanks for your interest in contributing. This guide covers the setup, the shape a feature
takes in this codebase, and the workflow from issue to merged PR.

The grid is built on [sv5ui](https://github.com/ndlabdev/sv5ui) and documented at
[sv5ui.vercel.app/docs/datagrid](https://sv5ui.vercel.app/docs/datagrid).

## Prerequisites

- **Node.js** 22+
- **pnpm** 10+ — install with it, not with npm or yarn. The lockfile is pnpm's and CI
  installs `--frozen-lockfile`, so another package manager produces a tree CI will reject.
  The scripts themselves shell out to `npm run` for their own sub-steps, which is fine.

## Setup

```bash
pnpm install
pnpm dev        # the playground under src/routes
```

The playground is where a change is exercised by hand. `src/routes/server/` holds the
server row model pages, including the big-data ones.

## Quality gates

Every change must pass these locally before a PR opens. CI runs the same four on every push
and PR to `main` and `dev`:

```bash
pnpm lint       # prettier --check + eslint
pnpm check      # svelte-check (must be 0 errors, 0 warnings)
pnpm build      # vite build + svelte-package + publint
pnpm test       # vitest, both projects
```

`pnpm format` auto-fixes formatting.

Tests run in two projects. `unit` is node, `browser` drives a real Chromium through
Playwright, so a first run needs:

```bash
pnpm exec playwright install --with-deps chromium
```

Two more commands exist for work that touches the hot paths:

```bash
pnpm bench          # vitest bench, the pipeline and server-model suites
pnpm perf:scroll    # measures scroll frames in a real browser, against a running
                    # `pnpm dev`. Takes a URL and a duration; it defaults to
                    # http://localhost:5173/virtual for 2 seconds.
```

`src/benchmarks/budgets.test.ts` fails when a budget is exceeded, so a change that costs
more than it should is caught by `pnpm test` rather than by a reviewer's memory.

## Workflow

Issue-driven. `dev` is the integration branch and `main` is the released one.

1. **Open an issue** first, using the templates, and wait for triage unless the change is
   trivial.
2. **Branch from `dev`**, named as below.
3. **Implement**, with tests and a `CHANGELOG.md` entry under `[Unreleased]`.
4. **Open a PR targeting `dev`** with `Closes #<issue>` in the body.
5. Releases go the other way round, and only from `npm run release`: the version commit
   is pushed as `release/vX.Y.Z` and opens its own PR into `main`. It is the one branch
   that targets `main` directly.

### Branch naming

```
fix/<issue#>-short-slug      # bug fix
feat/<issue#>-short-slug     # new feature
docs/<issue#>-short-slug     # documentation
chore/<short-slug>           # tooling, CI, deps
```

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), scoped by the area rather than
by file:

```
fix(pagination): keep a server model on the page it shows
feat(features): add a rowCountChanged event
docs(readme): document the server row model
chore(ci): install chromium before the browser project
```

Allowed types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`. Scopes in
use: `core`, `features`, `components`, `locales`, `types`, plus a feature name where it is
clearer.

## How the codebase is laid out

```
src/lib/core/          the kernel: grid state, the row pipeline, column and focus models,
                       the event bus, the announcer, virtualization maths
src/lib/features/      one directory per feature module, each self-contained
src/lib/components/    the component layer: DataGrid, the Grid.* parts, cells, chrome, menus
src/lib/locales/       one file per language pack
src/routes/            the playground
src/tests/             component and behaviour tests, plus axe and type tests
src/benchmarks/        benches and the budget test that guards them
```

## Writing a feature

A feature is a plain object, and the built-ins have no privileged access: everything they
use is a hook you can use too. Nine hooks exist, and a feature implements only what it
needs:

`id`, `pipelineStage`, `createState`, `createApi`, `keybindings`, `menuItems`,
`cellDecoration`, `serialize`, `hydrate`.

Conventions the built-ins follow, and a new one should too:

- **A pipeline stage is pure.** It takes `RowNode[]` and returns `RowNode[]`, and it declares
  its `order` from `PIPELINE_ORDER` so it never has to know what else is registered.
- **Every writer goes through `mutator`.** A setter that reads state on its way out will
  otherwise subscribe its caller to that state, and an `$effect` calling it loops. This was a
  real bug in 0.2.0; `mutator` is how it stays fixed.
- **A server row model gets its own guard.** `grid.rowModel === 'server'` means the rows in
  hand are one page, so filtering, sorting and paging stand aside. Anything that does
  arithmetic on a row index has to ask.
- **Strings belong to the locale pack.** Nothing user-visible is hardcoded in English;
  `defaultLabels` and `defaultAnnouncerStrings` are the fallbacks, and plurals come from
  `Intl.PluralRules` rather than a `count === 1` branch.
- **The public surface stays typed.** A feature declares its API by augmenting `GridApi` from
  its own module, and exports no `any`.

### Checklist for a new feature

- [ ] A directory under `src/lib/features/`, exporting the factory and its `getX(grid)`
      accessor.
- [ ] Tests under `src/tests/`, including a browser test if it has a UI or a keybinding.
- [ ] An `axe` assertion if it renders anything.
- [ ] A playground route, or a section on an existing one.
- [ ] Exported from `src/lib/index.ts`.
- [ ] A `CHANGELOG.md` entry under `[Unreleased]`.

## Accessibility

The grid is a div-based ARIA `grid`, or a `treegrid` once rows nest. `axe` runs in CI over
the grids the tests build for each feature, and over the `/qa` route, which is the one that
gathers every feature on a page — so a feature that renders belongs in one of those runs. A change that adds a control has to answer three
questions: what does a screen reader call it, what does the announcer say when it acts, and
can the keyboard reach it without adding a tab stop. The whole grid is one tab stop, so a
control inside a cell answers through the cell rather than taking a stop of its own.

## Changelog

[Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/). Add an
entry under `## [Unreleased]`, grouped by `Added` / `Changed` / `Fixed` / `Removed`.

Write what changed for the reader, not what the diff did. A good entry names the behaviour
before, the behaviour after, and why it was wrong, because that is what someone hitting the
bug searched for.

## Release process (maintainers)

One command, run from `main` with a clean tree:

```bash
npm run release -- minor        # patch / major / an explicit 1.2.3 also work
npm run release -- minor --dry  # walk it without writing or pushing
```

It bumps the version, closes `[Unreleased]` into a dated section, runs the gates, verifies
the **packed tarball** rather than the working tree, commits, and then — because `main` is
protected — pushes that commit as `release/vX.Y.Z`, opens a PR, waits for `ci`, merges it,
tags the merge commit, and pushes the tag. The tag is what publishes: `publish.yml` fires on
`v*.*.*`. The script then waits for that workflow, confirms npm actually moved, and cuts the
GitHub release.

`pnpm release:verify` runs standalone when you only want the tarball check.

Pre-1.0 a breaking change was a minor; from 1.0.0 semver applies as written.

`main` is protected — pull request required, `ci` required green, no force push or deletion,
and admins are not exempt. Nothing lands on it by direct push, releases included.

## Reporting security issues

Do **not** open a public issue. See [SECURITY.md](./SECURITY.md).

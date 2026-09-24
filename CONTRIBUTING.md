# Contributing to Yukthi File System (YFS) — Web UI

Thanks for considering a contribution. This project follows the standard GitHub fork-and-PR flow — nobody, maintainers included, pushes directly to `main`. Everything lands via a reviewed pull request that passes CI.

## Before you start

- For anything non-trivial (new feature, behavior change, architectural change), open an issue first using the [feature request](.github/ISSUE_TEMPLATE/feature_request.yml) or [question](.github/ISSUE_TEMPLATE/question.yml) template and get alignment before writing code. It saves you from a PR that gets rejected on approach, not implementation.
- For bugs, check [existing issues](https://github.com/Yukthi-Systems/YFS-FrontEnd/issues) first, then file one with the [bug report](.github/ISSUE_TEMPLATE/bug_report.yml) template if it's not already tracked.
- Small, focused fixes (typo, obvious bug, one small component) can skip straight to a PR.
- Some features need backend support. If your change needs a new or different endpoint, raise it in [YFS-Main-API](https://github.com/Yukthi-Systems/YFS-Main-API) or [YFS-Files-Api](https://github.com/Yukthi-Systems/YFS-Files-Api) rather than working around it in the UI.

## Step-by-step

1. **Fork the repo** — click "Fork" on [github.com/Yukthi-Systems/YFS-FrontEnd](https://github.com/Yukthi-Systems/YFS-FrontEnd).

2. **Clone your fork:**

   ```bash
   git clone https://github.com/<your-username>/YFS-FrontEnd
   cd YFS-FrontEnd
   ```

3. **Install dependencies** from the repo root (Node.js 22+ recommended):

   ```bash
   npm install
   cp apps/web/.env.example apps/web/.env   # then fill in your API/SSO URLs
   ```

4. **Create a branch off `main`** — name it by type:

   ```bash
   git checkout -b feat/short-description
   # or fix/..., chore/..., docs/..., refactor/...
   ```

5. **Make your change.** Run the dev server to check it locally:

   ```bash
   npm run dev
   ```

6. **Verify before committing** — CI will run these, so run them yourself first:

   ```bash
   npm run lint        # Oxlint — must be 0 errors
   npm run typecheck   # tsc across every workspace
   npm run build       # tsc -b && vite build — must succeed
   ```

7. **Commit using [Conventional Commits](https://www.conventionalcommits.org/)** — matches this repo's existing history:

   ```
   feat: add folder colour picker to the context menu
   fix: keep selection when switching view modes
   chore: bump vite to 8.x
   docs: update README setup instructions
   refactor: extract ViewModeToggle into its own component
   ```

8. **Push to your fork and open a PR against `main`:**

   ```bash
   git push -u origin feat/short-description
   ```

   Fill out the PR template — description, what changed, how you tested it. Link the issue it resolves (`Closes #123`) if there is one.

9. **CI runs automatically** (lint + typecheck/build + Docker build check). A maintainer reviews and requests changes if needed. Once CI is green and the PR is approved, a maintainer merges it — contributors should not merge their own PRs.

## Code guidelines

- **State:** Jotai for client state, TanStack Query for server state. No React Context for new state.
- **Data fetching:** `useQuery`/`useMutation` calls live in `apps/web/src/hooks/`, grouped by API resource (e.g. `usePublicSession.ts`), never inline in a component.
- **API calls:** go through `packages/service` (`@yfs/service`); reuse its types instead of re-declaring response shapes.
- **Errors:** every user-triggered action that can fail shows a toast (`useToast()`); no silent `catch` blocks.
- **Comments:** default to none. When one is needed, keep it to a line or two and explain *why*, not *what*.
- **New files:** start with the GPL-3.0 license header used across the repo.
- Keep PRs scoped to one concern, and don't reformat files you didn't otherwise touch.

## Getting help

Stuck, or want feedback on an approach before investing time in it? Ask in [Discord](https://discord.gg/29zTxvque) or open a [question issue](.github/ISSUE_TEMPLATE/question.yml).

# Contributing to Ledgerly

Thanks for your interest in improving Ledgerly! 🎉 Contributions of all sizes are welcome — bug fixes, features, docs, and design.

## Ways to contribute

- 🐛 **Report a bug** — open an [issue](../../issues/new/choose) with steps to reproduce.
- 💡 **Suggest a feature** — open a feature request issue and describe the use case.
- 🔧 **Send a pull request** — see the workflow below.
- ⭐ **Star the repo** — it genuinely helps others discover the project.

## Development setup

**Requirements:** Node **24+** (Next.js 16 does not run on older Node) and a Postgres database (a free [Neon](https://neon.tech) project works great).

```bash
git clone https://github.com/codewithowais/expense-tracker.git
cd expense-tracker
npm install
cp .env.example .env        # fill in DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, ADMIN_EMAIL
node scripts/migrate.mjs --fresh
npx @better-auth/cli@latest migrate
npm run dev
```

## Pull request workflow

1. **Fork** the repo and create a branch from `main`:
   ```bash
   git checkout -b feat/short-description
   ```
2. Make your change. Keep it focused — one logical change per PR.
3. **Run all checks locally** before pushing:
   ```bash
   npm run typecheck && npm run lint && npm run test
   ```
   CI runs these on every PR; PRs must be green to merge.
4. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages, e.g.:
   - `feat(assets): add live silver rate`
   - `fix(sync): guard against clock skew on push`
   - `docs(readme): clarify env setup`
5. Open a **Pull Request** against `main` with a clear description of *what* and *why*. Screenshots/GIFs are hugely appreciated for UI changes.

## Coding conventions

- **TypeScript strict** — no `any` escape hatches without good reason.
- **Local-first** — all data access goes through repositories in `src/lib/repositories/*`; UI reads reactively via `src/lib/hooks/use-data.ts`.
- Match the style of the surrounding code (naming, comments, formatting). ESLint is the source of truth.
- Money is stored in **major units**; use the float-safe helpers for aggregation.
- See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full component/hook/repository surface.

## Reporting security issues

Please **do not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md) for private disclosure.

## Code of Conduct

By participating, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

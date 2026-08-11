# Security Policy

Ledgerly handles personal financial data, so security reports are taken seriously.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report privately using one of:

- **GitHub Security Advisories** — go to the [Security tab](../../security/advisories/new) and open a private draft advisory (preferred).
- **Email** — contact the maintainer at the address on their [GitHub profile](https://github.com/codewithowais).

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (proof-of-concept if possible).
- Affected version / commit.

You can expect an initial acknowledgement within a few days. We'll keep you updated on the fix and coordinate disclosure timing with you.

## Scope & self-hosting notes

Ledgerly is **self-hosted** — each operator runs their own instance and database. Some security responsibilities are yours as the operator:

- Keep `DATABASE_URL` and `BETTER_AUTH_SECRET` secret; never commit them. Rotate immediately if exposed.
- Use a strong, unique `BETTER_AUTH_SECRET` (32+ random bytes).
- Serve over **HTTPS** in production and set `BETTER_AUTH_URL` to your real origin.
- Keep dependencies up to date (Dependabot PRs are enabled in this repo).

## Supported versions

This project is pre-1.0; security fixes land on `main`. Please run the latest `main` (or the newest release) before reporting.

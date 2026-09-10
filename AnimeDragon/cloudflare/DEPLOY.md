# AnimeDragon — Cloudflare deployment

## Workers Builds
- Root directory: `AnimeDragon/cloudflare` when the GitHub repository contains an outer `AnimeDragon/` directory.
- Build command: leave empty.
- Deploy command: `npx wrangler deploy`.
- Version command: leave empty.

## Required Worker bindings
- D1 binding `DB` -> `animedragon-db`.
- Assets binding is created by `wrangler.toml`.

## Required variables
Set these in the Worker environment:
- `SITE_URL` = the real Worker URL, for example `https://animedragon.<your-subdomain>.workers.dev`
- `ADMIN_EMAIL` = the email for the owner/admin account.
- `ADMIN_PASSWORD` = a strong password for that admin account (store as a secret, not in Git).

## Database
Run `schema.sql` in the D1 database once. Then run `seed.sql` once.

## First check after deployment
Open:
- `/api/config` — should return JSON with site settings and categories.
- `/` — should show login/signup.

## Important
Do not commit real passwords or tokens to GitHub.

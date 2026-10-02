# Cloudflare Worker deployment

The Vinext application Worker is named `dough-socratica-info` and is configured
in `cloudflare.config.ts`. Its intended production hostname is
`dough.socratica.info`.

## Commands

```bash
npm run build:vinext
npm run deploy:vinext
```

`deploy:vinext` builds the application and deploys the generated Worker through
the Cloudflare `cf` CLI. It is intentionally not a Wrangler deployment: this
repository uses `cloudflare.config.ts`.

## Required Cloudflare configuration

- The Worker needs `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as non-secret runtime bindings.
- `SUPABASE_SECRET_KEY` must be a Worker secret. Never commit it, put it in
  `cloudflare.config.ts`, or expose it to the browser.
- The Supabase Auth redirect allow-list must include
  `https://dough.socratica.info/auth/callback*` before production invitation
  links are sent.
- The custom hostname needs to be present in the Cloudflare zone before the
  first production deployment can attach it.

## Continuous deployment

Use Cloudflare Workers Builds, connected to the GitHub repository, with
`master` as the production branch. Configure both production and preview builds
with:

```text
Build command:  npm run build:vinext
Deploy command: npm run deploy:vinext -- --skip-build
Root directory: /
```

Workers Builds requires a Cloudflare-authorized GitHub connection and a
Cloudflare build token. Those are account settings, not repository values. Once
connected, every push to `master` runs the production build; preview builds are
optional for pull requests.

## Post-deploy smoke check

Check `/store/market` loads live vendors/products, `/admin` requires an admin
session, and a participant can reach `/ramp`. A full checkout rehearsal still
needs a provisioned team, member, mock card, and fund in the production
database.

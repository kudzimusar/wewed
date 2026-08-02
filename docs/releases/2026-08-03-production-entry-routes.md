# Production entry-route hotfix

Deployment trigger and release record for merge commit `a9bc37bad429d39fd7236709c4ccfd050c9cfe85`.

The hotfix adds compatibility entry points for:

- `/couple/login`, which forwards legacy sign-in links to a validated internal destination and defaults to `/billing`.
- `/pricing`, which permanently redirects to the canonical homepage pricing section at `/#pricing`.

The implementation does not change authentication internals, Stripe configuration, database state, environment variables, subscription processing, or planner/admin behavior.

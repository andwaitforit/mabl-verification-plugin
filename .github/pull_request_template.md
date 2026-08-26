## What changed

<!-- Link the issue this addresses, if there is one. -->

## Checklist

- [ ] Edited `mabl-verification/`, not `dist/`
- [ ] Ran `bun run build` and committed the regenerated projections
- [ ] `bun run check` is green (typecheck, tests, no projection drift)
- [ ] New behavior has a test that fails without the fix
- [ ] Contract changes update `mabl-verification-contract.ts` and every producer and consumer
- [ ] User-visible changes bump the version in all three manifests and add a `CHANGELOG.md` entry

## What you tested

<!-- Content validation alone is not enough: a stage with an invalid execution
     contract reads fine but is dropped as degraded at compose time. -->

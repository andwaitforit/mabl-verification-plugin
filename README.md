# mabl-verification

An [AIDLC](https://github.com/awslabs/aidlc-workflows) plugin that runs the mabl
verification loop inside the workflow: pre-PR test matching and local execution,
failure RCA, coverage-gap analysis, triage routing, and a ship recommendation.

Published and maintained by mabl. Not an AIDLC first-party plugin — it composes
into an AIDLC install through the documented third-party plugin mechanism.

## Layout

The plugin itself lives in [`mabl-verification/`](mabl-verification/); this
repository wraps it with the dev tooling needed to validate and package it.

## Developing

The framework's validator, compose fixture, and packager live in the
aidlc-workflows repository, so tests need a checkout of it:

```bash
git clone https://github.com/awslabs/aidlc-workflows.git
git -C aidlc-workflows checkout 572dda2863437d578b9d9bc2ea171a2e3955f91f  # v2 @ 2.6.80
export AIDLC_WORKFLOWS_ROOT="$PWD/aidlc-workflows"

bun install
bun test
bun run typecheck
```

A checkout placed beside this repository is discovered automatically;
`AIDLC_WORKFLOWS_ROOT` overrides the search. See
`mabl-verification/tests/harness.ts`.

## Status

Working toward a first release. The nine findings from the upstream review of
[awslabs/aidlc-workflows#907](https://github.com/awslabs/aidlc-workflows/pull/907)
are being addressed here; see CHANGELOG.md.

# mabl-verification

An [AIDLC](https://github.com/awslabs/aidlc-workflows) plugin that runs the mabl
verification loop inside the workflow: pre-PR test matching and local execution,
failure RCA, coverage-gap analysis, triage routing, and a ship recommendation.

Published and maintained by mabl. Not an AIDLC first-party plugin — it composes
into an AIDLC install through the documented third-party plugin mechanism.

## Layout

The plugin itself lives in [`mabl-verification/`](mabl-verification/); this
repository wraps it with the dev tooling needed to validate and package it.

## Installing

The published artifact is the packaged projection under
`dist/plugins/mabl-verification/<harness>/`, one per supported host.

```bash
# Claude
/plugin marketplace add andwaitforit/mabl-verification-plugin
/plugin install aidlc-mabl-verification@mabl-plugins

# Codex
codex plugin marketplace add andwaitforit/mabl-verification-plugin
codex plugin add aidlc-mabl-verification@mabl-plugins
```

Kiro has no plugin store: copy `dist/plugins/mabl-verification/kiro-ide/` into
the project and run the composer explicitly.

A SessionStart hook bundled in the projection composes the plugin into the
install, so no prose or skill file needs editing.

## Developing

The framework ships an authoring toolchain (validate / build / test) inside its
distribution, so this repository works against a **pinned, copied
distribution** — no aidlc-workflows checkout is involved anywhere in the loop.

```bash
bun install
bun run sync        # copies the pinned AIDLC distribution into .aidlc/ (gitignored)
bun run check       # typecheck + tests + projection drift
```

`bun run build` regenerates the host projections after any change under
`mabl-verification/`. `bun scripts/build-projections.ts --check` byte-compares
freshly built projections against the committed `dist/`, and CI fails on drift,
so a stale `dist/` cannot reach main.

### Pinned AIDLC version

`scripts/aidlc-pin.ts` is the single source of truth:

| | |
|---|---|
| Version | 2.6.105 |
| Commit | `3b5a1359fabef00de04ef05a58ed2835857a26cb` |

Bump both fields together, run `bun run sync --force`, then `bun run check`.
The validate and compose tiers run against exactly that distribution, so a
framework change that breaks this plugin surfaces as a test failure rather than
a user report.

### The compose hook

`mabl-verification/hooks/compose.ts` is deliberately **absent**. The build
injects the framework's bundled template, which means this plugin cannot drift
from it. The `compose-hook-absent` warning is expected and asserted in the test
suite. Vendor the file only to intentionally pin a modified hook.

## Status

**v0.1.0** — first published release, validated against AIDLC 2.6.105.

Pre-1.0: the stage contracts, artifact schemas, and sensor output shapes may
still change between minor versions. See [CHANGELOG.md](CHANGELOG.md). The findings from the upstream review of
[awslabs/aidlc-workflows#907](https://github.com/awslabs/aidlc-workflows/pull/907)
are being addressed here; see CHANGELOG.md.

Known gap: the setup documentation in
[`mabl-verification/README.md`](mabl-verification/README.md) has not been
re-verified against the current mabl CLI and MCP integration. Treat those
install steps as unconfirmed until that lands.

## Compatibility

| | |
|---|---|
| Plugin | 0.1.0 |
| Validated against AIDLC | 2.6.105 (`3b5a1359f`) |
| Harnesses | Claude Code, Codex, Copilot, Cursor, Kiro, Kiro IDE, opencode |

AIDLC ships frequently and its plugin contract tightens between patch releases,
so each plugin release names the exact framework version it was validated
against rather than a range. Newer AIDLC versions are likely to work but are not
covered until a release says so. If you hit a mismatch,
[open an issue](../../issues/new/choose) with both versions.

Pre-1.0, only the latest release receives fixes.

## Support

- **Bugs and feature requests** — [open an issue](../../issues/new/choose)
- **Security** — report privately, see [SECURITY.md](SECURITY.md). Never a
  public issue.
- **AIDLC framework itself** — [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows/issues)
- **mabl platform, CLI, or MCP** — mabl support, not this repository

Contributing: [CONTRIBUTING.md](CONTRIBUTING.md) ·
Security: [SECURITY.md](SECURITY.md) ·
License: [MIT](LICENSE)

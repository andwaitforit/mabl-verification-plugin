# Contributing Guidelines

Thank you for your interest in contributing to the mabl-verification AIDLC
plugin. Whether it's a bug report, a stage correction, a sensor fix, or a
documentation improvement, we value feedback and contributions from the
community.

Please read through this document before submitting any issues or pull requests.

## How this repository is built

This plugin composes into an [AIDLC](https://github.com/awslabs/aidlc-workflows)
install through the documented third-party plugin mechanism. It is published and
maintained by mabl — it is **not** an AIDLC first-party plugin, and the AIDLC
team does not own its releases, compatibility, or support.

The layout has two zones:

- **`mabl-verification/`** — the hand-authored plugin: manifest, stages,
  contributions, scopes, agents, knowledge, sensors, tools, tests. **Edit here.**
- **`dist/plugins/mabl-verification/<harness>/`** — generated, committed, and
  drift-guarded host projections, one per supported harness. **Never
  hand-edit** — `bun scripts/build-projections.ts --check` fails CI on any drift.

After editing anything under `mabl-verification/`, regenerate the projections:

```bash
bun run build        # regenerate every dist/plugins/mabl-verification/<harness>/
bun run check        # typecheck + tests + byte-parity drift guard
```

## Prerequisites

```bash
bun install
bun run sync         # copies the pinned AIDLC distribution into .aidlc/
```

No aidlc-workflows checkout is needed. AIDLC ships an authoring toolchain
(`aidlc-plugin-validate` / `-build` / `-test`) inside its distribution, and this
repository drives those shipped tools against a pinned, copied distribution. See
[README](README.md#pinned-aidlc-version).

## The pinned AIDLC version

`scripts/aidlc-pin.ts` is the single source of truth for the AIDLC version this
plugin is authored and tested against. Both the validate and compose tiers run
against exactly that distribution.

To move to a newer AIDLC release:

1. Update `AIDLC_SHA` and `AIDLC_VERSION` together in `scripts/aidlc-pin.ts`.
2. `bun run sync --force`
3. `bun run check` — fix anything the newer framework's rules now reject.
4. `bun run build` and commit the regenerated projections.
5. Record the new supported version in `CHANGELOG.md`.

AIDLC ships frequently, and its plugin contract does tighten between patch
releases. A framework change that breaks this plugin should surface here as a
test failure, not as a user report.

## Authoring principles

The plugin follows AIDLC's own separation of concerns. Keep these boundaries
clear:

- **Stages own workflow placement** — a stage's frontmatter is the source of
  truth for its phase, execution contract, agents, produced and consumed
  artifacts, sensors, and scopes. Do not restate placement in the agent persona.
- **The agent owns identity** — `mabl-verification-quality-agent` describes
  perspective and judgment, not stage ownership.
- **Knowledge is transferable** — files under `knowledge/` describe methodology
  (RCA, triage routing, authoring patterns, local-run patterns) that applies
  wherever the work happens, not "what the agent does at stage X".
- **One machine-readable contract** — every failure class, artifact key, and
  enum shared between a producer (stage prose) and a consumer (sensor, ship
  gate) lives in `mabl-verification/tools/mabl-verification-contract.ts`.
  Producer/consumer divergence is how a real regression silently bypasses a
  BLOCK; the test suite guards it.
- **Artifact keys are snake_case** — inside every JSON summary this plugin
  writes. MCP call signatures keep mabl's own camelCase spelling
  (`get_mabl_test_run(testRunId)`) and are deliberately excluded.
- **Artifacts are plugin-namespaced** — every produced artifact starts with
  `mabl-verification-`.
- **Sensors fail closed** — for an artifact this plugin owns, a missing file, an
  absent or malformed summary, or an unrecognized failure class reports
  `pass: false`. A zero-result pass must never be reachable.

## Pull Request Checklist

Before submitting a PR, verify:

- You edited `mabl-verification/`, **not** `dist/`.
- You ran `bun run build` and committed the regenerated projections alongside
  your source change.
- `bun run check` is fully green — typecheck, tests, and no projection drift.
- New behavior has a test. Sensor changes need dispatcher-shaped tests that
  invoke the tool the way `core/tools/aidlc-sensor.ts` does: `--stage <slug>`
  and `--output-path <exact file>`.
- Contract changes update `mabl-verification-contract.ts` **and** every producer
  and consumer that reads it.
- User-visible changes bump the version in `mabl-verification/.aidlc-plugin/plugin.json`,
  `package.json`, and `.claude-plugin/marketplace.json` — all three, kept in sync
  by a test — and add a matching `CHANGELOG.md` entry in the same commit.
- Stale stage names, slugs, or artifact keys do not remain in docs or generated
  output (grep the repo when renaming anything).

## Testing changes

```bash
bun run check
```

That runs three tiers:

1. **Validate** — the framework's shipped `aidlc-plugin-validate` against the
   authored plugin: manifest, stage schema, ownership, artifact namespacing,
   contribution targets, scope and agent naming.
2. **Compose** — the framework's shipped `aidlc-plugin-test`, which builds the
   projection, composes it into a disposable copy of a real install, runs the
   real compose hook, and reports drops, the compiled graph, and second-pass
   idempotency. It never mutates the source install.
3. **Plugin-local** — this plugin's own contract and sensor-behavior tests.

Describe what you tested in your PR. Content validation alone is not enough: a
stage with an invalid execution contract reads fine but is dropped as degraded at
compose time, which is how this plugin once shipped without a ship gate.

## Reporting bugs / feature requests

[Open an issue](../../issues/new/choose) using one of the templates. Before
filing, check existing issues to avoid duplicates.

The templates ask for the following; please fill them in, since most reports are
version-specific:

- Which stage, sensor, or tool is affected
- Expected vs actual behavior
- Your AIDLC version and harness (Claude Code, Kiro, Codex, opencode, Copilot,
  Cursor)
- Your mabl CLI version, and whether the run was local or cloud

Please do not paste mabl workspace credentials, API keys, or customer data into
an issue. Redact test names and URLs if they are sensitive.

## Contributing via pull requests

### Start with an issue

We encourage opening an issue before working on a PR. It helps everyone align on
approach and scope before you invest time. For small fixes like typos, go
straight to a PR.

### AI-generated contributions

PRs produced by AI coding agents are welcome and follow the same process. Start
with an issue, align on scope, and meet the same quality bar — including tests
that actually fail without the fix.

### Submitting your PR

1. Work against the latest `main`
2. Check existing open and recently merged PRs
3. Fork the repository
4. Make your changes (keep them focused)
5. Use clear commit messages following [conventional commits](https://www.conventionalcommits.org/)
   (e.g. `feat:`, `fix:`, `docs:`, `build:`)
6. Submit the PR and respond to feedback

### PR closure

We review every PR and want to help contributions land. To maintain quality, we
may close PRs that are out of scope or don't follow these guidelines. You're
always welcome to open an issue and try again.

## Security issue notifications

Do not open a public GitHub issue for a security problem. See
[SECURITY.md](SECURITY.md) for how to report privately.

## Licensing

See the [LICENSE](LICENSE) file. This project is MIT licensed. We will ask you to
confirm the licensing of your contribution.

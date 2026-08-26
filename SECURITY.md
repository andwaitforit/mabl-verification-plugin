# Security Policy

This plugin is published and maintained by mabl. Security response for the
plugin is owned here, not by the AIDLC team.

## Reporting a vulnerability

**Do not open a public GitHub issue for a security problem.**

Report privately through either channel:

1. **GitHub private vulnerability reporting** — use the **Report a
   vulnerability** button under this repository's
   [Security tab](../../security/advisories/new). This opens a private advisory
   visible only to maintainers.
2. **Email** — <!-- TODO(mabl): confirm the official intake address before
   publishing. --> mabl's security intake address.

Please include:

- The affected version or commit, and the pinned AIDLC version
  (`scripts/aidlc-pin.ts`)
- The harness and mabl CLI version
- Impact, and a minimal reproduction
- Whether the issue is already public anywhere

Do not include live credentials, API keys, or customer data in a report. A
redacted reproduction is always preferred.

## What to expect

| | |
|---|---|
| Acknowledgement | within 3 business days |
| Initial assessment | within 10 business days |
| Fix or mitigation plan | communicated with the assessment |

We will keep you updated as the fix progresses, credit you in the advisory
unless you prefer otherwise, and coordinate disclosure timing with you. Fixes
ship as a patch release with a `CHANGELOG.md` entry and a published GitHub
advisory.

## Scope

**In scope** — anything in this repository:

- The stages, contributions, scopes, agent persona, and knowledge under
  `mabl-verification/`
- The sensors and tools under `mabl-verification/tools/`, including the
  fail-closed behavior that gates ship decisions
- The generated projections under `dist/plugins/mabl-verification/`
- The build, sync, and pin scripts under `scripts/`
- The setup and configuration guidance in this repository's documentation

Concrete examples of in-scope issues: a sensor that reports `pass` for a failing
run and thereby lets a regression through a gate; a tool that leaks mabl
credentials into an artifact, log, or console output; guidance that instructs a
user to store an API key insecurely; a projection that executes content from an
untrusted path; a supply-chain problem in how `bun run sync` fetches and pins the
AIDLC distribution.

**Out of scope — report to the appropriate owner instead:**

- **The AIDLC framework itself** (composition, the plugin mechanism, the sensor
  dispatcher, the orchestrator) —
  [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows). Follow
  their [vulnerability reporting
  process](http://aws.amazon.com/security/vulnerability-reporting/).
- **The mabl platform, CLI, or MCP service** — use mabl's standard product
  security process, not this repository.
- **A host CLI** (Claude Code, Kiro, Codex, opencode, Copilot, Cursor) — report
  to that vendor.

If you are unsure which owner applies, report it here and we will route it.

## Security model notes

Two properties are load-bearing, and a report that either is violated is always
in scope:

**Sensors fail closed.** For an artifact this plugin owns, a missing file, an
absent or malformed JSON summary, or an unrecognized failure class must report
`pass: false`. A silent zero-result pass would let a real regression reach a
ship decision. `mabl-run-status` is a blocking sensor; overriding it requires the
framework's documented human-backed override, which is refused outright in
autonomous mode.

**The ship decision stays human-controlled.** This plugin recommends; it never
opens, merges, or promotes anything on its own. A change that lets it act without
a human gate is a security issue, not a feature.

## Credentials

This plugin never stores mabl credentials. It relies on the mabl CLI's and MCP
server's own authentication. Configuration guidance keeps secrets in the host's
MCP configuration or the environment — never in a committed file, an AIDLC
artifact, or a stage record. If you find guidance or code that contradicts this,
report it.

## Supported versions

Until a 1.0.0 release, only the latest published version receives security
fixes. Each release records the AIDLC version it was validated against; see
`CHANGELOG.md` and `scripts/aidlc-pin.ts`.

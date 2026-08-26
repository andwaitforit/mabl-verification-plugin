# Changelog

All notable changes to the mabl-verification plugin are documented here.
This project uses semantic versioning independently of aidlc-workflows.
Each release records the AIDLC version it was validated against.

## [0.1.0] - 2026-08-26

### Changed
- Authored against AIDLC **2.6.105** (`3b5a1359f`), up from 2.6.80. The
  framework shipped a plugin authoring toolchain (validate/build/test) in its
  distribution, so this repository now drives those shipped tools against a
  pinned, copied distribution in `.aidlc/`. Removed the checkout resolver, the
  staging of this plugin into a framework tree, and the CI clone of
  aidlc-workflows — no framework checkout is in the loop anywhere.
- Renamed the agent to `mabl-verification-quality-agent` to satisfy the
  `agent-filename` rule added in 2.6.105, which requires
  `<plugin>-<role>-agent.md`. The knowledge directory moved with it.
- Projections now carry the emitter's `.aidlc-plugin-projection.json`
  provenance file.

### Added
- Host projections for all seven harnesses under
  `dist/plugins/mabl-verification/`, built by `scripts/build-projections.ts`,
  with a `--check` drift guard wired into CI.
- Root `.claude-plugin/marketplace.json` so the repository can be added as a
  plugin marketplace.
- GitHub Actions CI: typecheck, tests, and projection-drift check against the
  pinned AIDLC distribution.
- `scripts/aidlc-pin.ts` as the single source of truth for the supported AIDLC
  version, and `bun run sync` to fetch it.
- Contract-tier tests (`tests/compose.test.ts`) that drive the framework's own
  shipped validate and test tools: 0 drops, graph compiled, all three stages and
  the plugin scope present, both contributions applied, and an idempotent second
  compose.
- An input contract on `mabl-verification-ship-gate` naming every mabl
  identifier kind the stage accepts, replacing bare `-jr`/`-pr`/`-j`/`-p`/`-v`
  shorthand carried over from the source skills.
- Version-synchronization tests across `plugin.json`, `package.json`, and the
  marketplace entry.
- `tools/mabl-verification-contract.ts` — the single machine-readable contract
  (failure-class enum, owned-artifact map, dispatcher flag parsing, fail-closed
  JSON extraction) shared by every producer and consumer.
- `contributions/construction/code-generation.md` — places the core
  `code-generation` stage under the plugin scope via `adds.scopes`.
- Dispatcher-shaped sensor behavior tests and framework-validator content tests.

### Fixed
- `mabl-verification-ship-gate` declared `execution: EXECUTE` with no
  `condition`, so composition dropped it as degraded and no ship gate existed.
- Both sensors treated `--output-path` as a directory when the dispatcher passes
  the exact written file, returning a clean zero-result pass for failing runs.
- Failure-class vocabulary diverged between producer prose and consumers,
  allowing a real regression to bypass BLOCK.
- `coverage_zero_match` / `coverageZeroMatch` key mismatch between the pre-PR
  producer and the coverage-gap consumer.
- The validation scope used an ignored `phases:` mechanism naming four
  nonexistent stage slugs.
- Docs incorrectly claimed blocking sensor severity does not exist.
- `required_sections: ["mabl Verification"]` was declared but never emitted.
- Contract drift the first pass missed: the ship gate still described failure
  classes in prose ("code regression / ... / flake") rather than the canonical
  tokens, and the triage-routing decision object used camelCase keys. Both are
  now guarded by tests that scan every fenced JSON block this plugin writes.
  MCP call signatures keep mabl's own camelCase spelling.

### Changed
- `mabl-run-status` is now `default_severity: blocking`;
  `mabl-coverage-threshold` remains advisory by explicit choice.
- Sensor `matches` globs narrowed to the plugin's own artifacts.
- Published from a mabl-owned repository rather than as an AIDLC first-party
  plugin.

[0.1.0]: https://github.com/andwaitforit/mabl-verification-plugin/releases/tag/v0.1.0

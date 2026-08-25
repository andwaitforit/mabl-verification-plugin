# Changelog

All notable changes to the mabl-verification plugin are documented here.
This project uses semantic versioning independently of aidlc-workflows.

## [Unreleased]

### Added
- Host projections for all seven harnesses under
  `dist/plugins/mabl-verification/`, built by `scripts/build-projections.ts`,
  with a `--check` drift guard wired into CI.
- Root `.claude-plugin/marketplace.json` so the repository can be added as a
  plugin marketplace.
- GitHub Actions CI: typecheck, tests, and projection-drift check against a
  pinned aidlc-workflows checkout.
- Real composition tests (`tests/compose.test.ts`) that build the actual
  projection, run the emitted compose hook, and assert all three stages reach
  the compiled graph.
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

### Changed
- `mabl-run-status` is now `default_severity: blocking`;
  `mabl-coverage-threshold` remains advisory by explicit choice.
- Sensor `matches` globs narrowed to the plugin's own artifacts.
- Published from a mabl-owned repository rather than as an AIDLC first-party
  plugin.

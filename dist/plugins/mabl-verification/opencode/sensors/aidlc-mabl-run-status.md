---
id: mabl-run-status
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-mabl-run-status.ts
default_severity: blocking
description: Gates on whether mabl test runs passed by reading the JSON summary from mabl-verification-run-results.md or mabl-verification-local-run-log.md (mabl-verification plugin, blocking)
category: document-shape
matches: "**/mabl-verification-{run-results,local-run-log}.md"
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
  tests_run: integer
  tests_passed: integer
  tests_failed: integer
  billable_skipped: integer
  has_unresolved_failures: boolean
timeout_seconds: 5
---

# mabl-run-status sensor (mabl-verification)

BLOCKING. Reads the machine-readable JSON summary block from either
`mabl-verification-run-results.md` (full pre-PR stage) or
`mabl-verification-local-run-log.md` (build-and-test contribution smoke-check)
and reports whether the mabl test runs passed.

## Pass criteria

- `pass: true` when `tests_failed == 0` (billable skips do not count as failures)
- `pass: false` when `tests_failed > 0` and at least one failure is classified as
  `product` or remains unresolved

## Findings

Each unresolved failure (not classified as `billable-skip` or already triaged as
`env-data`/`mabl-flake` with a successful rerun) is reported as a finding.

## Severity

BLOCKING. An unresolved `product` or `stale-test` failure refuses the stage's
approval gate. The framework's blocking severity is a real capability
(`default_severity: "advisory" | "blocking"`), and a human may still proceed
through the documented override — `aidlc-log.ts decision` → "Override blocking
sensors" → report with `--override-blocking-sensors`, which requires a
human-backed answer receipt and is refused outright in autonomous mode. The ship
decision therefore stays human-controlled while a silent pass becomes impossible.

## Fail-closed behavior

The sensor reads the exact file the dispatcher names in `--output-path`. For an
artifact this plugin owns, a missing file, an absent or malformed JSON summary,
an unrecognized failure class, or failures reported with no accompanying entries
all report `pass: false` with a `reason`. A file the plugin does not own reports
`not_applicable`. There is no zero-result pass.

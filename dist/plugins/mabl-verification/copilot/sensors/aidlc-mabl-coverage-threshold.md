---
id: mabl-coverage-threshold
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-mabl-coverage-threshold.ts
default_severity: advisory
description: Reports whether critical or normal coverage gaps exist in the mabl-verification-coverage-report.md (mabl-verification plugin, advisory)
category: document-shape
matches: "**/mabl-verification-coverage-report.md"
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
  total_flows: integer
  covered: integer
  uncovered: integer
  critical_gap_count: integer
  ship_blocker: boolean
timeout_seconds: 5
---

# mabl-coverage-threshold sensor (mabl-verification)

ADVISORY. Reads the machine-readable JSON summary from
`mabl-verification-coverage-report.md` and reports whether critical or normal
coverage gaps exist for the changed flows.

## Pass criteria

- `pass: true` when `critical_gap_count == 0` (no critical uncovered flows)
- `pass: false` when `critical_gap_count > 0` (at least one critical flow has no test)

## Findings

Each gap with severity `critical` or `normal` where `has_test == false` is reported
as a finding. Low-severity gaps and deferred recommendations are not reported.

## Ship-blocker signal

When `ship_blocker: true` (any critical gap with no test and recommendation `author`),
the downstream `mabl-verification-ship-gate` stage will factor this into its BLOCK
decision. The sensor itself does not block — it reports.

## Severity

ADVISORY, deliberately. A coverage gap is a judgement call about what deserves a
test, not a proven regression, so it informs rather than refuses. Blocking
severity exists in the framework and is used by this plugin's `mabl-run-status`
sensor; it is not used here on purpose. The downstream
`mabl-verification-ship-gate` stage still factors `ship_blocker` into its BLOCK
recommendation.

## Fail-closed behavior

The sensor reads the exact file the dispatcher names in `--output-path`. For the
owned coverage report, a missing file, an absent or malformed JSON summary, or a
summary with no `gaps` array reports `pass: false` with `ship_blocker: true` — a
report that cannot be read is never treated as full coverage.

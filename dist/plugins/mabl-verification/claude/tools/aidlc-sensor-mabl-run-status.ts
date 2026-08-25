#!/usr/bin/env bun
/**
 * aidlc-sensor-mabl-run-status.ts
 *
 * Blocking sensor for the mabl-verification plugin. Reads the JSON summary from
 * the exact artifact the dispatcher names and reports whether the mabl runs
 * passed.
 *
 * Fails closed: an owned artifact that cannot be read, carries no summary, has a
 * malformed summary, or names an unrecognized failure class reports pass:false.
 * A silent zero-result pass would let a real regression through the gate.
 *
 * Exit 0 + JSON stdout = sensor result.
 */

import { existsSync, readFileSync } from "node:fs";

import {
  RERUNNABLE_CLASSES,
  UNRESOLVED_CLASSES,
  emit,
  extractJsonBlock,
  isFailureClass,
  ownsArtifact,
  parseFlags,
} from "./mabl-verification-contract.ts";

const SENSOR_ID = "mabl-run-status";

interface Failure {
  test_id?: string;
  test_name?: string;
  class?: unknown;
  rerun_passed?: boolean;
}

interface RunSummary {
  status?: string;
  tests_run?: number;
  passed?: number;
  failed?: number;
  billable_skipped?: number;
  failures?: Failure[];
}

function base(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    pass: false,
    findings_count: 0,
    tests_run: 0,
    tests_passed: 0,
    tests_failed: 0,
    billable_skipped: 0,
    has_unresolved_failures: false,
    ...overrides,
  };
}

function failClosed(reason: string): never {
  emit(base({ pass: false, findings_count: 1, reason }));
}

function main(): void {
  const { outputPath } = parseFlags(process.argv.slice(2));

  if (!outputPath) failClosed("no --output-path supplied");

  // The dispatcher fires on any output of a stage that declares this sensor.
  // Files this plugin does not own carry no verdict either way.
  if (!ownsArtifact(SENSOR_ID, outputPath)) {
    emit(base({ pass: true, not_applicable: true }));
  }

  if (!existsSync(outputPath)) failClosed(`owned artifact missing: ${outputPath}`);

  let content: string;
  try {
    content = readFileSync(outputPath, "utf-8");
  } catch (err) {
    failClosed(`cannot read owned artifact: ${(err as Error).message}`);
  }

  const parsed = extractJsonBlock<RunSummary>(content);
  if (!parsed.ok) failClosed(parsed.reason);
  const summary = parsed.value;

  const failures = summary.failures ?? [];
  const unknown = failures.filter((f) => !isFailureClass(f.class));
  if (unknown.length > 0) {
    failClosed(
      `${unknown.length} failure(s) carry an unrecognized class; ` +
        `expected one of product|stale-test|env-data|mabl-flake|billable-skip`,
    );
  }

  const testsRun = summary.tests_run ?? (summary.status ? 1 : 0);
  const testsPassed = summary.passed ?? (summary.status === "pass" ? 1 : 0);
  const testsFailed = summary.failed ?? (summary.status === "fail" ? 1 : 0);
  const billableSkipped = summary.billable_skipped ?? 0;

  const unresolved = failures.filter((f) => {
    const cls = f.class as string;
    if (UNRESOLVED_CLASSES.includes(cls as never)) return true;
    // A rerunnable class only counts as resolved once a rerun actually passed.
    if (RERUNNABLE_CLASSES.includes(cls as never)) return f.rerun_passed !== true;
    return false;
  });

  // A reported failure with no corresponding failure entry is unexplained.
  if (testsFailed > 0 && failures.length === 0) {
    failClosed(`${testsFailed} test(s) failed but the summary lists no failures`);
  }

  emit({
    pass: unresolved.length === 0,
    findings_count: unresolved.length,
    tests_run: testsRun,
    tests_passed: testsPassed,
    tests_failed: testsFailed,
    billable_skipped: billableSkipped,
    has_unresolved_failures: unresolved.length > 0,
  });
}

main();

#!/usr/bin/env bun
/**
 * aidlc-sensor-mabl-coverage-threshold.ts
 *
 * Advisory sensor for the mabl-verification plugin. Reads the JSON summary from
 * the exact artifact the dispatcher names and reports whether critical or normal
 * coverage gaps exist for the changed flows.
 *
 * Fails closed on an owned artifact it cannot read or parse, so a missing
 * coverage report is never mistaken for full coverage.
 *
 * Exit 0 + JSON stdout = sensor result.
 */

import { existsSync, readFileSync } from "node:fs";

import {
  emit,
  extractJsonBlock,
  ownsArtifact,
  parseFlags,
} from "./mabl-verification-contract.ts";

const SENSOR_ID = "mabl-coverage-threshold";

interface Gap {
  flow?: string;
  severity?: "critical" | "normal" | "low";
  recommendation?: "author" | "defer" | "none";
  authored_test_id?: string | null;
  has_test?: boolean;
}

interface CoverageSummary {
  total_flows?: number;
  covered?: number;
  weakly_covered?: number;
  uncovered?: number;
  gaps?: Gap[];
  gap_found?: boolean;
  critical_gap_count?: number;
  ship_blocker?: boolean;
}

function base(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    pass: false,
    findings_count: 0,
    total_flows: 0,
    covered: 0,
    uncovered: 0,
    critical_gap_count: 0,
    ship_blocker: false,
    ...overrides,
  };
}

function failClosed(reason: string): never {
  emit(base({ pass: false, findings_count: 1, ship_blocker: true, reason }));
}

function main(): void {
  const { outputPath } = parseFlags(process.argv.slice(2));

  if (!outputPath) failClosed("no --output-path supplied");

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

  const parsed = extractJsonBlock<CoverageSummary>(content);
  if (!parsed.ok) failClosed(parsed.reason);
  const summary = parsed.value;

  if (!Array.isArray(summary.gaps)) {
    failClosed("coverage summary has no gaps array");
  }
  const gaps = summary.gaps as Gap[];

  const actionable = gaps.filter(
    (g) =>
      (g.severity === "critical" || g.severity === "normal") &&
      g.has_test !== true &&
      g.recommendation !== "none",
  );
  const critical = gaps.filter((g) => g.severity === "critical" && g.has_test !== true);

  emit({
    pass: critical.length === 0,
    findings_count: actionable.length,
    total_flows: summary.total_flows ?? 0,
    covered: summary.covered ?? 0,
    uncovered: summary.uncovered ?? 0,
    critical_gap_count: critical.length,
    ship_blocker: summary.ship_blocker ?? critical.length > 0,
  });
}

main();

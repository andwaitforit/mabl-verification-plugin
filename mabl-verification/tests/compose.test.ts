/**
 * Contract-tier tests: run the framework's own shipped validate and test tools
 * against this plugin, from the pinned distribution in .aidlc/.
 *
 * The test tool composes the built projection into a disposable copy of a real
 * install, runs the real compose hook, and never mutates the source install.
 * This is the check content validation cannot make: a stage with an invalid
 * execution contract reads fine but is dropped as degraded at compose time,
 * which is how this plugin once shipped without a ship gate.
 */

import { describe, expect, test } from "bun:test";

import {
  AIDLC_VERSION,
  PLUGIN_NAME,
  PLUGIN_ROOT,
  type ToolReport,
  runTool,
} from "./harness.ts";
import { INSTALL_DIR } from "../../scripts/aidlc-pin.ts";

const EXPECTED_STAGES = [
  "mabl-verification-coverage-gap",
  "mabl-verification-pre-pr",
  "mabl-verification-ship-gate",
];

describe(`validate tier (AIDLC ${AIDLC_VERSION})`, () => {
  const report: ToolReport = runTool("validate", [PLUGIN_ROOT]);

  test("the plugin is valid with no errors", () => {
    expect(report.errors).toEqual([]);
    expect(report.valid).toBe(true);
  });

  test("the only warning is the deliberate absent compose hook", () => {
    // Left absent on purpose: the build injects the bundled template, so the
    // plugin cannot drift from it.
    expect(report.warnings.map((w) => w.rule)).toEqual(["compose-hook-absent"]);
  });
});

describe(`compose tier (AIDLC ${AIDLC_VERSION})`, () => {
  const report: ToolReport = runTool("test", [
    PLUGIN_ROOT,
    "--install",
    INSTALL_DIR,
    "--harness",
    "claude",
  ]);
  const graph = report.graph as {
    compiled: boolean;
    presentStages: string[];
    missingStages: string[];
    presentScopes?: string[];
    missingScopes?: string[];
  };

  test("composes cleanly with no dropped surfaces", () => {
    expect(report.errors).toEqual([]);
    expect(report.drops).toEqual([]);
    expect(report.valid).toBe(true);
  });

  test("the graph compiles with all three plugin stages", () => {
    expect(graph.compiled).toBe(true);
    expect(graph.missingStages).toEqual([]);
    for (const slug of EXPECTED_STAGES) {
      expect(graph.presentStages).toContain(slug);
    }
  });

  test("the ship gate survives composition", () => {
    // The stage that was previously dropped as degraded.
    expect(graph.presentStages).toContain("mabl-verification-ship-gate");
  });

  test("the plugin scope reaches the compiled grid", () => {
    expect(graph.missingScopes ?? []).toEqual([]);
    expect(graph.presentScopes ?? []).toContain(`${PLUGIN_NAME}-validation`);
  });

  test("both core-stage contributions apply", () => {
    const changed = (report.changedFiles ?? []) as string[];
    expect(changed.some((f) => f.includes("build-and-test"))).toBe(true);
    expect(changed.some((f) => f.includes("code-generation"))).toBe(true);
  });

  test("a second compose is idempotent", () => {
    expect(report.idempotent).toBe(true);
  });
});

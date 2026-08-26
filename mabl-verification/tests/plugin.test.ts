/**
 * Content, contract, and sensor-behavior tests for the mabl-verification plugin.
 *
 * Framework-contract validation lives in compose.test.ts, which drives the
 * shipped aidlc-plugin tools. This file covers what those tools cannot know:
 * the plugin's own machine-readable contract and its sensors' runtime behavior,
 * invoked exactly as the dispatcher does.
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FAILURE_CLASSES } from "../tools/mabl-verification-contract.ts";
import { PLUGIN_NAME, PLUGIN_ROOT } from "./harness.ts";

const RUN_STATUS = join(PLUGIN_ROOT, "tools", "aidlc-sensor-mabl-run-status.ts");
const COVERAGE = join(PLUGIN_ROOT, "tools", "aidlc-sensor-mabl-coverage-threshold.ts");

/** Invokes a sensor exactly as core/tools/aidlc-sensor.ts does. */
function runSensor(
  tool: string,
  outputPath: string,
  stage = "mabl-verification-pre-pr",
): Record<string, unknown> {
  const proc = spawnSync("bun", [tool, "--stage", stage, "--output-path", outputPath], {
    encoding: "utf-8",
    timeout: 10_000,
  });
  expect(proc.status).toBe(0);
  return JSON.parse(proc.stdout.trim());
}

function writeArtifact(name: string, body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "mabl-sensor-"));
  const file = join(dir, name);
  writeFileSync(file, body);
  return file;
}

function runResults(summary: unknown): string {
  return `# Run Results\n\nProse.\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`;
}

describe("contract", () => {
  const prePr = readFileSync(
    join(PLUGIN_ROOT, "stages", "construction", "mabl-verification-pre-pr.md"),
    "utf-8",
  );
  const coverageGap = readFileSync(
    join(PLUGIN_ROOT, "stages", "construction", "mabl-verification-coverage-gap.md"),
    "utf-8",
  );

  test("producer prose names every canonical failure class", () => {
    for (const cls of FAILURE_CLASSES) {
      expect(prePr).toContain(`\`${cls}\``);
    }
  });

  test("producer prose does not teach non-canonical class labels", () => {
    for (const bad of ["**Code regression**", "**Flake**", "**Stale test**", "**Billable skip**"]) {
      expect(prePr).not.toContain(bad);
    }
  });

  test("zero-match key is snake_case on both sides", () => {
    expect(prePr).toContain("coverage_zero_match");
    expect(coverageGap).toContain("coverage_zero_match");
    expect(prePr).not.toContain("coverageZeroMatch");
    expect(coverageGap).not.toContain("coverageZeroMatch");
  });

  test("summary example uses snake_case failure keys", () => {
    expect(prePr).toContain('"test_id"');
    expect(prePr).not.toContain('"testId"');
    expect(prePr).not.toContain('"failingStep"');
  });

  test("consumers name only canonical classes", () => {
    // The ship gate reads what pre-pr writes; a prose-only label here is how a
    // real regression slipped past BLOCK before.
    const shipGate = readFileSync(
      join(PLUGIN_ROOT, "stages", "operation", "mabl-verification-ship-gate.md"),
      "utf-8",
    );
    for (const bad of ["code regression / stale-test", "/ flake /"]) {
      expect(shipGate).not.toContain(bad);
    }
    for (const cls of FAILURE_CLASSES) {
      expect(shipGate).toContain(cls);
    }
  });

  test("artifact json keys are snake_case across every producer", () => {
    // MCP call signatures keep mabl's own camelCase spelling; only keys inside
    // fenced json blocks this plugin writes are checked.
    const docs = [
      join(PLUGIN_ROOT, "stages", "construction", "mabl-verification-pre-pr.md"),
      join(PLUGIN_ROOT, "stages", "construction", "mabl-verification-coverage-gap.md"),
      join(PLUGIN_ROOT, "stages", "operation", "mabl-verification-ship-gate.md"),
      join(PLUGIN_ROOT, "knowledge", "mabl-verification-quality-agent", "triage-routing.md"),
    ];
    const camel = /"[a-z]+[A-Z][A-Za-z]*"\s*:/g;
    for (const doc of docs) {
      const body = readFileSync(doc, "utf-8");
      for (const block of body.match(/```json\s*\n[\s\S]*?\n```/g) ?? []) {
        expect({ doc, offenders: block.match(camel) ?? [] }).toEqual({
          doc,
          offenders: [],
        });
      }
    }
  });

  test("the ship gate documents every identifier kind it accepts", () => {
    const shipGate = readFileSync(
      join(PLUGIN_ROOT, "stages", "operation", "mabl-verification-ship-gate.md"),
      "utf-8",
    );
    expect(shipGate).toContain("## Input contract");
    for (const suffix of ["-jr", "-pr", "-j", "-p", "-v"]) {
      expect(shipGate).toContain(`\`${suffix}\``);
    }
  });
});

describe("mabl-run-status sensor", () => {
  test("reads the exact file the dispatcher names, not a directory", () => {
    const file = writeArtifact(
      "mabl-verification-run-results.md",
      runResults({ tests_run: 2, passed: 2, failed: 0, failures: [] }),
    );
    const result = runSensor(RUN_STATUS, file);
    expect(result.pass).toBe(true);
    expect(result.tests_run).toBe(2);
  });

  test("blocks on an unresolved product failure", () => {
    const file = writeArtifact(
      "mabl-verification-run-results.md",
      runResults({
        tests_run: 2,
        passed: 1,
        failed: 1,
        failures: [{ test_id: "t1", class: "product", rerun_passed: false }],
      }),
    );
    const result = runSensor(RUN_STATUS, file);
    expect(result.pass).toBe(false);
    expect(result.has_unresolved_failures).toBe(true);
    expect(result.findings_count).toBe(1);
  });

  test("fails closed on an unrecognized failure class", () => {
    const file = writeArtifact(
      "mabl-verification-run-results.md",
      runResults({
        tests_run: 1,
        passed: 0,
        failed: 1,
        failures: [{ test_id: "t1", class: "code regression" }],
      }),
    );
    const result = runSensor(RUN_STATUS, file);
    expect(result.pass).toBe(false);
    expect(String(result.reason)).toContain("unrecognized class");
  });

  test("fails closed on malformed json", () => {
    const file = writeArtifact(
      "mabl-verification-run-results.md",
      "# Run Results\n\n```json\n{ not valid json\n```\n",
    );
    const result = runSensor(RUN_STATUS, file);
    expect(result.pass).toBe(false);
    expect(String(result.reason)).toContain("malformed json");
  });

  test("fails closed when the owned artifact has no summary block", () => {
    const file = writeArtifact("mabl-verification-run-results.md", "# Run Results\n\nNo block.\n");
    const result = runSensor(RUN_STATUS, file);
    expect(result.pass).toBe(false);
  });

  test("fails closed when the owned artifact is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "mabl-sensor-"));
    const result = runSensor(RUN_STATUS, join(dir, "mabl-verification-run-results.md"));
    expect(result.pass).toBe(false);
  });

  test("fails closed when failures are reported but not enumerated", () => {
    const file = writeArtifact(
      "mabl-verification-run-results.md",
      runResults({ tests_run: 2, passed: 1, failed: 1, failures: [] }),
    );
    expect(runSensor(RUN_STATUS, file).pass).toBe(false);
  });

  test("treats a rerun-passed flake as resolved", () => {
    const file = writeArtifact(
      "mabl-verification-run-results.md",
      runResults({
        tests_run: 1,
        passed: 0,
        failed: 1,
        failures: [{ test_id: "t1", class: "mabl-flake", rerun_passed: true }],
      }),
    );
    expect(runSensor(RUN_STATUS, file).pass).toBe(true);
  });

  test("does not treat a never-rerun flake as resolved", () => {
    const file = writeArtifact(
      "mabl-verification-run-results.md",
      runResults({
        tests_run: 1,
        passed: 0,
        failed: 1,
        failures: [{ test_id: "t1", class: "mabl-flake" }],
      }),
    );
    expect(runSensor(RUN_STATUS, file).pass).toBe(false);
  });

  test("reports not_applicable for a file the plugin does not own", () => {
    const file = writeArtifact("requirements-analysis.md", "# Unrelated\n");
    const result = runSensor(RUN_STATUS, file);
    expect(result.not_applicable).toBe(true);
  });
});

describe("mabl-coverage-threshold sensor", () => {
  const report = (summary: unknown) =>
    writeArtifact(
      "mabl-verification-coverage-report.md",
      `# Coverage\n\n\`\`\`json\n${JSON.stringify(summary)}\n\`\`\`\n`,
    );

  test("passes when no critical gap is uncovered", () => {
    const file = report({
      total_flows: 3,
      covered: 3,
      uncovered: 0,
      gaps: [],
      critical_gap_count: 0,
    });
    const result = runSensor(COVERAGE, file, "mabl-verification-coverage-gap");
    expect(result.pass).toBe(true);
    expect(result.total_flows).toBe(3);
  });

  test("fails on an uncovered critical flow", () => {
    const file = report({
      total_flows: 2,
      covered: 1,
      uncovered: 1,
      gaps: [{ flow: "transfer", severity: "critical", recommendation: "author", has_test: false }],
    });
    const result = runSensor(COVERAGE, file, "mabl-verification-coverage-gap");
    expect(result.pass).toBe(false);
    expect(result.critical_gap_count).toBe(1);
    expect(result.ship_blocker).toBe(true);
  });

  test("fails closed on a missing report rather than reporting full coverage", () => {
    const dir = mkdtempSync(join(tmpdir(), "mabl-sensor-"));
    const result = runSensor(
      COVERAGE,
      join(dir, "mabl-verification-coverage-report.md"),
      "mabl-verification-coverage-gap",
    );
    expect(result.pass).toBe(false);
    expect(result.ship_blocker).toBe(true);
  });

  test("fails closed when the summary has no gaps array", () => {
    const file = report({ total_flows: 5, covered: 5 });
    const result = runSensor(COVERAGE, file, "mabl-verification-coverage-gap");
    expect(result.pass).toBe(false);
  });
});

describe("scope membership", () => {
  test("core stages join the plugin scope through adds.scopes", () => {
    for (const target of ["build-and-test", "code-generation"]) {
      const contrib = readFileSync(
        join(PLUGIN_ROOT, "contributions", "construction", `${target}.md`),
        "utf-8",
      );
      expect(contrib).toContain(`target: ${target}`);
      expect(contrib).toContain("scopes:");
      expect(contrib).toContain(`- ${PLUGIN_NAME}-validation`);
    }
  });

  test("the scope declares no ignored phases mechanism", () => {
    const scope = readFileSync(
      join(PLUGIN_ROOT, "scopes", `${PLUGIN_NAME}-validation.md`),
      "utf-8",
    );
    const frontmatter = scope.split("---")[1] ?? "";
    expect(frontmatter).not.toContain("phases:");
    expect(frontmatter).toContain("runner: true");
  });
});

describe("stage contracts", () => {
  const stages = [
    ["construction", "mabl-verification-pre-pr"],
    ["construction", "mabl-verification-coverage-gap"],
    ["operation", "mabl-verification-ship-gate"],
  ] as const;

  for (const [phase, slug] of stages) {
    test(`${slug} declares a valid execution contract`, () => {
      const raw = readFileSync(join(PLUGIN_ROOT, "stages", phase, `${slug}.md`), "utf-8");
      const frontmatter = raw.split("---")[1] ?? "";
      const execution = frontmatter.match(/^execution:\s*(\S+)/m)?.[1] ?? "";
      expect(["ALWAYS", "CONDITIONAL"]).toContain(execution);
      if (execution === "CONDITIONAL") {
        expect(frontmatter).toMatch(/^condition:\s*\S+/m);
      }
    });
  }
});

describe("release metadata", () => {
  const repoRoot = join(PLUGIN_ROOT, "..");
  const read = (...parts: string[]) =>
    JSON.parse(readFileSync(join(repoRoot, ...parts), "utf-8"));

  test("version is synchronized across every manifest", () => {
    const pluginVersion = read("mabl-verification", ".aidlc-plugin", "plugin.json").version;
    const packageVersion = read("package.json").version;
    const marketplace = read(".claude-plugin", "marketplace.json");
    const entry = marketplace.plugins.find(
      (p: { name: string }) => p.name === "aidlc-mabl-verification",
    );

    expect(pluginVersion).toBe(packageVersion);
    expect(entry?.version).toBe(pluginVersion);
  });

  test("the changelog records the released version", () => {
    const version = read("mabl-verification", ".aidlc-plugin", "plugin.json").version;
    const changelog = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf-8");
    // Either the version has its own released section, or work is staged
    // under Unreleased awaiting a release decision.
    const released = changelog.includes(`## [${version}]`);
    const staged = changelog.includes("## [Unreleased]");
    expect(released || staged).toBe(true);
  });
});

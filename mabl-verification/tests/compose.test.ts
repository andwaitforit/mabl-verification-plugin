/**
 * Real composition tests: build the actual host projection, install it into a
 * scratch project, run the emitted compose hook, and inspect the compiled stage
 * graph and scope grid.
 *
 * This is the check that content validation cannot make. A stage with an invalid
 * execution contract passes a schema read but is dropped as degraded at compose
 * time, which is how this plugin previously shipped without a ship gate.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PLUGIN_NAME, PLUGIN_ROOT, aidlcWorkflowsRoot, loadPluginKit } from "./harness.ts";

const kit = await loadPluginKit();
const composePluginFixture = kit.composePluginFixture as (opts: {
  plugin: string;
  harness: string;
}) => { projectDir: string; dropLogs: string };

const workflowsRoot = aidlcWorkflowsRoot();
const staged = join(workflowsRoot, "plugins", PLUGIN_NAME);
const stagedByUs = !existsSync(staged);

beforeAll(() => {
  if (stagedByUs) cpSync(PLUGIN_ROOT, staged, { recursive: true });
});

afterAll(() => {
  if (stagedByUs) rmSync(staged, { recursive: true, force: true });
});

describe("composition", () => {
  let projectDir = "";
  let dropLogs = "";

  beforeAll(() => {
    const fixture = composePluginFixture({ plugin: PLUGIN_NAME, harness: "claude" });
    projectDir = fixture.projectDir;
    dropLogs = fixture.dropLogs;
  });

  interface StageNode {
    slug: string;
    execution: string;
    condition?: string;
    scopes?: string[];
  }

  // stage-graph.json is a flat array of stage nodes.
  const graph = (): StageNode[] =>
    JSON.parse(
      readFileSync(join(projectDir, ".claude", "tools", "data", "stage-graph.json"), "utf-8"),
    );
  const stage = (slug: string): StageNode | undefined =>
    graph().find((s) => s.slug === slug);
  const grid = () =>
    JSON.parse(
      readFileSync(join(projectDir, ".claude", "tools", "data", "scope-grid.json"), "utf-8"),
    );

  test("composes with no dropped surfaces", () => {
    expect(dropLogs).not.toContain("degraded");
    expect(dropLogs).not.toContain("is not owned by plugin");
  });

  test("all three plugin stages reach the compiled graph", () => {
    const slugs = graph().map((s) => s.slug);
    for (const slug of [
      "mabl-verification-pre-pr",
      "mabl-verification-coverage-gap",
      "mabl-verification-ship-gate",
    ]) {
      expect(slugs).toContain(slug);
    }
  });

  test("the ship gate survives composition with a real condition", () => {
    const node = stage("mabl-verification-ship-gate");
    expect(node).toBeDefined();
    expect(node?.execution).toBe("CONDITIONAL");
    expect(node?.condition ?? "").not.toBe("");
  });

  test("core stages join the plugin scope through adds.scopes", () => {
    const scope = grid()[`${PLUGIN_NAME}-validation`];
    expect(scope).toBeDefined();
    expect(scope.stages["code-generation"]).toBeDefined();
    expect(scope.stages["build-and-test"]).toBeDefined();
  });

  test("the plugin scope routes all three plugin stages", () => {
    const scope = grid()[`${PLUGIN_NAME}-validation`];
    for (const slug of [
      "mabl-verification-pre-pr",
      "mabl-verification-coverage-gap",
      "mabl-verification-ship-gate",
    ]) {
      expect(scope.stages[slug]).toBeDefined();
    }
  });
});

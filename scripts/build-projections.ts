#!/usr/bin/env bun
/**
 * Emits this plugin's host projections into dist/plugins/mabl-verification/<harness>.
 *
 * The packager lives in aidlc-workflows and discovers plugins under that repo's
 * plugins/ directory, so the plugin is staged there for the duration of the
 * build and removed afterwards. A pre-existing directory at the staging path is
 * left untouched and the build refuses, so a real checkout is never clobbered.
 *
 *   bun scripts/build-projections.ts [--check]
 *
 * --check builds into a temp dir and byte-compares against the committed
 * projections, failing on drift. That is the CI guard against a stale dist/.
 */

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { aidlcWorkflowsRoot } from "./aidlc-root.ts";

const PLUGIN_NAME = "mabl-verification";
const HARNESSES = ["claude", "codex", "copilot", "cursor", "kiro", "kiro-ide", "opencode"];

const REPO_ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));
const PLUGIN_SRC = join(REPO_ROOT, PLUGIN_NAME);
const DIST_ROOT = join(REPO_ROOT, "dist", "plugins", PLUGIN_NAME);

const check = process.argv.includes("--check");

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(root, full));
    }
  };
  walk(root);
  return out.sort();
}

function build(outRoot: string): void {
  const workflowsRoot = aidlcWorkflowsRoot();
  const staged = join(workflowsRoot, "plugins", PLUGIN_NAME);
  const preexisting = existsSync(staged);

  if (preexisting) {
    throw new Error(
      `refusing to stage: ${staged} already exists.\n` +
        `Remove it, or point AIDLC_WORKFLOWS_ROOT at a checkout without this plugin.`,
    );
  }

  cpSync(PLUGIN_SRC, staged, { recursive: true });
  try {
    for (const harness of HARNESSES) {
      const outDir = join(outRoot, harness);
      rmSync(outDir, { recursive: true, force: true });
      mkdirSync(outDir, { recursive: true });
      const result = spawnSync(
        "bun",
        [join("scripts", "package.ts"), "plugin", "build", PLUGIN_NAME, harness, outDir],
        { cwd: workflowsRoot, encoding: "utf-8", timeout: 120_000 },
      );
      if (result.status !== 0) {
        throw new Error(`projection failed for ${harness}:\n${result.stderr || result.stdout}`);
      }
      console.log(`  ${harness}: ${listFiles(outDir).length} files`);
    }
  } finally {
    rmSync(staged, { recursive: true, force: true });
  }
}

if (check) {
  const tmp = mkdtempSync(join(tmpdir(), "mabl-projection-"));
  console.log("building projections for comparison...");
  build(tmp);

  const drift: string[] = [];
  for (const harness of HARNESSES) {
    const fresh = join(tmp, harness);
    const committed = join(DIST_ROOT, harness);
    const freshFiles = listFiles(fresh);
    const committedFiles = listFiles(committed);

    for (const file of freshFiles) {
      if (!committedFiles.includes(file)) drift.push(`missing from dist: ${harness}/${file}`);
      else if (
        readFileSync(join(fresh, file)).compare(readFileSync(join(committed, file))) !== 0
      ) {
        drift.push(`differs: ${harness}/${file}`);
      }
    }
    for (const file of committedFiles) {
      if (!freshFiles.includes(file)) drift.push(`stale in dist: ${harness}/${file}`);
    }
  }
  rmSync(tmp, { recursive: true, force: true });

  if (drift.length > 0) {
    console.error(`\n${drift.length} projection drift(s):`);
    for (const d of drift.slice(0, 40)) console.error(`  ${d}`);
    if (drift.length > 40) console.error(`  ... and ${drift.length - 40} more`);
    console.error("\nRun: bun scripts/build-projections.ts");
    process.exit(1);
  }
  console.log("\nprojections match dist/");
} else {
  console.log(`building projections into ${relative(REPO_ROOT, DIST_ROOT)}/`);
  build(DIST_ROOT);
  console.log("\ndone");
}

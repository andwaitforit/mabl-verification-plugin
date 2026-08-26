#!/usr/bin/env bun
/**
 * Copies the pinned AIDLC distribution into .aidlc/ (gitignored).
 *
 * Fetches only dist/<harness> at the pinned commit via a blobless sparse
 * checkout — the distribution an author is meant to copy, not a framework
 * checkout used as a build dependency. Re-running with the stamp already
 * matching is a no-op; pass --force to refetch.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AIDLC_DIR, AIDLC_SHA, AIDLC_VERSION, INSTALL_DIR, STAMP, TOOLCHAIN_HARNESS } from "./aidlc-pin.ts";

const REMOTE = "https://github.com/awslabs/aidlc-workflows.git";
const SUBPATH = `dist/${TOOLCHAIN_HARNESS}`;
const force = process.argv.includes("--force");

function run(cmd: string, args: string[], cwd?: string): void {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf-8", stdio: "pipe" });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed:\n${r.stderr || r.stdout}`);
  }
}

if (!force && existsSync(STAMP) && readFileSync(STAMP, "utf-8").trim() === AIDLC_SHA) {
  console.log(`.aidlc/ already at ${AIDLC_VERSION} (${AIDLC_SHA.slice(0, 12)})`);
  process.exit(0);
}

const tmp = mkdtempSync(join(tmpdir(), "aidlc-sync-"));
try {
  console.log(`fetching ${SUBPATH} at ${AIDLC_VERSION} (${AIDLC_SHA.slice(0, 12)})...`);
  run("git", ["clone", "--filter=blob:none", "--no-checkout", "--sparse", REMOTE, tmp]);
  run("git", ["sparse-checkout", "set", SUBPATH], tmp);
  run("git", ["checkout", AIDLC_SHA], tmp);

  const src = join(tmp, SUBPATH);
  if (!existsSync(src)) throw new Error(`${SUBPATH} absent at ${AIDLC_SHA}`);

  rmSync(AIDLC_DIR, { recursive: true, force: true });
  mkdirSync(INSTALL_DIR, { recursive: true });
  cpSync(src, INSTALL_DIR, { recursive: true });
  writeFileSync(STAMP, `${AIDLC_SHA}\n`);
  console.log(`synced to .aidlc/${TOOLCHAIN_HARNESS}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

/**
 * Plugin-local test constants, plus access to the pinned AIDLC toolchain.
 */

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AIDLC_SHA, AIDLC_VERSION, requireSynced, tool } from "../../scripts/aidlc-pin.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

export const PLUGIN_ROOT = resolve(join(HERE, ".."));
export const PLUGIN_NAME = "mabl-verification";
export const ARTIFACT_PREFIX = "mabl-verification-";
export { AIDLC_SHA, AIDLC_VERSION, requireSynced, tool };

export interface ToolFinding {
  rule: string;
  file?: string;
  message: string;
  fix?: string;
}

export interface ToolReport {
  valid: boolean;
  errors: ToolFinding[];
  warnings: ToolFinding[];
  [key: string]: unknown;
}

/** Runs a shipped aidlc-plugin-* tool in --json mode and returns its parsed report. */
export function runTool(name: string, args: string[]): ToolReport {
  requireSynced();
  const proc = spawnSync("bun", [tool(name), ...args, "--json"], {
    encoding: "utf-8",
    timeout: 180_000,
  });
  const raw = (proc.stdout || "").trim();
  if (!raw) {
    throw new Error(`aidlc-plugin-${name} produced no JSON:\n${proc.stderr}`);
  }
  return JSON.parse(raw) as ToolReport;
}

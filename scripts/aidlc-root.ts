/**
 * Resolves a sibling aidlc-workflows checkout, which supplies the validator,
 * compose fixture, and packager.
 *
 * This plugin ships in its own repository, so `plugin-kit.ts` is not reachable
 * by relative path the way it is for in-tree plugins. Point AIDLC_WORKFLOWS_ROOT
 * at a checkout pinned to PINNED_SHA, or place one beside this repo.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PINNED_SHA = "572dda2863437d578b9d9bc2ea171a2e3955f91f";
export const PINNED_VERSION = "2.6.80";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT_SUBPATH = join("tests", "harness", "plugin-kit.ts");

function isWorkflowsRoot(dir: string): boolean {
  return existsSync(join(dir, KIT_SUBPATH));
}

export function aidlcWorkflowsRoot(): string {
  const tried: string[] = [];

  const fromEnv = process.env.AIDLC_WORKFLOWS_ROOT;
  if (fromEnv) {
    const dir = resolve(fromEnv);
    tried.push(dir);
    if (isWorkflowsRoot(dir)) return dir;
  }

  // Walk up from here, checking for a sibling checkout at each level.
  let cursor = HERE;
  while (true) {
    for (const name of ["aidlc-workflows", join("vendor", "aidlc-workflows")]) {
      const dir = join(cursor, name);
      tried.push(dir);
      if (isWorkflowsRoot(dir)) return dir;
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  throw new Error(
    [
      "Could not locate an aidlc-workflows checkout.",
      "",
      "Set AIDLC_WORKFLOWS_ROOT to a checkout containing tests/harness/plugin-kit.ts:",
      "",
      "  git clone https://github.com/awslabs/aidlc-workflows.git",
      `  git -C aidlc-workflows checkout ${PINNED_SHA}`,
      '  export AIDLC_WORKFLOWS_ROOT="$PWD/aidlc-workflows"',
      "",
      `Tried: ${tried.join(", ")}`,
    ].join("\n"),
  );
}

export function pluginKitPath(): string {
  return join(aidlcWorkflowsRoot(), KIT_SUBPATH);
}

/** Loads the harness kit. Callers destructure the validators they need. */
export async function loadPluginKit(): Promise<Record<string, unknown>> {
  return import(pluginKitPath());
}

/**
 * The pinned AIDLC distribution this plugin is authored and tested against.
 *
 * The framework ships an authoring toolchain (validate/build/test) inside its
 * distribution, so this repository needs a copied distribution rather than a
 * framework checkout. Bump these two together and re-run `bun run sync`.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const AIDLC_SHA = "3b5a1359fabef00de04ef05a58ed2835857a26cb";
export const AIDLC_VERSION = "2.6.105";

/** The harness whose shipped install supplies the toolchain and the test-tier install. */
export const TOOLCHAIN_HARNESS = "claude";

export const REPO_ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));

/** Gitignored working copy of the pinned distribution. */
export const AIDLC_DIR = join(REPO_ROOT, ".aidlc");
export const INSTALL_DIR = join(AIDLC_DIR, TOOLCHAIN_HARNESS);
export const TOOLS_DIR = join(INSTALL_DIR, ".claude", "tools");
export const STAMP = join(AIDLC_DIR, "PINNED_SHA");

export function tool(name: string): string {
  return join(TOOLS_DIR, `aidlc-plugin-${name}.ts`);
}

export function requireSynced(): void {
  if (existsSync(tool("validate"))) return;
  throw new Error(
    `pinned AIDLC distribution not found under ${AIDLC_DIR}.\n` +
      `Run: bun run sync`,
  );
}

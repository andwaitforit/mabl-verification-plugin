/**
 * mabl-verification-contract.ts
 *
 * The single machine-readable contract shared by every mabl-verification
 * producer (stage prose) and consumer (sensors, ship gate). Pin changes here,
 * not in individual tools — a divergence between producer and consumer is how a
 * real regression silently bypasses a BLOCK.
 *
 * Conventions:
 * - JSON summary keys are snake_case everywhere.
 * - Failure classes are exactly FAILURE_CLASSES; anything else fails closed.
 */

import { basename } from "node:path";

export const FAILURE_CLASSES = [
  "product",
  "stale-test",
  "env-data",
  "mabl-flake",
  "billable-skip",
] as const;

export type FailureClass = (typeof FAILURE_CLASSES)[number];

/** Classes that must stop a ship unless a human resolves them. */
export const UNRESOLVED_CLASSES: readonly FailureClass[] = ["product", "stale-test"];

/** Classes that may be treated as resolved when a rerun passed. */
export const RERUNNABLE_CLASSES: readonly FailureClass[] = ["env-data", "mabl-flake"];

export function isFailureClass(value: unknown): value is FailureClass {
  return typeof value === "string" && (FAILURE_CLASSES as readonly string[]).includes(value);
}

/** Artifacts this plugin owns, by sensor. Anything else is not this sensor's business. */
export const OWNED_ARTIFACTS = {
  "mabl-run-status": [
    "mabl-verification-run-results.md",
    "mabl-verification-local-run-log.md",
  ],
  "mabl-coverage-threshold": ["mabl-verification-coverage-report.md"],
} as const;

export function ownsArtifact(sensorId: keyof typeof OWNED_ARTIFACTS, filePath: string): boolean {
  return (OWNED_ARTIFACTS[sensorId] as readonly string[]).includes(basename(filePath));
}

export interface Flags {
  outputPath: string;
  stageSlug: string;
}

/**
 * The dispatcher passes `--output-path <exact file>` and `--stage <slug>`.
 * `--stage-slug` is accepted as an alias for direct invocation.
 */
export function parseFlags(argv: string[]): Flags {
  let outputPath = "";
  let stageSlug = "";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--output-path" && argv[i + 1]) outputPath = argv[++i];
    else if ((arg === "--stage" || arg === "--stage-slug") && argv[i + 1]) stageSlug = argv[++i];
  }
  return {
    outputPath: outputPath || process.env.AIDLC_OUTPUT_PATH || "",
    stageSlug: stageSlug || process.env.AIDLC_STAGE_SLUG || "",
  };
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

/** Extracts the last fenced json block. Malformed or absent input is an error, never an empty pass. */
export function extractJsonBlock<T>(content: string): ParseResult<T> {
  const blocks = content.match(/```json\s*\n([\s\S]*?)\n```/g);
  if (!blocks || blocks.length === 0) {
    return { ok: false, reason: "no fenced json summary block found" };
  }
  const raw = blocks[blocks.length - 1]
    .replace(/```json\s*\n/, "")
    .replace(/\n```$/, "");
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (err) {
    return { ok: false, reason: `malformed json summary: ${(err as Error).message}` };
  }
}

export function emit(result: Record<string, unknown>): never {
  console.log(JSON.stringify(result));
  process.exit(0);
}

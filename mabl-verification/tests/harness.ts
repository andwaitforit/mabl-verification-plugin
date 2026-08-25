/**
 * Plugin-local test constants, plus the shared aidlc-workflows resolver.
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export {
  PINNED_SHA,
  PINNED_VERSION,
  aidlcWorkflowsRoot,
  loadPluginKit,
  pluginKitPath,
} from "../../scripts/aidlc-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

export const PLUGIN_ROOT = resolve(join(HERE, ".."));
export const PLUGIN_NAME = "mabl-verification";
export const ARTIFACT_PREFIX = "mabl-verification-";

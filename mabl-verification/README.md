# mabl-verification — AIDLC testing plugin

A third-party AIDLC plugin, published and maintained by mabl: an end-to-end
mabl verification loop layered onto the
AI-DLC workflow. Maps code changes to mabl tests, runs them locally, root-causes
failures, identifies coverage gaps, and gates ship decisions against mabl's
release readiness scoring.

## 1. What it does

mabl-verification enriches an AI-DLC run so that every code change is verified
against the user-facing flows it touches via mabl's AI testing platform. It:

- **contributes** to the existing `build-and-test` stage with a quick mabl
  smoke-check after unit tests pass;
- **adds three new stages** — pre-PR verification (construction), coverage gap
  analysis (construction), and a ship gate (operation) that turns the verification
  signal into a SHIP/BLOCK/NEEDS_HUMAN recommendation;
- **ships two advisory sensors** that read the machine-readable JSON results and
  report run-status and coverage-threshold findings;
- **ships a doctor check** that verifies the mabl CLI, authentication, workspace,
  and composed plugin state; and
- **ships one agent** (`mabl-verification-quality-agent`) that leads all three stages,
  absorbing the methodology for test matching, failure RCA, triage routing,
  coverage analysis, and ship gating.

## 2. How to use it

### Prerequisites

- **Node.js 22 or higher** — the mabl CLI requires an actively supported LTS
  release. Check with `node -v`. Running the CLI under WSL is not supported.
- **mabl CLI**: `npm install -g @mablhq/mabl-cli`, then confirm with
  `mabl --version`.
- **mabl CLI authenticated**: `mabl auth login --auto`, then confirm with
  `mabl auth info`.
- **mabl cloud MCP server** connected to your harness — see
  [MCP server setup](#mcp-server-setup). Provides `search_mabl_tests`,
  `analyze_mabl_failure`, `check_release_readiness`, and the rest of the tools
  the stages call.
- **bun** on PATH (required by all AIDLC plugins for hooks and tools).
- **A running local dev server** for test execution.
- **At least one mabl test** in the workspace covering the application.

### Installation

The published projections live in this repository under
`dist/plugins/mabl-verification/<harness>/`. Building from source is only needed
when developing the plugin — see the [repository README](../README.md).

**Claude Code** (host store):
```bash
/plugin marketplace add andwaitforit/mabl-verification-plugin
/plugin install aidlc-mabl-verification@mabl-plugins
```

**Codex CLI** (host store, in a git repo):
```bash
codex plugin marketplace add andwaitforit/mabl-verification-plugin
codex plugin add aidlc-mabl-verification@mabl-plugins
```

**Kiro IDE / Kiro CLI** (no store — folder-drop, then compose explicitly):
```bash
git clone https://github.com/andwaitforit/mabl-verification-plugin.git
cp -r mabl-verification-plugin/dist/plugins/mabl-verification/kiro-ide/. <project>/
AIDLC_PLUGIN_ROOT="$PWD/mabl-verification-plugin/dist/plugins/mabl-verification/kiro-ide" \
  AIDLC_PROJECT_DIR="<project>" AIDLC_HARNESS_DIR=.kiro \
  bun <project>/hooks/compose.ts
```

For the store-based harnesses a bundled SessionStart hook composes the plugin
automatically; no prose or skill file needs editing.

Then verify:
```bash
/aidlc --doctor    # expect a "Plugin check (mabl-verification)" section with 0 failures
/aidlc --scope enterprise   # the mabl-verification stages route under enterprise/feature/mvp/classic
```

### Scope gating

The three plugin stages activate under `enterprise`, `feature`, `mvp`, `classic`,
and the plugin's own `mabl-verification-validation` scope. A `poc` or `bugfix`
run won't reach them unless explicitly scoped.

## 3. Existing stages it modifies (the contribution seam)

| Core stage | What mabl-verification adds |
|---|---|
| `build-and-test` (construction) | Produces `mabl-verification-local-run-log`; binds `mabl-run-status` sensor; adds required section "mabl Verification"; splices Step 10a (quick smoke-check: match one test + run locally + record result). |

## 4. New stages it creates

| Stage | Phase | # | Activation | Produces |
|---|---|---|---|---|
| `mabl-verification-pre-pr` | construction | 3.90 | After build-and-test when mabl is configured | `mabl-verification-impact`, `mabl-verification-run-results` |
| `mabl-verification-coverage-gap` | construction | 3.95 | CONDITIONAL — when pre-pr reports zero-match or partial coverage | `mabl-verification-coverage-report` |
| `mabl-verification-ship-gate` | operation | 4.50 | EXECUTE under declared scopes | `mabl-verification-ship-verdict` |

All three are led by `mabl-verification-quality-agent`, mode: inline.

## 5. Design & implementation

### Layout

```
plugins/mabl-verification/
  .aidlc-plugin/plugin.json              # manifest
  stages/construction/                   # 2 new construction stages
    mabl-verification-pre-pr.md
    mabl-verification-coverage-gap.md
  stages/operation/                      # 1 new operation stage
    mabl-verification-ship-gate.md
  contributions/construction/            # 1 stage modification
    build-and-test.md
  agents/                                # 1 agent persona
    mabl-verification-quality-agent.md
  scopes/                                # 1 plugin scope
    mabl-verification-validation.md
  knowledge/mabl-verification-quality-agent/     # 4 methodology knowledge files
    local-run-patterns.md
    authoring-best-practices.md
    failure-rca-methodology.md
    triage-routing.md
  sensors/                               # 2 advisory sensor manifests
    aidlc-mabl-run-status.md
    aidlc-mabl-coverage-threshold.md
  tools/                                 # 2 sensor scripts + 1 doctor check
    aidlc-sensor-mabl-run-status.ts
    aidlc-sensor-mabl-coverage-threshold.ts
    mabl-verification-doctor.ts
  tests/                                 # content validation
    plugin.test.ts
  README.md
```

### The verification loop

The plugin implements a 6-question verification loop:

| # | Question | Answered by |
|---|----------|-------------|
| Q1 | Which tests are affected by this change? | `mabl-verification-pre-pr` (Steps 3–6) |
| Q2 | Do they pass? | `mabl-verification-pre-pr` (Steps 7–8) |
| Q3 | Why did it fail? | Agent knowledge: `failure-rca-methodology.md` |
| Q4 | What should we do next? | Agent knowledge: `triage-routing.md` |
| Q5 | Is there a coverage gap? | `mabl-verification-coverage-gap` |
| Q6 | Is it safe to ship? | `mabl-verification-ship-gate` |

### Sensors (advisory)

- **mabl-run-status** — reads `mabl-verification-run-results.md` or
  `mabl-verification-local-run-log.md`, reports pass/fail counts and unresolved
  failures. Bound to `build-and-test` (contribution) and `mabl-verification-pre-pr`.
- **mabl-coverage-threshold** — reads `mabl-verification-coverage-report.md`,
  reports critical/normal gap counts and ship-blocker status. Bound to
  `mabl-verification-coverage-gap`.

Severity is chosen per sensor. `mabl-run-status` is **blocking**: an unresolved
`product` or `stale-test` failure refuses the stage's approval gate, and a human
may proceed only through the framework's documented override ("Override blocking
sensors", which requires a human-backed answer receipt and is refused in
autonomous mode). `mabl-coverage-threshold` is **advisory** by deliberate choice —
a coverage gap is a judgement about what deserves a test, not a proven
regression — and the ship gate factors its `ship_blocker` signal into the BLOCK
recommendation.

Both sensors fail closed: for an artifact this plugin owns, a missing file, an
absent or malformed JSON summary, or an unrecognized failure class reports
`pass: false`, never a zero-result pass.

### Machine-readable contract

Each stage emits a JSON summary block at the end of its Markdown artifact that the
sensors read. Artifacts land under the engine-resolved record dir for the stage.

### Team knowledge (user-managed)

Project-specific configuration (workspace IDs, application IDs, credential
mappings, environment URLs) belongs in team knowledge at:
```
aidlc/spaces/<active-space>/knowledge/mabl-verification-quality-agent/workspace-constants.md
```

This file is NOT shipped by the plugin — teams create it during onboarding.

## 6. Testing this plugin

```bash
bun test plugins/mabl-verification/tests/plugin.test.ts
```

Validates: manifest, stage frontmatter (slug/filename match, plugin ownership, valid
agents, phase, number, artifact namespacing), contributions (target core stages,
namespaced artifacts, fragments), sensors (naming convention, tool references),
agents/scopes (naming, frontmatter), knowledge (exists, non-empty), and tools
(parseable).

## 7. Configuration

### MCP server setup

The plugin's stages call mabl through the **mabl cloud MCP server** — a hosted
HTTP endpoint at `https://mcp.mabl.com/mcp`. There is no local stdio package to
install.

Two authentication methods:

- **OAuth** — connects to your mabl user account and can reach any workspace that
  user belongs to. Start here if unsure; you will re-authenticate periodically.
- **API key** — scoped to the single workspace the key was generated in, and
  persists until the key expires. Better for agent-to-agent and CI use.

**Claude Code** (registers for the current project; add `--scope user` for all
projects):

```bash
claude mcp add --transport http mabl https://mcp.mabl.com/mcp
claude mcp list          # confirm
```

With an API key instead of OAuth:

```bash
claude mcp add --transport http mabl https://mcp.mabl.com/mcp \
  --header "x-api-key: $MABL_API_KEY"
```

**Clients using JSON config** (Kiro `.kiro/settings/mcp.json`, Claude Code
project config `.mcp.json`, and equivalents):

```json
{
  "mcpServers": {
    "mabl": {
      "url": "https://mcp.mabl.com/mcp",
      "type": "http"
    }
  }
}
```

Add a `headers` object for API-key auth:

```json
{
  "mcpServers": {
    "mabl": {
      "url": "https://mcp.mabl.com/mcp",
      "type": "http",
      "headers": { "x-api-key": "${MABL_API_KEY}" }
    }
  }
}
```

Reference the key from an environment variable, as above, whenever the config
file is committed or shared. Never paste a key into a tracked file.

**Client differences:**

| Client | Difference |
|---|---|
| Cursor, Windsurf | use `"type": "streamable-http"` |
| Legacy dual-endpoint clients | use `"type": "sse"` with `https://mcp.mabl.com/sse` |
| Gemini CLI | `gemini extensions install https://github.com/mablhq/mabl-mcp-server` |
| Claude Desktop | add as a custom connector: Settings → Connectors → Add custom connector |

After adding the server, complete the browser consent flow. If your client does
not prompt, ask it to "Help me authenticate the mabl MCP".

Authoritative source: [Set up the cloud MCP
server](https://help.mabl.com/hc/en-us/articles/47299404357780-Set-up-the-cloud-MCP-server).
Follow that article if it diverges from this summary.

### Workspace ID

Set once so future runs are zero-prompt:
```bash
mabl config set workspace-id <your-workspace-id>
```

Or provide in team knowledge at
`aidlc/spaces/<space>/knowledge/mabl-verification-quality-agent/workspace-constants.md`.

## See also

- [Plugin Mechanism](../../docs/reference/18-plugin-mechanism.md) — the normative design
- [Authoring a Plugin](../../docs/harness-engineering/10-authoring-a-plugin.md) — the author guide
- [test-pro plugin](../test-pro/) — the reference fixture this plugin is modeled after
- [mabl documentation](https://help.mabl.com/) — mabl platform docs
- [mabl CLI reference](https://help.mabl.com/docs/mabl-cli) — CLI commands

---
slug: mabl-verification-ship-gate
number: 4.50
name: mabl Ship Gate
plugin: mabl-verification
phase: operation
execution: CONDITIONAL
condition: Execute when mabl-verification-pre-pr is on this scope's resolved plan and produced run results, to gate the ship decision on mabl release readiness.
lead_agent: mabl-verification-quality-agent
support_agents: []
mode: inline
produces:
  - mabl-verification-ship-verdict
consumes:
  - artifact: mabl-verification-run-results
    required: true
  - artifact: mabl-verification-coverage-report
    required: false
requires_stage:
  - mabl-verification-pre-pr
sensors:
  - mabl-run-status
scopes:
  - enterprise
  - feature
  - mvp
  - mabl-verification-validation
  - classic
inputs: Run results from mabl-verification-pre-pr, coverage report from mabl-verification-coverage-gap (if produced), and mabl's release readiness scoring via MCP
outputs: mabl-verification-ship-verdict.md (under this stage's record dir, engine-resolved)
---

# mabl Ship Gate

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

The verification loop's decision gate. Everything upstream produced a quality signal;
this stage turns that signal into a **recommendation** the human acts on. It answers
**Q6 — is the change safe to ship?**

This stage does NOT open, merge, or mark a PR ready — it recommends only. The
PR/merge/deploy decision belongs to the human.

The flow: **collect run signal → analyze unanalyzed failures → check release readiness →
apply ship policy → emit verdict.**

---

## Steps

### Step 1: Load Agent Persona

Load mabl-verification-quality-agent persona from `agents/mabl-verification-quality-agent.md` and knowledge from `{{HARNESS_DIR}}/knowledge/mabl-verification-quality-agent/`.

## Input contract

This stage accepts two kinds of input.

**Upstream artifacts** (the normal path) — produced by earlier stages on the
resolved plan:

| Artifact | Producer | Required |
|---|---|---|
| `mabl-verification-run-results` | `mabl-verification-pre-pr` | yes |
| `mabl-verification-coverage-report` | `mabl-verification-coverage-gap` | no |

**mabl entity identifiers** (the standalone path) — supplied by the user when
this stage is invoked without an upstream run. Every mabl id carries a suffix
naming its entity kind; match on the suffix rather than asking the user which
kind they pasted:

| Kind | Suffix | Resolve with |
|---|---|---|
| Test run | `-jr` | `get_mabl_test_run(testRunId)` |
| Plan run | `-pr` | `get_mabl_plan_run(planRunId)` |
| Test | `-j` | `list_mabl_test_runs(testId, workspaceId)` |
| Plan | `-p` | `get_mabl_plan(planId)` |
| Deployment event | `-v` | `get_mabl_deployment(deploymentId)` |

An identifier whose suffix is not in this table is not a mabl entity id — ask
rather than guessing. The MCP parameter names above are mabl's own API spelling
and stay camelCase; keys in artifacts this plugin writes are snake_case.

### Step 2: Collect the Run Signal

Assemble the quality evidence from upstream stages:

1. **Run results** — read `mabl-verification-run-results` from `mabl-verification-pre-pr`.
   Extract per-test: pass/fail, failing step, `class` (one of `product`,
   `stale-test`, `env-data`, `mabl-flake`, `billable-skip` — see the input
   contract below), `confidence`, and `test_run_id`.

2. **Coverage report** — read `mabl-verification-coverage-report` from
   `mabl-verification-coverage-gap` (if the stage ran). Extract: gap count, severity
   distribution, ship-blocker flag.

3. **Direct references** — when this stage runs standalone, or the user names a
   specific mabl entity, resolve the signal via MCP using the identifier kinds in
   the input contract below:
   - a **test run id** → `get_mabl_test_run(testRunId)` for status + failure summary
   - a **plan run id** → `get_mabl_plan_run(planRunId)` for all test statuses

### Step 3: Analyze Unanalyzed Failures

For **each failed run** in the signal that has not already been analyzed by the
pre-pr stage's triage (Step 9), call `analyze_mabl_failure(runId, 'test', workspaceId)`
to ensure a saved failure analysis exists.

**Why this matters:** `check_release_readiness` reasons over saved analyses. A failed
run with no analysis is scored "unknown root cause" and drags the readiness score
down for no real reason. Billable-skip reds do not need deep analysis, but a saved
record keeps them from scoring as "unknown."

Skip runs already analyzed by the pre-pr stage this session.

### Step 4: Check Release Readiness

Call `check_release_readiness` (MCP) with the entity IDs from the run signal:
- **Test ids** from the matched set
- **Plan id** if a plan was triggered
- **Deployment event id** if this is post-deploy

Capture:
- The readiness **recommendation** (pass / at_risk / blocked)
- The readiness **score** (0–100)
- Per-entity pass/fail summaries
- Failure breakdown (application defects vs test implementation issues)
- Prioritized remediation suggestions

If the score looks worse than the triaged reality (e.g. dragged down by unanalyzed
runs per Step 3), note that discrepancy — do not blindly surface a low score when the
triage already explained the failures as non-code.

### Step 5: Apply Ship Policy

Decide **`SHIP` | `BLOCK` | `NEEDS_HUMAN`** from explicit, auditable rules:

#### SHIP
Every affected test passed, **OR** the only reds are confirmed non-code:
- Billable-AI skips in local CLI runs (GenAI/visual assertions disabled)
- Pre-existing failures already red on `main` (not introduced by this change)
- Environment/flake that healed on rerun (per triage routing)

**AND** no new uncovered critical flow (from coverage report, if present).

#### BLOCK
- Any confirmed **product regression** (failure classified as `product` with
  confidence ≥ 0.6)
- A **critical-flow coverage gap** with `has_test == false` (from coverage report)
- Release readiness scored `blocked` by mabl

#### NEEDS_HUMAN
- Readiness is mixed (score 50–75, `at_risk`)
- Confidence on any triage is below 0.6
- A proposed remedy touches product code (product-code fixes are always human-gated)
- The only path to SHIP requires spending mabl credits (billable AI reruns)

**Policy profiles:**
- `standard` (default) — rules above as written
- `strict` — downgrade any SHIP that relied on an un-rerun flake to NEEDS_HUMAN;
  any `coverage.gap_found == true` at `normal` severity also downgrades to NEEDS_HUMAN

Ship/merge itself is always a human action, so a clean SHIP still surfaces
"open PR" under `requiresHumanAction`.

### Step 6: Produce Ship Verdict

Write **`mabl-verification-ship-verdict.md`** to this stage's record dir:

1. **Decision** — SHIP / BLOCK / NEEDS_HUMAN
2. **One-line why** — the single most important reason
3. **Blockers** — each confirmed blocker with its evidence trail
4. **Release readiness** — mabl's score + recommendation
5. **Run links** — mabl app URLs for every run in the signal
6. **Required human actions** — what the person needs to do next (open PR, fix code,
   re-run with billable features, etc.)

Include a machine-readable JSON summary:

```json
{
  "decision": "SHIP",
  "reason": "All 3 matched tests passed; no critical coverage gaps",
  "score": 92,
  "readiness": "pass",
  "blockers": [],
  "requires_human_action": ["open_pr"],
  "policy": "standard",
  "tests_passed": 3,
  "tests_failed": 0,
  "billable_skipped": 0,
  "coverage_gap_critical": 0,
  "run_links": [
    "https://app.mabl.com/workspaces/.../test-runs/..."
  ]
}
```

### Step 7: Open the Approval Gate

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage mabl-verification-ship-gate --result awaiting-approval`.

### Step 8: Present Completion & Request Approval

Completion emoji: :ship: (SHIP), :no_entry: (BLOCK), or :raising_hand: (NEEDS_HUMAN)
Review path: this stage's engine-resolved record dir.
Standard 2-option approval (Approve / Request Changes).
STOP for the human response. Report Approve with
`--result approved --user-input "<exact choice>"`; report
Request Changes with `--result rejected --user-input "<feedback>"`, revise the
artifacts, then report `--result revised` before re-presenting.

---

## Sensors

This stage binds the `mabl-run-status` sensor which reads the JSON summary and
confirms all failures are either resolved or acknowledged before the verdict.

---

## Learn

While running this stage, maintain a running log in
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under: Interpretations, Deviations, Tradeoffs, Open questions —
each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.

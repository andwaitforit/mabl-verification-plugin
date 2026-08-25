---
name: mabl-verification-validation
plugin: mabl-verification
depth: Standard
keywords:
  - mabl
  - mabl verification
  - test verification
description: Run the mabl verification loop (pre-PR matching, coverage gap, ship gate)
skeleton: off
runner: true
---

# mabl Verification Validation Scope

A lightweight scope designed for two use cases:

1. **Plugin validation** — verifying the mabl-verification plugin itself works
   correctly after installation or upgrade. Exercises all three plugin stages
   against a real codebase with real mabl tests.

2. **mabl-centric workflows** — when the primary goal is test verification (not
   full feature ideation/design). Skips Ideation and Inception entirely, runs a
   minimal Construction (implement + build + mabl verify), and gates ship.

## When to use

- After installing/upgrading the mabl-verification plugin: `/aidlc --scope mabl-verification-validation`
- For hotfixes or small changes where the only validation needed is "do the mabl tests still pass?"
- When testing the plugin's integration with a new mabl workspace

## Stage flow

```
code-generation → build-and-test → mabl-verification-pre-pr
  → mabl-verification-coverage-gap (conditional)
  → mabl-verification-ship-gate (conditional)
```

Membership is declared by the stages themselves: the three plugin stages name
this scope in their `scopes:` frontmatter, and the core `code-generation` and
`build-and-test` stages join it through this plugin's contribution overlays
(`adds.scopes`). Initialization stages are supplied by the host scope grid.

## Prerequisites

- mabl CLI installed and authenticated
- mabl MCP server connected
- At least one mabl test in the workspace covering the application under development
- A running local dev server for test execution

---
target: code-generation
plugin: mabl-verification
adds:
  scopes:
    - mabl-verification-validation
---

The mabl verification loop needs the implementation stage on its resolved plan so
that `mabl-verification-pre-pr` has a diff to match tests against. This
contribution adds no produced artifacts, sensors, or fragments — it exists only
to place the core `code-generation` stage under the plugin's scope.

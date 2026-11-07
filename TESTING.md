# Verification catalogue

The public suite uses Node's built-in test runner and generic fixtures. Run **npm test** from this directory. No installation or live OCI access is required.

## Automated coverage

| Area | Cases covered |
| --- | --- |
| Capacity and sizing | Local formula, per-node placement, asymmetric reservations, ACD/VM limits, buffers, legacy/current memory, new versus existing CPU minima, high-RAM database CPU proposals and stale-sizing guards |
| Database topology | Duplicate IDs/names, reserved versus named slots, independent switchover conflicts, reciprocal peers, two standbys, confirmed settings versus workload demand, clone identity and missing inputs |
| Alternatives | Full restore, metadata/provenance, exact-ID priority, labelled legacy name matching, growth, migration overlap, retained unknowns and invalidated hardware |
| Spreadsheet input | CSV quoting/units/unknowns/duplicates, worksheet normalization, stored and compressed XLSX, sparse/shared/inline cells, formula-cache warnings, encrypted/malformed/oversized archives and bounded text expansion |
| Conventional VMC | Per-server contributions, explicit adoption, update/remove without double counting, unknowns, ledger tampering and manual-Other conflicts |
| Assessment/report | Hard errors versus warnings/open checks, node-specific deficits, rule differences, retained metadata, escaped entered text and script-free reports |
| Recovery | Explicit writes, invalid/stale draft envelopes, size/quota failure and safe clear |

The release also runs a local DOM/event harness for startup, inputs, keyboard activation, import races, stale preview prevention, Undo/Redo, saved-option restore, old-file compatibility, opt-in recovery, cross-tab draft changes and UTF-8 JSON-size limits. That harness is not a browser renderer and contains private historical compatibility fixtures; it is not distributed in this repository.

## Browser checks for 2.0

- Imported a generic .xlsx with two worksheets and a non-first header row; mapped and previewed three database records across two machines before applying.
- Linked primary and standby ACDs, explicitly copied database totals, and sized DC/DR independently. An unsized machine kept the whole plan incomplete.
- Captured an initial plan and a growth option; comparison retained missing/unselected capacity as unchecked.
- Enabled device recovery, refreshed, restored the plan and retained its machines/options.
- Entered a conventional footprint of 300 GB / 40 ECPU / 100 GB per VM across two nodes; remaining local capacity was 3,886 GB on the empty Standard preset.
- Inspected desktop and 390-pixel mobile forms/review. Wide tables scroll inside their containers; no page-level horizontal overflow was observed.
- Opened the generated standalone report and inspected executive layout, database hierarchy and technical content. No scripts or external assets are embedded. Native paginated PDF output is not a separate release assertion.

## Release gate

1. Run the public suite and local event harness. Record failures and repair material defects before publishing.
2. Review UI paths and a representative export using only generic test data.
3. Keep customer files and internal evidence outside this repository.
4. Keep model/package version, asset query versions and changelog aligned.
5. Push the approved release, verify the remote commit and Pages build, then compare changed live assets to local tested content.

The five-minute first-use target in PRODUCT_GOALS.md still needs an independent user trial. Passing these checks does not certify Oracle provisioning, workload performance or DR recovery.

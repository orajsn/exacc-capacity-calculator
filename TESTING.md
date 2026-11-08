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

## 2.1 library verification

- Pure store tests cover identity, UTF-8 limits, metadata-only reads, atomic revisions, quota/conflict preservation, archive/restore and deterministic legacy migration.
- Event tests cover independent plans, filtering, save/open/copy, unsaved-work choices, cross-tab conflicts, migration failures/newer legacy drafts and owner/ID preservation in exports.
- Async regressions pin replacement to the selected Plan ID, keep Cancel effective while Save finishes, and keep automatic saving off if the user disables it during an in-flight save.
- Native browser checks migrate a genuine 2.0 recovery draft, save two customers with different owners/IDs, find a plan by ID, protect a newer save from a second tab, and archive/restore a plan.
- No calculation or hardware rules changed in this release. Saved JSON remains the recovery route when browser storage is unavailable or full.

## 2.2 clarity and navigation verification

- Sizing-source tests cover manual restoration, inventory preview/apply, stale receipts, changed active machines, quantitative versus metadata edits, legacy signatures, known-hardware invariants and incomplete values.
- Live-capacity tests cover whole-machine/per-server arithmetic, positive totals with a node shortage, disabled/unselected resources, previews and shared-storage overcapacity without a false fit.
- Typed findings tests cover stable identities, reordered/removed machines and databases, ambiguous fallback, exact missing RAM/peer-side fields, optional checks versus missing values, and unsafe target strings.
- Entry tests cover blank quick checks, generic production/DR examples, unsaved-work guards and no automatic example persistence.
- Browser checks exercise the example, per-node view, database RAM edit and explicit totals review, exact missing-field navigation, manual assumption restoration, quick check with compute off/on and narrow-screen live metrics. Source changes retain the open editor and keyboard focus.
- Independent first-time presales users have not yet performed the five-minute usability trial. Automated and browser checks are not a substitute for that trial.

## 2.2.1 bug-audit regressions

- Identical CSV replacement retains the per-ACD CPU floor: the generic 400/1-ECPU, two-node case stays at 208 ECPUs per VM rather than falling to 201. With 555 Other ECPUs per node, it remains over the checked CPU capacity.
- Corrupt/missing applied breakdowns require reapplication; both inventory and independent manual source paths are covered. Growth/migration preserve applied snapshots and missing-workload flags.
- Deterministic delayed-operation cases cover a focus check racing an own save, stale metadata reads, edits/new plans arriving during archive, and restoration of retained unsaved edits. Real cross-tab conflicts remain protected.
- Input-event cases cover names/assumptions before blur, autosaving while focused, and metadata refresh across new plans and same-ID revisions.
- Native browser verification exercises the identical-inventory re-import and focused-note persistence. Delayed archive/revision races use a controlled atomic backend to reproduce the timing reliably.

## 2.2.2 focused reliability pass

- Workbook regressions exercise numeric scientific notation through the workbook reader and inventory preview, with literal text preserved and normal workload validation retained.
- Native browser QA on an isolated local origin verified example editing, device autosave, reload and reopening with the edited AVMC name retained. A narrow-screen check found no page-level horizontal overflow or console errors.
- The Excel fix is checked with generated workbook fixtures through the import pipeline; this pass does not claim a native file-picker test or an independent first-user usability study.

## 2.2.3 responsive layout

- Browser checks at requested 320×700, 390×844, 768×900 and 844×390 viewport sizes found no page-level horizontal overflow. Wide result tables scroll inside their own containers.
- Expanded AVMC inputs use 16px text and at least 44px height on phones. Bottom-of-page checks verified navigation remains reachable above the measured fixed bar.
- In short landscape views, the capacity bar uses normal document flow instead of covering the editor. Browser console reported no errors.
- Viewport emulation verifies layout; this is not a physical iOS/Android device or on-screen-keyboard compatibility certification.

## 2.3.0 appearance and compact phone controls

- Theme-controller tests cover System/Light/Dark, early application before CSS, blocked storage, operating-system changes and cross-tab preference updates. Appearance and dock controls do not change sizing plans or mark them unsaved.
- Palette tests require at least 4.5:1 for checked normal/muted/link/placeholder text on supported surfaces, primary-button text and status combinations, and 3:1 for keyboard focus against control surfaces. This is a scoped contrast check, not a claim of full WCAG certification.
- Mobile balances and status remain visible with extra controls collapsed. More/Less uses an accessible expanded state; existing short-screen flow and measured bottom clearance remain in place.
- Screen-only dark tokens preserve light print styles. Review caught and fixed the disabled-primary-button hover cascade so muted text retains its dark neutral background.

## 2.4.0 typography and task hierarchy

- Existing calculation, import, save and theme tests remain unchanged and pass. The font is self-hosted, and its checksum matches the pinned official asset; its OFL license is included.
- Browser checks at 320, 390, 768 and 1280px found no page-level horizontal overflow in the checked views. Light desktop and tablet, dark mobile, optional controls and compact capacity feedback were inspected.
- The browser reported loaded fonts and Geist Sans as the selected body family. This does not certify the rendered font of every glyph; system fallbacks remain available.
- This pass checks responsive layout in a desktop browser. Physical-device keyboard behavior, independently timed usability and browser print pagination remain unverified.

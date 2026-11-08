# Product goals

Goal: help presales build a defensible ExaC@C plan showing what fits, why, what limits growth and what still needs checking.

Execution started 7 November 2026. This roadmap covers a browser-only, generic planning product. Customer scenarios remain in the user's browser or downloaded files. A calculated fit is not an Oracle deployment approval, performance guarantee or commercial quote.

| Goal | Acceptance criteria | Status |
| --- | --- | --- |
| G1. Trust the answer | Versioned, sourced rules; explicit hard limits, buffer warnings and unchecked areas; regression cases for per-node constraints, legacy memory and sizing boundaries. | Implemented in 2.0 |
| G2. Represent the customer | Named site/machine/AVMC/ACD/ADB mapping; reserved versus populated ACD slots; linked primary/standby groups; missing/duplicate/mismatched data reported. | Implemented in 2.0 |
| G3. Compare meaningful plans | Full named alternatives with restore and comparison; growth and migration overlap proposals; resource bottlenecks and qualifications shown. | Implemented in 2.0 |
| G4. Bring data in safely | XLSX/CSV mapping and preview before applying; explicit ECPU/GB/TB units; missing values retained; old JSON resumes; no external data transfer. | Implemented in 2.0 |
| G5. Make everyday work dependable | Guided and advanced paths; multiple undo/redo; optional local device draft recovery; clear save state; keyboard and responsive review. | Implemented in 2.0 |
| G6. Share the reasoning | Downloadable executive and technical report covering all machines, topology, assumptions, sources, version and open checks; printable locally. | Implemented in 2.0 |
| G7. State coverage honestly | Visible supported/partial/not-checked matrix; conventional VMC treated separately with verified rules or explicitly entered console allocations; no reuse of the Autonomous formula. | Implemented in 2.0 |
| G8. Maintain a product | Documented test catalogue, repeatable checks, backward-compatible scenario handling, changelog and verified GitHub Pages publication. | Included in 2.0 release workflow |

## Scope and release gates

- Keep default inputs short. Detailed database inventory, conventional VMCs, assumptions and reports are optional sections.
- Recommendations rank capacity fit, not prices. CPU units, physical capacity, reservations and workload demand must not be silently interchanged.
- Automatic multi-year growth is an entered planning assumption. It does not predict performance or substitute for workload validation.
- Failure, storage-cell, backup and network sizing need their own validated evidence and inputs. Until implemented, label them not checked. A generic spare-CPU percentage is not an N-1 guarantee.
- Standard XLSX and CSV are supported through worksheet/header/column mapping. Arbitrary workbook interpretation, legacy/encrypted/macro formats, live OCI access, pricing, licensing and deployment automation are not part of this release.
- A conventional VMC console-footprint mode can be released independently of a full filesystem reservation estimator, with that distinction visible.
- Before release: pass calculation/model and UI-event tests, inspect desktop/tablet/mobile flows, verify export/resume and privacy boundaries, then verify the deployed commit/assets.

## Usability target

A first-time presales user should be able to build a basic scenario in five minutes, identify the limiting resource, and save or share it without assistance. This is a target to test with users, not a measured claim.

## Execution evidence

See TESTING.md for the test catalogue and browser scenarios, CHANGELOG.md for delivered behavior and README.md for usage/coverage. Independent review identified stale worksheet previews and incorrect name-based machine matching; both were repaired and covered by regression tests before release. Open Oracle documentation conflicts remain recorded even when the implemented planning path is complete.

The 2.0 baseline delivers the scoped goals above. Further coverage needs its own validated model: storage cells/backups, node/site-failure capacity, conventional filesystem reservations and additional hardware generations. The five-minute usability trial and customer workload validation remain future evidence, not claimed results.

## 2.1 — local customer plan library

Requested and executed 7 November 2026. The goal is organization and dependable local saving, using the current static hosting.

| Goal | Acceptance criteria | Delivery |
| --- | --- | --- |
| G9. Separate customers and projects | Customer-grouped plan cards; optional owner alias; stable Plan ID; search includes sites/machines; one project's inputs do not replace another's saved copy. | Implemented in 2.1 |
| G10. Keep work safe while switching | Revision-checked saves, unsaved-work choices, reversible archive, safe copy/replace actions and cancellation that prevents a later switch. | Implemented in 2.1 |
| G11. Preserve identity and old work | Metadata in JSON/reports; older files receive IDs; previous recovery draft migrates only after a verified save; failed migration retains its source. | Implemented in 2.1 |
| G12. Use local resources efficiently | No added server; metadata-only listing, on-demand payload loading, delayed writes, no rewrite on unchanged open, bounded storage and actionable quota errors. | Implemented in 2.1 |

Cross-device retrieval requires a separate shared-storage/access design. Owner aliases and Plan IDs in this release are organizational labels, not authentication. Future shared access must be explicit; no customer data is published by the library.

## 2.2 — presales clarity and everyday polish

Requested and executed 8 November 2026. This pass implements the four highest-priority improvements from the UI review.

| Goal | Acceptance criteria | Delivery |
| --- | --- | --- |
| G13. Make starting and saving clear | Saved plans / Download backup / Open plan file labels; quick check, customer plan and illustrative example entry points; unsaved work protected. | Implemented in 2.2 |
| G14. Make sizing provenance explicit | Manual versus inventory source, applied/current totals and missing data preview, explicit Apply, preserved manual assumptions and stale-data guards. | Implemented in 2.2 |
| G15. Show the effect while editing | Live local/CPU/memory balances; per-node or whole-machine view; clear disabled/unknown/preview states and node shortage warnings. | Implemented in 2.2 |
| G16. Turn findings into actions | Stable-ID navigation to the correct editor/field; safe fallback after deletion; missing inputs separated from not-selected/external checks. | Implemented in 2.2 |

The broader suggestions—multi-option decision tables, large-inventory workbench and incoming-file diff review—remain future scope. The five-minute first-use target has not been tested with independent presales users.

## 2.2.2 — focused reliability pass

| Goal | Acceptance criteria | Delivery |
| --- | --- | --- |
| G17. Accept valid stored Excel numbers | Numeric worksheet values in scientific notation reach the import preview without changing literal text or bypassing workload limits. | Implemented in 2.2.2 |
| G18. Recheck everyday plan use | Generic example editing, device save, reload/reopen and narrow-screen layout verified; findings distinguished from untested cases. | Verified in this pass |

No new hardware formulas, customer data, dependencies or shared storage service are introduced by this patch. See TESTING.md for evidence and limits.

## 2.4 — consistent visual hierarchy

| Goal | Acceptance criteria | Delivery |
| --- | --- | --- |
| G19. Consistent typography | Self-hosted licensed Geist Sans; shared type styles; 16px explanatory text and controls, 14px tables and secondary metadata; tabular numeric values. | Implemented in 2.4 |
| G20. Reach the task sooner | Less framing, compact phone navigation and optional tools below the primary task, without removing functionality. | Implemented in 2.4 |
| G21. Preserve reliable planning | Saved-plan format and calculations unchanged; regression suite and light/dark responsive browser checks. | Verified in 2.4 |

## 3.0 — allocation workbench

| Goal | Acceptance criteria | Delivery |
| --- | --- | --- |
| G22. Start with the calculation | Clean first use opens blank Allocations with explicit hardware assumptions; main editing and live diagram take priority over introductory content. | Implemented in 3.0 |
| G23. Keep existing work safe | Delayed library discovery, existing plans, recovery and user edits cannot be overwritten by startup defaults. New-plan replacement remains guarded. | Regression tested in 3.0 |
| G24. Reduce navigation overhead | Direct task views, compact metadata and optional tools; no welcome cards or repeated Next prompts. Saved hardware plans reopen at useful editing controls. | Implemented in 3.0 |

## 3.2 — public introduction and self-service guide

| Goal | Acceptance criteria | Delivery |
| --- | --- | --- |
| G25. Make the purpose clear | A dedicated home page explains Autonomous ExaC@C scope, public/local privacy and limits, with clear capacity, workload, example and saved-plan actions. | Implemented in 3.2 |
| G26. Make common cases teachable | Separate guide covers local capacity, workload sizing, groups/DR, import, options/growth, saving/sharing and result interpretation, with real generic screenshots and a sample CSV. | Implemented in 3.2 |
| G27. Prefer a readable first visit | Light is the default; explicit Dark/System preferences remain available and remembered. Home/guide work on narrow screens. | Verified in 3.2 |
| G28. Preserve work while learning | Home/guide load no plan data; help opened from the planner leaves working edits in place. CTA routing runs once and respects recovery, pending edits and user choices. | Regression tested in 3.2 |

The guide documents supported cases and unassessed areas; it does not claim exhaustive Oracle supportability, physical-device certification or an independently measured first-use completion time.

## 3.3 — learn by using the controls

| Goal | Acceptance criteria | Delivery |
| --- | --- | --- |
| G29. Optional first-use walkthrough | Offer a practice tour without forcing it; remember dismissal/completion and allow restart from Guide/menu. | Implemented in 3.3 |
| G30. Evidence-based progress | Advance through actual valid input/actions; successful current-plan saving required; skipped steps, failures and identity changes cannot silently complete the tour. | Regression tested in 3.3 |
| G31. Preserve work and responsiveness | Fresh generic practice plan, separate tab from existing work, Back/Skip/Exit, visible mobile controls, no polling or new hosted service. | Implemented in 3.3 |

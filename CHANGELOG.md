# Changelog

## 2.0.0 — 2026-11-07

### Added

- Dated rule registry, explicit coverage and qualified all-machine assessment with per-node bottlenecks and open checks.
- Named Site → Machine → AVMC → ACD → ADB mapping, independent-switchover findings and up to two standby ACD links.
- Local XLSX/CSV worksheet and column mapping, validated preview, unknown-value preservation and source-change/race protection.
- Full named alternatives, restore/comparison, growth and migration-overlap options. Stable machine identities take priority over legacy name matching.
- Separate conventional VMC console/proposal footprints with tracked inclusion in Other allocations to prevent double counting.
- Optional local device recovery, 20-change Undo/Redo, and consistent 10 MB JSON export/import limits.
- Self-contained executive/technical HTML report with sources and assumptions; printable locally.
- Public product goals and regression catalogue. Existing scenario v1 files remain supported.

### Corrected

- Memory-rule cutoff follows the current creation documentation: after 29 September 2026. The 22 September feature announcement is a separate event.
- New-creation CPU minimums are distinguished from older existing allocations requiring console confirmation.
- High-memory sizing proposes explicit additional database ECPUs and preserves the original requirements for review.
- Node shrinking cannot discard other allocations, and topology-changing previews cannot silently erase named database mappings.

### Boundaries

- Physical capacity fit does not prove immediate OCI provisioning/resize eligibility, failure capacity, workload performance or DR readiness.
- Shared storage/backup sizing, conventional filesystem formulas, pricing and licensing remain separate or unchecked, visibly documented in coverage.

## 1.9.0 — 2026-11-07

### Improved

- Rebuilt the interface around one shared stylesheet with consistent spacing, typography, controls, tables and responsive layouts. The independent Oracle-inspired appearance uses warm neutrals and restrained red accents.
- A compact header and machine sidebar replace repeated introductory text. Two visible choices explain new-machine sizing versus checking known hardware.
- The live capacity bar now includes the next step, keeping navigation available while editing. Review offers a direct return to AVMCs.
- Hardware comparison scrolls to its results. Optional buffers, saving instructions and calculation details expand when needed.
- Mobile forms appear before the allocation diagram; preview values stay explicitly labelled. Focus indicators and reduced-motion preferences are supported.
- Styles and scripts carry the release version in their URLs to prevent mixed cached releases.
- Resource formulas, hardware presets and saved JSON format are unchanged.

## 1.8.0 — 2026-11-07

### Improved

- A four-step presales workflow per machine: Machines, AVMCs & workloads, Compare options, Review & save.
- Separate paths for sizing new hardware from workload needs and checking a known machine's allocations. Each step explains what to enter and what comes next.
- New machines start without example AVMCs. New workload plans do not show free-capacity figures until hardware is selected.
- Workload inputs now sit inside the matching AVMC editor. Selecting hardware opens Review & save; changing quantitative workload inputs marks hardware for re-selection.
- Review includes the all-machine summary, missing-workload warnings and clear JSON/PDF actions. Steps remain freely navigable and drafts can be saved.
- Existing scenario files retain their saved allocations and remain usable. Resource formulas and hardware presets are unchanged.

## 1.7.0 — 2026-11-06

### Added

- Workload-input fields per AVMC and a DB-server suggestion panel comparing X11M Base, Standard, Large and Extra Large across a selected server-count range.
- Separate results for the smallest physical fit and the first option meeting optional buffer targets. Ranking uses DB-server count then memory tier, not prices.
- Editable extra-ECPU planning allowance, ACD CPU minimums, workload RAM requirements, minimum memory ratios and missing-workload flags.
- Applying an option updates the local plan and keeps Undo available. Existing other allocations are retained; a candidate cannot omit a server containing other allocations.

### Limits

- Suggestions cover DB-server CPU, memory and local storage for an all-server AVMC layout. They do not establish workload performance, exact failover/autoscaling reservations, shared-storage sizing, quotas, licensing, cost or in-place hardware eligibility.
- Compare each year's requirements before choosing hardware for a multi-year plan. Unsized workloads remain explicitly incomplete.
- Existing scenario files remain readable. No customer workbook data is included in the public app.

## 1.6.0 — 2026-09-30

### Added

- A live AVMC → reserved ACD-slot diagram for the selected machine, with local-storage totals, a usage bar, per-AVMC overhead/slot costs and per-server free space.
- Diagram Edit buttons open the corresponding AVMC form. Unapplied previews are labelled and their Edit buttons are disabled.
- Diagram boxes represent capacity reserved by the configured maximum ACD count, not discovered ACD or ADB instances.

### Improved

- Grouped machine fields into Site and machine, Hardware, and Optional buffer.
- Expandable AVMC editors put local-storage controls first; CPU and memory are grouped underneath and stay open while completing legacy checks.
- The diagram sits beside the forms on wide screens and above them on narrower screens. Invalid inputs clear stale diagram values.
- The optional Before / After tools are collapsed initially. The floating local-storage summary remains available.
- Formulas and scenario format are unchanged.

## 1.5.1 — 2026-09-30

### Added

- A fixed local-storage summary at the bottom of desktop and narrow screens. It updates as AVMCs, maximum ACD counts, placements and other allocations change.
- Shows the active machine, local GB left, allocated/total GB, AVMC/ACD counts and per-server or buffer warnings.
- Preview values are labelled “Preview · not applied”; cancelling restores the edited plan's summary. Invalid inputs clear the number instead of leaving a stale result.
- Undo, Save JSON, an unsaved-change indicator and a details link remain within reach. Saving from this bar is disabled while a preview is open.

### Improved

- The larger resource-card section stays in normal page flow, leaving more room for editing.
- Added space below the page so the floating summary does not cover the last controls. The summary is hidden in print/PDF.
- Resource formulas and scenario format are unchanged.

## 1.5.0 — 2026-09-30

### Clarified

- Replaced “growth reserve” with “buffer target” and simplified the text across setup, resource cards, layout previews, console comparisons and session estimates.
- Main resource cards now show actual calculated free capacity. The optional buffer target is shown separately.
- Explained that a user-selected buffer is a warning threshold, not an Oracle allocation or service limit.

### Fixed

- Layouts that fit available local storage stay previewable when the buffer target cannot be met. They show an amber warning and can be applied.
- Added “Preview maximum” when more ACD slots fit within storage capacity than within the chosen buffer target.
- Hardware/service-limit errors remain red and block applying the preview. Buffer-only warnings do not block it.
- Displayed negative differences from the buffer target in amber, separately from actual capacity shortages.
- Scenario format, hardware presets and resource formulas are unchanged.

## 1.4.2 — 2026-09-30

### Added

- Laptop save/resume instructions: download the editable JSON to Downloads or a chosen folder, then reopen it with Open saved JSON.
- A visible unsaved-work reminder with a quick Save JSON button, including in the desktop resource summary while scrolling.
- Explicit distinction between a resumable JSON configuration, the optional Before comparison and a printed PDF report.

### Improved

- Register the browser close/refresh warning only while unsaved changes exist, and remove it after opening/downloading a scenario or undoing back to the saved values.
- Track typed site and machine names immediately, so they count as unsaved work before the field loses focus.
- Download feedback says to check the local file, explains how to resume and avoids claiming the browser has confirmed a completed save.
- No automatic browser storage, server upload or changes to sizing formulas.

## 1.4.1 — 2026-09-30

### Clarified

- Renamed “Set as current configuration” to “Record Before values”. This optional action records allocation totals for a Before / After comparison; capacity calculations do not require it.
- Added a short worked example and explained that recording comparison values neither reads nor changes OCI, and does not save a scenario file.
- Labelled the comparison columns “Before (recorded)” and “After (editing now)”.

### Documentation

- Added this changelog, with earlier releases reconstructed from Git history and the existing release notes.
- Linked the changelog from the calculator and README.
- No changes to sizing formulas or scenario compatibility.

## 1.4.0 — 2026-09-30

### Added

- Current AVMC memory formula with the additional 300 MB per ECPU per VM, and a 135 GB minimum current-rule planning budget per VM.
- Per-AVMC legacy eligibility checklist. Proposed memory-ratio changes switch to the current rule.
- Conservative current-rule estimates for imported scenarios with unconfirmed memory history; saved comparison totals remain fixed.
- Per-AVMC memory/local-storage estimates, optional console observations and infrastructure-total reconciliation.
- Per-server shortfalls for a proposed additional AVMC: CPU, memory, local storage and VM slots.
- Resource-release and rolling-restart guidance, with public Oracle source links.
- Independent Oracle-inspired styling using local CSS and system fonts.

## 1.3.0 — 2026-09-17

### Added

- Site/machine navigation, duplicate/remove controls and persistent desktop resource summaries.
- Preview before applying replacement layouts; one-step Undo and unsaved-change tracking.
- Before/after workflow and expandable calculation details.
- Narrow-screen layouts and keyboard access to scenario import.

## 1.2.1 — 2026-09-17

### Fixed

- Preserved compute allocations when applying a matching layout; different layouts require explicit replacement allocations.
- Included all enabled resource checks in the machine overview and cleared stale status on invalid input.
- Preserved nonsequential imported server IDs during node-count changes, with validation before applying changes.

## 1.2.0 — 2026-09-17

### Added

- Independent CPU, memory and manual Exadata-storage growth buffers.
- Recorded allocation totals for before/after comparisons.
- Optional Exadata-storage capacity/allocation checks and an assumption-labelled ADB session estimator.
- CPU/memory checks enabled by default for new scenarios; saved scenario settings preserved.

## 1.1.1 — 2026-09-17

### Fixed

- Locked hardware capacity to the selected preset while keeping existing reservations editable.
- Relabelled imported nonmatching capacities as Custom without changing their values.

## 1.1.0 — 2026-09-17

### Added

- Multiple sites and machines with separate capacities, allocations and checks.
- Site/machine overview and scenario import/export compatibility.

## 1.0.0 — 2026-09-17

### Added

- Initial static ExaC@C AVMC local-storage calculator, X11M presets and custom console inputs.
- AVMC placement, maximum ACD-slot reservations, per-server constraints and layout comparisons.
- Scenario JSON import/export, print/PDF and public Oracle sizing references.

# Changelog

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

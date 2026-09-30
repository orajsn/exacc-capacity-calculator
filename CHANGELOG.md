# Changelog

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

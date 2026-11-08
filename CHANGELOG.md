# Changelog

## 3.4.2 — 2026-11-09

### Fixed

- Existing/unknown low-CPU allocation warnings now remain visible in summaries and comparisons instead of appearing as an unqualified fit.
- Hardware-profile validation rejects inherited JavaScript property names rather than accepting them as profiles.
- Exact decimal CPU/memory boundaries use the same small numerical tolerance as storage checks, preventing floating-point noise from creating false shortfalls. Real shortages still fail.
- A JSON download request no longer clears unsaved-work protection. Confirm receipt with I have the JSON file; a cancelled, failed or outdated download cannot mark current edits as backed up.

### Verified

- Added independent synthetic boundary regressions for per-node conservation, placement, monotonic changes, memory history, invalid inputs, missing checks and layout enumeration. Customer reconciliation files remain private.

## 3.4.1 — 2026-11-08

### Fixed

- Comparison review now exposes stale and incomplete workload-sizing flags alongside allocation results.
- Save as new copy cannot copy a different plan activated while device storage is still opening.
- Exiting a walkthrough returns keyboard focus to a visible working control instead of leaving it in the hidden guide panel.

### Improved

- Clearer labels distinguish Start guided practice from Read the guide, and Design options from the saved-plan library. Plan name & details makes the naming fields easier to find.
- Layout preview buttons have row-specific accessible names. Narrow screens show a persistent horizontal-scroll hint above layout options.

## 3.4.0 — 2026-11-08

### Added

- Side-by-side comparison of the working plan and up to two saved designs. Hardware, counts, allocations, remaining capacity, buffer status and warnings are shown per machine. Unchecked resources remain unknown, and per-server shortages stay visible.
- Import change review based on the actual proposed plan: added, changed, removed and unchanged databases; field-level changes; ACD groups, slot reservations, DR links and missing values. Filters and 50-record pages keep the complete review accessible.
- Guide walkthroughs and generic screenshots for both features.

### Preserved

- Selecting comparisons does not load or modify plans. Import still requires explicit Apply and a current preview; aggregate workload sizing still requires separate review.
- Renamed/moved inventory paths are added/removed rather than inferred identities. Ambiguous paths and legacy machine-name matches are explicitly qualified.

## 3.3.0 — 2026-11-08

### Added

- Optional first-visit invitation and a guided practice plan highlighting real hardware, AVMC, ACD-slot, capacity and save controls.
- Back, Skip step, Exit and Escape controls; completion is recorded only after all required steps and a successful save of the current practice plan.
- Restart links in the guide and Plans & files open a separate practice tab. Existing plan-switch and recovery protections remain in place.
- Browser-local dismissed/completed preference. The walkthrough uses local events and no new service, polling loop or runtime dependency.

## 3.2.0 — 2026-11-08

### Added

- Public home page explaining the planner and offering direct starts for known hardware, workload sizing, examples and saved plans.
- Separate Guide & FAQ with six walkthroughs, result interpretation, common questions, scope limits, four real generic screenshots and a sample CSV.
- Home and guide links from the planner open separately to preserve working edits. The calculator now lives at planner.html; browser-local saved plans remain on the same origin.

### Changed

- First visits default to Light, including when the device uses dark mode. Explicit saved Dark/System choices remain respected.
- Start-action links are handled once after library discovery, with protection for edits, recovery and intervening user actions.

## 3.1.0 — 2026-11-08

### Improved

- Renamed the application Autonomous Capacity Planner, with Exadata Cloud@Customer stated as its deployment scope. Other VM clusters remain entered-footprint checks rather than a complete conventional sizing model.
- Replaced the appearance dropdown with an accessible sun/moon button. Device appearance can still be restored from the menu.
- Consolidated New, saved plans, JSON import/export and print under Plans & files. Save on this device remains beside the working plan.
- Strengthened meaningful group boundaries and control borders in both themes. The phone menu is bounded to the toolbar width.

This release does not add authentication or online plan storage. Those require a separately configured hosting/access service.

## 3.0.0 — 2026-11-08

### Redesigned

- Opens directly into a blank allocation workbench on first use. The initial two-node X11M Standard hardware is explicitly a starting assumption, with Change hardware beside it. No plan is saved automatically.
- Replaced welcome cards and the decorative layer guide with a compact New plan choice. Machine, Allocations, Compare and Review are directly accessible views, without repeated Next-step prompts.
- Put editable AVMC allocations alongside the live storage diagram on larger screens. Reduced framing, repeated explanations and header space; optional tools remain below the working area.
- Consolidated customer metadata and copy actions under Plan details, and moved saving instructions to linked help at the bottom.
- Saved hardware plans reopen in Allocations; workload plans reopen in Machine. Existing saved plans, recovery prompts and unsaved edits take precedence over the new first-use default.
- Narrow-screen tabs wrap into two rows when needed. Light/dark appearance, readable type and compact live balances remain available.

Saved JSON remains compatible. Resource calculations and hardware rules are unchanged.

## 2.5.0 — 2026-11-08

### Improved

- Enlarged screen text: 16px helper copy and form labels, with at least 14px secondary labels, diagram captions and capacity status. Headings and key allocation values have clearer emphasis.
- Added lightweight, theme-aware icons for the three starting choices and an accessible Machine → AVMC → ACD → ADB explainer. These are vector/HTML visuals with no external image dependency.
- Preserved compact phone balances, existing print type sizes and all calculation and saved-plan behavior.

## 2.4.0 — 2026-11-08

### Improved

- Added self-hosted Geist Sans with its open font license; no external font service is used.
- Unified typography around readable body, control, caption and heading styles, with aligned numeric columns.
- Reduced enclosing frames and softened navigation so working inputs and results receive more emphasis. Phone navigation and starting choices use space more efficiently.
- Moved optional imports and conventional VM clusters below AVMC editing, and saved-option comparisons below the main comparison tools. All features remain available.
- Kept warm accents, light/dark/system appearance, compact phone balances and existing sizing behavior.

## 2.3.0 — 2026-11-08

### Added

- System, Light and Dark appearance choices. The selected appearance is remembered in this browser separately from customer plans, and system mode follows the operating-system preference.
- Dark colors for forms, tables, diagrams, readonly fields, warnings, errors and keyboard focus. Theme contrast tests cover text, status colors and focus indicators; printed plans retain light colors.

### Improved

- A compact phone capacity bar keeps balances and status visible. More/Less reveals or hides the remaining controls without changing the plan. Short landscape views keep the bar in normal page flow.

## 2.2.3 — 2026-11-08

### Improved

- Removed the “Presales workspace” header label and kept the version visible on phones.
- Stacked narrow phone forms, enlarged touch controls and input text, and allowed long resource names to wrap.
- The capacity bar stays fixed on taller screens, with page clearance matching its actual height. On short screens it moves with the page so it does not cover the editing area.
- Removed the duplicate backup button from the phone capacity bar; Download backup remains in the main toolbar. Wide comparison tables retain their own horizontal scrolling.

## 2.2.2 — 2026-11-08

### Fixed

- Excel numeric cells stored in scientific notation now reach the inventory preview as plain decimal values. Text cells retain their original contents, and workload validation still applies.

## 2.2.1 — 2026-11-08

### Fixed

- Inventory re-import no longer drops per-ACD CPU details and understates required AVMC CPU. Valid manual breakdowns are retained when slot counts are unchanged; inventory snapshots remain subject to explicit review.
- Missing or inconsistent applied CPU breakdowns cannot appear current. Growth and migration retain source metadata, manual snapshots and completeness flags instead of silently replacing them.
- Archive completion preserves edits made while the operation was pending, including undo history. Restoring the saved copy reconnects the retained working draft without marking it saved or enabling automatic writes.
- A focus/revision check finishing during the plan's own save no longer creates a false cross-tab conflict. Genuine newer, replaced, archived or removed copies still trigger protection.
- Project names and assumptions are tracked while typing, so autosave and leave protection do not depend on leaving the text field.
- Activating another plan or saved revision refreshes metadata fields even when an old field retained focus, preventing old text from carrying into the new plan.

If inventory was re-imported in v2.2, review/apply the database totals and rerun hardware sizing before relying on the earlier recommendation. No saved allocation is silently resized by this patch.

## 2.2.0 — 2026-11-08

### Improved

- Clear starting choices: Quick capacity check, New customer plan and an editable generic production/DR example.
- Renamed My plans to Saved plans, Save JSON to Download backup and Open JSON to Open plan file. Backups retain the existing JSON format.
- Explicit Manual totals / Database inventory sizing sources, with a difference preview and Apply action. Original manual assumptions can be restored.
- Semantic inventory freshness checks: CPU/RAM/grouping changes require sizing review; labels, storage and DR metadata do not falsely invalidate CPU/RAM totals.
- Live storage, CPU and estimated-memory balances, with whole-machine or per-DB-server views. Node shortages and manually checked shared-storage deficits remain visible.
- Typed Review input actions navigate by stable identities to relevant fields, including closed AVMC/ACD editors. Missing information is separated from optional or external checks.
- Known allocation checks remain visible when workload inputs need review. Optional workload sections retain focus/open state through source changes.

### Preserved

- Numerical resource formulas, hardware presets, local-only saving and existing scenario/library compatibility.
- Example/quick entry never silently replaces unsaved work or automatically stores example data.
- Independent first-time-user usability testing remains a future validation step; this release uses automated and browser checks.

## 2.1.0 — 2026-11-07

### Added

- Browser-local My plans library, grouped by customer and searchable by project, owner/alias, site, machine or Plan ID.
- Stable Plan IDs and customer/owner metadata in JSON and report headers. Owner labels do not create accounts or access control.
- Independent saved plans, duplication, archive/restore and explicit permanent removal. The four-step calculator remains inside each plan.
- Asynchronous storage with metadata-only listing, delayed automatic saves, revision conflict checks and no silent cross-tab overwrite.
- Validated migration of the old single draft; its source stays intact until the new copy is safely committed.
- Safe switching and JSON opening, with unsaved-work choices and identity checks around asynchronous actions.

### Preserved

- Static hosting, no shared online customer database, no network upload and no new runtime dependency.
- Old scenario files, calculation rules, hardware presets and named alternatives remain supported.

### Limits

- Up to 100 active/archived plans and 10 MB per plan, subject to browser storage limits. JSON remains the portable backup.
- Plan IDs find data already saved or imported in the current browser. Cross-device retrieval and shared online workspaces are not part of this release.

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

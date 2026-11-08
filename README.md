# Autonomous Capacity Planner

A browser-only Autonomous Database capacity planner for Exadata Cloud@Customer: AVMCs, ACDs and ADBs. Other VM-cluster allocations can be recorded as entered footprints; this is not a complete conventional Exadata sizing tool. Keep separate customer projects, build multi-site plans, compare allocations and export the reasoning. No account, backend, analytics or data upload. Device saving starts when you create a saved plan or choose Save on this device.

Use the sun/moon button to switch appearance. Plans & files → Use device appearance restores the operating-system setting. Only this preference is remembered automatically in this browser; changing it does not save or modify a customer plan. On phones, the compact capacity bar keeps balances and status visible; More opens its extra controls. Printed plans use light colors.

[Home](https://orajsn.github.io/exacc-capacity-calculator/) · [Open the planner](https://orajsn.github.io/exacc-capacity-calculator/planner.html) · [Guide & FAQ](https://orajsn.github.io/exacc-capacity-calculator/guide.html) · [Product goals](PRODUCT_GOALS.md) · [Release history](CHANGELOG.md) · [Test catalogue](TESTING.md)

The home page introduces the tool and offers task-specific starts. The guide contains screenshot walkthroughs and a generic CSV example. First visits use Light; explicit appearance preferences remain remembered. Existing saved plans remain available because the planner stays on the same website origin. Home and guide links inside the calculator open separately so working edits stay in place.

First visits also offer **Show me around**. The guided example uses a fresh plan named Guided practice and actual planner controls. It confirms hardware, adds an AVMC, reserves two ACD slots, explains the live result and waits for a successful device save. Back, Skip step and Exit are always available; skipped or failed steps do not count as completed. Only a dismissed/completed flag is remembered locally. Restart from Guide & FAQ or Plans & files → Guided example. Practice plans you save remain in Saved plans and can be archived there.

## Start calculating

With no saved plans, the planner opens directly into a blank allocation check. It starts with a clearly labelled two-node X11M Standard hardware assumption, zero AVMCs and CPU/memory checks off. Use **Change hardware** to match your machine, then **Add AVMC** to see reservations and remaining local storage update together. This initial workspace is not saved automatically.

Existing saved plans and recovery prompts retain priority on startup. **New plan** opens a compact choice of blank capacity check, customer plan or illustrative production/DR example. Switching plans preserves the unsaved-work guard.

**Plans & files** groups starting a new plan, opening device copies, importing a JSON file, downloading a backup and printing. **Save on this device** remains beside the working plan. Customer/project fields and Save as new copy are under **Plan details**. Saving help is at the bottom of the workspace and linked from the footer.

## Saved plans: customers, projects and owner labels

**Saved plans** lists the projects saved in this browser, grouped by customer. Search by customer, project, optional owner/alias, site, machine or full Plan ID. Each plan keeps its own machines, database inventory and alternatives.

- **Create a customer plan** starts a separate project with a generated Plan ID and saves it on this device.
- **Save on this device** keeps the working plan in the library and enables automatic updates after a short pause. You can turn automatic saving off in the saving help.
- **Save as new copy** creates a separate Plan ID. Loading an alternative inside a plan keeps that plan's identity.
- **Archive** removes a saved plan from the active list; Archived plans can be restored. Permanent deletion is a separate explicit action.
- JSON files and reports include customer, project, owner and full Plan ID. Older JSON files receive an ID when opened; download a backup to preserve it.

An owner alias is a label, not a verified account. A Plan ID is a reference, not a password or an online retrieval code. Other people using the public calculator do not automatically see your plans. On another device/browser, open the plan's JSON first; entering the ID alone cannot retrieve data that is not there.

## Workbench views

1. **Machine:** add one entry per ExaC@C infrastructure. Choose **Size a new machine** or **Check known hardware**. Hardware preset capacities are locked; Custom accepts verified console values.
2. **Allocations:** edit AVMC allocations or workload ECPU/RAM needs alongside the live allocation diagram. Optionally import Excel/CSV and name the ACDs and databases. **Use database totals for sizing** is an explicit action.
3. **Compare:** compare hardware, alternative AVMC layouts or saved plans. Save separate growth and migration-overlap options without changing the working plan.
4. **Review:** inspect the limiting resource, warnings and open checks. Download backup to resume, or download the report for all-machine executive and technical views.

Switch views directly using the tabs. The capacity bar keeps balances, Undo and Redo available; More opens extra controls on phones. Detailed inputs are optional. Buffers are preferred free capacity: missing a buffer warns; it does not reduce physical capacity.

The live bar shows remaining local storage, CPU and estimated memory. Choose **Whole machine** or an individual DB server; Review cards remain explicitly labelled whole-machine totals. A positive total does not hide a node shortage. Disabled or unavailable checks show no invented free capacity, and preview values remain labelled until applied.

Under Compare saved plans, growth and migration, select up to two saved options alongside the working plan. The table shows hardware, AVMC/ACD/database counts, each machine's resource allocations/free capacity and warnings. Values are recalculated using the current rules; stored provenance is displayed. Selection is read-only, and loading an option remains a separate action. Unselected hardware and unchecked resources are not presented as zero usage or proof of fit.

## Which inputs drive sizing?

Each AVMC selects **Manual totals** or **Database inventory**. Manual totals stay independent of named database rows. Inventory totals are applied through a review showing current values, proposed totals, changes and missing data; applying never silently resizes known AVMC allocations.

Changing inventory CPU/RAM/grouping/slot inputs marks previously applied inventory sizing stale. Hardware suggestions then require updated totals. Renames, storage and DR metadata do not invalidate CPU/RAM sizing. Switching back to Manual restores the saved manual assumptions, with an incomplete flag when a changed slot layout makes an old breakdown unusable.

Review separates **Corrections**, **Missing information**, **Advisories** and **Not checked in this estimate**. Review input actions open a reliably identified machine/AVMC/database field; deleted or ambiguous items fall back to a surviving parent instead of another record. Optional disabled checks are not presented as required missing inputs. These checks still do not establish provisioning or DR approval.

## Database placement and DR

The map distinguishes reserved ACD slots from named ACD/ADB inventory. Named records are a proposed design, not a live OCI inventory. A primary ACD can link to up to two standby ACDs; every copy is sized on its own machine. Links never copy or add resource allocations automatically.

Databases in one ACD share its Data Guard switchover boundary. A request for independent switchover is checked against the entered grouping. Configured peer CPU/storage checks require both rows to be explicitly confirmed as proposed peer settings; workload demand alone does not prove a configured mismatch. Autoscaling, lifecycle, version, protection mode, network and operational readiness remain open checks.

## Import Excel or CSV

- Import standard, unencrypted .xlsx or UTF-8 CSV. Choose the worksheet and header row, map columns, preview, then apply.
- One row per database: site, machine, AVMC, ACD, ADB, role, ECPUs, RAM GB, database storage TB and independent-switchover preference. Download the CSV template for the exact columns.
- Blank values remain unknown. The importer does not guess CPU conversions, hardware shapes or DR peer links.
- Add inventory or explicitly replace named inventory on the active machine. Changed source selections or plan inputs require another preview.
- Preview compares the actual candidate with the current plan. It shows database additions/removals/field changes, group and slot changes, and DR-link effects, including other affected machines. Filters and 50-record pages expose the full review. Missing-value counts cover the whole resulting plan.
- Inventory matching uses normalized full name paths; renamed/moved rows appear as removed and added. Ambiguous paths are flagged. A replacement file's regenerated IDs alone do not count as a change.
- Workbook formulas are not evaluated. Cached results can be stale; missing/error results remain blank with warnings. External links are not followed.
- Legacy .xls, encrypted workbooks, macro-enabled files and unsupported ZIP features require CSV export. Workbook input is limited to 10 MB, bounded XML/text expansion and 100,000 output cells; CSV import accepts at most 5,000 database rows.

## Compare plans

Saved options are complete snapshots of all machines. Loading one changes the working plan; Undo restores the previous state. Exact machine IDs take precedence over explicitly identified name-based matching of older files.

Growth options scale entered CPU/RAM requirements by the chosen percentages. Unknowns stay unknown and hardware must be compared again. Migration overlap copies selected AVMC allocations into a separate option, counts both footprints and clears copied DR links. Neither feature predicts application performance or verifies failure capacity.

The older **Record Before values** tool remains an optional totals comparison. Use named saved options when a complete restorable configuration is needed.

## Conventional VM clusters

A separate console/proposal footprint mode accepts the full local allocation, ECPU capacity and memory per VM on selected servers. It does not reuse the AVMC formula or calculate conventional filesystems/backups.

Choose whether the existing Other values already include those footprints. Inclusion, updates and removal use a tracked contribution to avoid double counting. Manual edits that conflict with tracked totals require reconciliation. Mixed-service VM limits and older OCPU conversions still require console confirmation.

## Saving and recovery

**Download backup** downloads the current customer plan with its ID, owner, all machines, named inventory, alternatives, assumptions and rule metadata. The filename includes the customer/project and a short ID suffix. Check that the download completed. **Open plan file** resumes it without automatically overwriting a saved device copy. Existing v1 scenario files remain readable; results use current rules and imported rule differences are shown.

The library stores separate plans in IndexedDB on this browser/device. It does not sync or upload. Switching away from unsaved work offers Save, Discard or Keep working. A newer saved revision from another tab causes a conflict instead of a silent overwrite; choose the saved version, save a new copy, or explicitly replace it.

The previous single recovery draft is migrated once after validation. Its old copy is only removed after a successful library commit and only if it has not changed meanwhile. Failed migration keeps the original recoverable.

JSON and individual saved plans are limited to 10 MB UTF-8; keep at most 20 alternatives per plan. The library accepts 100 active/archived plans, subject to the browser's actual storage allowance. Browser settings, private mode or clearing site data can remove device copies, so keep downloaded JSON backups. A failed save is shown; it never reports current edits as stored. Undo/Redo retains up to 20 changes within the open plan and is reset when switching projects.

For efficiency, listing and search read compact metadata rather than every plan's full JSON. Only the selected plan is loaded. Automatic writes are delayed until typing pauses, and opening an unchanged saved plan does not rewrite it. Metadata and payload updates use one transaction with revision checks. See [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) and [browser storage limits](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

## Reports and coverage

**Download report** creates self-contained HTML with an executive summary, all machines, named database groups, saved alternatives, technical figures, assumptions, sources and open checks. Open it locally and use Print / Save as PDF. Reports can contain customer-entered information; the tool does not publish them.

| Area | Current scope |
| --- | --- |
| AVMC local storage | Per-selected-DB-server reservations, maximum ACD slots and configured VM limits |
| CPU and memory | Allocation checks, current/confirmed legacy memory rules, qualified aggregate workload sizing |
| Hardware selection | X11M presets; rank by server count then memory tier, not price |
| Named topology | Entered ACD/ADB hierarchy and up to two standby links; partial DR validation |
| Shared Exadata storage | Optional manually entered usable/allocated totals; no cell/backup sizing |
| Conventional VMC | Explicit console/proposal footprints; no automatic filesystem reservation model |
| Provisioning and scale-down | Not approved by a capacity fit; live reservations and console minima need review |
| Failures, RTO/RPO, performance, licensing and prices | Not checked |

The eight-machine, 32-AVMC-entry, 1,000-database-row-per-ACD and 20-option bounds are calculator input limits, not Oracle service limits. Platform-specific limits are checked separately.

## Rules and source differences

The dated registry in rules.js records formulas, scope, source links and unresolved source differences. Current source review: 7 November 2026.

Version 2.2.1 repairs a v2.2 inventory re-import defect that could lose per-ACD CPU details. For a plan re-imported in v2.2, review/apply its database totals and rerun hardware sizing before relying on the earlier recommendation. Applied snapshots with missing details now require review; existing allocations are not silently resized.

- Local reservation uses the detailed creation formula consistently; worked examples on other Oracle pages do not always reconcile.
- Current memory uses the additional 0.3 GB per ECPU overhead and a conservative 135 GB/VM creation budget. The documented cutoff is **after 29 September 2026**, or after an existing AVMC's memory ratio changes. The 22 September feature announcement is a different date; exact-cutoff eligibility still needs console confirmation.
- New AVMC proposals enforce the current 40-ECPU/VM creation minimum. Existing or unknown older positive allocations below it receive a console-confirmation warning; they are not declared unsupported merely from the new-creation rule.
- When RAM needs more than the maximum entered memory ratio permits, sizing can propose additional **database ECPUs**. It preserves requested inputs and requires per-ADB review; spare AVMC CPU alone does not establish the required ADB memory.
- The extra ECPU percentage is a user planning assumption, not Oracle's computed failover reservation. Available, reserved and reclaimable CPU remain distinct.

Primary references: [Create AVMC](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/create-an-autonomous-exadata-vm-cluster.html), [hardware shapes](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/characteristics-of-infrastructure-shapes.html), [capacity terminology](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/plan-and-observe-capacity-for-autonomous-ai-database-on.html), [Data Guard scope](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/protect-critical-databases-from-failures-and-disasters-using.html).

## Development and publication

Static HTML/CSS/JavaScript; no build or runtime dependency. Serve this directory over HTTP for complete workbook import and device-storage behavior. Open index.html directly only for basic local use.

Run npm test for the public model/integration suite. Update model.js, package.json, CHANGELOG.md and the CSS/script version queries in index.html together. Keep customer files, examples derived from customer data and internal evidence outside this public repository. Verify the published commit and changed assets after deployment.

ui.css owns the shared visual system, responsive layouts and print styles. Self-hosted Geist Sans provides consistent typography, with system fallbacks for unavailable glyphs or loading failures. Its license and pinned source are in assets/fonts. The design uses shared type and spacing tokens, restrained warm accents and task-focused forms and tables. This is an independent application, not an official Oracle, Vercel or IBM product or deployment approval.

# ExaC@C Capacity Planner

A browser-only presales planner for Exadata Cloud@Customer. Build a multi-site plan, compare resource allocations, map database groups and export the reasoning. No account, backend, analytics or data upload. Optional device recovery is off until the user enables it.

[Open the planner](https://orajsn.github.io/exacc-capacity-calculator/) · [Product goals](PRODUCT_GOALS.md) · [Release history](CHANGELOG.md) · [Test catalogue](TESTING.md)

## Start in four steps

1. **Machines:** add one entry per ExaC@C infrastructure. Choose **Size a new machine** or **Check known hardware**. Hardware preset capacities are locked; Custom accepts verified console values.
2. **AVMCs & workloads:** enter AVMC allocations or workload ECPU/RAM needs. Optionally import Excel/CSV and name the ACDs and databases. **Use database totals for sizing** is an explicit action.
3. **Compare options:** compare hardware, alternative AVMC layouts or saved plans. Save separate growth and migration-overlap options without changing the working plan.
4. **Review & save:** inspect the limiting resource, warnings and open checks. Save JSON to resume, or download the report for all-machine executive and technical views.

The capacity bar keeps Next, Undo, Redo and Save available. Detailed inputs are optional. Buffers are preferred free capacity: missing a buffer warns; it does not reduce physical capacity.

## Database placement and DR

The map distinguishes reserved ACD slots from named ACD/ADB inventory. Named records are a proposed design, not a live OCI inventory. A primary ACD can link to up to two standby ACDs; every copy is sized on its own machine. Links never copy or add resource allocations automatically.

Databases in one ACD share its Data Guard switchover boundary. A request for independent switchover is checked against the entered grouping. Configured peer CPU/storage checks require both rows to be explicitly confirmed as proposed peer settings; workload demand alone does not prove a configured mismatch. Autoscaling, lifecycle, version, protection mode, network and operational readiness remain open checks.

## Import Excel or CSV

- Import standard, unencrypted .xlsx or UTF-8 CSV. Choose the worksheet and header row, map columns, preview, then apply.
- One row per database: site, machine, AVMC, ACD, ADB, role, ECPUs, RAM GB, database storage TB and independent-switchover preference. Download the CSV template for the exact columns.
- Blank values remain unknown. The importer does not guess CPU conversions, hardware shapes or DR peer links.
- Add inventory or explicitly replace named inventory on the active machine. Changed source selections or plan inputs require another preview.
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

**Save JSON** downloads all machines, named inventory, saved options, assumptions and rule metadata. Check that the download completed. **Open JSON** resumes it. Existing v1 scenario files remain readable; results are recalculated using current rules, and imported rule differences are shown.

Optional device drafts store the plan only in the current browser/device. They do not sync or upload. Recovery is offered explicitly on reopening, and Clear stored draft does not delete the working plan. A downloaded JSON remains the portable backup.

There is one recovery slot for this site in a browser. Other tabs can replace it; leaving-page checks verify that the stored draft still matches the current plan. Use separate JSON files for separate projects.

JSON export/import is bounded to 10 MB in UTF-8; keep at most 20 alternatives per file. Device drafts are bounded to 2 MB and may also be limited by browser storage permissions/quota. A failed draft save is shown and does not claim that current edits were saved. Undo/Redo retains up to 20 changes in the current tab; it is not exported.

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

- Local reservation uses the detailed creation formula consistently; worked examples on other Oracle pages do not always reconcile.
- Current memory uses the additional 0.3 GB per ECPU overhead and a conservative 135 GB/VM creation budget. The documented cutoff is **after 29 September 2026**, or after an existing AVMC's memory ratio changes. The 22 September feature announcement is a different date; exact-cutoff eligibility still needs console confirmation.
- New AVMC proposals enforce the current 40-ECPU/VM creation minimum. Existing or unknown older positive allocations below it receive a console-confirmation warning; they are not declared unsupported merely from the new-creation rule.
- When RAM needs more than the maximum entered memory ratio permits, sizing can propose additional **database ECPUs**. It preserves requested inputs and requires per-ADB review; spare AVMC CPU alone does not establish the required ADB memory.
- The extra ECPU percentage is a user planning assumption, not Oracle's computed failover reservation. Available, reserved and reclaimable CPU remain distinct.

Primary references: [Create AVMC](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/create-an-autonomous-exadata-vm-cluster.html), [hardware shapes](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/characteristics-of-infrastructure-shapes.html), [capacity terminology](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/plan-and-observe-capacity-for-autonomous-ai-database-on.html), [Data Guard scope](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/protect-critical-databases-from-failures-and-disasters-using.html).

## Development and publication

Static HTML/CSS/JavaScript; no build or runtime dependency. Serve this directory over HTTP for complete workbook import and device-storage behavior. Open index.html directly only for basic local use.

Run npm test for the public model/integration suite. Update model.js, package.json, CHANGELOG.md and the CSS/script version queries in index.html together. Keep customer files, examples derived from customer data and internal evidence outside this public repository. Verify the published commit and changed assets after deployment.

ui.css owns the shared visual system, responsive layouts and print styles. The independent Oracle-inspired appearance uses system fonts and no proprietary brand assets. This is not an official Oracle application or deployment approval.

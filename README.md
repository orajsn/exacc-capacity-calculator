# ExaC@C Capacity Calculator

A static, browser-only planning calculator for Autonomous VM Cluster capacity and resizing on Exadata Cloud@Customer. Open `index.html` locally or serve the folder through GitHub Pages. No build, runtime dependencies, backend, analytics, cookies or automatic persistence.

Release history is maintained in [CHANGELOG.md](CHANGELOG.md). Update its release entry alongside the calculator version before publishing.

## Save on your laptop and resume later

1. Click **Save scenario (.json)** to download `exacc-scenario.json`. Your browser uses Downloads or the location you choose. Check that the download completed; this static page cannot confirm the file reached disk.
2. Keep the JSON file. It includes all machines, allocations, planning inputs and recorded Before totals. Apply any preview first if you want it saved.
3. Return to the calculator and use **Open saved JSON** to resume. Download a new copy after further edits.

The page shows an unsaved-work reminder and registers a close/refresh warning while edits differ from the last opened/downloaded scenario. Browsers control the warning text and may suppress it, especially on mobile. Keep the JSON file as your backup. The calculator does not automatically store your scenario in the browser, on GitHub, on OCI or on a server. A printed PDF is a report, not a resumable configuration.

## Optional Before / After comparison

**Record Before values** keeps the allocation totals currently entered for the selected machine. Continue editing to see the difference in the Before / After table. For example, recording 1,000 GB and then modelling 800 GB shows a −200 GB change.

This records comparison totals, not a complete configuration that can be restored. It does not fetch or change OCI resources. You can ignore this feature and still use every capacity calculation. **Save scenario** downloads the full editable scenario, including any recorded Before totals. Applying a preview without an existing reference records the previous design's totals automatically.

## What it does

- X11M Standard, Large, Extra Large and Base presets, plus manually entered console values.
- Multiple sites and machines, AVMC placement on selected DB servers and per-server capacity checks.
- Maximum ACD slots, local reservations, other allocations, user-selected buffer and explicit 16-ACD limit.
- Comparison of 1 through the available VM count, showing both absolute and buffered local-storage ceilings.
- Optional ECPU pool and memory-allocation checks, formula breakdown, scenario JSON import/export and print/PDF.
- A fixed local-storage summary shows the active machine's remaining GB while you edit on desktop or a narrow screen. It also shows a labelled preview before you apply it, and restores the plan values on cancel. Undo, Save JSON and Details are available in the bar. It is hidden in print/PDF.
- A live AVMC → reserved ACD-slot diagram shows where local storage is allocated. Each box is a configured slot, not proof that an ACD exists. Per-server balances stay visible below the diagram because free capacity cannot be pooled between servers. Use Edit on a diagram card to open that AVMC's form.
- Machine inputs are grouped by purpose. AVMC forms expand individually, with CPU/memory controls grouped below the local-storage inputs. The optional Before / After tools can be expanded when needed.

## Buffer targets are warnings

A buffer is the percentage of capacity you would like to keep free. It does not allocate resources or reduce the machine's real capacity. Resource cards show the calculated free capacity, with the buffer target underneath.

- **Green:** meets the buffer target.
- **Amber:** fits the checked capacity, but is below the buffer target. You can still use the layout.
- **Red:** exceeds a checked hardware or service limit. Adjust the inputs before applying the preview.

Layout comparisons prefer an option that keeps the requested local-storage buffer. If none is possible, they still offer a layout that fits the physical storage. **Preview maximum** shows the maximum ACD slots when that differs from the option with the buffer. CPU and memory are checked in the preview when enabled. Actual Oracle allocations and reservations still count; the optional buffer is separate.

The preset initial buffer of 10% is a user-adjustable planning assumption, not an Oracle recommendation. Comparison designs replace current modelled AVMCs, span all machine DB servers and retain other allocations. The maximum local-storage count is not a guarantee that all ACDs or workloads can be provisioned.

## Version 1.4 — memory rules and allocation evidence

- Current memory formula: `(ECPU/VM × GB/ECPU + 40 + 0.3 × ECPU/VM) × 1.02 × VM count`. Applies to AVMCs created after 22 September 2026, or existing AVMCs after memory per CPU changes. The calculator uses decimal 300 MB = 0.3 GB and a minimum current-rule budget of 135 GB per VM. The raw formula at 40 ECPUs and 2 GB/ECPU is 134.64 GB; the budget uses the documented 135 GB minimum. Console rounding remains authoritative.
- Legacy checklist: creation before the cutoff and unchanged memory-per-CPU setting must both be confirmed before using the earlier `+40 GB` formula. Creation on the cutoff date requires console confirmation. A memory-ratio edit switches the proposal to the current rule.
- Older scenarios without memory-rule fields remain readable, but their memory history is unconfirmed and capacity checks use the conservative current estimate. Local-storage calculations and saved reference totals remain unchanged. Reconfirm legacy eligibility where appropriate; do not assume an imported snapshot is a fresh console allocation.
- Per-AVMC memory and local-storage estimates, optional console observations, and infrastructure-total reconciliation with a user-entered tolerance. Console observations remain fixed when proposals change and never override the formula.
- A proposed additional AVMC is checked on every DB server for CPU, memory, local storage and VM slots. This is a physical-capacity check without optional growth reserves. Shared storage, quotas, ACD reservations and scale-down minima still require console review.
- An independent Oracle-inspired appearance uses local CSS, system fonts and no proprietary brand assets. No customer data, internal guides or private links are embedded.

## Version 1.3 — current configuration to proposed changes

- One site-to-machine navigator with add, duplicate and remove controls. Removing the last machine is disabled.
- Four resource cards show free capacity after the growth reserve, allocation totals, unchecked resources and capacity warnings. The cards and Undo stay visible while editing on desktop; on narrow screens they remain in normal page flow.
- Set the current reference above the editor. Subsequent edits are labelled as the proposed configuration. Existing saved references remain readable.
- Preview a layout before applying it. Replacement allocations are requested only when needed, and the preview shows resource changes and warnings. Applying without a reference captures the previous design as the current reference.
- Undo restores the most recent change, including a removed AVMC or machine, an imported scenario, or an applied layout. Undo history stays in the current tab and is not exported.
- Unsaved-change status tracks the scenario against its last opened or downloaded version. The browser warns before leaving with changes, where supported. There is still no automatic persistence or network upload.
- Detailed formulas, per-server tables, resize caveats and optional session planning are available in expandable sections. The sizing formulas and scenario schema are unchanged.

## Version 1.2 — expansion and resize planning

### 1.2.1 fixes

- Applying a local-storage combination preserves names and compute allocations when the AVMC count and all-server placement match. A different layout requires explicit replacement ECPUs and memory ratio; it never silently resets compute to minimums.
- The machine overview includes every enabled resource check, including CPU/memory buffers and manual Exadata storage. Unchecked resources are labelled, and invalid inputs clear stale overview status.
- Changing DB-server count preserves imported IDs, assigns unused IDs to added nodes, and validates placement before committing a change. Rejected changes leave the existing design intact.

### Planning features

- Independent buffers: local 10%, CPU 30%, memory 30%, and Exadata storage 30%. All are editable percentages of total capacity, not Oracle service limits or mandatory best practices. Existing saved local buffers remain unchanged.
- New designs include CPU/memory allocation checks by default. Existing scenario check settings are preserved. Change per-VM ECPUs and the 2–5 GB/ECPU memory ratio to explore allocations; checks include every selected server.
- Capture a machine baseline, then compare proposed AVMC count, ACD slots and resource allocations. Negative deltas indicate modelled release; OCI resize permission, workload fit and maintenance impact require console review.
- Exadata storage is a separate optional manual check of console usable TB and total allocated TB, including internal/backup reservations. It is not derived from database-server local storage or recalculated when cluster fields change.
- Session arithmetic takes one ADB's base ECPUs and an editable sessions/ECPU assumption. 75 dedicated and 325 shared/MTS are illustrative, not verified public Dedicated service limits. No node-count or autoscaling multiplier is applied. This is not a throughput or availability guarantee.
- Version 1.2 used the legacy memory formula. Version 1.4 adds the documented current rule and per-AVMC eligibility checks above.

Additional public references: [AVMC scaling and rolling restarts](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/manage-autonomous-exadata-vm-clusters.html) and [shared-server architecture](https://docs.oracle.com/en/database/oracle/oracle-database/26/netag/understanding-shared-server-architecture.html). These support operating caveats; the architecture page does not substantiate the numerical session assumptions.

Run `node --test model.test.cjs planning.test.cjs audit.test.cjs` for the public model checks. Keep every sibling JavaScript and CSS file beside `index.html`.

## Hardware inputs

Preset shapes lock local capacity, ECPU capacity, memory, VM limit and AVMC image overhead. Existing reservations stay editable without changing the shape. Select Custom / console values to enter another verified configuration. Imported scenarios whose capacities differ from their named preset are labelled Custom, preserving their values.

## Multiple sites and machines

Use **+ Site / machine** once per ExaC@C infrastructure. Give each entry a site/location and a machine name; reuse the site name for multiple machines in that location (for example DC / Machine 1, DC / Machine 2, DR / Machine 1). The overview shows all entries together, with separate hardware, reservations, AVMC design and checks. No capacity is pooled across machines. Save/open includes the whole scenario, up to eight machines. Older scenario files remain readable with an unspecified site label.

## Formula and evidence

Per AVMC: `VM count × [image overhead + (100 + 50 × configured maximum ACDs) × 1.03 + 2]` GB. Two-node X11M simplifies to `578 + 103 × slots`. Configured slots reserve storage before ACD creation. Each AVMC supports at most 16 ACDs.

Public Oracle memory, allocation, scaling and X11M references checked 2026-09-30:

- [Detailed resource formula](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/create-an-autonomous-exadata-vm-cluster.html)
- [Infrastructure shapes](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/characteristics-of-infrastructure-shapes.html)
- [Service limits](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/plan-and-observe-capacity-for-autonomous-ai-database-on.html)
- [Compute management](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/compute-management-in-autonomous-ai-database-on-dedicated.html)

The detailed formula gives 681 GB for a two-node one-slot X11M AVMC, whereas Oracle's worked example shows 682 GB. The calculator deliberately uses the detailed formula, with optional additional allowance, and requires final console reconciliation. X11M presets follow the Autonomous hardware table's 6-VM/server limit (2 for Base); mixed-service limits require separate validation.

CPU checks compare AVMC allocation totals and creation minimums. They do not establish ACD creation availability, autoscaling, failover reserves, application performance, database data/backup storage or migration overlap. No customer inventory is embedded.

## Conventional VMC extension

Keep a separate model for conventional VMCs. Their local use depends on configured filesystems and Oracle-managed VM backups and whether each uses DB-server or Exascale storage. Current version accepts their console-reported allocations in “Other local GB”. It does not apply the ACD formula to them. [Conventional VMC documentation](https://docs.oracle.com/en/engineered-systems/exadata-cloud-at-customer/ecccm/ecc-manage-vm-clusters.html).

## Run and test

Open `index.html` with its sibling files present. Run `node --test model.test.cjs planning.test.cjs audit.test.cjs` for formula, placement, buffer, boundary, resize, session, reconciliation and import checks. No package installation required.

## Publish

Use a dedicated public repository containing only this folder. Enable GitHub Pages from `main`, root `/`. The site will be public. Scenario files are user downloads and should not be committed. This project is an independent planning aid and is not endorsed by Oracle.

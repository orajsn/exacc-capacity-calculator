# ExaC@C Capacity Calculator

A static, browser-only planning calculator for Autonomous VM Cluster local storage on Exadata Cloud@Customer. Open `index.html` locally or serve the folder through GitHub Pages. No build, runtime dependencies, backend, analytics, cookies or automatic persistence.

## What it does

- X11M Standard, Large, Extra Large and Base presets, plus manually entered console values.
- Multiple sites and machines, AVMC placement on selected DB servers and per-server capacity checks.
- Maximum ACD slots, local reservations, other allocations, user-selected buffer and explicit 16-ACD limit.
- Comparison of 1 through the available VM count, showing both absolute and buffered local-storage ceilings.
- Optional ECPU pool and memory-allocation checks, formula breakdown, scenario JSON import/export and print/PDF.

The preset initial buffer of 10% is a user-adjustable planning assumption, not an Oracle recommendation. Comparison designs replace current modelled AVMCs, span all machine DB servers and retain other allocations. The maximum local-storage count is not a guarantee that all ACDs or workloads can be provisioned.

## Hardware inputs

Preset shapes lock local capacity, ECPU capacity, memory, VM limit and AVMC image overhead. Existing reservations stay editable without changing the shape. Select Custom / console values to enter another verified configuration. Imported scenarios whose capacities differ from their named preset are labelled Custom, preserving their values.

## Multiple sites and machines

Use **+ Site / machine** once per ExaC@C infrastructure. Give each entry a site/location and a machine name; reuse the site name for multiple machines in that location (for example DC / Machine 1, DC / Machine 2, DR / Machine 1). The overview shows all entries together, with separate hardware, reservations, AVMC design and checks. No capacity is pooled across machines. Save/open includes the whole scenario, up to eight machines. Older scenario files remain readable with an unspecified site label.

## Formula and evidence

Per AVMC: `VM count × [image overhead + (100 + 50 × configured maximum ACDs) × 1.03 + 2]` GB. Two-node X11M simplifies to `578 + 103 × slots`. Configured slots reserve storage before ACD creation. Each AVMC supports at most 16 ACDs.

Public Oracle documentation checked 2026-09-17:

- [Detailed resource formula](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/create-an-autonomous-exadata-vm-cluster.html)
- [Infrastructure shapes](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/characteristics-of-infrastructure-shapes.html)
- [Service limits](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/plan-and-observe-capacity-for-autonomous-ai-database-on.html)
- [Compute management](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/compute-management-in-autonomous-ai-database-on-dedicated.html)

The detailed formula gives 681 GB for a two-node one-slot X11M AVMC, whereas Oracle's worked example shows 682 GB. The calculator deliberately uses the detailed formula, with optional additional allowance, and requires final console reconciliation. X11M presets follow the Autonomous hardware table's 6-VM/server limit (2 for Base); mixed-service limits require separate validation.

CPU checks compare AVMC allocation totals and creation minimums. They do not establish ACD creation availability, autoscaling, failover reserves, application performance, database data/backup storage or migration overlap. No customer inventory is embedded.

## Conventional VMC extension

Keep a separate model for conventional VMCs. Their local use depends on configured filesystems and Oracle-managed VM backups and whether each uses DB-server or Exascale storage. Current version accepts their console-reported allocations in “Other local GB”. It does not apply the ACD formula to them. [Conventional VMC documentation](https://docs.oracle.com/en/engineered-systems/exadata-cloud-at-customer/ecccm/ecc-manage-vm-clusters.html).

## Run and test

Open `index.html` with its sibling files present. Run `node --test model.test.cjs` for formula, placement, buffer, boundary and import checks. No package installation required.

## Publish

Use a dedicated public repository containing only this folder. Enable GitHub Pages from `main`, root `/`. The site will be public. Scenario files are user downloads and should not be committed. This project is an independent planning aid and is not endorsed by Oracle.

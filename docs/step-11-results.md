# Step 11 — repeatable source performance and memory measurements

Date: 5 November 2026. Delivered: benchmark tooling and measured source results. No production renderer changes were necessary based on the repeatable measurements. No native launcher build, execution, installation or policy change occurred. Installed app remains 0.0.6; portable 0.0.7 remains the step-7 build.

## Why this order

1. Verify fixture sizes before timing. The existing 500-page PDF is only 377,935 bytes, so it cannot stand in for the proposed 100 MB PDF acceptance fixture. The existing DOCX and EPUB are also small. Added a reproducible 9,968,629-byte image-heavy PDF rather than silently treating a small file as a 10 MB case.
2. Separate measurements from production interfaces. A test-only Node child exposes diagnostics through parent IPC; the production broker HTTP API is unchanged. The existing bundled Node runtime runs source code and isolated headless Chromium renders it.
3. Establish fresh-process timing before reused-process timing. Both include file registration and reaching a non-busy reader followed by two animation frames. Fresh-process measurements also include broker/browser startup. OS caches are not flushed; this is not a disk-cold or installed-launch benchmark.
4. Collect memory separately from timed readiness. Sample Windows working sets for the dedicated broker and browser processes reported by Chromium CDP. This avoids including the development tools and personal browser in the totals, while retaining explicit process-coverage limitations.
5. Exercise repeated closure and concurrent documents. Twenty cycles check that broker sessions/snapshots/reads return to zero. A separate five-document test checks correct content and memory with multiple active sessions.
6. Preserve failures, investigate the intermittent PDF startup timeout, and produce source-only comparisons instead of declaring release performance acceptance.

## Measured results

Environment: Windows build 26200 x64, Intel Core i5-12450H, 12 logical CPUs, about 7.68 GiB RAM reported to Node, Node 22.23.2, Playwright Chromium 156.0.8078.4. This is the development machine, not the proposed four-core reference machine.

Ten repetitions per timing cell:

| Fixture | Actual size/capacity | Fresh-process median | Reused-process median | Reused-process p90 |
| --- | --- | ---: | ---: | ---: |
| Text | 1,000,000 bytes | 0.769 s | 0.333 s | 0.465 s |
| Synthetic image-heavy PDF | 9,968,629 bytes, 2 pages | 1.875 s | 1.512 s | 1.634 s |
| DOCX | 37,068 bytes | Not measured | 0.764 s | 0.779 s |
| EPUB | 2,077 bytes | Not measured | 0.390 s | 0.429 s |
| XLSX | 341,498 bytes, 100,000 cells | Not measured | 1.293 s | 1.345 s |
| CSV | 22,000,081 bytes, 100,000 data rows | Not measured | 0.860 s | 0.887 s |
| PNG | 79,784 compressed bytes, 24 megapixels | Not measured | 0.528 s | 0.554 s |
| Searchable PDF | 377,935 bytes, 500 pages | Not measured | 0.589 s | 0.655 s |

The final main run completed 120 opens: 20 fresh-process opens, 80 reused-process opens and 20 additional open/close cycles. PDF next-page completion had an 83 ms median and 84 ms p90 across ten actions; this is one operation, not proof of all interaction targets.

All ten final text/PDF runs were within the corresponding 5-second fresh-process and 2-second reused-process comparison thresholds. DOCX, EPUB and 100,000-cell XLSX were within 10 seconds for these actual fixtures. Small DOCX/EPUB results do not qualify maximum-size Office/book inputs.

## Memory and cleanup

- Empty broker/browser baseline: 85.0 MiB sampled combined working set.
- Highest single-document ready-state sample: 568.0 MiB for the 24-megapixel PNG, about 483.1 MiB above baseline.
- After completed cycles 5, 10, 15 and 20: approximately 205.3, 227.4, 227.5 and 226.7 MiB respectively. Broker snapshot reservations were zero at each closure; session, pending-registration and active-read counters also returned to zero.
- Retained working set increased between cycles 5 and 10 and then levelled off in these samples. This does not establish leak freedom or immediate return of all allocations to the OS.
- Five simultaneous PDF/DOCX/EPUB/XLSX/CSV sessions showed the correct documents, all ready in 2.811 seconds. Sampled working set: 1,016.9 MiB loaded; 215.2 MiB after closure. All broker allocation counters returned to zero.

Memory caveats: native `tasklist` values are rounded to KiB; sums can double-count shared pages. Only CDP-reported browser process IDs plus the broker were sampled. No reported PID was missing in the main run, but that does not prove all utility processes were included. Sampling happened after ready/close, so transient parsing peaks can be missed. This is not private committed memory or the combined-incremental 1 GB release acceptance measurement. No forced garbage collection was used.

## Failures and investigation

1. The initial PowerShell memory helper was blocked by script execution policy. Kept the failure record, removed the helper and used native read-only `tasklist` reporting. No execution policy was changed.
2. A subsequent fresh-process PDF open timed out after 40 seconds. The first harness lacked enough captured viewer state to classify it. Added failure-state diagnostics, retained that run, then completed the full 120-open run without errors. A separate ten-fresh-PDF follow-up also passed. The original timeout's cause remains unresolved; it is not erased by successful retries.
3. The first concurrent probe expected unpadded spreadsheet fixture identifiers. Corrected the assertion to the actual generated identifiers, then reran successfully. This was a benchmark assertion error, not a rendering defect.

Final successful workload: 120 main opens + 5 concurrent opens + 10 targeted PDF starts = 135 opens. This is a workload count, not 135 independent unit-test groups. Existing regression suites were not rerun wholesale because production application code was unchanged.

## Reproduction

From the code root, with the existing dependencies, generated base fixtures and Playwright Chromium available:

```powershell
.venv-fixtures\Scripts\python.exe tools/benchmark/build_fixture.py
npm run bench
npm run bench:summary
npm run bench:concurrent
npm run bench:pdf-startup
```

Default: ten repetitions per timing group and twenty closure cycles. `UFV_BENCH_ROUNDS` can select 1–20 repetitions for diagnostics; use ten for this baseline. The main run writes checkpoints and error details; the summarizer refuses incomplete/error results and verifies fixture byte counts and SHA-256 hashes before emitting a report. Run without competing benchmark/test workloads. A benchmark readiness failure exits nonzero; missed performance comparison thresholds are recorded separately, not disguised as correctness failures.

Tools are under `tools/benchmark/`. Generated performance fixture is under `tests/fixtures/run-work/performance/`. No private user documents are used.

Evidence files under `tests/results/`:

- `step-11-performance.json`: raw final main measurements, environment and method.
- `step-11-summary.json` and `step-11-measurements.md`: comparisons and readable table.
- `step-11-concurrent.json`: five simultaneous documents and cleanup.
- `step-11-pdf-reliability.json`: ten additional fresh-PDF starts.
- `step-11-initial-script-block.json` and `step-11-initial-timeout.json`: retained unsuccessful attempts.
- `step-11-validation.json`: consolidated status and source hashes.

## Remaining work

REL-08 remains unchecked. Required further work includes classifying the intermittent startup timeout; continuous full-process-tree/private-memory sampling; large real-world DOCX/EPUB examples near their size limits; a genuine 100 MB PDF; installed-launch cold/warm measurements; broader browser and reference-machine repetitions; real sleep/background behavior; actual 200% zoom and screen-reader checks. Firefox still has the step-10 launch failure. The unsigned native launcher remains blocked separately from the working source viewer.

For personal use, no signing purchase is required to continue using the tested development setup. A paid signing service is a separate deployment choice; these tests do not make the blocked executable trusted.

Next milestone: personal-use readiness review, prioritizing the remaining startup reliability/browser gaps and clear instructions for the tested local workflow. Native packaging/default-file launching remains a separate unresolved deployment requirement.

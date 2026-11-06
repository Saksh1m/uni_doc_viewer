# Step 4 renderer and packaging decisions

Date: 2026-11-04  
Status: feasibility experiments complete. Selected libraries are ready for staged integration; this is not completion of the document-viewer features or release qualification.

## Outcome

All 31 final experiments passed in the isolated, packaged lab. The lab contains 30 input files, including five supplemental capacity/cache fixtures. The installed stage-3 application continues to support text files only; these experimental renderers have not been registered as Windows handlers.

The lab uses a private Node runtime, locally bundled browser assets, actual PDF/data/DOCX workers, and a fresh Chromium test profile. Attempts to load external resources were blocked and checked. Every final scenario recorded zero attempted external requests and zero unhandled browser errors.

## Selected libraries

| Purpose | Selected version | Reason and required integration behavior | Declared license |
|---|---|---|---|
| PDF | PDF.js 6.5.438 | Real worker, first-page rendering, text extraction, password retry and range requests passed; bundle worker, fonts, CMaps and WASM | Apache-2.0 |
| DOCX reading view | Mammoth 1.13.0 | Headings, lists, tables and embedded images passed; use a worker and binary image transfer | BSD-2-Clause |
| EPUB | EPUB.js 0.3.93 rebuilt with @xmldom/xmldom 0.9.12 | EPUB 2/3 navigation and conservative content isolation passed; rebuild from source and pin the override | BSD-2-Clause / XML parser MIT |
| XLSX values | SheetJS CE 0.20.3 from its official distribution | Dates in both systems, identifiers, cached values and 100,000 cells passed after explicit missing-cache normalization | Apache-2.0 |
| CSV/TSV | PapaParse 5.7.0 | Quoting, delimiters, literal identifiers/formula-like text and 100,000 rows passed; parse in a worker | MIT |
| Markdown | Marked 18.1.3 plus DOMPurify 3.4.17 | Required constructs and sanitization probes passed | MIT / DOMPurify offers Apache-2.0 or MPL-2.0 |
| ZIP handling used by document formats | JSZip 3.10.2 | Locally bundled; requires independent resource guards | MIT or GPL-3.0-or-later; choose MIT for this project |

SheetJS is pinned to the [official installation artifact](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), rather than assuming the npm registry package is current. Mammoth's reading-view and sanitization boundaries follow its [documented behavior](https://github.com/mwilliamson/mammoth.js/). EPUB scripted content stays disabled, consistent with the [EPUB.js warning](https://github.com/futurepress/epub.js/blob/master/README.md).

## Defects and design risks resolved in the experiment

1. **EPUB dependency advisories.** The initially installed default dependency tree had a high-severity XML-parser finding. The audit tool's suggested EPUB.js 0.4.2 version introduced a critical finding instead. We retained 0.3.93, pinned @xmldom/xmldom to 0.9.12, rebuilt EPUB.js from source, and ran the EPUB cases again. The final npm audit reported zero known vulnerabilities for this resolved tree. An audit is not proof of absence of vulnerabilities; the override requires continued compatibility testing.
2. **False spreadsheet zero.** SheetJS with `sheetStubs: true` represents a formula without a cached result as a stub containing `v: 0`. The adapter now recognizes the stub, exposes an unavailable result, and preserves real cached zero and empty-string results. A new fixture distinguishes these three cases. Stale-cache detection is not promised; saved values must be labeled as possibly stale.
3. **DOCX main-thread stalls.** The initial inline-image path paused the main thread for roughly 0.57 seconds on the image-heavy document. Moving conversion to a worker alone did not eliminate the pause. Transferring binary images and creating blob URLs avoided oversized base64 HTML attributes. The final measured maximum main-thread lag for that case was about 33 ms.
4. **Image display must be tested, not inferred.** A transfer experiment produced HTML image tags before the images could actually decode. Tests now inspect decoded image dimensions. The final DOCX tests verify that every rendered image has a positive natural width.
5. **Sandbox and blob compatibility.** The opaque-origin iframe could not use the generated blob images. The reading frame now permits same-origin access while denying scripts through both its sandbox and its own CSP. Sanitization and resource filtering remain mandatory. Never combine this setting with `allow-scripts`.
6. **EPUB input mode.** Binary input must use the binary opening path. Treating an ArrayBuffer as a URL caused stalled opening promises; the harness now awaits explicit binary opening.
7. **Security checks must distinguish text from executable markup.** The first Markdown assertion incorrectly rejected a harmless literal `javascript:` string. The corrected assertion checks active elements and URL attributes; the literal text can remain readable.

## Measured results

These are single-run renderer measurements on Windows 11 with approximately 8 GB RAM and 12 logical processors, using Chromium 156.0.8078.4. Timing starts after libraries are loaded and includes loading the fixture, parsing and first display. It excludes application/browser startup. It is not the release specification's ten-run performance qualification.

| Workload | Actual file size | First useful renderer output | Sampled browser + server private memory peak |
|---|---:|---:|---:|
| 500-page text PDF | 0.38 MB approximately | 249 ms | 202 MiB |
| Image-heavy PDF | 14.18 MB | 354 ms | 233 MiB |
| Image-heavy PDF | 132.31 MB | 579 ms | 361 MiB |
| Image-heavy DOCX | 11.35 MB | 6,528 ms | 257 MiB |
| Image-heavy EPUB | 21.37 MB | 722 ms | 286 MiB |
| XLSX with 100,000 populated cells | 0.34 MB | 628 ms | 253 MiB |
| CSV with 100,000 data rows and 10 columns | 22.00 MB | 454 ms | 272 MiB |

Memory samples were taken every 100 ms across the test-browser and lab-server process trees, including baseline/test overhead. They measure private committed bytes, not total physical memory or guaranteed instantaneous peaks. One sample encountered a process that could not be read during process churn; this is recorded in the raw results. Main-page JS heap measurements alone would omit worker and native memory and were not used as the total-memory claim.

The large PDFs issued HTTP range requests. Server statistics record bytes scheduled, not bytes received: an initial full-response request can be cancelled by PDF.js, so summing scheduled response sizes would overstate transfer. No reduced-transfer percentage is claimed.

The XLSX cancellation experiment terminates the worker after it signals parsing start. It demonstrates prompt termination in that workload; it is not proof of cancellation behavior at every parser phase.

## Fidelity boundaries

- PDF page canvas output, text extraction, last-page access and password retry passed. Full text-selection UI, printing and annotation handling still need integration tests.
- DOCX reading content passed, including merged-table content. The header marker was omitted, consistent with the explicitly limited reading-view promise. Exact pagination and complex Word layout are not supported by this choice.
- EPUB navigation passed for two chapters in EPUB 2 and 3. The experiment removes book styles and active/external resources; typography preservation and broader EPUB coverage remain later work.
- XLSX tests prove typed values and cache distinctions. They do not prove charts, recalculation or Excel-equivalent presentation.
- CSV tests use row callbacks and render sample rows only. A production virtualized grid, full search and scrolling are not implemented here.

## Packaging, licensing and limits

The lab is approximately 309 MB because it includes about 202 MB of test inputs and an 87 MB private runtime. The copied renderer vendor assets total about 19.6 MB. Production packaging should lazy-load only the selected renderer and should not contain the fixture corpus or the lab server.

The build records SHA-256 inventory entries and dependency license declarations/notices. Most notices are included. Some transitive npm packages lack a standalone notice file; the inventory exposes that gap, and full distribution-notice collection remains a release packaging task. Optional native/build-tool dependencies are not automatically part of the browser payload.

The proposed [resource policy](renderer-resource-policy.json) uses bounded file sizes, one heavy parse at a time, worker timeouts, and archive/image/cell limits. These values give a starting envelope supported by the experiments, not a universal safety guarantee. The lab currently enforces only worker timeouts and selected central-directory checks; actual decompression budgets, image/canvas limits and whole-file preallocation checks are required before production.

## Remaining evidence gaps

- The broader real-authoring-tool document corpus, unusual fonts/layouts, DRM/fixed-layout rejection and unsupported encryption examples.
- Full EPUBCheck validation. Java was not available on this host; the earlier structural checks and actual browser rendering passed, but neither replaces EPUBCheck.
- Ten-run cold/warm benchmarks, other supported browsers, a clean Windows machine, and simultaneous-file resource pressure.
- Production-grade archive validation and content isolation testing against more than the bounded synthetic probes.
- Full third-party notice collection and normal release vulnerability review.

These gaps do not prevent beginning step 5. They remain explicit integration/release gates; the experiment does not silently lower the first-release acceptance specification.

## Deliverables and next step

- [Experiment source and reproduction instructions](../experiments/renderers/README.md)
- [Final machine-readable results](../experiments/renderers/results/results.json)
- [Dependency lock](../experiments/renderers/package-lock.json)
- [Final dependency audit](../experiments/renderers/audit-final.json)
- [Proposed resource policy](renderer-resource-policy.json)

Next: step 5 implements the secure production file-session broker. Carry forward authenticated range delivery, explicit per-file authorization, safe snapshot/identity handling, resource guards, and the selected renderer constraints. Keep the disposable lab server out of the production application.

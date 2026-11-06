# Step 7 — renderer integration into the application

Version: 0.0.7. Date: 2026-11-05. Scope: integrate the first-release file families into the shared Windows prototype. This is not completion of the release acceptance checklist.

**Deployment status:** source and portable build are ready for review, but 0.0.7 was not installed. Windows Application Control blocked the final unsigned launcher during PowerShell's assembly-loading argument test (HRESULT 0x800711C7). Code Integrity events 3033 and 3077 report that it did not meet the signing-policy requirements. No policy changes, alternate execution route or installation attempt was used to work around the block. The installed version remains 0.0.6 and therefore remains text-only. Deployment needs a signing/trust route approved for this Windows environment.

## Delivered behavior

| Format | Implemented in the application | Deliberate limits |
| --- | --- | --- |
| TXT | Existing Unicode reading, wrap, browser search and print | 8 MiB |
| PDF | Real PDF.js worker, authenticated ranges, page navigation, fit/zoom, selectable text, search, password retry | Current-page printing only; no OCR or interactive annotations; 5,000 pages, 16 million canvas pixels, 24-megapixel embedded-image cap |
| PNG/JPEG/WebP | Display, zoom/fit, orientation and print | 24 megapixels; animation rejected |
| Markdown | Worker conversion and sanitized isolated reading view with search | Raw HTML sanitized; external links/resources disabled |
| DOCX | Worker conversion, embedded raster images, tables and reading-view search | Original pagination and complex layout are not reproduced; no document print control yet |
| EPUB 2/3 | Reading-order chapter selector with available TOC labels, previous/next, text size, current-chapter search and chapter-level refresh position | No book scripts/styles/external resources; fixed-layout/encrypted books rejected; no exact scroll position/full-book search/printing |
| CSV/TSV | Literal text cells, delimiter selection, bounded table window, row/column navigation and search | 100,000 data rows plus header, 1,024 columns, 1.1 million cells; printing visible rows only |
| XLSX | Sheet tabs via selector, formatted saved values, row/column navigation and search | No recalculation/charts/macros; 100,000 populated cells, explicit missing-cache values and stale-cache disclosure |

All renderer assets are pinned and shipped locally. The updated installer is prepared to offer 12 supported extensions through Open with while retaining selected defaults. Removal handles the new document ProgID as well as the existing text ProgID, and ownership checks precede installation mutations. These script changes passed syntax inspection but have not been applied to the installed application because of the signing-policy block.

## Why the implementation is ordered this way

1. **Keep the existing broker contract.** Adapters receive one file-scoped credential and cannot register paths through HTTP. This avoids separate file-access rules for each format.
2. **Validate containers before parsing.** The lab's declared expansion check was insufficient. A serialized Node worker now inflates bounded entries and compares actual sizes before the browser receives an admitted DOCX, EPUB or XLSX snapshot. Local/central headers, duplicate/traversal names, overlapping ranges and unsupported ZIP forms are checked. This is still not a complete adversarial archive/security certification.
3. **Separate rendering from lifecycle.** The shell owns cancellation, retry, session closure and cleanup; adapters register workers, PDF tasks, frames and object URLs for disposal. Native response deadlines accommodate the 30-second archive guard without prematurely killing other sessions.
4. **Integrate visual and document views before tables.** PDF establishes the worker/range contract, images establish raster bounds, isolated document views establish sanitization, and table views reuse the worker and cancellation path.
5. **Verify the package before enabling associations.** Tests exercise assets inside the built package, a bundled runtime with system Node absent from PATH, and real native IPC admission for the new formats. Native registration does not silently choose defaults.

## Changes from the renderer lab

- The EPUB adapter uses JSZip, browser XML parsing and a conservative script-free chapter view rather than shipping the lab's EPUB.js bundle. This keeps reading-order navigation while avoiding scripted rendition machinery and an extra XML-parser dependency. It deliberately gives up publisher styling and fixed-layout support; EPUB.js remains an experiment, not a shipped dependency.
- CSV and XLSX expose the complete admitted data through a bounded 100-row × 20-column window instead of the lab's sample-only rows. Row/column controls and active-sheet search reach data outside that window.
- Markdown, DOCX and table parsing use disposable browser workers. PDFs use the real PDF.js worker with local supporting assets. The PDF configuration follows the documented header/range/worker settings in the [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html).
- Raster headers are checked before decoding. Archive validation accounts for supported image signatures even when their entry names lack normal image extensions.
- Reading HTML is capped at 8 MiB and 100,000 markup openings, sanitized with DOMPurify and displayed in a frame with no script permission and a script-denying CSP. Book XML/chapter input is capped at 2 MiB with DOCTYPE/entity declarations rejected. External links/resources are disabled in reading views.

## Resource envelope

Input limits remain in `src/snapshot.cjs`. Archive validation permits at most 10,000 entries, 32 MiB actual expansion per entry and 256 MiB combined. It rejects ZIP64, multipart archives, encryption, unsafe/duplicate paths and inconsistent bounds. Supported embedded raster images share an 80-megapixel budget, with 24 megapixels per image. One archive-validation worker runs at a time, with a 30-second deadline.

Parser/loading and subsequent renderer operations also have a 30-second deadline. The current password form shares that deadline; retry starts a fresh load. The limits bound selected operations and allocations, not total browser/process memory. Concurrent-renderer peak memory and pathological parser behavior still require release qualification.

## Verification and defects caught

- The existing 17 broker/lifecycle groups plus two new archive/raster guard groups pass.
- The original five packaged-text and session-browser groups pass, preserving refresh, closure, Unicode and multi-tab behavior.
- Four renderer groups cover 23 opens: PDFs (including password, 500 pages, corrupt input and cancellation), four image fixtures, Word, Markdown/security probes, EPUB 2/3/security probes, CSV/TSV, both Excel date systems, large tables and formula-cache edge cases.
- Native IPC tests additionally admit PDF, image, Word, EPUB, Excel, Markdown and CSV through the same C# entry used by the launcher.
- That native IPC test passed on a preceding 0.0.7 build. The final rebuild subsequently encountered the Windows signing-policy block; final installed-product/native-launch verification is therefore outstanding. The earlier pass is not treated as a pass for the blocked final executable.
- Final packaged-runtime tests pass (2 groups), and the production dependency audit reports zero known vulnerabilities. Together with 19 broker/resource/lifecycle groups, 5 existing browser groups and 4 renderer groups, this gives 30 passing automated groups. These checks run the bundled Node/browser path; they do not override the blocked Windows launcher check.
- PDF and DOCX screenshots were visually inspected; text, controls, tables and embedded images displayed as intended.
- Tests check for attempted external requests and unhandled browser errors. Password cancellation also checks worker closure within two seconds, followed by a successful retry.

Testing found a Word image buffer that was not transferable, a cancellation error that overwrote the intended user message, and test-harness startup waits that could hang after an empty broker exited. These were corrected. A PDF test initially counted the text-layer measurement canvas as another displayed page; it now checks the actual page canvas.

## Still required before release

Full-document PDF printing; richer document warnings and final reading controls; broader real-world Word/EPUB/Excel fidelity; real browser/background/sleep and cross-account tests; clean-machine and default-browser UI qualification; ten-run startup/memory benchmarks; independent security review; final third-party notice review and signing. Table rendering is windowed rather than a continuous-scroll spreadsheet. PDF search selects a matching page, not individual highlighted matches. Chapter position is restored, not exact scroll position.

The immediate deployment prerequisite is approved signing/trust for the native executable, followed by installation/association and native-launch verification. Development can continue with completing and qualifying the reading experience and resource behavior against the release checklist. The first renderer integration itself is now in the application source and portable build rather than only in the laboratory.

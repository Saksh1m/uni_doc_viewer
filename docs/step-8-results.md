# Step 8 — reading controls and bounded print preparation

Date: 5 November 2026. Status: implemented and tested in source, not packaged or installed. The installed application remains 0.0.6; the existing 0.0.7 package remains the step-7 build. No Windows launcher rebuild, execution, installation or policy change was attempted.

## Why this order

1. Extend the shell's operation handling first. Printing needs asynchronous preparation, cancellation and recoverable validation errors. A rejected print range must leave the current document usable.
2. Add a shared print preview before format-specific printing. It gives one keyboard-accessible return path, predictable print CSS and cleanup for temporary image URLs. Preview content comes only from renderer-created images or an already sanitized document frame; document scripts remain disabled.
3. Add bounded PDF printing next. Validate the range and total raster pixel estimate before rendering, then render sequentially. This avoids creating hundreds of canvases at once. The user can print the whole document if it fits, or choose a smaller range.
4. Reuse the preview for Word/Markdown and the current EPUB chapter. These are reading views; original Office layout and complete-book printing are not promised.
5. Improve search, reading-position restoration and password waiting. These rely on the integrated renderers and their cleanup lifecycle established in steps 5–7.
6. Exercise failure cases and regressions before updating the handoff. Keep all development separate from the launcher blocked by Windows Application Control.

## Delivered

- PDF print-from/through controls and prepared preview. Limits: 200 pages, 64 million estimated raster pixels, 32 MiB encoded PNG images and the existing 30-second operation deadline. Rendering scale is 1.5; output is rasterized, excludes annotations and is subject to browser paper/margin settings. These budgets are not a total process-memory ceiling.
- Invalid or excessive print ranges show a useful status without disposing the reader. Cancel during preparation uses the existing cancel/retry lifecycle. Preview provides Print, Back to reading and Escape; returning revokes temporary image URLs and removes preview nodes.
- Word and Markdown reading-view printing; EPUB current-chapter printing. Untrusted frames retain their script-free sandbox. Images remain local blob resources.
- PDF search checks the current page on a new query, then advances between matching pages. Matching text-layer spans are highlighted, including spans intersecting a phrase. Enter activates search. Highlighting is span-level, not exact glyph-level; this is not OCR or match-by-match navigation within a page.
- EPUB saves chapter, text size and relative scroll position in tab sessionStorage, restores on refresh/font changes and removes position on explicit session closure. Old numeric chapter entries are migrated. This is not persistent reading history or an exact semantic bookmark.
- Password entry pauses the loading deadline; submitting resumes it. Existing session expiry still applies. Cancelling remains available.
- DOCX conversion warnings now expose up to 20 messages of 500 characters each, rendered as plain text. Narrow toolbar wrapping and select focus indication improved.

## Verification

- `npm test`: 19 broker, lifecycle and resource-guard groups passed.
- `npm run test:reading`: 6 groups passed, including the four existing renderer regression groups and two new step-8 groups. This executes current source with the existing bundled Node runtime and isolated headless Chromium, without invoking the Windows launcher.
- `npm run test:browser`: 5 groups passed (two existing packaged text groups and three source session-browser groups).
- After the final preview cleanup change, both new step-8 groups passed again.
- New cases: current-page search highlight and Enter; invalid range and page/pixel-budget rejection followed by successful navigation; three-page PDF preview; print invocation intercepted rather than sending a physical print job; sanitized Word/Markdown/EPUB print content; Escape return; long EPUB font/scroll restoration and closure cleanup; keyboard search and 600-pixel viewport overflow check; password wait simulated for 35 seconds.
- Chromium printed the three-page preview to `tests/results/step-8-print.pdf`; pypdf verified exactly three output pages. `tests/results/step-8-print-preview.png` was visually reviewed.
- Existing cancellation, corrupt file, authenticated ranges, external-request blocking and script-free-frame checks passed in the source renderer suite.

## Review findings and remaining work

- An initial implementation shared the parser timeout with human password entry. Pausing it while the password form is active fixes that failure without removing cancellation or session expiry.
- Printing all PDF pages without a budget would be a memory risk. Explicit bounded ranges and sequential canvases address that; encoded-image rejection is checked during preparation. The 32 MiB edge and cancellation during raster preparation still need dedicated stress qualification.
- Cloning an iframe element would retain its viewport clipping. Printing clones its already sanitized body content into a separate surface instead. PDF pages are raster images, so printed PDF text is not selectable.
- Preview cleanup now removes retained image nodes as well as revoking URLs. Current document data remains available for returning to reading.
- A 600-pixel viewport check is not actual 200% browser zoom. Full keyboard/screen-reader review, actual browser zoom, real print dialogs/printers, mixed page sizes and Edge/Firefox qualification remain outstanding.
- PDF highlights reset on page/zoom re-render; search again restores them. PDF search remains page-oriented, and unusual PDF text ordering can affect phrase matching.
- Native signing/trust, installation/upgrade, real sleep/background behavior, clean-machine tests, performance/memory measurements and the release acceptance checklist remain prerequisites for release.

## Files

Implementation: `src/web/viewer.js`, `render-print.mjs`, `render-pdf.mjs`, `render-document.mjs`, `parse-worker.js`, `style.css`.

Verification: `tests/renderers.test.cjs`, `tools/test-reading.cjs`, `tests/results/step-8-validation.json`.

Project status: `PROJECT_STATUS.md`, with matching Desktop copy at `C:\Users\ADMIN\Desktop\Universal File Viewer Status.md`.

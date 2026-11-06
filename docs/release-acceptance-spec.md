# Universal File Viewer — first release acceptance specification

Version: 0.1 draft baseline  
Date: 2026-11-04  
Status: Original step-1 acceptance baseline. Implementation has since progressed through step 12 (personal-use source workflow; partial release qualification); see PROJECT_STATUS.md for current evidence. The release-level checklist below remains unqualified.

This document defines the proposed first release. Decisions below are working defaults, not claims that the user has approved every detail. Changes must update the corresponding acceptance criteria before implementation expands scope.

## 1. Product promise

On a supported Windows computer without Node.js or Microsoft Office installed, a user can install the application, choose it through Windows “Open with,” and read a supported local file in their default browser without uploading its contents.

The application is a read-only viewer. It does not modify the original document, execute document macros, or promise exact Microsoft Office layout reproduction.

The primary user wants to read a downloaded or received document quickly without installing a separate application for each format.

## 2. Platform and installation boundary

| Item | First-release baseline | Reason |
|---|---|---|
| Operating system | Windows 11 x64; record the exact tested build in the release report | One platform and architecture keeps installation behavior testable |
| Browsers | Stable Microsoft Edge, Google Chrome, and Firefox; record exact versions at release qualification | Tests the default-browser promise across different browser implementations |
| Installation | Per-user installer; administrator privileges should not be required for normal installation or viewing | Matches a personal desktop utility |
| Runtime | Ship the required runtime and all rendering assets | No developer tooling or network bootstrap should be necessary |
| Launch | Windows Explorer “Open with,” command-line file argument, and reopening a file through the app's Windows entry point | Exercises the actual product entry points |
| Default associations | Register supported extensions as available handlers; user chooses defaults through Windows | Preserve user control and existing associations |
| Network | Core viewing works with internet access disabled | Offline viewing is part of the product promise |
| Background operation | Start on demand, no terminal window, exit after sessions become idle | Avoid a permanently running service |

Opening the app without a file must show an understandable file-selection entry point or instructions, rather than an empty or broken page. The exact implementation is deferred.

WhatsApp support means files handed to this application by Windows can be viewed. Intercepting WhatsApp's internal previews or every attachment click is not a release requirement.

Windows ARM, Windows 10, macOS, Linux, mobile, browser extensions, and managed enterprise deployment are outside this release's tested support boundary.

## 3. Format contract

All formats must expose the filename, a loading state, a readable failure state, and a way to retry or reopen. Availability of other controls follows the table; unsupported controls must not appear functional.

| Format | Required behavior | Explicit limits |
|---|---|---|
| PDF | Page navigation, zoom/fit width, selectable text and search when a text layer exists, printing, password prompt for supported encrypted PDFs | No OCR, editing, digital-signature validation, or promise to support every encryption scheme |
| JPEG, PNG, WebP | Display, zoom, fit, correct orientation where metadata is supported | No editing, animation guarantee, or color-critical proofing |
| TXT | UTF-8 including BOM, UTF-16 LE/BE with BOM, scrolling, wrapping toggle, text search | Unknown/invalid encodings produce a warning; no silent claim of correct decoding |
| Markdown (.md) | Headings, lists, emphasis, links, code blocks, basic tables, text search | Raw HTML disabled or sanitized; no arbitrary local-resource loading |
| DOCX | Reading view for paragraphs, headings, lists, embedded images, and basic tables; text search | No exact pagination, tracked-change review, macros, or guaranteed handling of floating objects and complex layouts |
| EPUB | DRM-free reflowable EPUB 2/3 reading, table of contents, chapter navigation, font-size controls, session reading position | No DRM, document scripts, fixed-layout fidelity guarantee, or global book search requirement |
| CSV/TSV | Tabular display, row/column navigation, literal text search, delimiter override for CSV, virtualized rows | No editing; uncertain encoding/delimiter must be surfaced; strings beginning with '=' remain data |
| XLSX | Sheet tabs, cell values, basic number/date display, row/column navigation, text search within the active sheet | No formula recalculation, charts, macros, exact Excel styling, or external-link refresh |

For XLSX, use cached formula results when available and disclose that they may be stale. When absent, visibly indicate that no calculated value is available; do not invent zero or an empty calculated result. Preserve identifiers and text cells without coercing them into numbers. Handle workbook date-system metadata.

External links require an explicit user action and must not replace the viewer unexpectedly. External document images, styles, fonts, and other resources are blocked by default. Embedded supported resources can render. Relative references must not grant access to neighboring filesystem files.

Deferred formats/features: legacy .doc/.xls, RTF, SVG, audio/video, ZIP exploration, PSD, 3D, annotations, editing, export/conversion, cloud storage, synchronization, and persistent reading history. Unsupported files receive an explanation rather than an empty viewer.

## 4. Observable session behavior

| Event | Required outcome |
|---|---|
| Open one supported file | Default browser opens a viewer and shows useful content |
| Open five different files in quick succession | Each receives the correct document/session; no file overwrites another session |
| Open the same file twice | Two usable viewing sessions are acceptable; deduplication is optional |
| Refresh an active viewer | File reloads without another Windows launch or reuse of the bootstrap token |
| Leave a tab in the background for 30 minutes while the computer stays awake | Returning to it preserves or transparently restores usable viewing |
| Computer sleeps or broker/browser crashes | Resume succeeds where possible; otherwise show actionable reopen instructions without displaying the wrong document |
| Close all viewing tabs | Broker exits within five minutes after its final active session expires; the test must verify exit without assuming unload events are reliable |
| Session expires while a page remains visible | Explain expiration and how to reopen; never silently return unrelated content |
| Original file is removed or becomes unreadable | Already loaded content may remain; new reads show a specific error |
| Original file changes while open | Never silently combine old and new bytes; detect the change and ask the user to reopen, or continue a consistent snapshot |
| Default browser cannot be launched | Provide a useful desktop-visible error and a retry/recovery path without exposing credentials |
| App is already the default handler | Any fallback instructions must avoid a recursive “open in default app” loop |

The lifecycle mechanism is deferred to implementation. The background-tab and cleanup requirements must both pass; a heartbeat design that meets only one is insufficient.

## 5. Privacy and security acceptance requirements

- Bind the file-serving listener to loopback only. Reject unexpected Host headers and unauthorized requests; do not rely on CORS as authentication.
- Serve only explicitly opened files. Provide no unauthenticated directory listing or arbitrary-path file-read endpoint.
- Use a short-lived, single-use bootstrap credential, followed by file-scoped session authorization. Active refresh and repeated/range reads must remain possible.
- Keep source paths out of viewer URLs. Remove bootstrap credentials from the visible URL after exchange and exclude credentials/document contents from application logs.
- A credential for file A cannot read file B. Separate ports alone do not establish authentication isolation.
- Document content cannot execute scripts in the trusted app context, read its credentials, or request unrelated files. Sanitize converted content and isolate it from application controls.
- Do not execute macros, spreadsheet formulas, or document-supplied commands. Do not use shell interpolation for file paths.
- Bundle dependencies locally. Loading a supported document triggers no application-originated internet requests, analytics, or external-resource retrieval. Explicit user navigation to an external link is the exception.
- Do not persist document copies or reading history by default. If temporary data is necessary, restrict access and clean it on normal exit and a later startup after a crash. Do not promise secure physical erasure.
- Bound parser time, decompressed bytes, and memory-related work. A small compressed file must not bypass resource safeguards.
- Treat filenames and document metadata as untrusted text in the interface.

Privacy scope: the application controls its own requests and storage. Browser history, browser extensions, operating-system caches, and device administrators are outside that guarantee. This is not a sandbox against an attacker already controlling the user's account.

## 6. Performance and capacity targets

These are proposed acceptance targets, not measured performance claims. Step 4 experiments may revise them with recorded evidence before release promises are finalized.

Reference machine: Windows 11 x64, four logical CPU cores, 8 GB RAM, SSD, no Node.js/Office installation. Record the actual CPU, OS build, browser version, and test conditions. Use non-pathological fixtures within the stated limits; adversarial inputs have separate rejection tests.

| Measurement | Target |
|---|---|
| Cold opening a 1 MB text file or 10 MB ordinary PDF, including browser startup | Useful readable content within 5 seconds in at least 9 of 10 runs |
| Warm opening the same fixtures with browser and broker running | Useful content within 2 seconds in at least 9 of 10 runs |
| DOCX up to 10 MB, EPUB up to 20 MB, or XLSX up to 10 MB/100,000 populated cells | Useful content within 10 seconds in at least 9 of 10 runs |
| Large-file validation fixtures | 100 MB/500-page text PDF; 20 MB/100,000-row/10-column CSV; 24-megapixel image |
| Interaction after loading | Navigation/search controls provide visible feedback within 200 ms; long work shows progress and can be cancelled |
| Cancellation | Stop parser work and recover a usable viewer within 2 seconds |
| Combined incremental memory for one ordinary acceptance fixture | At most 1 GB across broker and attributable browser work; document measurement method and browser baseline |
| Close/reopen stress | Twenty sequential open/close cycles show no sustained accumulation of sessions, handles, or document memory after cleanup |

File byte size is not a sufficient safety limit. Step 4 must establish format-specific limits on decoded images, expanded archives, workbook cells, and parsing time. Files above the implemented envelope must receive a clear limit message without destabilizing the application. A compressed or pathological file need not meet rendering-time targets, but it must fail safely.

## 7. Release acceptance checklist

Every unchecked item below is future verification work, not a completed result.

- [ ] REL-01: Fresh standard-user installation works without Node.js, Office, or an internet connection once the installer is available.
- [ ] REL-02: “Open with” registration, default-browser launch, spaces/Unicode in paths, and launching without a file work.
- [ ] REL-03: Every required format behavior passes its representative fixtures; rendering limitations are visible in the product/help.
- [ ] REL-04: Session behavior in section 4 passes, including refresh, concurrent files, background tabs, cleanup, and recovery.
- [ ] REL-05: Missing, expired, replayed-bootstrap, and wrong-file credentials fail to retrieve documents.
- [ ] REL-06: Host/origin checks, document isolation, external-resource blocking, and resource-exhaustion tests pass.
- [ ] REL-07: Core viewing works offline; a network inspection finds no unexpected application-originated external traffic.
- [ ] REL-08: Performance targets pass or are revised explicitly with evidence before release qualification.
- [ ] REL-09: Corrupt, unsupported, encrypted, missing, changed, and oversized files produce specific recovery guidance.
- [ ] REL-10: Core controls are keyboard accessible, focus is visible, controls have accessible names, and the shell remains usable at 200% browser zoom.
- [ ] REL-11: Exact supported browser versions pass the installed-product tests; file associations are verified on the recorded Windows build.
- [ ] REL-12: Signed distribution is verified on a clean machine; signing does not imply that Windows reputation warnings can never appear.
- [ ] REL-13: Upgrade and uninstall preserve originals and unrelated settings, remove the app's registrations, and do not leave broken default-handler commands.
- [ ] REL-14: Dependency licenses/notices are included; known applicable critical/high security findings are resolved or the affected component is excluded.
- [ ] REL-15: Manual update/reinstall instructions, limitations, version information, and a privacy description are included.

Release blockers: unauthorized file access, modification of original files, silent material misrepresentation of content, application crashes in required workflows, unusable installation, or failure of a required checklist item. Cosmetic defects may remain only if documented and they do not prevent required use.

## 8. Decisions, assumptions, and deferred choices

| Decision | Current disposition | When to settle |
|---|---|---|
| Windows-only first release | Working scope default | Before expanding platform work |
| Read-only, offline-first, no account | Working product baseline | Before implementation changes this promise |
| DOCX reading view and XLSX cached-value display | Deliberate fidelity boundary | Validate with step 4 examples |
| Runtime packaging, HTTP framework, IPC, and session mechanism | Not selected by this specification | Steps 3–6, based on experiments |
| Precise resource limits | Provisional targets above | Step 4 measurements; enforce before public release |
| Publisher identity/signing certificate | External release dependency; not needed to begin development | Identify during packaging experiment, obtain before distribution |
| Product name, icon, and visual branding | Placeholder name is sufficient for development | Before installer/release polish |
| Automatic updates | Deferred; manual installation of a verified new release | Separate security/design work if introduced |

No user response is required to begin the next authorized development step using these defaults. Material changes to scope or costs should be made explicit rather than silently assumed.

## 9. Sequence review and handoff

Review pass 1 — completeness: defined the platforms, formats, entry points, failure behavior, and a finite release checklist so “ready” is observable.

Review pass 2 — contradictions: separated one-time entry credentials from reusable viewing authorization; required both background-tab survival and idle cleanup; prevented cached spreadsheet values from being presented as recalculated results.

Review pass 3 — testability: distinguished proposed performance targets from measurements, limited the offline guarantee to application behavior, and surfaced signing and resource-limit dependencies.

Remaining uncertainty is empirical: renderer fidelity, packaged dependency behavior, resource ceilings, and browser/session behavior require the later experiments. This specification does not claim those uncertainties are resolved.

Next step: create a representative, non-sensitive fixture collection and a trust-boundary map. Link each fixture/test to the REL identifiers above. Do not expand the format list or start a polished UI before the packaged launch and renderer experiments establish feasibility.

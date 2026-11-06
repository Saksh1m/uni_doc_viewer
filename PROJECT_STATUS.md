# Universal File Viewer — completed work and remaining work

Updated: 6 November 2026  
Current installed version: **0.0.6**  
Current packaged build: **0.0.7 (step 7)**  
Current development source: **step 12 personal-use command and startup recovery on 0.0.7; not packaged or installed**  
Current stage: **Steps 1–12 development work delivered; browser and performance qualification remain partial and deployment is blocked by Windows signing policy. The full application is not ready for release.**

## 1. What works today

**For personal use now:** the current source viewer can be started with the existing bundled Node runtime using `tools/view-local.cjs`. It prints a one-time address to open manually in Chrome or Edge. Full instructions are in `PERSONAL_USE.md`, also copied to `C:\Users\ADMIN\Desktop\Universal File Viewer - How to Open Files.md`. This requires no signing purchase and does not invoke the blocked executable. Each command starts a separate one-file source session.


The installed prototype opens local **`.txt` files only** in the Windows default browser. It includes its own Node.js runtime, so the user does not need a separate Node.js installation.

You can select a text file, read it, search with the browser's Ctrl+F, wrap lines, print, refresh, and end the viewing session. UTF-8 and BOM-marked UTF-16 text are supported up to 8 MiB.

Several file launches share one background broker for the same installation and Windows login session. Each file has separate authorization and a consistent read-only snapshot. Reading does not modify the original file. The app registers as an available Windows “Open with” handler; it has not changed your default associations.

**The installed 0.0.6 viewer remains text-only.** Step 7 integrated PDF, Word, EPUB, spreadsheets, Markdown and PNG/JPEG/WebP into the 0.0.7 source and portable build. Its bundled-runtime/browser tests pass, but Windows Application Control blocked the final unsigned launcher check (0x800711C7; Code Integrity events 3033/3077). Installation was not attempted. An approved signing/trust route and final installed-product verification are required; security policy was not changed or bypassed.

## 2. Exactly where the files are on your computer

The source code is on your computer, inside the Codex project workspace. It is **not currently stored in the Windows Desktop folder**.

### This status document

Main copy alongside the source code:

```text
C:\Users\ADMIN\.codex\.chatgpt-projects\g-p-6926bd6755588191ad3f6e6949edf482\universal-file-viewer\PROJECT_STATUS.md
```

Convenience copy on your Windows Desktop:

```text
C:\Users\ADMIN\Desktop\Universal File Viewer Status.md
```

The Desktop copy is a snapshot of this report, not an automatically synchronized file.

### Complete source-code project

```text
C:\Users\ADMIN\.codex\.chatgpt-projects\g-p-6926bd6755588191ad3f6e6949edf482\universal-file-viewer
```

Paste that entire path into the File Explorer address bar and press Enter. Open this folder in your code editor to continue development. The `.codex` directory may be hidden in normal folder browsing; pasting the full path avoids that problem.

### Installed application

```text
C:\Users\ADMIN\AppData\Local\Programs\UniversalFileViewer-Prototype\UniversalFileViewer.exe
```

This is the executable to run. The installed directory contains the application and its runtime; use the source-code project above for development.

### Built application and portable package

Built executable:

```text
C:\Users\ADMIN\.codex\.chatgpt-projects\g-p-6926bd6755588191ad3f6e6949edf482\universal-file-viewer\dist\UniversalFileViewer\UniversalFileViewer.exe
```

Portable ZIP:

```text
C:\Users\ADMIN\.codex\.chatgpt-projects\g-p-6926bd6755588191ad3f6e6949edf482\universal-file-viewer\dist\UniversalFileViewer-0.0.7-win-x64.zip
```

Keep the `app` and `runtime` folders beside the executable. Copying only the `.exe` will not create a working installation. This ZIP is an unsigned development prototype, not a signed public release.

## 3. What has been completed

These step numbers refer to the development sequence followed in this project, which became more detailed than the original seven-phase concept. Step 7 is complete as renderer integration in source/build, not as a successful installation of that build.

| Step | Completed work | What that completion means |
| --- | --- | --- |
| 1 — Define the first release | Windows-first scope, format expectations, privacy requirements, session behavior, performance targets and 15 release acceptance checks | We have a written definition of “ready.” The checks are not all passed. |
| 2 — Build test material and map risks | Synthetic fixtures, verification scripts, security boundaries and test scenarios | Repeatable test inputs exist without relying on private user documents. |
| 3 — Prove packaged Windows launching | Native GUI launcher, bundled Node runtime, text viewer, per-user installation and removal, “Open with” registration | A runnable Windows prototype exists. Signing and clean-machine qualification remain outstanding. |
| 4 — Evaluate document renderers | Separate PDF, DOCX, EPUB, Markdown and spreadsheet experiments; library selection and resource-policy work | 31 final lab experiments passed. Renderer integration was subsequently completed in step 7. |
| 5 — Implement protected file sessions | Loopback-only HTTP broker, single-use entry tokens, file-specific credentials, authenticated byte ranges, immutable snapshots, size/session limits and explicit closure | The application has a tested file-access foundation. This is not an independent security certification. |
| 6 — Share the broker and handle its lifecycle | Protected Windows named-pipe control channel, one shared runtime, concurrent launch handling, expiry, connection recovery, crash recovery and cleanup | Native launch and lifecycle tests pass. Real sleep and full supported-browser qualification remain unfinished. |
| 7 — Integrate renderers | PDF/image controls, sanitized Word/Markdown/EPUB reading views, windowed CSV/Excel tables, parser cancellation and actual archive-expansion guards | Integrated 0.0.7 build passes Node/browser tests. Final Windows launcher verification and installation are blocked by signing policy. |

| 8 — Improve the reading experience | Bounded PDF range print previews, Word/Markdown and EPUB chapter printing, PDF search highlights, EPUB scroll/font restoration, password-wait handling and conversion warning details | Source tested in isolated Chromium. No native rebuild, package update or installation; full accessibility/browser qualification remains. |

| 9 — Harden document handling | ZIP integrity/header/descriptor checks, alternate-path rejection, XML declaration restrictions, print CSS isolation and abort-aware print encoding | Adversarial source tests plus renderer regressions; not an independent security certification or installed-product qualification. |

| 10 — Browser, keyboard and recovery qualification | Skip link, focus/busy states, cancellation/retry race fix, cached-page renderer reload, spreadsheet keyboard/search fixes, reusable browser matrix | Chrome 156.0.8078.80 and Edge 156.0.4314.58 source checks pass. Firefox could not launch; screen readers, actual 200% zoom and real sleep remain unverified. |

| 11 — Measure source performance and memory | Repeatable fresh/reused-process benchmarks, synthetic ~10 MB PDF, sampled process memory, 20 closure cycles and five simultaneous documents | 135 opens completed across final workloads; counters returned to zero. Earlier intermittent PDF startup timeout remains unclassified; continuous peak memory and installed performance are not qualified. |

| 12 — Personal-use readiness and startup recovery | Manual local-view command and Desktop guide; reproduced and fixed a stalled-renderer import deadline/cancellation hang; generic reopen guidance | 48 regression groups passed. Personal source workflow tested with text/PDF, Unicode paths, refresh and cleanup. Historical timeout cause is not proven; native and broader release qualification remain incomplete. |

### Current lifecycle behavior

- A bootstrap URL expires after 60 seconds if it is not used.
- An authenticated session expires after 45 minutes without activity, or eight hours in total.
- Visible pages send a heartbeat. The idle lease allows a 30-minute background interval even without heartbeats.
- Up to eight pending/open file sessions share a broker. The snapshot-buffer budget is 256 MiB; this is not a ceiling on all application/browser memory.
- End viewing session clears the local view and revokes the server session when reachable.
- After the final session ends, the broker and host normally stop after about five seconds.
- Closing tabs without explicitly ending sessions can retain the broker until the idle lease expires.
- A temporary connection failure preserves loaded text and offers recovery instructions. After a broker crash, reopening the original through Windows starts a fresh snapshot.

### Verification already performed

| Verification | Recorded result |
| --- | --- |
| Broker, lifecycle and resource guards | 19 test groups passed |
| Browser tests in isolated test browsers | 5 test groups passed |
| Package tests | 2 test groups passed |
| Native argument/path transport | Four cases passed at step 6. Final step-7 check was blocked by Windows Application Control. |
| Native shared-broker integration | Earlier 0.0.7 build passed, including admission of new formats. Final rebuilt launcher is blocked; its native deployment check remains outstanding. |
| Integrated renderer tests | 4 groups covering 23 file opens passed: PDFs/passwords/ranges/cancellation, images/orientation, reading views, large tables and formula-cache edge cases |
| Installed 0.0.6 build | All 14 packaged-file hashes matched; two launches shared one broker, correct contents were read, and final closure stopped it |
| Renderer lab | 31 final experiments passed separately from the installed app |

The 31-minute no-heartbeat check advanced the test clock. It was **not** a real 31-minute background-browser or computer-sleep test. Native host/runtime crash tests did terminate real test processes.

## 4. Where the important code is

All paths in this table are relative to the complete source-code project folder listed above.

| Location | Purpose |
| --- | --- |
| `src/broker.cjs` | HTTP authorization, file sessions, metadata, range reads and expiry |
| `src/snapshot.cjs` | Read-only file snapshots, format checks and file-size limits |
| `src/managed.cjs` | Private control channel between the Windows host and Node broker |
| `src/server.cjs` | Standalone text-viewer entry used by development/package tests |
| `src/web/index.html` | Viewer page structure |
| `src/web/style.css` | Viewer appearance |
| `src/web/viewer.js` | Format routing, credentials, cancellation, controls and connection recovery |
| `src/web/render-*.mjs`, `src/web/parse-worker.js` | PDF, images, isolated reading views and windowed tables |
| `src/archive-check.cjs`, `src/image-info.cjs` | Actual archive expansion and raster dimension guards |
| `tools/build-renderers.cjs` | Bundle pinned renderer assets and dependency notices |
| `windows/Launcher.cs` | Windows file picker, file-opening entry point and default-browser launch |
| `windows/BrokerHost.cs` | Shared native host, named pipes, permissions and process ownership |
| `windows/Launcher.exe.config`, `windows/app.manifest` | Windows/.NET runtime and long-path settings |
| `tools/` | Build, installation, removal and fixture utilities |
| `tests/` | Automated broker, browser, package, IPC and lifecycle checks |
| `tests/fixtures/` | Fixture generation instructions and generated test documents |
| `tests/results/` | Local test summaries and other generated evidence |
| `experiments/renderers/` | Separate renderer feasibility lab; not the installed viewer |
| `docs/` | Acceptance specification, design rationale and step-by-step results |
| `dist/` | Generated application folders and portable ZIPs |

Do not edit the parent project's `sources/` folder: it contains synced read-only reference material. Application development belongs in `universal-file-viewer`.

## 5. What still needs to be done, in order

The following is the recommended continuation, not a claim that these features already exist.

### A. Resolve the deployment prerequisite and verify integration

The first renderer integration is implemented in 0.0.7. Do not repeat it from scratch. Obtain an approved signing/trust route for the Windows launcher, then rerun native launch checks, install/upgrade verification and supported-extension association tests. The installed 0.0.6 app has deliberately been preserved.

Step 8 adds source-only reading improvements described in `docs/step-8-results.md`. The portable 0.0.7 package still reflects step 7. EPUB remains limited to reflowable unencrypted books; table printing still covers visible rows and navigation uses a 100-row by 20-column window. External links/resources remain disabled.

### B. Qualify the shared reading interface

Implemented: print preview with bounded PDF ranges, sanitized document/chapter printing, PDF matching-span highlighting and Enter search, EPUB chapter/font/relative-scroll restoration within a session, password-wait deadline handling, and expandable DOCX conversion warnings. Tests cover keyboard activation, preview dismissal, a narrow viewport, restoration and print-budget rejection.

Step 10 adds skip navigation, reading-region focus, announced busy state, focus recovery after cancellation and session closure, spreadsheet Enter search and captions. Chrome/Edge automated checks pass. Still required: actual 200% browser zoom, screen-reader review, full keyboard/focus audit, real printer/dialog testing across Edge/Chrome/Firefox, complex document pagination, mixed PDF page sizes and broader fidelity. EPUB position is session-scoped relative scroll, not a permanent cross-device bookmark. PDF print output is rasterized and annotations are excluded.

### C. Expand document-hardening qualification

Step 9 adds archive CRC/header/descriptor checks, rejects conflicting alternate ZIP paths and unsupported XML declarations, removes document CSS classes from sanitized print content, and makes print encoding cancellation recover promptly. Five new resource test groups and two new browser groups cover the changes. See `docs/step-9-results.md`.

Remaining: expand beyond synthetic fixtures, complete EPUBCheck validation, broaden malformed-input/fuzz testing, measure memory across repeated large-document operations and qualify the 32 MiB print encoding limit. Current safeguards are not a total-memory bound or independent security certification.

This comes before release because a small compressed document can consume far more resources than its file size suggests.

### D. Complete Windows and browser qualification

Step 10 tested source in isolated headless Chrome 156.0.8078.80 and Edge 156.0.4314.58. Playwright Firefox failed to launch with `spawn UNKNOWN`; its behavior is unverified. Simulated persisted page transitions exercise a renderer reload fix; they do not prove real sleep or back/forward caching. See `docs/step-10-results.md`.

Still test the installed application in supported Edge, Chrome and Firefox versions, with real default-browser launching and Windows “Open with.” Include five rapid file launches, repeated refresh, real 30-minute background periods, sleep/hibernate, browser discard/crash, another Windows account, and browser-launch failure.

Also test installation on a clean Windows machine without Node.js or Office, offline use, upgrade/removal, long and Unicode paths, and preservation of existing file associations.

These checks validate the desktop workflow that isolated browser and native-method tests cannot fully prove.

### E. Measure full-application performance and memory

Step 11 delivered repeatable source measurements. Final medians: 1 MB text 0.769 s fresh / 0.333 s reused; ~10 MB PDF 1.875 s fresh / 1.512 s reused. Twenty closure cycles returned broker reservations to zero; a five-document concurrent check passed. Highest single-document ready-state working-set sample was 568 MiB; this is not a continuous peak or total-memory guarantee. See `docs/step-11-results.md` and `tests/results/step-11-measurements.md`.

Step 12 reproduced and fixed a stalled renderer-import hang. That mechanism is not proven to be the cause of the earlier unclassified timeout. Still required: investigate any recurrence with the improved diagnostics, measure full process-tree/private-memory peaks, use representative near-limit Office/EPUB files and a genuine 100 MB PDF, and repeat on the reference machine through the installed launcher. REL-08 is not complete.

### F. Prepare a distributable release

Complete third-party notices and dependency review, resolve applicable serious vulnerabilities, obtain the publisher identity/signing arrangements, sign and verify the distribution, and finalize installation, update, removal and privacy instructions.

Signing may require a certificate or external publisher setup; it has not been obtained as part of this development work.

### G. Run the release checklist and fix blockers

Use `docs/release-acceptance-spec.md` as the release gate. Its 15 acceptance items remain unchecked as complete release-level claims. Do not label the application ready for public release until required formats, security, lifecycle, usability, performance and deployment checks have recorded passing evidence.

## 6. Features outside the current first-release scope

macOS, Linux and mobile versions; legacy `.doc`/`.xls`; RTF; SVG; audio/video; ZIP browsing; PSD and 3D viewing; editing; annotations; cloud sync; persistent reading history; and automatic updates are deferred.

The first release is a Windows read-only viewer. It does not promise to intercept WhatsApp's internal previews; files that Windows hands to the registered application are the supported integration route.

## 7. Starting the application and continuing development

To use the latest source features, follow `PERSONAL_USE.md` or the matching Desktop quick-start guide. It uses the existing local Node runtime and a manually opened browser address. To use the old installed app, run the installed executable listed in section 2 and choose a `.txt` file; that remains the 0.0.6 text-only workflow.

To work on the code, open PowerShell in the source project folder. The existing development machine has the required tools. A new development machine needs Windows x64, compatible Node 22, the .NET Framework C# compiler, test dependencies and generated fixtures; see the project README and fixture guide.

The following source checks avoid rebuilding or invoking the blocked launcher:

```powershell
npm test
npm run test:reading
npm run test:browser
npm run test:readiness
node tools/test-qualification.cjs chrome msedge
```

`test:reading` uses the existing bundled Node runtime and current source assets in isolated Chromium. It does not modify the installed app or packaged executable. Native build/install/IPC checks must wait for the approved signing/trust prerequisite. A fresh checkout also needs local renderer assets (`node tools/build-renderers.cjs`), test fixtures and Playwright Chromium installed.

Stop if any command fails and resolve the failure before treating the build as verified. The renderer lab has its own reproduction instructions in `experiments/renderers/README.md`.

Useful documents inside the source folder:

- `docs/release-acceptance-spec.md` — definition of a ready first release.
- `docs/step-4-results.md` — renderer choices, experiments and remaining gaps.
- `docs/step-5-results.md` — file-broker implementation and tests.
- `docs/step-6-results.md` — shared-host and lifecycle results.
- `PERSONAL_USE.md` — exact commands for using the latest source viewer on this computer.
- `docs/step-12-results.md` — personal-use workflow, startup hang fix, tests and remaining readiness limits.
- `docs/step-11-results.md` — repeatable performance/memory tooling, measured results, failed attempts and remaining gates.
- `docs/step-10-results.md` — Chrome/Edge qualification, keyboard/recovery fixes, Firefox launch failure and remaining manual checks.
- `docs/step-9-results.md` — archive hardening, adversarial tests, cancellation fixes and remaining qualification.
- `docs/step-8-results.md` — reading improvements, design tradeoffs, source-only test evidence and remaining checks.
- `docs/step-7-results.md` — integrated renderer behavior, test evidence, limits and signing-policy block.
- `docs/session-lifecycle.md` — design rationale, review passes and tradeoffs.
- `docs/broker-protocol.md` — current API and resource policy.

**Step 12 delivers a tested personal-use source workflow and startup recovery fix. Try files using the Desktop quick-start guide. The native launcher and full release qualification remain separate unresolved work.**

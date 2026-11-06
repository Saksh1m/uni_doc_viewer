# Step 10 — browser, keyboard and lifecycle qualification

Date: 5 November 2026. Status: development fixes implemented; qualification is partial. Source-only changes on 0.0.7. Installed version remains 0.0.6; the portable 0.0.7 package still contains step 7. No launcher rebuild, installation, default-association change or security-policy change was performed.

## Why this sequence

1. Read the step-9 handoff and inspect focus, loading and lifecycle behavior. Broader browser testing should exercise a known set of required workflows, not merely whether the landing page loads.
2. Fix shared shell behavior before duplicating format tests across browsers. A document skip link, focusable reading regions, visible focus and announced busy state improve every renderer. Cancellation must finish cleanup before Retry becomes usable.
3. Exercise the source with isolated installed Chrome and Edge channels. These checks cover browser rendering without depending on the Windows launcher that remains blocked by signing policy. No personal browser profiles were used.
4. Attempt a second browser engine. Playwright Firefox downloaded, but its process could not start (`browserType.launch: spawn UNKNOWN`). It is recorded as an environment launch failure, never as a pass or a renderer failure. The cause was not established; no alternate execution route or policy change was attempted.
5. Run existing renderer, broker and session regressions after fixes, record exact tested browser versions and preserve the distinction between automated source checks and release qualification.

## Delivered fixes

- Keyboard-accessible “Skip to document” link, focusable document/scroll regions, consistent visible focus and `aria-busy` on the main reading region.
- Cancel leaves Retry disabled until the prior operation settles, then moves keyboard focus to it. Password forms are removed during cleanup, preventing interaction with a stale form. This fixes the cancellation/retry race exposed in the first Chrome and Edge runs.
- Ending a viewing session moves focus to the completion message.
- A persisted `pageshow` reloads disposed renderer state instead of merely pinging the broker. This repairs the ready-document return path after `pagehide` cleanup. The automated check dispatches page-transition events; it does not prove real back/forward-cache eligibility or physical sleep behavior.
- Spreadsheet search responds to Enter. Fractional/invalid row and column positions normalize to valid integer positions instead of looking up nonexistent fractional cells.
- Tables have captions identifying the sheet and visible rows. Document-frame sizing and toolbar constraints prevent shell overflow in the tested narrow viewport.
- Generated reading frames declare an English default language. Language detection and faithful propagation of document language are not implemented; multilingual assistive-technology review remains necessary.

## Recorded browser results

| Browser | Version | Result | Scope |
| --- | --- | --- | --- |
| Installed Google Chrome, fresh isolated profile | 156.0.8078.80 | 3 groups passed | Headless source tests |
| Installed Microsoft Edge, fresh isolated profile | 156.0.4314.58 | 3 groups passed | Headless source tests |
| Playwright Firefox | Download reported 157.0, build v1555; runtime version not obtained | Could not launch; 3 groups failed at setup | No Firefox product behavior verified |

Host registry reports build 26200.9711, display version 25H2 (the legacy ProductName value says Windows 10 Home Single Language). Node: 22.23.2. These are this development machine's recorded values, not clean-machine support evidence.

Each passing browser run exercises TXT, PDF, PNG, Markdown, DOCX, EPUB, CSV, TSV and XLSX. Checks cover readable representative content, named visible controls, a 600-pixel viewport without whole-page horizontal overflow, external-request interception, keyboard skip navigation, visible document focus, password cancellation/retry, print preview focus/escape return, spreadsheet Enter search, simulated cached-page restoration, offline/online recovery and final broker allocation cleanup.

The first recovery test also tried to click Retry after automatic online recovery had already hidden it. That was a test expectation error; the final test waits for automatic recovery and checks that the same PDF page remains loaded.

## Regression evidence

- `npm test`: 24 groups passed.
- `npm run test:reading`: 8 source-renderer groups passed.
- `npm run test:browser`: 5 groups passed; two exercise the unchanged packaged text viewer, three exercise source session behavior.
- `node tools/test-qualification.cjs chrome msedge`: 6 groups passed (three per browser).
- Total: 43 passing groups in the final available-browser/regression runs. Firefox's three setup failures are separately recorded, not hidden by that count.
- Narrow Markdown screenshot from Chrome visually reviewed: `tests/results/step-10-chrome-narrow.png`. Edge counterpart: `tests/results/step-10-msedge-narrow.png`.
- Evidence: `tests/results/qualification-matrix.json`, per-browser `.tap` logs and `tests/results/step-10-validation.json`.

The matrix runner defaults to Chrome, Edge and Firefox and exits nonzero if any selected browser fails. Passing explicit browser names limits the run without implying that omitted browsers passed. `npm run test:qualification` defaults to isolated Playwright Chromium, or respects `UFV_BROWSER`.

## Remaining qualification — do not mark release gates passed

| Check | Current disposition |
| --- | --- |
| Firefox renderer and recovery behavior | Unverified because browser launch failed; resolve the supported test environment before rerunning |
| Actual 200% browser zoom | Unverified; a 600px viewport is only a reflow check |
| Screen readers and complete keyboard/focus audit | Unverified; automated control/focus assertions are not a screen-reader audit |
| Real back/forward-cache restore and restore during an in-flight operation | Unverified; current test simulates persisted transition events on a ready document |
| Real 30-minute background period, sleep/hibernate, browser discard/crash | Still outstanding; earlier clock-advanced tests remain simulation evidence |
| Native default-browser launch, Open with, upgrade/uninstall and clean standard-user machine | Still blocked by approved signing/trust prerequisite |
| Physical print dialogs/printers, mixed PDF page sizes and complex Office fidelity | Still outstanding |
| Performance and total memory acceptance targets | Not measured by these tests |

REL-03/04/07/10/11 now have additional partial evidence; none is promoted to complete release-level acceptance. The fifteen release checklist items remain unchecked.

## Next development milestone

Step 11 should build repeatable performance and memory measurements for the integrated source, record cold/warm and repeated-document behavior, and fix measured regressions. That work can proceed independently of the unresolved native signing and Firefox environment prerequisites. Do not label the application ready for release until the remaining qualification gates pass.

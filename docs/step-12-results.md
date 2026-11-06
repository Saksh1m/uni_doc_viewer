# Step 12 — personal-use readiness and startup recovery

Date: 6 November 2026. Delivered: a tested manual source-viewing command, Desktop instructions and a fix for a reproduced loading/cancellation hang. Installed app remains 0.0.6; portable 0.0.7 remains the step-7 package. No native launcher execution, rebuild, installation, file-association change, certificate purchase or security-policy change occurred.

## Why this order

1. Review the unclassified step-11 startup timeout and inspect pending operations. Repeating ordinary opens alone cannot validate how a stalled renderer behaves.
2. Inject a stalled renderer-module request and test the deadline and cancellation. Both tests failed before the fix: the UI stayed busy and Retry could not regain focus even after the deadline or Cancel.
3. Repair the waiting lifecycle before exposing the personal-use entry point. Browser dynamic imports do not accept an AbortSignal. Aborting the controller alone therefore did not settle the `await import(...)` operation. The shell now races non-abortable waits against the session signal, observes late promise results/rejections, and releases the UI promptly.
4. Verify the manual entry point separately from the blocked executable. It starts the existing source server with the bundled Node runtime and prints a one-time address for the user to open manually. No default-browser process or native launcher is started by this tool.
5. Run renderer, broker, keyboard/browser and local-workflow regressions, followed by fresh PDF startup probes. Document what is usable without promoting partial qualification to release readiness.

## Implementation

- `src/web/viewer.js`: abort-aware waiting for dynamic renderer import, renderer startup and long actions; reset stale metadata on reload; recovery wording works for manual source sessions as well as Windows launches.
- `src/web/render-common.mjs`: check cancellation after sanitizer loading so an abandoned operation cannot construct a late reading frame.
- `tools/view-local.cjs`: one-file interactive source command with help, local dependency checks, familiar file errors, one-time URL handoff and clean Ctrl+C/session closure handling. It resolves source modules relative to its own location and does not interpolate paths into shell commands.
- `tests/readiness.test.cjs`: deterministic stalled-import deadline, retry, cancellation/focus and no-late-content-after-closure regressions. The deadline test advances the browser clock; it is not a wall-clock performance measurement.
- `tests/local-view.test.cjs`: help/errors, Unicode/spaces/ampersand filename, browser refresh, unchanged original bytes, PDF rendering/navigation, execution from a different working directory, and server shutdown after session closure. Uses the existing bundled Node runtime and isolated Chromium.
- `PERSONAL_USE.md`: exact local commands and operational limits; matching copy on Desktop.
- `tools/benchmark/pdf-reliability.cjs`: can write step-12 evidence without overwriting the step-11 report.

The abort wrapper stops waiting; it does not claim that the browser can cancel an in-flight module download. Late import completion is ignored, renderer cleanup still runs, and a retry may reuse the browser's module-fetch state. If the underlying local asset remains unavailable, retry can fail again and the user can end/restart the session.

## What you can use now

Open `PERSONAL_USE.md` or the Desktop file `Universal File Viewer - How to Open Files.md`. The guide starts with a supplied synthetic PDF and then shows how to substitute your own file path.

The workflow is: run a command in PowerShell, copy its `http://127.0.0.1:` address into Chrome or Edge within 60 seconds, keep the terminal open, and select **End viewing session** when done. The server normally exits around five seconds afterward. Each command starts a separate broker for one file. This does not reproduce the native launcher's shared-host or double-click workflow.

The printed address contains a one-time credential. It is interactive user output, not a persisted application log. Do not share it or redirect it to a saved log. The URL contains no original filesystem path. The browser removes the token from its visible URL after startup.

No signing purchase is required for this existing development workflow. The blocked executable remains blocked; the installed text-only 0.0.6 app is untouched.

## Verification

- Before fix: both deliberately stalled-import tests failed.
- After fix: `npm run test:readiness` — 5 groups passed.
- `npm test` — 24 broker/lifecycle/resource groups passed.
- `npm run test:reading` — 8 source renderer groups passed.
- `npm run test:browser` — 5 groups passed; includes two unchanged packaged-text groups and three source session groups.
- `node tools/test-qualification.cjs chrome msedge` — 6 groups passed (Chrome 156.0.8078.80 and Edge 156.0.4314.58, isolated headless profiles).
- Total automated regression groups: 48. Ten additional fresh-process PDF starts passed. Their results are recorded separately in `tests/results/step-12-pdf-reliability.json`; consolidated evidence is in `tests/results/step-12-validation.json`.

## Readiness decision and remaining limits

The manual source workflow is usable for personal trials on this development computer with the tested formats. It is not a newly installed Windows application or a public release.

The stalled-import defect is reproduced and fixed. Its relationship to the historical step-11 PDF timeout is unknown because the original failure lacked sufficient state capture. Do not label that historical cause as proven or the timeout universally eliminated.

Still unqualified: Firefox (test browser could not launch), actual 200% browser zoom, screen readers, physical sleep/resume and long background periods, continuous full-process peak memory, near-limit real-world DOCX/EPUB inputs, a genuine 100 MB PDF, physical printer behavior, and signed/installed native workflows. Existing parser and rendering fidelity limits remain. Release checklist items stay unchecked.

The next useful action for personal use is to try representative noncritical files through the documented command and address specific failures. Remaining release qualification is a separate work list; no additional format expansion or paid purchase is needed to try the current viewer.

# Renderer experiments

Stage 4 isolates rendering and packaging decisions from the installed stage-3 text viewer. This lab is test infrastructure, not a user-facing application or production file server.

## Reproduce

From this directory, with the root stage-3 package and baseline fixtures already built:

```powershell
npm ci
../../.venv-fixtures/Scripts/python.exe supplemental.py
../../.venv-fixtures/Scripts/python.exe cache_fixture.py
node build.cjs
node run.cjs
```

The root project's Playwright installation and its Chromium test browser are required. Python is needed to create test inputs and sample Windows process memory. Neither Python nor developer tools are application runtime dependencies.

The builder creates `../../dist/renderer-lab/`, including a private Node runtime, browser assets, worker files, PDF fonts/CMaps/WASM, a fixture allowlist, dependency notices, and a SHA-256 inventory. The test runner starts that bundled runtime from an unrelated directory with system Node removed from PATH. It uses an isolated browser/profile and blocks attempted external requests.

`results/results.json` contains the most recent functional results, render timings and sampled memory. `results/memory.jsonl` records 100 ms samples of private committed bytes for the test-browser and lab-server process trees. Short-lived processes can exit between enumeration and sampling; any unreadable sample is disclosed. Main-page JavaScript heap is a separate, incomplete memory metric.

Renderer timing starts after the lab page and libraries have loaded. It includes fixture loading, parsing and first display; it excludes Windows/browser launch and library bootstrap. These single-run measurements are not the ten-run release benchmarks.

## Important adapter behaviors

- PDF.js uses a real module worker plus local supporting assets and range-enabled delivery. Tests render a page and inspect text from the last page.
- Mammoth runs in a dedicated worker. Images cross the worker boundary as binary buffers and become generated blob URLs. Sanitization therefore does not parse enormous base64 attributes. Blob URLs are revoked during renderer disposal.
- Converted DOCX/Markdown content is sanitized and displayed in an iframe with `allow-same-origin` but **without** `allow-scripts`; document CSP also forbids scripts. Same-origin access supports generated blob images and parent-driven inspection/search. Never enable scripts in these frames.
- EPUB.js is rebuilt from source with the pinned XML-parser override. Using its prebuilt npm bundle would not establish that the override reached bundled code. `epub-bundle-inputs.json` records the actual inputs.
- EPUB scripts/styles/external links/resources are stripped or blocked in the experiment. This validates a conservative reading view, not arbitrary book styling fidelity.
- SheetJS runs in a worker with `sheetStubs: true`. Formula cells with `t: "z"` are normalized to an unavailable cached value. Genuine cached zero and cached empty strings remain distinct. Cached values are never recalculated and may be stale.
- CSV uses PapaParse with `dynamicTyping: false` and streaming row callbacks inside a worker. Only sample rows reach the lab DOM; a production virtualized grid is future work.
- ZIP preflight checks the central directory, traversal names, entry count and declared expanded bytes. It rejects ZIP64 in this lab. It is not a full streaming decompression budget or adversarial ZIP validator.

## Evidence discipline

The 31 scenarios assert format behavior, malformed-file failures, script/resource controls, correct formula cache handling, actual decoded DOCX images, real workers and cancellation. “Pass” means those assertions passed; it does not mean an entire format is release-qualified.

The generated larger fixtures contain actual embedded synthetic raster images. They exceed 10/100 MB for PDF, 10 MB for DOCX and 20 MB for EPUB. They are image-heavy capacity probes, not representative real-world documents. No original project documents or personal images are used.

The selected parser versions and proposed integration limits are documented in [the step 4 report](../../docs/step-4-results.md) and [resource policy](../../docs/renderer-resource-policy.json). The policy is an implementation input for later steps, not an assertion that all limits are enforced now.

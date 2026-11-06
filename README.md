# Universal File Viewer

Windows-first, offline-first local file viewer under development. The stage-7 prototype opens TXT, Markdown, PDF, PNG/JPEG/WebP, DOCX, reflowable DRM-free EPUB, CSV/TSV and XLSX through the shared protected Windows broker. See the prototype instructions for reading-view, printing and resource limits; this is not a qualified public release.

**Local deployment status:** the 0.0.7 source/portable build contains these adapters, but Windows Application Control blocked the final unsigned launcher. Installation was not attempted; the installed 0.0.6 application remains text-only. See the step 7 report for evidence and the approved-signing prerequisite.

## Personal use now

Follow [the local viewing guide](PERSONAL_USE.md) to use the current source with the bundled Node runtime. The command prints a one-time local address to open manually in Chrome or Edge. No signing purchase is needed for this workflow. See [step 12 results](docs/step-12-results.md) for the reproduced startup-hang fix, tests and remaining limits.

## Current source (steps 8–12)

Source-only updates add bounded PDF printing, document/chapter print previews, EPUB position restoration and document hardening. Use `npm test`, `npm run test:reading` and `npm run test:browser` for source validation. Browser/keyboard/recovery checks and remaining qualification are in [step 10 results](docs/step-10-results.md). Run `node tools/test-qualification.cjs chrome msedge` for the available installed-browser checks; Firefox currently fails to launch in this environment. See [step 9 results](docs/step-9-results.md) and [project status](PROJECT_STATUS.md).

The existing portable package does not include these changes. On this machine, native rebuild/install/launch checks remain deferred until the approved signing/trust prerequisite is resolved. Build/install commands below describe the packaging workflow, not a workaround for that block.

Archive limitations include ZIP64, unsupported encryption, conflicting alternate filenames, corrupt checksums and XML DOCTYPE/ENTITY declarations. Some otherwise valid documents with benign DTD declarations will be rejected. Sanitized reading views discard document CSS classes/styles and external resources.

## Current build

`dist/UniversalFileViewer/UniversalFileViewer.exe` opens a supported-file picker when launched without arguments. The package includes a private Node runtime, local renderer assets and a small .NET Windows GUI launcher; it does not require a system Node installation.

Run `dist/UniversalFileViewer/install.ps1` to install for the current Windows user and register supported “Open with” handlers. Existing defaults are unchanged. See [prototype instructions](docs/prototype-readme.md) for usage, limits, and uninstall behavior.

## Development

Build prerequisites: Windows x64, Node 22 x64, and the Windows .NET Framework C# compiler. Fixture scripts additionally require Python; see the [fixture guide](tests/fixtures/README.md).

```powershell
npm ci
npm test
npm run build:windows
npm run test:package
npm run test:ipc
powershell -NoProfile -ExecutionPolicy Bypass -File tools/test-windows-quoting.ps1
npx playwright install chromium
npm run test:browser
npm run test:renderers
```

The browser test uses its own headless browser/profile, not the user's open browser. Developer tooling and downloaded test browsers are not included in the application package. The backend uses Node built-in modules; frontend libraries are pinned and copied locally by `tools/build-renderers.cjs`. Renderer tests also use the supplemental cache fixture documented in the renderer lab README.

## Design and evidence

- [Release acceptance specification](docs/release-acceptance-spec.md)
- [Step 2 results](docs/step-2-results.md)
- [Trust boundaries](docs/trust-boundaries.md)
- [Application scenario matrix](docs/test-scenarios.md)
- [Step 3 results](docs/step-3-results.md)
- [Step 4 renderer decisions](docs/step-4-results.md)
- [Step 5 broker results](docs/step-5-results.md)
- [Step 6 lifecycle results](docs/step-6-results.md)
- [Step 7 renderer integration](docs/step-7-results.md)
- [Windows process and session lifecycle](docs/session-lifecycle.md)
- [Broker protocol and boundaries](docs/broker-protocol.md)
- [Renderer experiment reproduction](experiments/renderers/README.md)

Do not edit project reference files under the parent workspace's `sources/` directory.

## Source performance measurements

Step 11 adds repeatable benchmark tooling under `tools/benchmark/`. See [step 11 results](docs/step-11-results.md) for commands, measured timings, memory limitations and the retained intermittent startup timeout. `npm run bench` uses the existing local runtime and isolated Chromium; it does not invoke the Windows launcher. No signing purchase is required for this development workflow.

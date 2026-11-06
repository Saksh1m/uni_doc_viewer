# Step 3 Windows launch experiment

Date: 2026-11-04  
Build: 0.0.3  
Status: prototype implemented, packaged, installed, and tested on the current host. Clean-machine and interactive native-UI qualification remain pending.

## What works

The package receives one local `.txt` file, reads a bounded immutable snapshot, starts a server on an available loopback port, and launches the Windows default browser. The page shows Unicode text with line wrapping, browser-native search, and printing. UTF-8 and BOM-marked UTF-16 are supported; the limit is 8 MiB.

The entry executable is a Windows GUI application, so launching it does not allocate a terminal window. Running it without a file invokes a native file picker. Native dialogs provide startup errors; interaction with these dialogs has not been verified because Computer Use access was denied.

The per-user installer registers a text-file “Open with” handler without changing defaults. Its command quotes both the executable and the file argument. The runtime ships inside the package; developer tools and test browsers do not.

Installed location: `%LOCALAPPDATA%\Programs\UniversalFileViewer-Prototype\UniversalFileViewer.exe`.

Portable archive: `dist/UniversalFileViewer-0.0.3-win-x64.zip` (34,403,409 bytes at this build). Extract the entire directory; the executable requires its adjacent runtime/app files.

## Design choices and why

| Choice | Reason | Limitation carried forward |
|---|---|---|
| Private Node runtime rather than a single executable | Proves runtime-independent installation immediately and supports later worker/parser assets without injection tooling | Larger multi-file package; SEA can be evaluated later if a single file materially helps |
| Small C# Windows launcher | Uses native file selection, ShellExecute default-browser launching and GUI error dialogs without shipping Chromium or Electron | A small native component supplements the JavaScript backend; Windows .NET Framework is required |
| One process and snapshot per file | Keeps step 3 focused on launch/packaging and prevents mixing later file modifications into the displayed text | Shared per-user broker and production lifecycle remain steps 5–6 |
| One-use bootstrap plus bearer authorization | Avoids unauthenticated file access during the experiment; refresh uses tab session storage rather than token reuse | Full threat-model verification and production expiry are not complete |
| Text only, inserted with textContent | Tests the complete delivery path without executing document markup | No PDF, office, ebook, or spreadsheet rendering yet |
| Current-user registration only | Avoids elevation and preserves user control over defaults | Interactive Open with selection is still an outstanding UI check |

The Node runtime packaging approach is consistent with shipping a runtime bundle; single-executable applications remain an alternative described in the [Node SEA documentation](https://nodejs.org/download/release/latest-v22.x/docs/api/single-executable-applications.html). The standalone browser tests use [Playwright](https://playwright.dev/docs/test-webserver) with an isolated headless browser and no user profile.

## Verification actually performed

Host: Windows 11 Home Single Language, build 26200. Runtime: Node v22.23.2 x64. Browser test engine: Chromium 156.0.8078.4 through Playwright 1.64.1.

| Check | Result and evidence boundary |
|---|---|
| Seven server/launch tests | Passed: supported encodings/paths, failures, bootstrap replay rejection, repeat reads, source preservation, Host/Origin/wrong-file rejection, safe insertion/CSP, expiry and snapshot limits |
| Two package tests | Passed: package hashes, Windows GUI PE subsystem, private-runtime startup with system Node absent from PATH, unrelated working directory, four path fixtures |
| Native Windows argument transport | Passed TXT-01 and PATH-01/02/03 using the compiled launcher's Quote method and an actual Windows child-process argv probe |
| Two browser test groups | Passed: six fixture opens plus refresh/wrap, exact Unicode text, empty file, no page errors or attempted external resources, literal markup without script execution |
| Visual inspection | Reviewed isolated-browser screenshot of PATH-01; title, Unicode text, controls and footer were readable |
| Default-browser launch | Invoked the installed executable with TXT-01; observed a Chrome window titled `utf8.txt — Universal File Viewer`; Chrome was the configured HTTP handler. This establishes launch/title, not a full desktop-browser inspection |
| Installation lifecycle | Per-user install, uninstall, reinstall and repeated install passed; existing text/HTTP defaults were compared and preserved |
| Busy installation | Installer correctly refuses a running prototype before copying files |

The installed executable's browser tab was inspected only through its returned window title. Computer Use refused access to both Google Chrome and the prototype executable. No other tool was used to take control of those denied windows. Isolated browser tests used a separate test browser/profile.

During testing, an attempted reinstall initially failed on the running runtime file. The installer now preflights active installed processes and stops before copying anything. A Host-header test also needed Node's low-level HTTP client because fetch did not send the custom Host value; the corrected test passed.

## Remaining gates

- A genuinely clean Windows machine without developer tools; removing Node from PATH is useful evidence, not an equivalent clean-machine test.
- Interactive Explorer “Open with” selection, native file-picker selection/cancellation, and native error-dialog behavior. Registry registration, quoting and default-browser launch have been checked separately.
- Edge/Firefox compatibility, long background-tab survival, robust sleep/crash recovery, and shared process behavior.
- Production security qualification, signing, publisher identity, and release installation UX.

The build is unsigned development software. Step 3's implementation is ready for renderer experiments, but the original clean-machine acceptance gate is not yet closed. No full-release checklist item is marked complete solely from these results.

## Reproduce and continue

See the [developer README](../README.md) and [prototype usage instructions](prototype-readme.md). Test sources are `tests/launch.test.cjs`, `tests/package.test.cjs`, `tests/browser.test.cjs`, and `tools/test-windows-quoting.ps1`. Generated evidence is under `tests/results/`.

Next implementation work is step 4: isolated renderer and packaging experiments using the existing PDF/DOCX/EPUB/XLSX fixtures. Preserve the current text launch path as the regression baseline.

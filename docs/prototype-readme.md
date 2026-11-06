# Universal File Viewer prototype 0.0.7

Local verification status (5 November 2026): Windows Application Control blocked this unsigned launcher's final assembly-loading check because it did not meet the signing policy. This build has not replaced the installed 0.0.6 prototype. Use an approved signing/trust process before installation on this environment; do not disable security policy to run it. Bundled-runtime/browser tests passed, but final native deployment verification remains pending.

This stage-7 prototype opens local text, Markdown, PDF, PNG/JPEG/WebP, Word `.docx`, reflowable DRM-free EPUB, CSV/TSV and Excel `.xlsx` files in the Windows default browser. It includes its own Node runtime and renderer assets. No Node.js or Microsoft Office installation is needed to run the package. Windows 11 x64 and its .NET Framework 4.7.2-or-newer runtime are the intended platform.

## Run or install

Double-click `UniversalFileViewer.exe` to choose a supported file, or drag a file onto it. Keep the `runtime` and `app` folders beside the executable.

To register the prototype under Windows “Open with,” open PowerShell in this package directory and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

This script runs once with its own execution policy; it does not change the machine policy. It installs into `%LOCALAPPDATA%\Programs\UniversalFileViewer-Prototype`, needs no administrator permissions, and adds available handlers for the supported extensions. It does not change selected file or HTTP defaults. Right-click a supported file, choose **Open with**, and select **Universal File Viewer (Prototype)**. If it is not listed, browse to the installed executable. Choose **Just once** during testing.

## Behavior and limits

- UTF-8 and BOM-marked UTF-16 text, up to 8 MiB; invalid encodings get a native error message.
- Browser text search through Ctrl+F, line wrapping, printing, and light/dark display.
- PDF: page navigation, selectable text layer, text search, fit/zoom and password retry. Printing is **current page only**. No OCR or interactive annotations/forms; large embedded images can be omitted by PDF.js's image limit.
- PNG/JPEG/WebP: display, fit/zoom, browser-applied orientation and image printing. Animated images are rejected.
- DOCX/Markdown: sanitized reading views with search. Complex Word layout, exact pagination, comments and tracked-change fidelity are not promised. External links/resources are disabled; document printing is not yet provided.
- EPUB 2/3: chapter list/navigation, text size, current-chapter search and chapter-level position across refresh. Book scripts/styles/external resources are disabled. Fixed-layout and encrypted books, including obfuscated-font encryption declarations, are rejected. Exact scroll-position restoration and full-book search/printing are not provided.
- CSV/TSV/XLSX: sheet selection, row/column navigation, active-sheet search and CSV delimiter override. A window of at most 100 rows × 20 columns is displayed at once; use navigation to see the rest. Printing covers visible rows only. Formulas never execute; saved caches may be stale and missing caches are explicitly unavailable.
- Limits: PDF 150 MiB/5,000 pages/16 million canvas pixels; TXT 8 MiB; Markdown 2 MiB; DOCX/XLSX 12 MiB; EPUB/CSV/TSV/images 24 MiB. Raster images are capped at 24 megapixels; document embedded images at 80 megapixels combined. Archives have 10,000-entry, 32 MiB-per-entry and 256 MiB-total actual expansion limits, checked before parser admission. ZIP64 and multipart archives are rejected.
- Worksheets: 100,000 populated cells per workbook, 100,000 rows and 1,024 columns per sheet. CSV/TSV: 100,000 data rows plus a header, 1,024 columns and 1.1 million cells. Parser/loading operations have a 30-second limit and a Cancel loading control. Password entry is also subject to the current loading deadline; use Retry loading if it expires.
- Read-only memory snapshot: changes to the original after opening do not update the current view.
- One hidden Windows host and one shared Node runtime per installation and Windows login session. Up to eight pending/open viewing sessions share the broker's limits. Opening another file does not replace earlier files.
- The listener binds to 127.0.0.1 on an available port. A one-use bootstrap grants a file-specific bearer credential; document text is inserted as text, not HTML. No cookies are used.
- An unopened session expires after about 60 seconds. An authenticated session expires after 45 minutes without an authenticated request, or eight hours total. A visible tab sends a heartbeat once a minute; a background tab can remain usable for 30 minutes without any heartbeat. The runtime and host exit about five seconds after their final session ends.
- Returning to a tab checks the connection. Temporary connection loss offers retry and preserves loaded text; expiry or a broker crash gives instructions to reopen the original through Windows. Reopening starts a fresh snapshot if the old broker has stopped. A full page reload after the server has stopped may show the browser's own connection-error page.
- **End viewing session** clears the displayed text and tab credential and revokes the server snapshot when reachable. If unreachable, the server session expires automatically.
- Refresh works while the server is alive, using the current tab's session storage. After expiry, reopen the file through Windows.
- No automatic network-resource downloads, accounts, persistent reading-history database, editing or automatic updates. Third-party dependency notices are included in `app/THIRD-PARTY-NOTICES.json`.

This package is unsigned development software, not a production release. Steps 5–7 implement the protected broker, Windows IPC, lifecycle and first renderer integration. Independent security review, broader real-document coverage, full memory/performance benchmarks, real sleep/background qualification and clean-machine, multi-browser release testing remain outstanding. The launcher/host are small Windows GUI helpers; the file server and browser frontend are JavaScript.

## Remove

Use **End viewing session** in each viewer tab and wait a few seconds, then run the installed `uninstall.ps1` in PowerShell. Alternatively, close the tabs and allow about 46 minutes for idle expiry. The uninstaller refuses to remove running installed executables or an installation whose ownership marker/registration has changed.

The installer never chooses this app as the default. If you manually choose it as default, select another handler for those formats in Windows Settings before removing this development prototype.

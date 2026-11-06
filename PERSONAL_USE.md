# Universal File Viewer — open your files locally

Updated: 6 November 2026.

You can use the current source viewer on this computer without purchasing a signing certificate. This workflow starts its existing Node runtime and gives you a local browser address. It does not use the blocked Windows launcher or change Windows security settings.

## 1. Open PowerShell and enter the code folder

Copy this command:

```powershell
Set-Location -LiteralPath "C:\Users\ADMIN\.codex\.chatgpt-projects\g-p-6926bd6755588191ad3f6e6949edf482\universal-file-viewer"
```

The code is in that folder, not on your Desktop. This guide is also copied to `C:\Users\ADMIN\Desktop\Universal File Viewer - How to Open Files.md`.

## 2. Start with the supplied sample PDF

```powershell
& ".\dist\UniversalFileViewer\runtime\node.exe" ".\tools\view-local.cjs" ".\tests\fixtures\generated\valid\pdf\searchable.pdf"
```

The command prints an address beginning with `http://127.0.0.1:`. Copy the complete address into Chrome or Edge within 60 seconds. Keep the terminal open while reading. If the address expires, stop with Ctrl+C and run the command again.

The address includes a one-time access token. It is intended for your browser; do not share it or save the command output as a log. The viewer removes the token from the visible address after opening.

## 3. Open your own file

Use the same command with your file's actual path in quotes. For example, replace the example path below with a file that exists:

```powershell
& ".\dist\UniversalFileViewer\runtime\node.exe" ".\tools\view-local.cjs" "C:\Users\ADMIN\Downloads\example.pdf"
```

Supported extensions: `.txt`, `.md`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.docx`, `.epub`, `.csv`, `.tsv`, `.xlsx`.

Each command opens one file and starts a separate local server. To use another file at the same time, run the command in a second terminal. This manual source workflow does not share the native launcher's single-host implementation. Normal refresh within an active viewing session works.

## 4. Finish reading

Choose **End viewing session** in the browser. The local server should stop after roughly five seconds and print `Local viewer stopped.` You can then close the terminal.

Ctrl+C in the terminal also stops that server. Merely closing a browser tab does not reliably notify it; the session will otherwise expire automatically. An authenticated session has a 45-minute idle limit and an eight-hour absolute limit. Do not leave the server running unnecessarily.

## If something fails

- **File not found:** use the actual full path and surround it with quotes.
- **Unsupported file or limit message:** choose a supported file within the implemented limits; changing its extension does not convert it.
- **Rendering assets missing:** from the code folder, run `& ".\dist\UniversalFileViewer\runtime\node.exe" ".\tools\build-renderers.cjs"`. This uses the dependencies already present in this development workspace. A fresh computer needs separate setup.
- **Loading stalls:** wait for the 30-second deadline or choose Cancel loading, then Retry loading. Password-entry time is excluded from the parser deadline. If recovery fails, end the session and run the command again.
- **Connection/session expired:** start the original file again with the command above. An old one-time address cannot start a new session.
- **Windows blocks a command:** stop and keep the error for diagnosis; these instructions do not require disabling protections or running as administrator.

## What to expect

Files remain local and read-only. Reading views can differ from Word, Excel or an ebook's original layout. XLSX uses saved values without recalculating formulas. EPUB supports unencrypted reflowable books. PDF search needs a text layer. Printing has explicit page/memory limits; EPUB prints the current chapter, tables print visible rows.

This is a tested development workflow, not a fully qualified public release. Chrome and Edge have passed source checks. Firefox could not start in the test environment and remains unverified. Screen-reader use, actual 200% browser zoom, physical sleep/resume, continuous memory peaks and some large real-world formats still need qualification.

The installed Windows application remains the old 0.0.6 text-only version. Double-click/Open with support for the newer source remains blocked by Windows signing policy. This command does not make that executable trusted.

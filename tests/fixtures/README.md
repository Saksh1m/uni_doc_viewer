# Step 2 fixture collection

This is a synthetic software test corpus, not a set of polished document deliverables. Some inputs are deliberately invalid, contain harmless execution markers, or have intentionally stale/missing formula caches. Do not “repair” or recalculate them: those conditions are the tests.

The collection contains 47 files generated from code. No files from `sources/` or personal documents were used. Generated content may be used and modified with this project. Fixture-generation dependencies are development tools, not chosen application dependencies.

## Reproduce

From the `universal-file-viewer` directory in PowerShell:

```powershell
python -m venv .venv-fixtures
.venv-fixtures/Scripts/python.exe -m pip install -r tools/fixture-requirements.txt
.venv-fixtures/Scripts/python.exe tools/build_fixtures.py
.venv-fixtures/Scripts/python.exe tools/verify_fixtures.py
```

The initial dependency installation needs internet access. Generating and verifying fixtures afterward works locally. Python is only required for this development workflow; end users will not need it.

- [Generated catalog](generated/CATALOG.md): each file, expected viewer behavior, and related release checks.
- [Machine-readable manifest](generated/manifest.json): IDs, paths, sizes, SHA-256 hashes, facts, and `viewer_status: not_run`.
- [Verification report](verification.json): fixture integrity and semantic checks, independent of future viewer tests.
- [Scenario matrix](../../docs/test-scenarios.md): tests requiring a running app or OS/browser interaction.
- [Security boundary map](../../docs/trust-boundaries.md): assets, data flow, abuse cases, and controls.

Generated binaries and the Python environment are ignored by Git. Keep the generator, requirements, documentation, and future test code in version control. Regeneration overwrites only known generated outputs and does not recursively delete anything. If fixtures are renamed later, remove obsolete generated files deliberately; the manifest is the authoritative list.

## Fixture families and ground truth

| Family | Coverage |
|---|---|
| Text and paths | UTF-8, BOMs, UTF-16 LE/BE, invalid encoding, empty file, Unicode and shell punctuation, long path, leading option-like filename |
| Sessions | Five files with different markers for concurrency and wrong-file authorization tests |
| PDF | Searchable three-page document, password-protected document (`viewer-test`), 500-page text document, truncated input, HTML disguised as PDF |
| Images | JPEG/PNG/WebP quadrants, EXIF orientation 6, highly compressed 24-megapixel image |
| Markdown | Basic reading constructs; script/event/style/external-image/relative-file probes |
| DOCX | Heading, list, embedded image, table; second-page merged-cell/header fidelity boundary |
| EPUB | Two-chapter EPUB 2 and EPUB 3 containers; scripted/external-resource probe; bounded expansion and traversal probes |
| CSV/TSV | Quoted commas and newlines, escaped quotes, delimiter override, leading zeros, large identifiers, formula-like strings, malformed quotes, 100,000 rows |
| XLSX | Two sheets, identifiers, zero, boolean, dates in 1900/1904 systems, percentages, cached/missing/stale formula values, 100,000 populated cells |
| Failure inputs | Truncated DOCX/XLSX/EPUB, unsupported RTF, neighboring-file sentinel |

Security probes change only a DOM marker or reference a reserved `.invalid` hostname; they do not read real secrets or send data to a real collection endpoint. No probe scripts are executed during corpus validation. A failed DNS request is still an attempted external request and must fail the future privacy test.

The expansion probe contains only 1 MiB of repeated padding. Test rejection using a 512 KiB **test-only** decompression budget; production limits remain unset. The traversal archive must never be extracted with an unrestricted extraction function. Inspect entries in memory.

For file-change/removal tests, copy fixtures to `run-work/`, mutate the copies, and verify originals against the manifest afterward. Do not mutate canonical generated fixtures during viewer tests.

## What verification proves

The verifier checks hashes, sizes, encoding markers, image dimensions/orientation, PDF page counts/text/password behavior, OOXML ZIP/XML integrity, selected DOCX contents, XLSX typed values/cache conditions, CSV shape, and EPUB container basics. It uses a different PDF reader from the PDF generator.

It does **not** prove viewer compatibility, visual fidelity, accessibility, browser security, full EPUB standards conformance, or performance. Those remain later-stage checks. `verification.json` must never be reported as a passing application test run.

## Known coverage gaps to fill during step 4

- Ordinary 10 MB and 100 MB PDFs, and representative 10 MB DOCX/20 MB EPUB files. The current 500-page PDF is small and deliberately not padded to pretend that it measures large-file I/O.
- Complex real-authoring-tool examples: floating Word objects, nested tables, embedded fonts, fixed-layout/DRM EPUB rejection, unsupported PDF encryption, and spreadsheet external links/charts.
- Official EPUBCheck conformance runs for valid EPUB examples; current checks verify packaging/XML and navigation structure only.
- Very long Windows paths on machines with different long-path policies; the current long-path fixture is environment-sensitive.
- Additional format-specific decompression, image-pixel, cell-count and timeout limits once actual parsers are selected.

These gaps do not block the initial launch experiment. They do block claims of exhaustive format or performance qualification.

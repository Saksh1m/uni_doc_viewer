# Step 9 — document hardening and adversarial regression tests

Date: 5 November 2026. Delivery: source only, on the existing 0.0.7 development baseline. Installed app: 0.0.6. Packaged 0.0.7 remains the step-7 package. No native launcher build, launch, install or policy change was performed.

## Order and rationale

1. Review archive admission before browser rendering. DOCX, XLSX and EPUB all cross this boundary, so shared validation prevents malformed entries from reaching several different parsers.
2. Validate integrity and parser agreement. Expanded-size checks alone cannot detect content corruption or disagreement between central/local headers. CRC-32 now checks decompressed entry bytes; local sizes/checksums, streaming data descriptors, disk numbers, flags and extra-field bounds are checked before admission. CRC detects corruption, not malicious authenticity.
3. Reject alternate path interpretations. Unicode ZIP extra fields must describe exactly the already validated UTF-8 name; ZIP64 extra fields are rejected. Otherwise a downstream parser could use a different filename from the one inspected by the guard. Consistent UTF-8 Unicode names and streaming archives remain supported and tested.
4. Reject unsupported XML declarations before conversion. XML-named members and content that starts like XML are checked for DOCTYPE/ENTITY, including null-separated UTF-16/32 spellings. This is a conservative admission restriction, not a complete XML validator. It also rejects benign DTD declarations and declaration text in comments; broader compatibility remains to be qualified.
5. Review the reading-to-print boundary. Sanitized document CSS classes are now removed as well as styles, IDs and names: a document class such as `print-controls` must not inherit trusted print CSS and hide document content. The script-free iframe remains unchanged. Its load-abort listener is removed when loading finishes.
6. Test cancellation at the encoding boundary. Canvas encoding cannot be stopped through its browser API, but the app must not remain blocked waiting for its callback. The new abort-aware wrapper immediately stops waiting, removes the listener and ignores late callbacks. Existing renderer cleanup destroys the PDF worker and clears the canvas.
7. Run malformed-input tests and existing functionality together, then update the status handoff. Release and installed-product claims remain separate from source test evidence.

## Changes

- `src/archive-check.cjs`: entry CRC checks, local/central consistency, signed/unsigned streaming descriptor handling, flags/disk checks, extra-field validation, alternate Unicode-path rejection and XML declaration restrictions.
- `src/web/render-common.mjs`: remove untrusted CSS classes and release completed iframe abort listeners.
- `src/web/render-print.mjs` and `render-pdf.mjs`: abort-aware PNG encoding for print preparation.
- `tests/resource-guards.test.cjs`: five added groups covering archive integrity, declarations, duplicates/expansion/count limits, broker recovery and alternate paths.
- `tests/renderers.test.cjs`: two added browser groups covering hostile markup through printing and cancellation while encoding. Fixed an existing test predicate that dereferenced an EPUB body before it existed; the test now waits for chapter completion before refresh.

## Verification

Commands: `npm test`, `npm run test:reading`, `npm run test:browser`.

All 37 groups passed in the final runs; machine-readable evidence is in `tests/results/step-9-validation.json`. The test set comprises: 24 broker/lifecycle/resource groups, 8 source renderer groups and 5 browser/session groups. Two browser groups check the unchanged packaged text viewer; other tests exercise current source. All use synthetic inputs and isolated Chromium where a browser is needed.

Specific checks include:

- CRC mismatch, local size mismatch, encryption flags, nonzero disk index and forged streaming descriptors rejected; valid streaming archive accepted.
- Duplicate paths, more than 10,000 entries and a compressed 33 MiB entry whose headers lie about its expanded length rejected.
- UTF-8 and UTF-16 declarations in an extensionless XML-looking member rejected.
- Consistent Unicode extra paths accepted; alternate paths and malformed extra bounds rejected.
- Four concurrent corrupt-archive registrations fail, return snapshot reservations and pending registration counters to zero, then allow a good archive to open and close.
- Script, event-handler, iframe, form, SVG/MathML, refresh, external-resource and trusted-class payloads remain inert after sanitization and print cloning; intended document text stays visible under print CSS; the source fixture is unchanged.
- A deliberately delayed PNG callback does not block Cancel and Retry. Worker closure and successful reload complete within two seconds in the test; the late callback cannot create a stale print preview.
- Existing format rendering, authenticated PDF ranges, password handling, EPUB restoration, print bounds and session isolation continue to pass.

## Remaining limits and next step

This is a targeted hardening pass, not a security certification or a claim that arbitrary hostile files are safe. A checksum is not an authenticity guarantee. The current limits do not bound all native/browser allocations. More real-world Office/EPUB files, EPUBCheck validation, fuzzing, parser stress cases, the exact 32 MiB print-encoding edge and full memory measurements remain outstanding. No private user documents were collected.

The initial full renderer run found an EPUB test timing bug; after fixing the null-body predicate and waiting for completed navigation, the suite was rerun. Report only final passing results as acceptance evidence.

Next development milestone: broader browser/accessibility and lifecycle qualification, with recorded failures and fixes. Native installation, real default-browser launching and clean-machine checks still require an approved signing/trust route. Windows policy was not changed or bypassed. The release checklist remains unchecked at release level.

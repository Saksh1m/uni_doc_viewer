# Step 2 completion record

Date: 2026-11-04

Step 2 is complete as a baseline fixture collection and security boundary map. The viewer has not been implemented. No release acceptance checkbox is marked complete by this work.

## Delivered

- 47 synthetic fixture files, totaling 23,922,094 bytes (approximately 23.9 MB).
- A repeatable generator and a separate verifier, with pinned Python dependencies in a project-local environment.
- A manifest containing hashes, sizes, expected outcomes, release-check mappings, and explicit `not_run` viewer status.
- A security boundary map covering launcher arguments, per-user IPC, filesystem access, browser authentication, parser output, content isolation, resource limits, and cleanup.
- 19 running-application scenarios with expected evidence, plus a result-record template.

## Executed checks

The fixture verifier passed 343 assertions across all 47 files. Assertions include integrity/metadata checks as well as selected semantic checks; this is not 343 application tests.

Two consecutive generator runs produced identical manifests and file SHA-256 hashes. The second generated corpus was verified again successfully. This establishes reproducibility in the current pinned environment, not across all future Python/compression-library versions.

PDF validation used pypdf against ReportLab-generated files. DOCX validation used package/XML checks and python-docx. Spreadsheet validation inspected typed values and formula/cache states using openpyxl; formula recalculation was deliberately not performed. Image and CSV checks verified dimensions/orientation and row/field values. EPUB checks verified ZIP/XML packaging and chapter structure, without a full EPUBCheck run.

The test assets are software inputs, including intentionally broken documents. Visual fidelity and browser rendering are deliberately unverified until renderer selection in step 4.

## Review findings carried forward

1. Compressed office and ebook containers require expanded-size limits despite ZIP viewing being out of scope.
2. The 500-page PDF is not a substitute for a 100 MB I/O fixture. Realistic size-specific examples remain a named step 4 task.
3. Step 1's cleanup grace is measured after session expiry, so step 6 still needs a bounded expiry policy and a background-tab test. No cleanup guarantee has been silently assumed.
4. Script blocking, URL filtering, CSS containment, and attempted-network-request inspection are separate checks.
5. Known cached spreadsheet results can be verified; whether a cache is stale cannot generally be inferred from a workbook. The viewer must disclose this limitation instead of promising stale-result detection.

## Next authorized stage

Step 3 is the minimal packaged Windows launch experiment: “Open with” passes a local text-file path to a launcher, a loopback server starts, and the default browser shows that file. Use TXT-01 and PATH-01/02/03 first. Do not add full rendering or claim security acceptance before the later broker work.

## Files

- [Fixture guide](../tests/fixtures/README.md)
- [Fixture catalog](../tests/fixtures/generated/CATALOG.md)
- [Verification report](../tests/fixtures/verification.json)
- [Trust boundaries](trust-boundaries.md)
- [Application test scenarios](test-scenarios.md)
- [Release acceptance specification](release-acceptance-spec.md)

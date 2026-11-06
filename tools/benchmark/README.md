# Performance tools

Read `../../docs/step-11-results.md` for methodology, commands, results and limitations.

- `build_fixture.py`: deterministic synthetic image-heavy PDF and checksum manifest.
- `broker.cjs`: test-only child broker with IPC diagnostics; not shipped as a production API.
- `run.cjs`: fresh/reused-process timings, memory snapshots and twenty closure cycles; also exports the test harness.
- `summarize.cjs`: validates completeness and fixture hashes, computes source-only target comparisons and writes Markdown/JSON summaries.
- `concurrent.cjs`: five simultaneous correct-document sessions and cleanup.
- `pdf-reliability.cjs`: targeted fresh-process startup probe with failure diagnostics.

Requires Windows, existing bundled Node runtime, installed npm dependencies, generated base fixtures and Playwright Chromium. Uses isolated browser profiles, synthetic inputs, native read-only process reporting and no Windows launcher. Does not change security policy. Output contains no authentication tokens or user document content. Results are written under `tests/results/` and are not release certification.

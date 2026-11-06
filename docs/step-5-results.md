# Step 5 — bounded, authenticated file-session broker

Completed implementation and local verification on 2026-11-04. Build version: 0.0.5. This is a development milestone, not production security certification.

## Delivered

- Trusted registration into a loopback broker with per-file credentials, single-use bootstrap, expiry and revocation.
- Immutable read-only snapshots, per-format and aggregate allocation guards, separate protected metadata and original-byte routes.
- Authenticated single-range reads with ETags/If-Range; host/origin/fetch-metadata checks, bounded bootstrap bodies and restrictive response headers.
- Updated text frontend with refresh-safe per-file credentials and an End viewing session control.
- Windows package includes the broker modules and static assets; no renderer-lab dependency is shipped.

See [protocol, ordering rationale and limitations](broker-protocol.md) for the defended design choices. The obsolete step-3 API test was replaced by the broker suite; package tests now exercise protected metadata and bytes instead of `/api/document`.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | 13/13 test groups passed |
| `npm run build:windows` | Native GUI launcher and bundled runtime built |
| `npm run test:package` | 2/2 groups passed: hashes/GUI subsystem and four bundled-runtime path fixtures without system Node on PATH |
| `tools/test-windows-quoting.ps1` | Four native argument-transport cases passed |
| `npm run test:browser` | 2/2 groups passed: six text/path fixtures plus literal markup probe |
| Browser integration | Refresh, wrapping, token-fragment removal, explicit closure and post-closure refresh passed; zero external requests or page errors in the six-fixture run |
| Root lockfile refresh/audit | Version updated to 0.0.5; four development packages audited, zero known findings reported |

Broker coverage includes eight simultaneous bootstrap redemptions with exactly one success, cross-file denial, generic unauthenticated responses, original-file modification/deletion, byte ranges and empty files, rejected hostile headers, body bounds, bootstrap/idle/absolute expiry, concurrent allocation races, failed-snapshot reservation release, invalid signatures/encoding, oversized input, Unicode/UTF-16 preservation, read-budget rejection, large-response abort recovery, and empty-broker shutdown.

One initial hostile-Host test used fetch, which did not transmit the intended Host override; it now uses Node HTTP directly. The unknown Range-unit handling was corrected to return a full response. A proposed slow-consumer test exposed that Windows can accept a complete large write before the consumer reads it: the final suite verifies abort recovery and read admission separately, and does not claim an OS-buffer memory ceiling.

## Not yet qualified

Shared broker reuse across launches, Windows IPC access controls, multi-process aggregate limits, background/sleep recovery, real parser integration, independent security review, supported-browser matrix and clean-machine installation remain outstanding. The installed viewer remains text-only. Step 4's renderer and release evidence gaps still apply.

Next is step 6: connect native launches to one managed broker and establish reliable lifecycle behavior before integrating document renderers into the application shell.

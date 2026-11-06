# File-session broker — current protocol (steps 5–7)

## Order and rationale

Step 4 established that the chosen renderers need repeatable bytes, workers and authenticated range reads. Step 5 supplies that boundary before renderer integration: otherwise each renderer would invent its own file access and lifecycle. Step 6 reuses the broker across native launches and handles session recovery. See [Windows lifecycle](session-lifecycle.md) for process ownership, IPC and design reviews.

Only trusted JavaScript calls `registerFile(path)`. The launcher sends the selected path through an account-restricted Windows named pipe to a hidden native host, which forwards bounded JSON over its Node child's private stdin/stdout pipes. There is no HTTP path-registration, directory-listing, diagnostic or arbitrary-filesystem endpoint. The host serializes requests and consumes each child response even if the initiating client disconnects.

## Protocol

The listener binds to `127.0.0.1`, port 0. A registration returns a random 128-bit file ID and 256-bit bootstrap token. The URL is `/view/<id>#token=<token>`; the fragment never becomes an HTTP request target. The frontend removes it immediately and redeems it once. Tokens and credentials are stored as SHA-256 digests on the server and compared with timing-safe equality.

| Route | Authorization | Behavior |
| --- | --- | --- |
| GET/HEAD `/view/<id>` | None | Generic shell, no filename or contents |
| GET/HEAD fixed assets under the packaged `web` tree | None | Explicit startup index of shipped scripts, styles, fonts, CMaps and WASM; no user-file paths |
| POST `/api/session` | Same-origin JSON `{fileId, token}` | Atomic single-use redemption; returns file-specific bearer credential |
| GET/HEAD `/api/files/<id>/metadata` | Bearer | Basename, format, size and snapshot flag |
| GET/HEAD `/api/files/<id>/bytes` | Bearer | Original bytes as octet-stream attachment |
| POST `/api/files/<id>/ping` | Bearer and Origin | Renew idle activity |
| POST `/api/files/<id>/close` | Bearer and Origin | Revoke, cancel active responses, clear server buffer |

Credential storage is per-file tab `sessionStorage`; fetches omit cookies. It permits refresh but grants no access to another file. Requests require the exact loopback Host; a supplied Origin must match, and POST requires it. Cross-site/same-site fetch metadata and duplicate Host/Origin/Authorization headers are rejected. No CORS allowance is returned. Responses are no-store, nosniff, same-origin resource policy and frame-denied; the shell has a restrictive CSP. These controls supplement bearer authorization, not replace it.

GET supports one byte range: closed, open-ended or suffix. Unsatisfiable/malformed byte ranges and multiple ranges return 416. HEAD ignores Range. Unknown range units are ignored. If-Range matches the per-snapshot ETag or receives the complete representation. There is no multipart range support.

## Snapshot and resource policy

Registration accepts allowlisted extensions, rejects final symbolic links/non-files, Windows network/device paths and alternate streams. It opens one read-only handle, reserves capacity before allocation, reads in 1 MiB pieces, and compares file identity/size/timestamps before and after. Subsequent writes or deletion of the original cannot change the snapshot. Signatures catch obvious format mismatches; they are not complete document validation. Step 7 adds serialized worker validation of archive bounds/names and actual decompression before DOCX/EPUB/XLSX admission, plus raster pixel guards. See the step 7 report for the enforced envelope and remaining validation gaps.

| Limit | Default |
| --- | --- |
| Registered and pending sessions | 8 per broker |
| Snapshot buffers | 256 MiB per broker |
| Format bytes | TXT 8 MiB; MD 2; PDF 150; DOCX/XLSX 12; EPUB/CSV/TSV/images 24 |
| Active server responses for file bytes | 4 |
| Connections | 32 |
| Bootstrap JSON / HTTP headers | 1 KiB / 8 KiB |
| Bootstrap lifetime | 60 seconds |
| Idle / absolute authenticated lifetime | 45 minutes / 8 hours |
| Empty broker grace | 5 seconds |
| Request / socket inactivity timeout | 10 / 15 seconds, subject to Node scheduling |

The snapshot budget is not a total-memory ceiling: runtime, decoded text, browser copies, HTTP/socket buffers and parsers add memory. Native launches into the same installation/login session share these limits. Separate installation copies or Windows login sessions have independent brokers. The response counter ends when Node finishes writing or the response closes; it does not measure unread client/OS buffers. Total-memory qualification under concurrent parser and slow-client pressure remains required.

## Boundaries and remaining flaws

- Same-account malware, administrators, compromised browser extensions and a compromised trusted application origin are outside this boundary. This is not OS-level isolation between tabs. Untrusted renderer content must be isolated before integration.
- The URL fragment and credential exist briefly/in-memory in trusted processes; removing the fragment is not guaranteed erasure from every browser/OS diagnostic surface.
- Clearing a server Buffer on revocation does not securely erase copies already held by the browser, runtime or OS. End viewing also clears the visible text and sessionStorage in that tab.
- File identity checks detect ordinary concurrent changes, not malicious same-user filesystem races. No claim of protection against an attacker able to modify both this app and its source files.
- A full snapshot trades startup latency and memory for consistent reads. Lazy source-file streaming would need equivalent version consistency and bounded persistent handles.
- The 45-minute idle lease tolerates the specified 30-minute background period without timers. Longer sleep, absolute expiry, broker crashes or a browser discarding the page may require reopening through Windows. Clock-advanced tests do not replace real sleep and browser-background qualification.
- PDF, DOCX, EPUB, Markdown, CSV/TSV, XLSX and raster-image adapters are now in the packaged frontend. Their limitations are documented in the prototype README; integration does not complete release qualification.

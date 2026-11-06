# Step 6 — shared Windows broker and session recovery

Implemented 2026-11-04; installed-build verification completed 2026-11-05. Prototype version: 0.0.6. This is a development milestone; release qualification remains incomplete.

## Delivered

- Native launches in one installation/login session reuse a hidden host and one Node runtime. Five independent launch processes received distinct, correct file sessions on one origin.
- Windows named-pipe ACLs, peer checks, startup serialization and lifetime ownership replace one runtime per file. Eight-session and snapshot budgets are now shared in that scope.
- Browser-launch failure revokes only its file; malformed requests, missing files and disconnected control clients do not displace other sessions.
- A 45-minute idle lease supports the required 30-minute background interval without relying on browser heartbeat timers. Visibility/focus/online events check the connection and provide retry or reopen guidance while preserving loaded text.
- Closing the last session stops both processes; host/runtime crashes release ownership and the next native launch recovers. No document copies, lock files or credentials are persisted for recovery.

See [lifecycle decisions and review passes](session-lifecycle.md) and the [current broker protocol](broker-protocol.md).

## Validation

| Check | Evidence |
| --- | --- |
| Broker and lifecycle suite | 17 test groups: original 13 broker cases, default 31-minute no-heartbeat lease, twenty open/close cycles, parent-channel loss and oversized control input |
| Native IPC integration | Five simultaneous launcher clients; one runtime; actual protected pipe ACL allows only current SID and denies network SID; eight-session limit; malformed/disconnected clients; per-file revoke; empty exit; host crash and Node crash with subsequent restart |
| Isolated browser tests | Five test groups across packaged text viewing, literal markup, five independent tabs, transient offline recovery, clock-advanced expiry and broker-crash messaging |
| Package/argument checks | Package hashes, Windows GUI subsystem, bundled runtime without system Node on PATH, four native path-quoting cases |
| Installed prototype | All 14 packaged-file hashes matched; two native launches, including PATH-02's long path, shared one broker and returned correct contents; final closure stopped the broker |

The native IPC test invokes the same C# OpenSession method as the GUI through a test-only driver, avoiding changes to the user's default browser. The host and Node runtime are real packaged processes. NODE_OPTIONS is deliberately invalid and system Node is absent from the helper's PATH; the bundled child still works.

The final native integration run passed in approximately 26.6 seconds, including the long-path fixture and two normal empty shutdowns. This is a suite duration, not a file-opening performance benchmark. A slower provisional run was not accepted as the final result: inherited caller handles were corrected and the harness now treats subprocess timeouts as failures rather than parsing their partial output as success. The test driver also carries the application's manifest and long-path runtime settings; an installed-build check exposed that these were initially missing from the driver.

## Limits and next step

The installed viewer remains text-only. A 45-minute lease means closing all tabs without End viewing session can retain the broker for about 45 minutes plus cleanup grace. Sleep beyond the lease, absolute expiry or lost browser state may require reopening through Windows. Full reload after broker exit can show the browser's own connection error.

Real 30-minute browser-background runs, physical sleep/hibernate, cross-account attack attempts, default-browser GUI qualification, independent security review and clean-machine testing remain outstanding. The clock-advanced tests and observed ACLs do not claim those checks are complete. Release checklist items remain unchecked.

Next: integrate the selected renderers into the application shell using this shared registration, range-delivery and lifecycle contract, preserving content isolation and resource limits.

# Tests that need the running application

Status for every scenario: **NOT RUN — application not implemented.** Fixture verification is a separate activity.

Run destructive file-lifecycle actions only against copies under `tests/fixtures/run-work/`. Capture app version, Windows build, browser/version, fixture ID/hash, exact steps, observed result and evidence. A screenshot can establish appearance, but cannot prove network isolation or authorization.

| ID | Inputs and procedure | Required evidence/outcome | Release checks |
|---|---|---|---|
| SC-01 | Install on a fresh standard-user Windows 11 x64 environment, disable internet, use Open with on TXT-01 and PDF-01 | Correct default browser; useful content; no runtime installation or terminal window | REL-01/02/07/11 |
| SC-02 | Open PATH-01/02/03; launch with no file; choose an unsupported file; simulate browser launch failure | Correct file or specific actionable failure; no argument execution or silent empty page | REL-02/09 |
| SC-03 | Open SESSION-01 through SESSION-05 rapidly; open same file again; refresh each tab | Correct markers in every tab; refreshing does not redeem bootstrap again | REL-04/05 |
| SC-04 | Background a viewer for 30 min; return; separately close all tabs and observe expiry/exit | Survives backgrounding; cleanup follows documented expiry and grace; record elapsed times | REL-04 |
| SC-05 | Sleep/resume; separately stop broker and restart browser | Usable recovery or clear reopen instructions; no wrong document or leaked credentials | REL-04/09 |
| SC-06 | Open disposable file copies, then change bytes, rename/delete, or deny access | Consistent snapshot or specific error; never mixed old/new ranges; canonical hashes unchanged | REL-04/09 |
| SC-07 | Perform 20 open/close cycles, then a crash/restart | No accumulating sessions/handles/memory; temporary residues removed according to policy | REL-04/08 |
| SC-08 | Run all valid fixtures across Edge, Chrome, Firefox; inspect against catalog | Format ground truth holds, documented fidelity limits visible; exact browser versions recorded | REL-03/11 |
| SC-09 | Use only keyboard, 200% browser zoom, light/dark display, screen-reader control inspection | Reachable controls, visible focus, accessible names and usable shell | REL-10 |
| SC-10 | Warm/cold timing runs and large fixtures on reference-class hardware | 9/10 timing criterion, peak incremental memory, cancellation response and meaningful first content recorded | REL-08 |
| SC-11 | Upgrade/uninstall signed release candidate with unrelated file associations present | Original files/settings preserved; app registrations removed without dangling commands | REL-12/13 |
| SEC-01 | Request bytes/metadata/HEAD/ranges with missing credentials, unexpected Host, foreign Origin; inspect listening interface | No document disclosure; loopback only; legitimate entry navigation still works | REL-05/06 |
| SEC-02 | Use session A credential against session B IDs and every read endpoint; try encoded traversal/arbitrary-path arguments | No bytes, names or existence metadata for unauthorized files; no neighboring file access | REL-05/06 |
| SEC-03 | Redeem one bootstrap twice, concurrently, after expiry, and after normal refresh; inspect logs/URL | Exactly one initial redemption; replay/expiry refused; refresh works using session; no credential residue in app logs | REL-05/06 |
| SEC-04 | Load SEC-MD, SEC-EPUB and PDF-SPOOF; instrument parent/document contexts | No execution marker, parent access, application CSS damage, or unsafe navigation; mismatched PDF rejected | REL-06 |
| SEC-05 | Load external-resource probes while capturing attempted requests; try relative neighbor references | Zero automatic external requests and zero unselected neighbor reads; failure to resolve DNS is not a pass | REL-06/07 |
| SEC-06 | SEC-EXPAND with test-only 512 KiB expanded limit; SEC-TRAVERSAL; large fixtures with lowered limits; cancel work | Bounded failure, no filesystem escape, no unresponsive broker; test limit injection disabled in distributed product | REL-06/08/09 |
| SEC-07 | From unrelated web origin attempt to register arbitrary local paths; attempt IPC from another Windows account | No file registration/access; correct IPC permissions | REL-06 |
| SEC-08 | Inspect app logs/temp storage after normal exit and crash; hash originals before/after viewing | No credentials/content in logs; originals unchanged; temporary files scoped and recovered | REL-06/07/13 |

REL-14 dependency/license review and REL-15 documentation review are release audits, not document fixture tests. REL-12 signing is an installer/distribution check. These have not been passed by preparing this corpus.

## Evidence record template

```json
{
  "scenario_id": "SC-03",
  "status": "not_run",
  "app_version": null,
  "windows_build": null,
  "browser_version": null,
  "fixture_ids": ["SESSION-01", "SESSION-02"],
  "manifest_sha256": null,
  "steps": [],
  "observed": null,
  "evidence_paths": [],
  "defect_reference": null
}
```

Use `pass`, `fail`, `blocked`, or `not_run` only after recording actual execution. A missing application or environment is never a pass.

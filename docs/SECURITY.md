# Security: threat model and test plan

Scope: the Android app as built today (offline, no backend). Baseline:
OWASP MASVS (L1). The OWASP API Security Top 10 applies only once a hosted
backend exists; it is listed under "Before adding a backend".

## Assets

1. Integrity of routes and accessibility information (wrong data can send a wheelchair user to steps)
2. User location and camera (privacy)
3. Research session logs
4. Release signing key

## Threat model (STRIDE)

| # | Threat | Example | Mitigation in the app | Status |
|---|---|---|---|---|
| T1 | Tampering: malicious campus pack | A pack marks stairs as step-free | Full validation on import; unknown steps never treated as step-free; provenance shown; only the user can import | Implemented |
| T2 | Tampering: fake or moved QR marker | Sticker sends AR guidance from the wrong place | Markers only match known IDs **on the current route**; alignment still requires the user to stand and confirm; drift budget forces re-alignment; arrows hidden when unreliable | Implemented. Physical marker audits: process item |
| T3 | Spoofing: QR code with a URL | Phishing link in a sticker | Decoded text is compared with marker IDs only, never opened; validator rejects URL-like marker payloads | Implemented |
| T4 | Information disclosure: location | Location leaked or logged | No background location; positions kept in memory; not in session logs; no network calls | Implemented |
| T5 | Information disclosure: camera | Images saved or sent | Frames processed live; only the luminance plane is read for QR, then discarded | Implemented |
| T6 | Tampering: CSV injection | Exported log opens a formula in Excel | Cells starting with `= + - @` are neutralised | Implemented, tested |
| T7 | Denial of service: huge pack file | App freezes on import | 5 MB limit before parsing | Implemented |
| T8 | Elevation: restricted areas | Routing non-residents through a hostel | `allowedRoles` edges excluded unless the role is set | Implemented (roles not yet user-selectable) |
| T9 | Secrets in the APK | API keys extracted | No keys used; ARCore features used need none | Implemented. Re-check if Geospatial or AI is added |
| T10 | Signing key loss or leak | Malicious update | Keystore kept outside the repo, `.gitignore` rules, backed up offline | Process item |

## MASVS L1 checklist

| Area | Requirement | Status |
|---|---|---|
| STORAGE | No sensitive data in logs or backups; minimal local data | Logs hold no coordinates; consider `android:allowBackup="false"` before release (template sets `true`) |
| CRYPTO | No custom crypto | None used |
| AUTH | n/a: no accounts | — |
| NETWORK | TLS for all traffic | No network traffic yet; keep `usesCleartextTraffic` off |
| PLATFORM | Minimal permissions, requested in context | Camera on AR start; location on "My location"/map; ARCore optional |
| PLATFORM | WebView limited to bundled content | Capacitor default; no remote URLs loaded |
| CODE | Dependencies current; release build minified | Run `npm audit` and review; enable R8 for release (ProGuard rules for ARCore/ZXing to be tested) |
| RESILIENCE | (L2, not required) | — |

## Security test plan

| Test | How | Expected |
|---|---|---|
| Malformed pack | Import non-JSON, wrong schema, dangling edges | Rejected with reasons, previous map kept (automated + manual) |
| Pack with unknown steps | Import pack where a key path has `steps: "unknown"` | Step-free routes avoid it (automated) |
| URL in QR | Show a QR containing `https://…` to the AR screen | Ignored; nothing opens |
| Off-route marker | Show a marker from another route | "That marker is not on this route" |
| Permissions denied | Deny camera, deny location | Clear message; map and text directions still work |
| No network | Airplane mode | Search, routing, map, AR guidance work |
| APK secrets scan | `aapt dump strings` / unzip and grep for `AIza`, `sk-`, `key` | Nothing found |
| Backup | `adb backup` / Android 12+ data extraction rules | Decide and document before release |

## Before adding a backend (OWASP API Top 10)

Object-level authorisation on pack and admin endpoints, authentication for
admins, rate limiting on public and AI endpoints, input validation with the
same validator, no keys in the app, HTTPS only, and logging without personal data.

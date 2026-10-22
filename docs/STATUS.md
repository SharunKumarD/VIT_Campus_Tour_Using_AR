# Project status

Last updated: 23 October 2026. "Tested" means tests were actually run; the
column says where. Nothing here was measured on the real VIT campus yet.

## Definition of Done (from the project brief)

| # | Requirement | State | Evidence |
|---|---|---|---|
| 1 | Next.js app runs | Completed, tested | `npm run build`, static export, on the developer PC |
| 2 | Capacitor packages it | Completed, tested | Debug APK built with Gradle on Windows |
| 3 | Installable APK | Completed, tested | `adb install` on realme P3 5G (Android 16) |
| 4 | Runs on a compatible device | Completed, tested | realme P3 5G |
| 5 | Locations searchable | Completed, tested | Unit tests + on phone |
| 6 | Real routing algorithm | Completed, tested | A*; 1,500 random graphs vs brute-force reference |
| 7 | Uses actual location | Implemented, needs device test | Capacitor Geolocation; logic unit-tested; browser-tested with simulated GPS |
| 8 | Genuine ARCore on hardware | Completed, tested | Anchored arrow stayed fixed on the floor (realme P3) |
| 9 | No simulated overlay presented as AR | Completed | Arrows exist only as ARCore-anchored geometry, hidden when unreliable |
| 10 | Indoor checkpoint navigation | Implemented, needs device test | Alignment + RouteGuide unit-tested; QR decode path compiled, marker PDF verified with a decoder |
| 11 | Accessibility constraints enforced, data labelled | Completed, tested | Hard filters; unknown ≠ step-free; demo labels everywhere |
| 12 | Unreliable positioning triggers fallback | Implemented, partly tested | RouteGuide modes unit-tested; on-device test pending |
| 13 | Offline data and routing | Completed, tested in browser | IndexedDB import/revert verified in Chrome; routing needs no network |
| 14 | No production secrets in APK | Completed | No keys used anywhere |
| 15 | Permissions and privacy controls | Implemented | In-context camera/location; delete sessions; reset settings |
| 16 | Essential tests documented and run | Completed | 70+ Node tests, 23 JUnit tests |
| 17 | Research claims referenced | Completed for Phase 0 | Plan document references opened and checked |
| 18 | Results measured, not invented | In progress | Logging built; no field data yet |
| 19 | Reproducible setup | Completed | README |
| 20 | VR future work only | Completed | Not implemented |

## By area

| Area | Completed | Pending | Blocked |
|---|---|---|---|
| Data | Model, validator, demo pack, import/export, provenance | — | **Authorised VIT campus data** |
| Routing | A*, profiles, explanations, instructions | Re-routing after deviation (detected, not re-routed) | — |
| Location | GPS fix, accuracy classes, snapping, demo relocation | Device test; heading use | — |
| AR | Camera, planes, anchors, alignment, guidance modes, QR, study condition | Device tests of guidance and QR; ARCore Geospatial as a second alignment source | VPS coverage at VIT unknown |
| Research | Session logs, CSV/JSON export, protocol | Stage A simulation runs, Stage B field data | Stage C needs IEC approval |
| Security/privacy | Threat model, MASVS checklist, privacy draft, compliance matrix | `allowBackup` decision, licences screen, terms | VIT legal review |
| Release | Signing instructions | Signed release build, R8 rules test | VIT approval for public release |
| Optional | — | AI campus assistant (deliberately not started), hosted backend | Needs navigation proven on device first |

## Known limitations

- Demo campus only. GPS routes are meaningful only after "Place demo map at my location" or a real pack.
- AR alignment depends on the user standing at the marker and facing its arrow; a 5° facing error is about 1.3 m sideways at 15 m.
- Arrows are drawn through walls (no occlusion).
- Floor changes need re-alignment at a marker on the new floor.
- Tested on one phone model.

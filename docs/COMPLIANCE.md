# Compliance matrix

Not legal advice; no compliance is claimed. Have VIT's legal or IT office
review before public release.

**India, DPDP Act 2023 and DPDP Rules 2025:** the Rules were notified in
November 2025 with phased commencement; most operational duties (notice,
consent, security safeguards, breach reporting, retention) apply from around
13 May 2027. Design to them now. GDPR applies only if the app is offered to
people in the EU.

## The 15-point checklist

| # | Item | Applies now? | Status / action |
|---|---|---|---|
| 1 | Privacy policy | Yes | Draft in `docs/PRIVACY.md`; show it in the app before release |
| 2 | Terms and conditions | Before release | Write: demo/beta status, "follow on-site signs", no accessibility guarantee |
| 3 | GDPR / other laws | DPDP yes; GDPR only for EU users | No personal data leaves the phone today |
| 4 | Cookie / tracking consent | No | No cookies, analytics or tracking |
| 5 | Lawful basis and consent | Yes (location, camera, research) | Android runtime permission at point of use; research needs separate informed consent |
| 6 | Marketing consent | No | No marketing |
| 7 | Data deletion | Yes | In-app delete for sessions and settings; uninstall removes all |
| 8 | Data retention | Yes | Sessions kept until deleted; define a study retention period with the ethics committee |
| 9 | Data processing agreements | Not yet | Needed when a hosted backend or AI provider is added |
| 10 | Third-party disclosure | Yes | Google Play Services for AR runs on the device (Google's terms apply); no data shared by this app |
| 11 | Data security | Yes | See `docs/SECURITY.md` |
| 12 | Breach procedure | Before backend | Write: who to notify, within what time (DPDP Rules), how |
| 13 | Intellectual property | Yes | Campus maps/plans belong to VIT: obtain written permission; no VIT logo or official name use without approval |
| 14 | Open-source licences | Yes | Table below; include a licences screen before release |
| 15 | Payments / subscriptions | No | None |

## Additional items

| Item | Status |
|---|---|
| Camera permission | Requested only when AR starts; explained in the app |
| Location: precise vs approximate | Precise needed for routing from your position; approximate still shows you on the map with a warning |
| Location minimisation | No background access; not stored or logged |
| Institutional authorisation | Needed for data collection, marker placement and any campus-wide release |
| Research ethics | IEC approval and informed consent before any participant study |

## Open-source components

| Component | Licence | Used for |
|---|---|---|
| Next.js, React | MIT | Interface |
| Tailwind CSS | MIT | Styles |
| Capacitor (core, android, app, geolocation) | MIT | Android packaging, back button, GPS |
| Google ARCore SDK | Apache 2.0 (SDK); Google Play Services for AR has its own terms | AR |
| ZXing core | Apache 2.0 | QR decoding |
| AndroidX | Apache 2.0 | Android support libraries |

Verify each licence from the installed package before release.

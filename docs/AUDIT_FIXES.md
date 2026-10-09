# Finance tracker audit fixes — 2026-10-09

The audit examined `affb9be37ee83da2d1140eca8cbcfff82f8d604f`. Fixes were applied on top of `5a28b36aa474c45dfd0a0a628e31c69f323e0e02`, preserving the subsequent README edits. Existing ledger records are migrated without clearing the database. No real financial data or provider credentials were used for verification.

## Findings and changes

| ID | Change | Verification |
| --- | --- | --- |
| A01 | History hooks run before every conditional return; an app error boundary handles unexpected rendering failures. | Production browser: History and month changes |
| A02 | Expense sign is normalized from transaction type; backup preserves date, currency and stable UUID. | Backup round trip, browser restore |
| A03 | Missing or invalid FX rates make converted totals unavailable; no implicit 1:1 rate. | Accounting tests, offline browser |
| A04 | Dashboard, AI and PDF use the same conversion rules. Chat separates native-currency totals. PDF rows retain their original currency. | Mixed-currency accounting and PDF browser check |
| A05 | Individual deletion, ledger wipe and replacement restore require confirmation. | Browser cancellation and confirmed deletion |
| A06 | Settings exports a versioned JSON backup and supports merge/replace restore. | Browser export/import |
| A07 | Entire backup validates before one atomic transaction; UUID deduplication, legacy repeat-restore detection, size/count limits and conflicting-ID rejection. | Restore, invalid replacement and duplicate tests |
| A08 | Calendar-indexed six-month aggregation includes every matching row. | 2,200-record regression |
| A09 | Request generations prevent stale dashboard/converter responses from replacing newer selections. | Delayed-response browser regression; dashboard code review |
| A10 | AI reloads on ledger, month, currency, key and consent changes; hidden tabs avoid unnecessary requests. | Browser add-transaction/AI refresh |
| A11 | Failures use an honest built-in provider label; failures are not cached; Refresh bypasses cache and key changes invalidate it. | AI failure/cache/key tests |
| A12 | Thinking cleanup removes explicit reasoning delimiters and preserves ordinary answer openers; empty responses fall back. | Response-filter tests |
| A13 | Writes resolve only after IndexedDB transaction completion and reject aborts. | Forced abort after request success |
| A14 | Failed update lookups show an error instead of Up to date. | Network failure unit/browser checks |
| A15 | Web version comes from tracked package metadata; default repository is tracked; release setter and CI verify Android/web agreement. | Version check, update-selection tests |
| A16 | Release script builds non-debug APKs with mandatory existing-key configuration; no automatic replacement debug signer. | Unsigned-release guard test passed; production signing still needs the original keystore |
| A17 | Only repository HTTPS release URLs are allowed; SHA-256, package ID, newer version code and current signing certificate are checked before installation. | URL/digest tests, native compilation; phone installer/signing test pending |
| A18 | Android 6+ provider keys use AES-GCM and Android Keystore; plaintext migration deletes old values after successful saving. Browser/Android 5 keys are session-only. | Browser plaintext-storage check, native compilation; device Keystore test pending |
| A19 | AI sharing is off by default; explicit opt-in and accurate Groq/Tavily payload disclosure. | No-consent/no-network test and UI review |
| A20 | Indexed recent-100 diary identifies its incomplete scope, separates currencies, attaches once, and caps conversation/context size. | Chat payload regression |
| A21 | Frontend/build dependencies updated; maintained tar compatibility adapter keeps Capacitor 5 sync working. | Clean npm install, npm audit, build and Capacitor sync |
| A22 | PDF code loads only when exporting and runs in a module worker; circular manual vendor splitting removed. | Production startup resource assertions and PDF export |
| A23 | History renders 50 rows per page; PDF reads 250-row pages and renders outside the UI thread. | 121-row browser pagination, same-date cursor and worker PDF tests |
| A24 | Same-currency and empty ledgers skip FX requests; overlapping rate requests share a promise. | Same-currency zero-network test |
| A25 | Finance regressions, browser stories, dependency scans and Android builds are in GitHub Actions. | Local regression suites; branch protection remains a repository-admin setting |
| A26 | Sequential download polling has cancellation, missing-job handling, global/per-request timeouts and string-valued native download IDs. | Missing/timeout/hung/cancelled polling tests, native compilation |
| A27 | Remote main is fast-forwarded before building; exact built content is committed/tagged and branch/tag push is atomic. No post-build rebase. | Release-script review; publication not executed |
| L01 | Every optional legacy API route requires a configured owner bearer token; no token fails closed. Loopback binding is the default. | Auth/read/write/key and missing-configuration tests |
| L02 | Legacy API stores supplied currency/date, migrates existing rows to INR and converts summary/category/AI totals consistently. | Date/currency, mixed-rate and migration tests |
| L03 | Legacy AI cache fingerprints financial data, selected currency and key; mutation/key changes clear cache; failed AI is not live or cached. | Mutation/key/forced-refresh tests |
| L04 | Blank fields, nonfinite/out-of-range amounts and invalid currencies are rejected. Validation responses omit submitted values. | Invalid-input and numeric-Infinity tests |
| L05 | Optional backend dependencies updated and pinned; unused multipart parser removed. | pip-audit of runtime requirements |

## Validation

- Frontend: **21 passing Node regression tests**.
- Optional backend: **14 passing pytest regressions**.
- Production browser: **8 passing Playwright stories** at a phone-sized viewport, using synthetic records and mocked providers.
- Production web build, tracked web/Android version agreement and Capacitor Android sync: passed.
- `npm audit`: **0 known vulnerabilities** in the installed dependency tree.
- `pip-audit -r backend/requirements.txt`: **no known vulnerabilities**.
- Android: `assembleDebug testDebugUnitTest` passed with Java 17, SDK 33 and Gradle 8.0.2; one existing JVM smoke test passed. The new updater and credential vault compiled successfully.
- Release version setter: an isolated fixture verified Android/web/lockfile version agreement and no double increment on repeated invocation.
- Release signing guard: `assembleRelease --offline` with signing variables absent was rejected before packaging, as required.

The PDF worker is approximately 419 kB and is absent from startup requests. The main entry is approximately 189 kB plus the shared motion chunk; these are build sizes, not measured phone startup latency.

## Release and verification limits

The installed/released v2.2.8 APK is unchanged. Source fixes take effect after a rebuilt APK is installed. Publishing a compatible update requires the **original installation signing key**, a newer version/versionCode, and a checksum-bearing release. This change does not publish an APK or test an upgrade on a physical phone. Do not uninstall an existing installation to solve a signing mismatch: export a JSON backup and retain the existing ledger.

Android installer behavior, Keystore migration, Downloads access and phone memory/FPS require device verification. JSON restore is limited to 20 MB/100,000 rows; Android file exports are limited to 20 MB. PDF generation still retains the finished document inside the worker. History filtering/accounting still reads the selected month's records; pagination bounds DOM work rather than promising constant total memory.

The dormant backend is a single-owner service and is not a multi-user authorization design. Dependency scanners report known advisories at the time of the check, rather than guaranteeing the absence of every vulnerability. Release scripts were reviewed but not run to publish; automatic tests do not replace a signed, in-place device upgrade test. Configure required CI checks/branch protection through repository administration if desired.

# Safety / accessibility review — 8 September 2026

## Release position

This is a safer prototype, **not certified for independent travel**. Automated tests use synthetic GPS, route responses, and speech callbacks. No actual emergency messages were sent. They cannot establish that an iPhone/Android user heard intelligible Thai/English or that a street is safe.

## Main findings addressed

| Risk found | Change | Evidence |
| --- | --- | --- |
| App synthesis competed with repeated live regions | Explicit reader/app output choice; one persistent polite announcer; no per-GPS live output; dialog owns its result announcement while background is inert | speech unit tests; browser single-live-region test |
| Cancelled speech callbacks interrupted a newer message | Callback identity guard, bounded queue, grouped obsolete instructions, critical messages no longer cut each other | speech cancellation/priority tests |
| Speech could stop silently | Start/completion watchdogs, visible failure + reader fallback, guidance suspension; retry only clears failure after an utterance ends; known wrong-language voice rejected | speech tests; browser injected engine failure and recovery |
| GPS could stay indefinitely acquiring or freeze without an error | Independent first-fix/staleness deadlines; stop/retry invalidates previous callbacks; reject invalid coordinates | GPS unit tests; browser missing-update and denied-permission scenarios |
| Turn advanced before reaching the turn | Outgoing-path evidence, at most one step per fix; manual confirmation near a turn; polyline distance instead of shortcut distance | navigation geometry tests |
| Arrival near a building could ignore remaining route | Require final route segment/end proximity and GPS accuracy check; disclose snapped-endpoint offset | navigation endpoint/across-wall tests |
| Off-route/paused state still exposed old guidance | Suspend instructions, Repeat and hazard output until usable; replay current instruction after recovery | browser off-route, poor-GPS, stale-GPS tests |
| Failed walking provider fell back to driving | Removed driving fallback; reject malformed provider data | routing adapter tests |
| Public geocoder autocomplete / retry pressure | Explicit search submission, debounce, shared per-tab scheduler including retries, memory cache, backoff + Retry-After/provider cooldown | search cancellation and HTTP tests |
| SOS hold side effects/assistive activation | Hold prepares a native confirmation dialog; keyboard/virtual click also work; explicit activation hands off to SMS/share | StrictMode click/hold tests; browser denial + modal focus restoration |
| Cancelled sharing reported success | No success/session on cancellation; late share results cannot resurrect stopped/arrived sessions | safety-hook tests |
| Snapshot called “live” or “revocable” | UI/README disclose snapshot, expiry limits and inability to revoke received data | code/doc inspection; expiry and malformed-payload tests |
| Saved contacts could silently disappear on storage failure | Validate numbers; report failed persistence/deletion; no 5-second deletion deadline | storage tests and UI inspection |
| Narrow screens/settings awkward with keyboard | Main controls before optional map, single document scrolling, native radios, skip link and focus restoration | browser 320px/large-text/dark-mode/keyboard tests |
| Contrast transiently failed during theme transition | Removed button color interpolation | browser axe regression |
| Tile cache matched obsolete host | Canonical tile URL; browser HTTP cache plus bounded revisit fallback; no prefetch | configuration inspection, **not a live tile offline test** |

## Automated verification

- Latest completed run (8 September 2026): **39 unit/regression tests across 8 files and 14 Chromium browser scenarios passed**. Lint, app typecheck, formatting and production build also passed. The build still reports an initial JS bundle-size advisory (~508 kB before gzip); this is not a functional test failure.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm test`, `npm run build`.
- `npm run test:e2e` runs production preview with Chromium and mocked external requests.
- Unit/regression suites cover speech, GPS, navigation geometry, HTTP, provider validation, settings, SOS, sharing and search races.
- Browser scenarios cover reader-only speech, engine timeout/recovery, poor/stale GPS, off-route Repeat, SOS without GPS, explicit search, keyboard controls, language persistence in storage, 320px reflow, dark/large-text automated accessibility, and service-worker offline app shell.
- Also verified: routing outage retries and spoken error without driving fallback, focus restoration on Stop, persisted Thai after reload, translation-key/interpolation parity with locale-specific plurals, and automated accessibility for guidance/paused/SOS states in both themes.
- Accessibility checks use axe WCAG 2 A/AA and 2.1 AA rules for the tested page state. This **does not certify the entire app or every interaction as WCAG conformant**.
- `test-results/` and Playwright traces are ignored by Git. Re-run after edits; use the run output for exact test counts.

## Required real-device acceptance (not yet performed)

Use a sighted helper in a controlled location; do not test alone in traffic.

- [ ] iPhone Safari + VoiceOver, browser and installed PWA, Thai/English: test announcement spoken once, explore controls while guidance is pending, Repeat/Stop, changes of language and voice mode.
- [ ] Android Chrome + TalkBack: same matrix, virtual-click SOS and radio/selector operation.
- [ ] Without screen reader: confirm audible Thai/English with device speaker, wired/Bluetooth audio, low volume, voice not installed, and network-dependent voices offline.
- [ ] Trigger interruption: phone call, another app, lock screen, Bluetooth disconnect. Confirm guidance is not trusted while app is suspended; recover only after checking audio/GPS.
- [ ] GPS denied, initial timeout, indoor poor accuracy, no further fixes, wrong-side-of-street drift, implausible jumps and recovery. Evaluate thresholds with mobility specialists.
- [ ] Route trial: closely spaced turns, curved path, straight-name changes, U-turn, roundabout, off-route, snapped building entrance. Check instructions against surroundings; no instruction may imply traffic is clear.
- [ ] SOS: use a consenting test contact, inspect stale/no-location text, open SMS without sending, then separately verify a deliberately sent test message. Verify iOS/Android SMS body handling and cancelled share sheets.
- [ ] Snapshot receiver: expiry while page remains open, copied link and tampered payload; explain no remote revocation and no authenticity guarantee.
- [ ] 200–400% zoom, portrait/landscape, display/font preferences, keyboard/switch, focus restoration, contact lists with long names/numbers.
- [ ] Production HTTPS/Vercel: manifest/install/update flow, shell offline, real provider responses, cache headers/attribution, no update/reload during guidance.

## Open limitations / production blockers

- The browser cannot detect/coordinate operating-system screen-reader speech or prove actual audibility. Reader mode requires an enabled reader; app mode should not be combined with one. Polite announcements can be delayed or suppressed by assistive-technology settings.
- GPS accuracy estimates do not prove map matching, safe walking surface or crossing alignment. No camera/obstacle/traffic detection, verified crossings, or heading calibration. Thresholds are prototype choices requiring field validation.
- Background GPS/audio are not guaranteed; the app cannot guarantee an alert is heard when the OS suspends it.
- Nominatim limit is aggregate **across all users of an app**, not per browser. Client-only throttling is insufficient for public scale or multiple tabs. A controlled provider configuration and aggregate limiter/self-hosted or contracted provider are needed before broad release.
- Public walking route service has no app-specific SLA. Walking routes are not a guarantee of accessible pavement or safe crossings. No driving fallback is allowed.
- “Share location” is an unsigned URL snapshot, not live tracking, encryption, authentication or enforceable expiry. A backend is required for real live sharing and revocation; do not claim Phase 4 live-tracking acceptance is complete.
- Map renderer remains Leaflet-specific behind MapView/SharedLocationView even though geocoding/routing/domain services are abstracted.
- SpeechRecognition voice commands are not implemented. PWA installs and tile-cache revisits need actual-device checks.
- No legal/PDPA or independent accessibility certification was performed. Provider/hosting/OS data practices must be assessed before release.

See [README](../README.md) for setup, provider-policy links, privacy flows and deployment steps.

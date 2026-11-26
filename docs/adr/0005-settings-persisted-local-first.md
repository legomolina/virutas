# Settings persisted in the browser, local-first

The Foundations spec (#2) kept Settings in memory only, so they were lost on every reload. Now the Settings the woodworker chose are saved in the browser, so they do not have to be set again on each visit. The design is **local-first**: a copy saved in the browser is always the source the app starts from. Signing in with an account and backing Settings up to a server is not built yet; when it comes, it is added as a sync layer on top of that copy and does not replace it.

## Decision

- **What is saved: Settings only.** The global Settings (preferred Unit System, Imperial precision, language) and each Tool's defaults (`GLOSSARY.md`: Settings). The job in progress (Stock, Cut List, the current job's Kerf…) is not saved.
- **Only the values the woodworker chose.** A value that still follows its default (the browser's locale or language, or the Unit System for Cut Optimizer defaults) is not saved, so it keeps following that default on later visits. When an account arrives, a new device that has changed nothing has nothing to overwrite.
- **One storage seam.** `SettingsStore` reads and writes through a small synchronous interface (`load()` / `save()`) with a `localStorage` implementation. Tools never touch storage. When an account arrives, a sync layer reconciles this local copy with the server's; the app still starts instantly and works offline.
- **The language is saved with the other Settings**, through `SettingsStore`, not with Transloco's persist-lang plugin, so a single saved document holds every Setting. On start-up a saved language takes priority over the browser's and is loaded before the app renders.
- **Versioned and validated.** The saved document carries a `version`. On load each field is checked with the same rules as the store's setters. An invalid field is dropped and falls back to its default without affecting the others. A future format (for example adding when each value changed, for sync) is a migration from one version to the next.
- **Best effort.** When browser storage is unavailable (blocked, private mode, quota), the app keeps Settings in memory as before, without telling the woodworker.
- **Other tabs follow.** A change saved in one tab is applied to the others (`storage` event) without being saved again. This is the same path a change arriving from a server will take.
- **No consent banner.** Saving preferences the woodworker set themselves counts as storage strictly necessary for a service they asked for, so it is exempt from consent under the ePrivacy Directive art. 5(3), Article 29 WP Opinion 04/2012 (user-interface customisation) and the AEPD cookie guide (Spain, LSSI art. 22.2). This holds only while nothing else (analytics, third-party scripts) stores or reads data on the device; anything like that needs its own review. The Settings page says the Settings are kept only in this browser and lets the woodworker reset them all.

## Considered Options

- **Server as the source of truth, with an asynchronous storage interface from day one**: ready for an account, but every Setting would need loading states, and there is no backend.
- **Transloco's persist-lang plugin for the language**: a second store to keep in step with the first, and to sync separately later.
- **Saving every value, including defaults**: freezes values the woodworker never chose, and makes merging two devices ambiguous.
- **Recording when each value changed, now**: only needed for merging across devices, and the merge rule is not decided. The version field lets us add it later.

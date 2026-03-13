// js/version.js
//
// Single source of truth for the app version.
//
// Imported by config.js, pwa.js, and sw.js. sw.js can use this because it is
// registered as a module worker ({ type: "module" }), which is supported in
// Chrome 91+, Firefox 116+, and Safari 16.4+.
//
// ── Release checklist ────────────────────────────────────────────────────────
//   1. Bump APP_VERSION below.
//   2. Add a new entry at the top of data/patchNotes.js.
//   3. Deploy. sw.js and pwa.js pick up the new value automatically.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Current application version. The service worker uses this as its cache name,
 * so changing this string is what triggers a cache refresh for all users on
 * their next visit.
 * @type {string}
 */
export const APP_VERSION = "1.1.0";

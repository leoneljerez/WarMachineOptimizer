// data/patchNotes.js

/**
 * @typedef {Object} PatchNote
 * @property {string}   version  - Semver string matching APP_VERSION in js/version.js
 * @property {string}   date     - ISO 8601 date (YYYY-MM-DD)
 * @property {string[]} changes  - Human-readable list of changes for this version
 */

/**
 * Ordered list of patch notes, newest first.
 *
 * How to update:
 *   1. Add a new entry at the top of this array.
 *   2. Set `version` to match APP_VERSION in js/version.js.
 *   3. Bump `CACHE_NAME` in sw.js to the same version string.
 *   4. Deploy.
 *
 * @type {PatchNote[]}
 */
export const patchNotes = [
	{
		version: "1.1.0",
		date: "2026-03-12",
		changes: ["Added PWA support — install the app to your home screen for offline use.", "Patch notes now display on update so you know what changed."],
	},
	{
		version: "1.0.0",
		date: "2026-01-01",
		changes: ["Initial release."],
	},
];

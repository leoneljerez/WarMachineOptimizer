// sw.js
//
// Service worker powered by Workbox (loaded from CDN — no build step needed).
//
// ── Release checklist ────────────────────────────────────────────────────────
//   1. Bump APP_VERSION in js/version.js          ← source of truth
//   2. Add a new entry at the top of data/patchNotes.js
//   3. Deploy — Workbox handles cache busting automatically via URL revision
// ─────────────────────────────────────────────────────────────────────────────
//
// NOTE: No need to bump a CACHE_VERSION constant anymore. Workbox detects
// file changes via its precache manifest and handles invalidation itself.

importScripts("./workbox/workbox-v7.4.0/workbox-sw.js");

const { precacheAndRoute, cleanupOutdatedCaches } = workbox.precaching;
const { registerRoute, NavigationRoute } = workbox.routing;
const { CacheFirst, NetworkFirst } = workbox.strategies;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { ExpirationPlugin } = workbox.expiration;
const { clientsClaim } = workbox.core;

// Take control of all clients as soon as this SW activates.
// Per web.dev: clientsClaim() is safe here because precaching is complete
// before activation (skipWaiting is called at the end of install).
clientsClaim();

// ─────────────────────────────────────────────
// Precache
// ─────────────────────────────────────────────

// Bump REVISION on every release to invalidate app files.
// Vendor files use revision: null — their URLs are stable and never change.
const REVISION = "1.1.0";

precacheAndRoute([
	{ url: "./index.html", revision: REVISION },
	{ url: "./guardian.html", revision: REVISION },
	{ url: "./manifest.json", revision: REVISION },
	// CSS
	{ url: "./css/bootstrap.min.css", revision: null },
	// JS — app
	{ url: "./js/version.js", revision: REVISION },
	{ url: "./js/app.js", revision: REVISION },
	{ url: "./js/guardian-app.js", revision: REVISION },
	{ url: "./js/pwa.js", revision: REVISION },
	{ url: "./js/config.js", revision: REVISION },
	{ url: "./js/calculator.js", revision: REVISION },
	{ url: "./js/battleengine.js", revision: REVISION },
	{ url: "./js/optimizer.js", revision: REVISION },
	{ url: "./js/optimizerWorker.js", revision: REVISION },
	{ url: "./js/guardianCalculator.js", revision: REVISION },
	{ url: "./js/saveload.js", revision: REVISION },
	{ url: "./js/storage.js", revision: REVISION },
	{ url: "./js/profiles.js", revision: REVISION },
	{ url: "./js/workerManager.js", revision: REVISION },
	{ url: "./js/db.js", revision: REVISION },
	{ url: "./js/utils/utils.js", revision: REVISION },
	{ url: "./js/utils/ranks.js", revision: REVISION },
	{ url: "./js/utils/upgradeAnalyzer.js", revision: REVISION },
	{ url: "./js/ui/machines.js", revision: REVISION },
	{ url: "./js/ui/heroes.js", revision: REVISION },
	{ url: "./js/ui/artifacts.js", revision: REVISION },
	{ url: "./js/ui/tavern.js", revision: REVISION },
	{ url: "./js/ui/results.js", revision: REVISION },
	{ url: "./js/ui/guardian.js", revision: REVISION },
	{ url: "./js/ui/settings.js", revision: REVISION },
	{ url: "./js/ui/notifications.js", revision: REVISION },
	{ url: "./js/ui/upgradeSuggestions.js", revision: REVISION },
	{ url: "./js/ui/formHelpers.js", revision: REVISION },
	{ url: "./js/data/machines.js", revision: REVISION },
	{ url: "./js/data/heroes.js", revision: REVISION },
	{ url: "./js/data/abilities.js", revision: REVISION },
	{ url: "./js/data/patchNotes.js", revision: REVISION },
	// JS — vendor (revision: null = URL is stable, never re-fetch)
	{ url: "./js/vendor/bootstrap.bundle.min.js", revision: null },
	{ url: "./js/vendor/break_eternity.esm.js", revision: null },
	{ url: "./js/vendor/dexie.min.mjs", revision: null },
	// WASM
	{ url: "./js/wasm/wmo_engine_bg.wasm", revision: REVISION },
	{ url: "./js/wasm/wmo_engine.js", revision: REVISION },
	{ url: "./js/wasm/wmo_engine.d.ts", revision: REVISION },
	{ url: "./js/wasm/wmo_engine_bg.wasm.d.ts", revision: REVISION },
	// images needed
	{ url: "./img/ui/wmArmorx128.avif", revision: REVISION },
	{ url: "./img/ui/wmArmorx128.jxl", revision: REVISION },
	{ url: "./img/ui/wmArmorx128.png", revision: REVISION },
	{ url: "./img/ui/wmArmorx128.webp", revision: REVISION },
	{ url: "./img/ui/wmDamagex128.avif", revision: REVISION },
	{ url: "./img/ui/wmDamagex128.jxl", revision: REVISION },
	{ url: "./img/ui/wmDamagex128.png", revision: REVISION },
	{ url: "./img/ui/wmDamagex128.webp", revision: REVISION },
	{ url: "./img/ui/wmHealthx128.avif", revision: REVISION },
	{ url: "./img/ui/wmHealthx128.jxl", revision: REVISION },
	{ url: "./img/ui/wmHealthx128.png", revision: REVISION },
	{ url: "./img/ui/wmHealthx128.webp", revision: REVISION },
]);

// Remove precache entries from old Workbox versions that are no longer needed.
cleanupOutdatedCaches();

// ─────────────────────────────────────────────
// Navigation — NetworkFirst with offline fallback
// ─────────────────────────────────────────────
//
// web.dev recommendation: NetworkFirst for navigations keeps the install
// prompt working (Chrome needs a real network response) and ensures users
// always get fresh HTML when online, while falling back to cache when not.
// networkTimeoutSeconds: 3 means offline fallback kicks in quickly.

registerRoute(
	new NavigationRoute(
		new NetworkFirst({
			cacheName: "pages",
			networkTimeoutSeconds: 3,
			plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
		}),
	),
);

// ─────────────────────────────────────────────
// Images — CacheFirst, 60 day expiry
// ─────────────────────────────────────────────
//
// Images are not precached (too many variants). They are cached on first
// fetch and served from cache thereafter. The image warming in pwa.js
// proactively fetches all images after the SW activates so they are
// available offline without the user needing to visit each tab.

registerRoute(
	({ request }) => request.destination === "image",
	new CacheFirst({
		cacheName: "images",
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({
				maxEntries: 300,
				maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
			}),
		],
	}),
);

// ─────────────────────────────────────────────
// WASM — CacheFirst safety net
// ─────────────────────────────────────────────
//
// The primary WASM loading path is main-thread precompile + transfer to
// worker (see app.js / pwa.js). This route handles any direct .wasm fetches
// that slip through (e.g. in browsers where module worker SW bypass doesn't
// apply, or on guardian.html which has no precompile logic).

registerRoute(
	({ url }) => url.pathname.endsWith(".wasm"),
	new CacheFirst({
		cacheName: "wasm",
		plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
	}),
);

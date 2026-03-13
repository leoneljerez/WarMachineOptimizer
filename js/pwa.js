// js/pwa.js
//
// PWA layer: service worker registration, install prompt, update toast,
// patch notes modal, WASM precompile, and image cache warming.
//
// Follows web.dev/learn/pwa gold standard:
//   - beforeinstallprompt captured and deferred for custom install UI
//   - SW registered without localhost bypass (Chrome enables SW on localhost)
//   - Update detection via updatefound + statechange (not controllerchange)

import { APP_VERSION } from "./version.js";
import { patchNotes } from "./data/patchNotes.js";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const SEEN_VERSION_KEY = "wm_seen_version";

// ─────────────────────────────────────────────
// Install prompt (web.dev pattern)
// ─────────────────────────────────────────────

// Capture the browser's install prompt event so we can trigger it from our
// own UI instead of relying on the browser's ambient prompt.
// Per web.dev: capture beforeinstallprompt early, call prompt() on user gesture.
let _installPromptEvent = null;

window.addEventListener("beforeinstallprompt", (e) => {
	// Prevent the default mini-infobar on mobile (Android).
	e.preventDefault();
	_installPromptEvent = e;
	// Show any custom install button you have in the UI.
	_showInstallButton();
});

window.addEventListener("appinstalled", () => {
	// Clean up after install — hide button, clear deferred event.
	_installPromptEvent = null;
	_hideInstallButton();
	console.log("[PWA] App installed");
});

/**
 * Triggers the browser's native install prompt from a user gesture.
 * Call this from a button's click handler.
 * @returns {Promise<"accepted"|"dismissed"|null>}
 */
export async function triggerInstallPrompt() {
	if (!_installPromptEvent) return null;
	_installPromptEvent.prompt();
	const { outcome } = await _installPromptEvent.userChoice;
	_installPromptEvent = null;
	return outcome;
}

function _showInstallButton() {
	const btn = document.getElementById("pwaInstallBtn");
	if (btn) btn.classList.remove("d-none");
}

function _hideInstallButton() {
	const btn = document.getElementById("pwaInstallBtn");
	if (btn) btn.classList.add("d-none");
}

// ─────────────────────────────────────────────
// Patch notes modal
// ─────────────────────────────────────────────

function _createPatchNotesModal() {
	if (document.getElementById("patchNotesModal")) return;

	const modal = document.createElement("div");
	modal.id = "patchNotesModal";
	modal.className = "modal fade";
	modal.setAttribute("tabindex", "-1");
	modal.setAttribute("aria-labelledby", "patchNotesModalLabel");
	modal.setAttribute("aria-hidden", "true");

	modal.innerHTML = `
		<div class="modal-dialog modal-dialog-scrollable">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title" id="patchNotesModalLabel">What's New</h5>
					<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
				</div>
				<div class="modal-body" id="patchNotesBody"></div>
				<div class="modal-footer">
					<button type="button" class="btn btn-primary" data-bs-dismiss="modal">Got it</button>
				</div>
			</div>
		</div>
	`;

	document.body.appendChild(modal);
}

function _renderPatchNotes(lastSeenVersion) {
	const body = document.getElementById("patchNotesBody");
	if (!body) return;

	body.replaceChildren();

	const toShow = lastSeenVersion ? patchNotes.filter((n) => _isNewerVersion(n.version, lastSeenVersion)) : patchNotes;

	for (const note of toShow) {
		const section = document.createElement("div");
		section.className = "mb-3";

		const heading = document.createElement("h6");
		heading.className = "fw-bold";
		heading.textContent = `v${note.version} — ${note.date}`;

		const list = document.createElement("ul");
		list.className = "mb-0";
		for (const change of note.changes) {
			const item = document.createElement("li");
			item.textContent = change;
			list.appendChild(item);
		}

		section.appendChild(heading);
		section.appendChild(list);
		body.appendChild(section);
	}
}

function _showPatchNotesModal() {
	// eslint-disable-next-line no-undef
	const modal = new bootstrap.Modal(document.getElementById("patchNotesModal"));
	modal.show();

	document.getElementById("patchNotesModal").addEventListener("hidden.bs.modal", () => localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION), { once: true });
}

// ─────────────────────────────────────────────
// Update toast
// ─────────────────────────────────────────────

function _showUpdateToast() {
	const toastRoot = document.getElementById("toastRoot");
	if (!toastRoot) return;

	const toastEl = document.createElement("div");
	toastEl.className = "toast align-items-center border-0 text-bg-info";
	toastEl.setAttribute("role", "status");
	toastEl.setAttribute("aria-live", "polite");
	toastEl.setAttribute("aria-atomic", "true");

	toastEl.innerHTML = `
		<div class="toast-body d-flex flex-column gap-2">
			<div><strong>Update installed</strong> — v${APP_VERSION} is ready.</div>
			<div class="d-flex gap-2">
				<button type="button" class="btn btn-sm btn-light" id="pwaReloadBtn">Reload now</button>
				<button type="button" class="btn btn-sm btn-outline-light" id="pwaNotesBtn">What's new?</button>
				<button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="toast" aria-label="Dismiss"></button>
			</div>
		</div>
	`;

	toastRoot.appendChild(toastEl);

	// eslint-disable-next-line no-undef
	const toast = new bootstrap.Toast(toastEl, { autohide: false });
	toast.show();

	toastEl.querySelector("#pwaReloadBtn").addEventListener("click", () => window.location.reload());
	toastEl.querySelector("#pwaNotesBtn").addEventListener("click", () => {
		toast.hide();
		_renderPatchNotes(null);
		_showPatchNotesModal();
	});
	toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}

// ─────────────────────────────────────────────
// Version comparison
// ─────────────────────────────────────────────

function _isNewerVersion(a, b) {
	const parse = (v) => v.split(".").map(Number);
	const [aMaj, aMin, aPat] = parse(a);
	const [bMaj, bMin, bPat] = parse(b);
	if (aMaj !== bMaj) return aMaj > bMaj;
	if (aMin !== bMin) return aMin > bMin;
	return aPat > bPat;
}

// ─────────────────────────────────────────────
// First-visit patch notes
// ─────────────────────────────────────────────

function _checkFirstVisitNotes() {
	const lastSeen = localStorage.getItem(SEEN_VERSION_KEY);
	if (!lastSeen || _isNewerVersion(APP_VERSION, lastSeen)) {
		_renderPatchNotes(lastSeen);
		setTimeout(_showPatchNotesModal, 800);
	}
}

// ─────────────────────────────────────────────
// Image cache warming
// ─────────────────────────────────────────────

/**
 * Proactively fetches all image paths through the SW so they are cached
 * before the user visits each tab. Fire-and-forget — never blocks startup.
 *
 * Uses cache: "no-store" so requests bypass the HTTP cache and go straight
 * to the SW, which then stores them in its own CacheFirst image cache.
 *
 * @param {string[]} imagePaths
 */
async function _warmImageCache(imagePaths) {
	if (!imagePaths?.length || !navigator.serviceWorker?.controller) return;

	// Run in background — allSettled so one failure doesn't abort the rest.
	Promise.allSettled(imagePaths.map((path) => fetch(path, { cache: "no-store" }))).then(() => console.log("[PWA] Image cache warmed"));
}

// ─────────────────────────────────────────────
// WASM precompile (exported — used by app.js)
// ─────────────────────────────────────────────

/**
 * Fetches and compiles the WASM module on the main thread where the SW's
 * fetch handler intercepts correctly. Chrome's module workers bypass the SW
 * for dynamic import() calls, so WASM must be compiled here and transferred.
 *
 * @returns {Promise<WebAssembly.Module|null>}
 */
export async function preloadWasm() {
	try {
		const wasmUrl = new URL("../wasm/wmo_engine_bg.wasm", import.meta.url).href;
		const response = await fetch(wasmUrl);
		if (!response.ok) {
			console.warn(`[PWA] WASM fetch failed — HTTP ${response.status}`);
			return null;
		}
		const module = await WebAssembly.compile(await response.arrayBuffer());
		console.log("[PWA] WASM precompiled");
		return module;
	} catch (err) {
		console.warn("[PWA] WASM preload failed, JS fallback will be used:", err.message);
		return null;
	}
}

// ─────────────────────────────────────────────
// Service worker registration
// ─────────────────────────────────────────────

/**
 * Registers sw.js and wires the update detection flow.
 *
 * Per web.dev lifecycle:
 *   1. Browser byte-checks sw.js on every page load.
 *   2. If changed, new worker installs alongside the active one.
 *   3. updatefound + statechange = "activated" signals update is ready.
 *   4. We show the update toast; user chooses when to reload.
 *
 * Note: no localhost bypass — Chrome supports SW on localhost for dev/testing.
 */
async function _registerServiceWorker() {
	if (!("serviceWorker" in navigator)) return;

	try {
		const registration = await navigator.serviceWorker.register("./sw.js", {
			// Per web.dev: updateViaCache: "none" ensures sw.js itself is always
			// fetched from the network, never from the HTTP cache.
			updateViaCache: "none",
		});

		// Per web.dev: check for updates on each page load (in case the user
		// has had the tab open for a long time without navigating).
		registration.update();

		// updatefound fires when a new SW version starts installing.
		registration.addEventListener("updatefound", () => {
			const newWorker = registration.installing;
			if (!newWorker) return;

			newWorker.addEventListener("statechange", () => {
				// "activated" + existing controller = genuine update (not first install).
				if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
					_showUpdateToast();
				}
			});
		});
	} catch (err) {
		console.error("[PWA] Service worker registration failed:", err);
	}
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Initialises the PWA layer. Call once from app.js after DOM is ready.
 * @param {string[]} imagePaths - Image paths to warm into SW cache
 */
export async function initPWA(imagePaths = []) {
	_createPatchNotesModal();
	await _registerServiceWorker();
	_checkFirstVisitNotes();
	_warmImageCache(imagePaths); // fire-and-forget
}

/**
 * Opens the patch notes modal. Expose via settings or "What's new?" link.
 */
export function showPatchNotes() {
	const lastSeen = localStorage.getItem(SEEN_VERSION_KEY);
	_renderPatchNotes(lastSeen);
	_showPatchNotesModal();
}

// profiles.js
import { db } from "./db.js";
import { AppConfig } from "./config.js";
import { showToast } from "./ui/notifications.js";
import { autoLoad } from "./storage.js";
import { createInitialStore } from "./app.js";
import { renderMachines } from "./ui/machines.js";
import { renderHeroes } from "./ui/heroes.js";
import { renderArtifacts } from "./ui/artifacts.js";
import { renderTavernCards } from "./ui/tavern.js";

// ─────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────

/**
 * Resets the store to defaults and refreshes all UI panels.
 * Used when switching to an empty profile.
 * @param {Object} store
 * @private
 */
function _resetStoreUI(store) {
	Object.assign(store, createInitialStore());
	document.getElementById("engineerLevel").value = store.engineerLevel;
	document.getElementById("scarabLevel").value = store.scarabLevel;
	document.getElementById("riftRank").value = store.riftRank;
	renderMachines(store.machines);
	renderHeroes(store.heroes);
	renderArtifacts(store.artifacts);
	renderTavernCards(store.machines);
}

/**
 * Refreshes both the header profile selector and the management modal list.
 * Called after every profile mutation to keep both views consistent.
 * @param {Object} store
 * @private
 */
async function _refreshProfileUI(store) {
	await renderProfileSelector(store);
	// Re-render management list only when it is visible
	const container = document.getElementById("profileManagementList");
	if (container) await renderProfileManagement();
}

// ─────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────

/**
 * Renders the profile dropdown in the header.
 * @param {Object} store - Application store
 */
export async function renderProfileSelector(store) {
	const container = document.getElementById("profileSelector");
	if (!container) return;

	const [profiles, activeProfile] = await Promise.all([db.getAllProfiles(), db.getActiveProfile()]);

	const dropdownBtn = document.createElement("button");
	dropdownBtn.className = "btn btn-outline-primary dropdown-toggle d-flex align-items-center gap-2";
	dropdownBtn.type = "button";
	dropdownBtn.setAttribute("data-bs-toggle", "dropdown");
	dropdownBtn.setAttribute("aria-expanded", "false");

	const icon = document.createElement("i");
	icon.className = "bi bi-person-circle";

	const text = document.createElement("span");
	text.textContent = activeProfile ? activeProfile.name : "No Profile";
	dropdownBtn.append(icon, text);

	const dropdownMenu = document.createElement("ul");
	dropdownMenu.className = "dropdown-menu";

	for (const profile of profiles) {
		const li = document.createElement("li");

		if (profile.isActive) {
			const activeItem = document.createElement("span");
			activeItem.className = "dropdown-item active";
			activeItem.textContent = profile.name;
			li.appendChild(activeItem);
		} else {
			const link = document.createElement("a");
			link.className = "dropdown-item";
			link.href = "#";
			link.textContent = profile.name;
			link.addEventListener("click", async (e) => {
				e.preventDefault();
				await switchToProfile(profile.id, store);
			});
			li.appendChild(link);
		}

		dropdownMenu.appendChild(li);
	}

	if (profiles.length > 0) {
		const divider = document.createElement("li");
		const hr = document.createElement("hr");
		hr.className = "dropdown-divider";
		divider.appendChild(hr);
		dropdownMenu.appendChild(divider);
	}

	if (profiles.length < AppConfig.MAX_PROFILES) {
		const newProfileLi = document.createElement("li");
		const newProfileLink = document.createElement("a");
		newProfileLink.className = "dropdown-item";
		newProfileLink.href = "#";
		newProfileLink.innerHTML = '<i class="bi bi-plus-circle me-2"></i>New Profile';
		newProfileLink.addEventListener("click", async (e) => {
			e.preventDefault();
			await createNewProfile(store);
		});
		newProfileLi.appendChild(newProfileLink);
		dropdownMenu.appendChild(newProfileLi);
	} else {
		const maxLi = document.createElement("li");
		const maxItem = document.createElement("span");
		maxItem.className = "dropdown-item text-muted";
		maxItem.textContent = `Max ${AppConfig.MAX_PROFILES} profiles`;
		maxLi.appendChild(maxItem);
		dropdownMenu.appendChild(maxLi);
	}

	const manageLi = document.createElement("li");
	const manageLink = document.createElement("a");
	manageLink.className = "dropdown-item";
	manageLink.href = "#";
	manageLink.innerHTML = '<i class="bi bi-gear me-2"></i>Manage Profiles';
	manageLink.setAttribute("data-bs-toggle", "modal");
	manageLink.setAttribute("data-bs-target", "#manageProfilesModal");
	manageLi.appendChild(manageLink);
	dropdownMenu.appendChild(manageLi);

	container.replaceChildren(dropdownBtn, dropdownMenu);
}

/**
 * Renders the profile management modal content.
 * @param {Object} store - Application store (needed for rename/delete actions)
 */
export async function renderProfileManagement(store) {
	const container = document.getElementById("profileManagementList");
	if (!container) return;

	const profiles = await db.getAllProfiles();

	if (profiles.length === 0) {
		const msg = document.createElement("p");
		msg.className = "text-secondary text-center";
		msg.textContent = "No profiles found. Create one to get started!";
		container.replaceChildren(msg);
		return;
	}

	const list = document.createElement("div");
	list.className = "list-group";

	for (const profile of profiles) {
		const item = document.createElement("div");
		item.className = `list-group-item d-flex justify-content-between align-items-center ${profile.isActive ? "active" : ""}`;

		const nameSection = document.createElement("div");
		nameSection.className = "d-flex align-items-center gap-2";

		if (profile.isActive) {
			const badge = document.createElement("span");
			badge.className = "badge bg-success";
			badge.textContent = "Active";
			nameSection.appendChild(badge);
		}

		const nameSpan = document.createElement("span");
		nameSpan.textContent = profile.name;
		nameSection.appendChild(nameSpan);

		const buttonSection = document.createElement("div");
		buttonSection.className = "btn-group btn-group-sm";

		const renameBtn = document.createElement("button");
		renameBtn.className = "btn btn-outline-secondary";
		renameBtn.innerHTML = '<i class="bi bi-pencil"></i>';
		renameBtn.title = "Rename";
		renameBtn.addEventListener("click", () => renameProfile(profile.id, store));
		buttonSection.appendChild(renameBtn);

		const canDelete = profiles.length > 1;
		const deleteBtn = document.createElement("button");
		deleteBtn.className = "btn btn-outline-danger";
		deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
		deleteBtn.title = canDelete ? "Delete" : "Cannot delete only profile";
		deleteBtn.disabled = !canDelete;
		deleteBtn.addEventListener("click", () => {
			if (canDelete) deleteProfile(profile.id, profile.name, store);
		});
		buttonSection.appendChild(deleteBtn);

		item.append(nameSection, buttonSection);
		list.appendChild(item);
	}

	container.replaceChildren(list);
}

// ─────────────────────────────────────────────
// Profile mutations
// ─────────────────────────────────────────────

/**
 * Switches the active profile and refreshes the UI.
 * Loads saved data if the profile has any; resets to defaults otherwise.
 * @param {number} profileId
 * @param {Object} store
 */
async function switchToProfile(profileId, store) {
	try {
		await db.switchProfile(profileId);
		const profile = await db.getActiveProfile();
		const state = await db.loadState();

		if (state) {
			await autoLoad(store);
			showToast(`Switched to profile: ${profile.name}`, "success");
		} else {
			_resetStoreUI(store);
			showToast(`Switched to new profile: ${profile.name}`, "success");
		}

		await _refreshProfileUI(store);
	} catch (error) {
		console.error("Failed to switch profile:", error);
		showToast("Failed to switch profile", "danger");
	}
}

/**
 * Prompts for a name and creates a new profile, then switches to it.
 * @param {Object} store
 */
async function createNewProfile(store) {
	const existingCount = (await db.getAllProfiles()).length;
	const name = prompt(`Enter name for new profile (${AppConfig.MAX_PROFILES} max):`, `Profile ${existingCount + 1}`);

	if (!name?.trim()) return;

	try {
		const profileId = await db.createProfile(name.trim());
		showToast(`Created profile: ${name}`, "success");
		await switchToProfile(profileId, store);
	} catch (error) {
		console.error("Failed to create profile:", error);
		showToast(error.message || "Failed to create profile", "danger");
	}
}

/**
 * Prompts for a new name and renames the given profile.
 * @param {number} profileId
 * @param {Object} store
 */
async function renameProfile(profileId, store) {
	const profile = await db.profiles.get(profileId);
	const newName = prompt("Enter new profile name:", profile.name);

	if (!newName?.trim() || newName.trim() === profile.name) return;

	try {
		await db.renameProfile(profileId, newName.trim());
		showToast("Profile renamed successfully", "success");
		await _refreshProfileUI(store);
	} catch (error) {
		console.error("Failed to rename profile:", error);
		showToast("Failed to rename profile", "danger");
	}
}

/**
 * Confirms and deletes a profile, then loads the newly active profile.
 * @param {number} profileId
 * @param {string} profileName
 * @param {Object} store
 */
async function deleteProfile(profileId, profileName, store) {
	if (!confirm(`Delete profile "${profileName}"? This cannot be undone.`)) return;

	try {
		await db.deleteProfile(profileId);
		showToast("Profile deleted successfully", "success");
		await autoLoad(store);
		await _refreshProfileUI(store);
	} catch (error) {
		console.error("Failed to delete profile:", error);
		showToast(error.message || "Failed to delete profile", "danger");
	}
}

// ─────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────

/**
 * Bootstraps the profile system on app startup.
 * Creates a default profile if none exist, ensures an active profile is set,
 * then renders the selector.
 * @param {Object} store
 */
export async function initializeProfiles(store) {
	try {
		let profiles = await db.getAllProfiles();

		if (profiles.length === 0) {
			await db.createProfile(AppConfig.DEFAULT_PROFILE_NAME);
			profiles = await db.getAllProfiles();
		}

		const active = await db.getActiveProfile();
		if (!active && profiles.length > 0) {
			await db.switchProfile(profiles[0].id);
		}

		await renderProfileSelector(store);
	} catch (error) {
		console.error("Failed to initialize profiles:", error);
		showToast("Failed to initialize profiles", "danger");
	}
}

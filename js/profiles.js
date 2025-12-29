// profiles.js
import { db } from "./db.js";
import { AppConfig } from "./config.js";
import { showToast } from "./ui/notifications.js";
import { autoLoad } from "./storage.js";

/**
 * Renders the profile dropdown in the header
 * @param {import('./app.js').Store} store - Application store
 */
export async function renderProfileSelector(store) {
	const container = document.getElementById("profileSelector");
	if (!container) return;

	const profiles = await db.getAllProfiles();
	const activeProfile = await db.getActiveProfile();

	// Clear existing content
	container.replaceChildren();

	// Create dropdown button
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

	// Create dropdown menu
	const dropdownMenu = document.createElement("ul");
	dropdownMenu.className = "dropdown-menu";

	// Add existing profiles
	for (let i = 0; i < profiles.length; i++) {
		const profile = profiles[i];
		const li = document.createElement("li");

		if (profile.isActive) {
			// Active profile - show as active
			const activeItem = document.createElement("span");
			activeItem.className = "dropdown-item active";
			activeItem.textContent = profile.name;
			li.appendChild(activeItem);
		} else {
			// Inactive profile - make clickable
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

	// Add divider if there are profiles
	if (profiles.length > 0) {
		const divider = document.createElement("li");
		const hr = document.createElement("hr");
		hr.className = "dropdown-divider";
		divider.appendChild(hr);
		dropdownMenu.appendChild(divider);
	}

	// Add "New Profile" option if under limit
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
		// Show max reached message
		const maxLi = document.createElement("li");
		const maxItem = document.createElement("span");
		maxItem.className = "dropdown-item text-muted";
		maxItem.textContent = `Max ${AppConfig.MAX_PROFILES} profiles`;
		maxLi.appendChild(maxItem);
		dropdownMenu.appendChild(maxLi);
	}

	// Add "Manage Profiles" option
	const manageLi = document.createElement("li");
	const manageLink = document.createElement("a");
	manageLink.className = "dropdown-item";
	manageLink.href = "#";
	manageLink.innerHTML = '<i class="bi bi-gear me-2"></i>Manage Profiles';
	manageLink.setAttribute("data-bs-toggle", "modal");
	manageLink.setAttribute("data-bs-target", "#manageProfilesModal");
	manageLi.appendChild(manageLink);
	dropdownMenu.appendChild(manageLi);

	container.appendChild(dropdownBtn);
	container.appendChild(dropdownMenu);
}

/**
 * Switches to a different profile
 * @param {number} profileId - Profile ID to switch to
 * @param {import('./app.js').Store} store - Application store
 */
async function switchToProfile(profileId, store) {
	try {
		await db.switchProfile(profileId);

		// Get the new profile
		const profile = await db.getActiveProfile();

		// Check if the new profile has any data
		const state = await db.loadState();

		if (state) {
			// Profile has data - load it
			await autoLoad(store);
			showToast(`Switched to profile: ${profile.name}`, "success");
		} else {
			// Profile is empty - reset to defaults and show empty state
			const { createInitialStore } = await import("./app.js");
			const defaults = createInitialStore();

			// Reset store to defaults
			Object.assign(store, defaults);

			// Update UI inputs
			document.getElementById("engineerLevel").value = store.engineerLevel;
			document.getElementById("scarabLevel").value = store.scarabLevel;
			document.getElementById("riftRank").value = store.riftRank;

			// Re-render UI
			const { renderMachines } = await import("./ui/machines.js");
			const { renderHeroes } = await import("./ui/heroes.js");
			const { renderArtifacts } = await import("./ui/artifacts.js");
			const { renderTavernCards } = await import("./ui/tavern.js");

			renderMachines(store.machines);
			renderHeroes(store.heroes);
			renderArtifacts(store.artifacts);
			renderTavernCards(store.machines);

			showToast(`Switched to new profile: ${profile.name}`, "success");
		}

		// Update profile selector
		await renderProfileSelector(store);
	} catch (error) {
		console.error("Failed to switch profile:", error);
		showToast("Failed to switch profile", "danger");
	}
}

/**
 * Creates a new profile
 * @param {import('./app.js').Store} store - Application store
 */
async function createNewProfile(store) {
	const name = prompt(`Enter name for new profile (${AppConfig.MAX_PROFILES} max):`, `Profile ${(await db.getAllProfiles()).length + 1}`);

	if (!name || !name.trim()) {
		return;
	}

	try {
		const profileId = await db.createProfile(name.trim());
		showToast(`Created profile: ${name}`, "success");

		// Refresh profile selector
		await renderProfileSelector(store);
        await switchToProfile(profileId, store);
        
	} catch (error) {
		console.error("Failed to create profile:", error);
		showToast(error.message || "Failed to create profile", "danger");
	}
}

/**
 * Renders the profile management modal content
 */
export async function renderProfileManagement() {
	const container = document.getElementById("profileManagementList");
	if (!container) return;

	const profiles = await db.getAllProfiles();
	//const activeProfile = await db.getActiveProfile();

	container.replaceChildren();

	if (profiles.length === 0) {
		const emptyMessage = document.createElement("p");
		emptyMessage.className = "text-secondary text-center";
		emptyMessage.textContent = "No profiles found. Create one to get started!";
		container.appendChild(emptyMessage);
		return;
	}

	const list = document.createElement("div");
	list.className = "list-group";

	for (let i = 0; i < profiles.length; i++) {
		const profile = profiles[i];

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

		// Rename button
		const renameBtn = document.createElement("button");
		renameBtn.className = "btn btn-outline-secondary";
		renameBtn.innerHTML = '<i class="bi bi-pencil"></i>';
		renameBtn.title = "Rename";
		renameBtn.addEventListener("click", async () => {
			await renameProfile(profile.id);
		});
		buttonSection.appendChild(renameBtn);

		// Delete button (can't delete active profile if it's the only one)
		const canDelete = profiles.length > 1;
		const deleteBtn = document.createElement("button");
		deleteBtn.className = "btn btn-outline-danger";
		deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
		deleteBtn.title = canDelete ? "Delete" : "Cannot delete only profile";
		deleteBtn.disabled = !canDelete;
		deleteBtn.addEventListener("click", async () => {
			if (canDelete) {
				await deleteProfile(profile.id, profile.name);
			}
		});
		buttonSection.appendChild(deleteBtn);

		item.appendChild(nameSection);
		item.appendChild(buttonSection);
		list.appendChild(item);
	}

	container.appendChild(list);
}

/**
 * Renames a profile
 * @param {number} profileId - Profile ID
 */
async function renameProfile(profileId) {
	const profile = await db.profiles.get(profileId);
	const newName = prompt("Enter new profile name:", profile.name);

	if (!newName || !newName.trim() || newName.trim() === profile.name) {
		return;
	}

	try {
		await db.renameProfile(profileId, newName.trim());
		showToast("Profile renamed successfully", "success");

		// Refresh management list
		await renderProfileManagement();
        const store = window.appStore; // Access global store
		await renderProfileSelector(store);

	} catch (error) {
		console.error("Failed to rename profile:", error);
		showToast("Failed to rename profile", "danger");
	}
}

/**
 * Deletes a profile
 * @param {number} profileId - Profile ID
 * @param {string} profileName - Profile name (for confirmation)
 */
async function deleteProfile(profileId, profileName) {
	const confirmed = confirm(`Delete profile "${profileName}"? This cannot be undone.`);

	if (!confirmed) {
		return;
	}

	try {
		//const wasActive = (await db.profiles.get(profileId)).isActive;

		await db.deleteProfile(profileId);
		showToast("Profile deleted successfully", "success");

		// Refresh management list
		await renderProfileManagement();
        const store = window.appStore; // Access global store
		await autoLoad(store);
		await renderProfileSelector(store);
	} catch (error) {
		console.error("Failed to delete profile:", error);
		showToast(error.message || "Failed to delete profile", "danger");
	}
}

/**
 * Initializes profile system on app startup
 * Creates default profile if none exist
 * @param {import('./app.js').Store} store - Application store
 */
export async function initializeProfiles(store) {
	try {
		let profiles = await db.getAllProfiles();

		// Create default profile if none exist
		if (profiles.length === 0) {
			console.log("No profiles found, creating default profile");
			await db.createProfile(AppConfig.DEFAULT_PROFILE_NAME);

			// Re-fetch profiles after creation to ensure we have the new profile
			profiles = await db.getAllProfiles();
		}

		// Verify we have an active profile
		const activeProfile = await db.getActiveProfile();
		if (!activeProfile && profiles.length > 0) {
			// Shouldn't happen, but fail-safe: activate first profile
			await db.switchProfile(profiles[0].id);
		}

		// Render profile selector
		await renderProfileSelector(store);
	} catch (error) {
		console.error("Failed to initialize profiles:", error);
		showToast("Failed to initialize profiles", "danger");
	}
}

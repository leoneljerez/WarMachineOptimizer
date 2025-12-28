// db.js
import Dexie from "https://cdn.jsdelivr.net/npm/dexie@4.0.10/+esm";
import { AppConfig } from "./config.js";

/**
 * War Machine Optimizer Database with Profile Support
 */
class WMDatabase extends Dexie {
	constructor() {
		super("WarMachineOptimizer");

		// Single version with profile support
		this.version(1).stores({
			profiles: "++id, name, isActive",
			general: "profileId",
			machines: "[profileId+id], profileId, id",
			heroes: "[profileId+id], profileId, id",
			artifacts: "[profileId+stat], profileId, stat",
			results: "++id, [profileId+mode], profileId, mode",
		});
	}

	// ========================================
	// Profile Management
	// ========================================

	async getActiveProfile() {
		return await this.profiles.where("isActive").equals(1).first();
	}

	async getAllProfiles() {
		return await this.profiles.toArray();
	}

	async createProfile(name) {
		const count = await this.profiles.count();
		if (count >= AppConfig.MAX_PROFILES) {
			throw new Error(`Maximum ${AppConfig.MAX_PROFILES} profiles allowed`);
		}

		const isActive = count === 0 ? 1 : 0;
		const profileId = await this.profiles.add({ name, isActive });

		// Initialize empty data
		await this.general.put({
			profileId,
			engineerLevel: AppConfig.DEFAULTS.ENGINEER_LEVEL,
			scarabLevel: AppConfig.DEFAULTS.SCARAB_LEVEL,
			riftRank: AppConfig.DEFAULTS.RIFT_RANK,
		});

		const artifactRecords = AppConfig.ARTIFACT_STATS.map((stat) => ({
			profileId,
			stat,
			values: Object.fromEntries(AppConfig.ARTIFACT_PERCENTAGES.map((p) => [p, 0])),
		}));
		await this.artifacts.bulkPut(artifactRecords);

		return profileId;
	}

	async switchProfile(profileId) {
		await this.transaction("rw", this.profiles, async () => {
			await this.profiles.toCollection().modify({ isActive: 0 });
			await this.profiles.update(profileId, { isActive: 1 });
		});
	}

	async renameProfile(profileId, newName) {
		await this.profiles.update(profileId, { name: newName });
	}

	async deleteProfile(profileId) {
		const profile = await this.profiles.get(profileId);
		if (!profile) throw new Error("Profile not found");

		await this.transaction("rw", [this.profiles, this.general, this.machines, this.heroes, this.artifacts, this.results], async () => {
			await this.profiles.delete(profileId);
			await this.general.where("profileId").equals(profileId).delete();
			await this.machines.where("profileId").equals(profileId).delete();
			await this.heroes.where("profileId").equals(profileId).delete();
			await this.artifacts.where("profileId").equals(profileId).delete();
			await this.results.where("profileId").equals(profileId).delete();

			if (profile.isActive) {
				const remaining = await this.profiles.toArray();
				if (remaining.length > 0) {
					await this.profiles.update(remaining[0].id, { isActive: 1 });
				}
			}
		});
	}

	// ========================================
	// Data Methods
	// ========================================

	async saveState(state) {
		const profile = await this.getActiveProfile();
		if (!profile) throw new Error("No active profile");

		await this.transaction("rw", [this.general, this.machines, this.heroes, this.artifacts], async () => {
			// Save general
			await this.general.put({
				profileId: profile.id,
				engineerLevel: state.engineerLevel,
				scarabLevel: state.scarabLevel,
				riftRank: state.riftRank,
			});

			// Save machines
			const machineRecords = state.machines.map((m) => ({
				profileId: profile.id,
				id: m.id,
				rarity: m.rarity,
				level: m.level,
				blueprints: m.blueprints,
				inscriptionLevel: m.inscriptionLevel || 0,
				sacredLevel: m.sacredLevel || 0,
			}));
			await this.machines.bulkPut(machineRecords);

			// Save heroes
			const heroRecords = state.heroes.map((h) => ({
				profileId: profile.id,
				id: h.id,
				percentages: h.percentages,
			}));
			await this.heroes.bulkPut(heroRecords);

			// Save artifacts
			const artifactRecords = Object.keys(state.artifacts).map((stat) => ({
				profileId: profile.id,
				stat,
				values: state.artifacts[stat],
			}));
			await this.artifacts.bulkPut(artifactRecords);
		});
	}

	async loadState() {
		const profile = await this.getActiveProfile();
		if (!profile) return null;

		const count = await this.machines.where("profileId").equals(profile.id).count();
		if (count === 0) return null;

		const [general, machines, heroes, artifacts] = await Promise.all([
			this.general.get(profile.id),
			this.machines.where("profileId").equals(profile.id).toArray(),
			this.heroes.where("profileId").equals(profile.id).toArray(),
			this.artifacts.where("profileId").equals(profile.id).toArray(),
		]);

		if (!general) return null;

		const artifactsObj = {};
		for (const a of artifacts) {
			artifactsObj[a.stat] = a.values;
		}

		return {
			engineerLevel: general.engineerLevel,
			scarabLevel: general.scarabLevel,
			riftRank: general.riftRank,
			machines,
			heroes,
			artifacts: artifactsObj,
		};
	}

	async exportData() {
		const state = await this.loadState();

		if (!state) {
			return JSON.stringify(
				{
					version: 1,
					appVersion: AppConfig.APP_VERSION,
					general: {
						engineerLevel: 0,
						scarabLevel: 0,
						riftRank: "bronze",
					},
					machines: [],
					heroes: [],
					artifacts: Object.fromEntries(AppConfig.ARTIFACT_STATS.map((s) => [s, Object.fromEntries(AppConfig.ARTIFACT_PERCENTAGES.map((p) => [p, 0]))])),
				},
				null,
				2
			);
		}

		return JSON.stringify(
			{
				version: 1,
				appVersion: AppConfig.APP_VERSION,
				general: {
					engineerLevel: state.engineerLevel,
					scarabLevel: state.scarabLevel,
					riftRank: state.riftRank,
				},
				machines: state.machines.map((m) => ({
					id: m.id,
					rarity: m.rarity,
					level: m.level,
					blueprints: m.blueprints,
					inscriptionLevel: m.inscriptionLevel,
					sacredLevel: m.sacredLevel,
				})),
				heroes: state.heroes.map((h) => ({
					id: h.id,
					percentages: h.percentages,
				})),
				artifacts: state.artifacts,
			},
			null,
			2
		);
	}

	async importData(jsonString) {
		const data = JSON.parse(jsonString);

		if (data.version !== 1) {
			throw new Error("Incompatible save data version");
		}

		const profile = await this.getActiveProfile();
		if (!profile) throw new Error("No active profile");

		await this.transaction("rw", [this.general, this.machines, this.heroes, this.artifacts], async () => {
			// Clear existing
			await this.general.where("profileId").equals(profile.id).delete();
			await this.machines.where("profileId").equals(profile.id).delete();
			await this.heroes.where("profileId").equals(profile.id).delete();
			await this.artifacts.where("profileId").equals(profile.id).delete();

			// Import general
			await this.general.put({
				profileId: profile.id,
				engineerLevel: data.general.engineerLevel,
				scarabLevel: data.general.scarabLevel,
				riftRank: data.general.riftRank,
			});

			// Import machines
			if (data.machines.length > 0) {
				const machineRecords = data.machines.map((m) => ({
					profileId: profile.id,
					id: m.id,
					rarity: m.rarity,
					level: m.level,
					blueprints: m.blueprints,
					inscriptionLevel: m.inscriptionLevel || 0,
					sacredLevel: m.sacredLevel || 0,
				}));
				await this.machines.bulkPut(machineRecords);
			}

			// Import heroes
			if (data.heroes.length > 0) {
				const heroRecords = data.heroes.map((h) => ({
					profileId: profile.id,
					id: h.id,
					percentages: h.percentages,
				}));
				await this.heroes.bulkPut(heroRecords);
			}

			// Import artifacts
			const artifactRecords = Object.keys(data.artifacts).map((stat) => ({
				profileId: profile.id,
				stat,
				values: data.artifacts[stat],
			}));
			await this.artifacts.bulkPut(artifactRecords);
		});
	}

	async saveResult(mode, result) {
		const profile = await this.getActiveProfile();
		if (!profile) throw new Error("No active profile");

		await this.transaction("rw", this.results, async () => {
			await this.results.where("[profileId+mode]").equals([profile.id, mode]).delete();
			await this.results.add({ profileId: profile.id, mode, result });
		});
	}

	async getLatestResult(mode) {
		const profile = await this.getActiveProfile();
		if (!profile) return null;

		const result = await this.results.where("[profileId+mode]").equals([profile.id, mode]).first();
		return result ? result.result : null;
	}

	async clearProfileData() {
		const profile = await this.getActiveProfile();
		if (!profile) throw new Error("No active profile");

		await this.transaction("rw", [this.general, this.machines, this.heroes, this.artifacts], async () => {
			await this.general.where("profileId").equals(profile.id).delete();
			await this.machines.where("profileId").equals(profile.id).delete();
			await this.heroes.where("profileId").equals(profile.id).delete();
			await this.artifacts.where("profileId").equals(profile.id).delete();
		});

		// Reinitialize
		await this.general.put({
			profileId: profile.id,
			engineerLevel: AppConfig.DEFAULTS.ENGINEER_LEVEL,
			scarabLevel: AppConfig.DEFAULTS.SCARAB_LEVEL,
			riftRank: AppConfig.DEFAULTS.RIFT_RANK,
		});

		const artifactRecords = AppConfig.ARTIFACT_STATS.map((stat) => ({
			profileId: profile.id,
			stat,
			values: Object.fromEntries(AppConfig.ARTIFACT_PERCENTAGES.map((p) => [p, 0])),
		}));
		await this.artifacts.bulkPut(artifactRecords);
	}
}

export const db = new WMDatabase();

// js/guardian-app.js
import { renderGuardianCalculator } from "./ui/guardian.js";

/**
 * Initializes the Guardian Calculator page
 */
async function init() {
	try {
		console.log("Initializing Guardian Calculator...");

		// Render the calculator
		renderGuardianCalculator();

		console.log("Guardian Calculator ready");
	} catch (error) {
		console.error("Initialization failed:", error);
		
		// Show error toast if available
		const toastRoot = document.getElementById("toastRoot");
		if (toastRoot) {
			const { showToast } = await import("./ui/notifications.js");
			showToast("Failed to initialize Guardian Calculator. Please refresh.", "danger");
		}
	}
}

// Wait for DOM, then initialize
if (document.readyState === "loading") {
	await new Promise((resolve) => {
		document.addEventListener("DOMContentLoaded", resolve, { once: true });
	});
}

await init();
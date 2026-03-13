// workerManager.js
import { showToast } from "./ui/notifications.js";

/**
 * Manages the lifecycle of the optimizer Web Worker.
 *
 * Responsibilities:
 *   - Creating and terminating Worker instances
 *   - Routing messages to caller-supplied callbacks
 *   - Ensuring only one optimization runs at a time
 *
 * Previously this logic lived inline in app.js, mixing worker management
 * with app initialization and UI event wiring.
 */
export class WorkerManager {
	constructor() {
		/** @type {Worker|null} */
		this._worker = null;
	}

	// ─────────────────────────────────────────────
	// Public API
	// ─────────────────────────────────────────────

	/**
	 * True while an optimization is running.
	 * @returns {boolean}
	 */
	get isRunning() {
		return this._worker !== null;
	}

	/**
	 * Starts an optimization run.
	 * If a run is already active it is cancelled before starting the new one.
	 * @param {Object}   payload          - Data to post to the worker
	 * @param {Function} onResult         - Called with the deserialized result on success
	 * @param {Function} onLoadingChange  - Called with `true` at start and `false` at finish
	 */
	run(payload, onResult, onLoadingChange) {
		this._cancelCurrent();
		onLoadingChange(true);

		const worker = new Worker("js/optimizerWorker.js", { type: "module" });
		this._worker = worker;

		worker.onmessage = (e) => {
			this._worker = null;
			onLoadingChange(false);
			this._handleMessage(e.data, onResult);
			this._dispose(worker);
		};

		worker.onerror = (err) => {
			this._worker = null;
			onLoadingChange(false);
			console.error(new Error("Worker error", { cause: err }));
			showToast("Optimization failed. Please try again.", "danger");
			this._dispose(worker);
		};

		worker.postMessage(payload);
	}

	// ─────────────────────────────────────────────
	// Private helpers
	// ─────────────────────────────────────────────

	/**
	 * Cancels and disposes the currently running worker, if any.
	 * @private
	 */
	_cancelCurrent() {
		if (!this._worker) return;
		showToast("Previous optimization cancelled", "info");
		this._dispose(this._worker);
		this._worker = null;
	}

	/**
	 * Removes event listeners and terminates a worker instance.
	 * @private
	 * @param {Worker} worker
	 */
	_dispose(worker) {
		worker.onmessage = null;
		worker.onerror = null;
		worker.terminate();
	}

	/**
	 * Routes a worker message to the result handler or shows an error toast.
	 * @private
	 * @param {Object}   data     - Raw message data from the worker
	 * @param {Function} onResult - Success callback
	 */
	_handleMessage(data, onResult) {
		if (data.error) {
			console.error(new Error("Optimization failed", { cause: data.error }));
			showToast("Optimization failed. Please try again.", "danger");
			return;
		}
		onResult(data);
	}
}

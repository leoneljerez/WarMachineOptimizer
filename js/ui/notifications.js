/**
 * Shows a Bootstrap toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type: success, danger, warning, info
 */
export function showToast(message, type = "success") {
  const toastRoot = document.getElementById("toastRoot");

  const toastEl = document.createElement("div");
  toastEl.className = `toast align-items-center text-bg-${type} border-0`;
  toastEl.setAttribute("role", "alert");
  toastEl.setAttribute("aria-live", "assertive");
  toastEl.setAttribute("aria-atomic", "true");

  // Create toast body
  const toastBody = document.createElement("div");
  toastBody.className = "d-flex";

  const bodyText = document.createElement("div");
  bodyText.className = "toast-body";
  bodyText.textContent = message;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn-close btn-close-white me-2 m-auto";
  closeBtn.setAttribute("data-bs-dismiss", "toast");
  closeBtn.setAttribute("aria-label", "Close");

  toastBody.appendChild(bodyText);
  toastBody.appendChild(closeBtn);
  toastEl.appendChild(toastBody);

  toastRoot.appendChild(toastEl);

  // eslint-disable-next-line no-undef
  const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
  toast.show();

  toastEl.addEventListener("hidden.bs.toast", () => {
    toastEl.remove();
  });
}

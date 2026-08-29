/*
|--------------------------------------------------------------------------
| Shared Auth Form Helpers
|--------------------------------------------------------------------------
|
| Small, dependency-free UI helpers used by every auth page (login,
| register, forgot-password, update-password, verify-email) so the same
| "show an error under a field", "toggle a banner", "disable a button
| while loading" logic isn't copy-pasted into five separate inline
| scripts.
|
*/

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function showBanner(banner, message) {
  if (!banner) return;
  banner.textContent = message;
  banner.style.display = "block";
}

export function hideBanner(banner) {
  if (!banner) return;
  banner.style.display = "none";
  banner.textContent = "";
}

export function showFieldError(input, errorEl, message) {
  if (errorEl) errorEl.textContent = message;
  if (input) input.classList.add("invalid");
}

export function clearFieldError(input, errorEl) {
  if (errorEl) errorEl.textContent = "";
  if (input) input.classList.remove("invalid");
}

// Clears every field error + input.invalid state + banner in one call.
// Pass an array of { input, error } pairs and (optionally) a banner.
export function clearFormErrors(fields, banner) {
  fields.forEach(({ input, error }) => clearFieldError(input, error));
  hideBanner(banner);
}

// Disables a submit button and swaps its label while an async action is
// in flight. Remembers the original label on the element itself so
// setButtonIdle() can restore it without the caller passing it twice.
export function setButtonBusy(button, busyText) {
  if (!button) return;
  if (!button.dataset.idleText) {
    button.dataset.idleText = button.textContent;
  }
  button.disabled = true;
  button.textContent = busyText;
}

export function setButtonIdle(button) {
  if (!button) return;
  button.disabled = false;
  button.textContent = button.dataset.idleText || button.textContent;
}

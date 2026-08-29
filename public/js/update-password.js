import { updatePassword } from "./auth.js";
import {
  showBanner,
  hideBanner,
  setButtonBusy,
  setButtonIdle,
} from "./form-helpers.js";

const form = document.getElementById("passwordForm");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const submitButton = document.getElementById("submitButton");
const errorBanner = document.getElementById("errorBanner");
const infoBanner = document.getElementById("infoBanner");

async function handlePasswordUpdate(event) {
  event.preventDefault();
  hideBanner(errorBanner);

  if (password.value.length < 8) {
    showBanner(errorBanner, "Password must be at least 8 characters.");
    return;
  }

  if (password.value !== confirmPassword.value) {
    showBanner(errorBanner, "Passwords do not match.");
    return;
  }

  setButtonBusy(submitButton, "Updating…");

  try {
    await updatePassword(password.value);
    showBanner(infoBanner, "Password updated. You can continue to your account.");
    form.reset();
    setTimeout(() => window.location.replace("account.html"), 1200);
  } catch (error) {
    showBanner(errorBanner, error.message);
  } finally {
    setButtonIdle(submitButton);
  }
}

form.addEventListener("submit", handlePasswordUpdate);

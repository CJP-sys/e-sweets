import { resetPassword } from "./auth.js";
import {
  isValidEmail,
  showBanner,
  hideBanner,
  showFieldError,
  clearFieldError,
  setButtonBusy,
  setButtonIdle,
} from "./form-helpers.js";

const form = document.getElementById("resetForm");
const emailInput = document.getElementById("email");
const emailError = document.getElementById("emailError");
const errorBanner = document.getElementById("errorBanner");
const infoBanner = document.getElementById("infoBanner");
const submitBtn = document.getElementById("submitBtn");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFieldError(emailInput, emailError);
  hideBanner(errorBanner);
  hideBanner(infoBanner);

  if (!isValidEmail(emailInput.value.trim())) {
    showFieldError(emailInput, emailError, "Enter a valid email address.");
    return;
  }

  setButtonBusy(submitBtn, "Sending...");

  try {
    await resetPassword(emailInput.value.trim());
    showBanner(infoBanner, "Check your inbox for a password reset link.");
    form.reset();
  } catch (error) {
    showBanner(errorBanner, error.message);
  } finally {
    setButtonIdle(submitBtn);
  }
});

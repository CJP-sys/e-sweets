import { registerUser } from "./auth.js";
import {
  isValidEmail,
  showBanner,
  clearFormErrors,
  showFieldError,
  setButtonBusy,
  setButtonIdle,
} from "./form-helpers.js";

const form = document.getElementById("registerForm");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirmPassword");

const nameError = document.getElementById("nameError");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const confirmError = document.getElementById("confirmPasswordError");
const errorBanner = document.getElementById("errorBanner");
const submitBtn = document.getElementById("submitBtn");

const fields = [
  { input: nameInput, error: nameError },
  { input: emailInput, error: emailError },
  { input: passwordInput, error: passwordError },
  { input: confirmInput, error: confirmError },
];

function validate() {
  let valid = true;

  if (!nameInput.value.trim()) {
    showFieldError(nameInput, nameError, "Name is required.");
    valid = false;
  }

  if (!emailInput.value.trim()) {
    showFieldError(emailInput, emailError, "Email is required.");
    valid = false;
  } else if (!isValidEmail(emailInput.value.trim())) {
    showFieldError(emailInput, emailError, "Enter a valid email address.");
    valid = false;
  }

  if (!passwordInput.value) {
    showFieldError(passwordInput, passwordError, "Password is required.");
    valid = false;
  } else if (passwordInput.value.length < 8) {
    showFieldError(
      passwordInput,
      passwordError,
      "Password must be at least 8 characters.",
    );
    valid = false;
  }

  if (confirmInput.value !== passwordInput.value) {
    showFieldError(confirmInput, confirmError, "Passwords do not match.");
    valid = false;
  }

  return valid;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFormErrors(fields, errorBanner);

  if (!validate()) return;

  setButtonBusy(submitBtn, "Creating account...");

  try {
    const result = await registerUser(
      emailInput.value.trim(),
      passwordInput.value,
      nameInput.value.trim(),
    );

    window.location.href = result.needsEmailVerification
      ? "verify-email.html"
      : "account.html";
  } catch (error) {
    showBanner(errorBanner, error.message);
  } finally {
    setButtonIdle(submitBtn);
  }
});

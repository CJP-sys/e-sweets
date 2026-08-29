import { loginUser } from "./auth.js";
import {
  isValidEmail,
  showBanner,
  clearFormErrors,
  showFieldError,
  setButtonBusy,
  setButtonIdle,
} from "./form-helpers.js";

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const errorBanner = document.getElementById("errorBanner");
const submitBtn = document.getElementById("submitBtn");

const fields = [
  { input: emailInput, error: emailError },
  { input: passwordInput, error: passwordError },
];

function validate() {
  let valid = true;

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
  }

  return valid;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFormErrors(fields, errorBanner);

  if (!validate()) return;

  setButtonBusy(submitBtn, "Logging in...");

  try {
    const user = await loginUser(emailInput.value.trim(), passwordInput.value);

    if (!user.email_confirmed_at) {
      sessionStorage.setItem("esweets-verification-email", user.email || "");
      window.location.href = "verify-email.html";
      return;
    }

    window.location.href = "index.html";
  } catch (error) {
    if (error.code === "email_not_confirmed") {
      window.location.href = "verify-email.html";
      return;
    }
    showBanner(errorBanner, error.message);
  } finally {
    setButtonIdle(submitBtn);
  }
});

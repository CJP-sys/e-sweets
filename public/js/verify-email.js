import { resendVerificationEmail } from "./auth.js";
import { showBanner, hideBanner, setButtonBusy, setButtonIdle } from "./form-helpers.js";

const email = sessionStorage.getItem("esweets-verification-email") || "";
const emailLabel = document.getElementById("verificationEmail");
const resendButton = document.getElementById("resendButton");
const errorBanner = document.getElementById("errorBanner");
const infoBanner = document.getElementById("infoBanner");

if (email) emailLabel.textContent = email;

async function handleResendVerification() {
  hideBanner(errorBanner);
  hideBanner(infoBanner);

  if (!email) {
    showBanner(
      errorBanner,
      "Return to registration and enter your email again.",
    );
    return;
  }

  setButtonBusy(resendButton, "Sending…");

  try {
    await resendVerificationEmail(email);
    showBanner(infoBanner, "A new verification email has been sent.");
  } catch (error) {
    showBanner(errorBanner, error.message);
  } finally {
    setButtonIdle(resendButton);
  }
}

resendButton.addEventListener("click", handleResendVerification);

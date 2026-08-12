import { logoutUser, requireAuth, updateCustomerProfile } from "./auth.js";

const profileForm = document.querySelector("#profileForm");
const fullNameInput = document.querySelector("#fullName");
const emailInput = document.querySelector("#email");
const verifiedStatus = document.querySelector("#verifiedStatus");
const roleStatus = document.querySelector("#roleStatus");
const ownerLink = document.querySelector("#ownerLink");
const logoutButton = document.querySelector("#logoutButton");
const errorBanner = document.querySelector("#errorBanner");
const infoBanner = document.querySelector("#infoBanner");

let currentUser;

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.style.display = "block";
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  errorBanner.style.display = "none";
  infoBanner.style.display = "none";

  try {
    const profile = await updateCustomerProfile(
      currentUser.id,
      fullNameInput.value.trim(),
    );
    fullNameInput.value = profile.full_name;
    infoBanner.textContent = "Your profile was updated.";
    infoBanner.style.display = "block";
  } catch (error) {
    showError(error.message);
  }
}

async function handleLogoutClick() {
  await logoutUser();
  window.location.replace("login.html");
}

async function initializeAccountPage() {
  try {
    const authState = await requireAuth();
    if (!authState) return;

    currentUser = authState.user;
    fullNameInput.value = authState.profile.full_name || "";
    emailInput.value = currentUser.email || authState.profile.email;
    verifiedStatus.textContent = currentUser.email_confirmed_at ? "Yes" : "No";
    roleStatus.textContent = authState.profile.role;
    ownerLink.hidden = authState.profile.role !== "owner";

    profileForm.addEventListener("submit", handleProfileSubmit);
    logoutButton.addEventListener("click", handleLogoutClick);
  } catch (error) {
    showError(error.message);
  }
}

initializeAccountPage();

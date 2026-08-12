import { listCustomerProfiles, logoutUser, requireAuth } from "./auth.js";

const profileRows = document.querySelector("#profileRows");
const errorBanner = document.querySelector("#errorBanner");
const logoutButton = document.querySelector("#logoutButton");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatJoinDate(value) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function createProfileRow(profile) {
  return `<tr><td>${escapeHtml(profile.full_name || "—")}</td><td>${escapeHtml(profile.email)}</td><td>${escapeHtml(profile.role)}</td><td>${formatJoinDate(profile.created_at)}</td></tr>`;
}

async function handleLogoutClick() {
  await logoutUser();
  window.location.replace("login.html");
}

async function initializeOwnerPage() {
  try {
    const authState = await requireAuth({ allowedRoles: ["owner"] });
    if (!authState) return;

    const profiles = await listCustomerProfiles();
    profileRows.innerHTML = profiles.length
      ? profiles.map(createProfileRow).join("")
      : '<tr><td colspan="4">No customer profiles found.</td></tr>';
    logoutButton.addEventListener("click", handleLogoutClick);
  } catch (error) {
    errorBanner.textContent = error.message;
    errorBanner.style.display = "block";
  }
}

initializeOwnerPage();

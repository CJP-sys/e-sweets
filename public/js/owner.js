import {
  createLoginRedirect,
  logoutUser,
  requireAuth,
  listCustomerProfiles,
} from "./auth.js";

const errorBanner = document.querySelector("#errorBanner");
const profileRows = document.querySelector("#profileRows");
const logoutButton = document.querySelector("#logoutButton");

function showError(message) {
  if (errorBanner) {
    errorBanner.textContent = message;
    errorBanner.style.display = "block";
  }
}

function renderProfiles(profiles) {
  if (!profileRows) {
    return;
  }

  profileRows.replaceChildren();

  profiles.forEach((profile) => {
    const row = document.createElement("tr");
    const values = [
      profile.full_name || profile.username || "Unnamed customer",
      profile.email || "",
      profile.role || "customer",
      profile.created_at
        ? new Date(profile.created_at).toLocaleDateString()
        : "",
    ];

    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });

    profileRows.append(row);
  });

  if (!profiles.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "No customer profiles found.";
    row.append(cell);
    profileRows.append(row);
  }
}

async function initializeOwnerPage() {
  try {
    const authState = await requireAuth({
      allowedRoles: ["owner"],
      requireVerifiedEmail: true,
    });

    if (!authState?.user) {
      return;
    }

    renderProfiles(await listCustomerProfiles());
  } catch (error) {
    console.error("Owner dashboard initialization failed:", error);

    if (error?.status === 401 || error?.code === "not_authenticated") {
      window.location.replace(createLoginRedirect());
      return;
    }

    showError(error?.message || "Unable to load customer profiles.");
  }
}

logoutButton?.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    await logoutUser();
    window.location.replace("login.html");
  } catch (error) {
    logoutButton.disabled = false;
    showError(error?.message || "Unable to log out.");
  }
});

initializeOwnerPage();

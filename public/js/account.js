import {
  createLoginRedirect,
  logoutUser,
  requireAuth,
  updateCustomerProfile,
} from "./auth.js";

/*
|--------------------------------------------------------------------------
| DOM Elements
|--------------------------------------------------------------------------
*/

const profileForm =
  document.querySelector(
    "#profileForm",
  );

const fullNameInput =
  document.querySelector(
    "#fullName",
  );

const emailInput =
  document.querySelector(
    "#email",
  );

const verifiedStatus =
  document.querySelector(
    "#verifiedStatus",
  );

const roleStatus =
  document.querySelector(
    "#roleStatus",
  );

const ownerLink =
  document.querySelector(
    "#ownerLink",
  );

const logoutButton =
  document.querySelector(
    "#logoutButton",
  );

const errorBanner =
  document.querySelector(
    "#errorBanner",
  );

const infoBanner =
  document.querySelector(
    "#infoBanner",
  );

/*
|--------------------------------------------------------------------------
| Page State
|--------------------------------------------------------------------------
*/

let currentUser = null;
let currentProfile = null;

/*
|--------------------------------------------------------------------------
| Messages
|--------------------------------------------------------------------------
*/

function showError(message) {
  if (!errorBanner) {
    return;
  }

  errorBanner.textContent =
    message ||
    "Something went wrong.";

  errorBanner.style.display =
    "block";
}

function showInfo(message) {
  if (!infoBanner) {
    return;
  }

  infoBanner.textContent =
    message || "";

  infoBanner.style.display =
    "block";
}

function clearMessages() {
  if (errorBanner) {
    errorBanner.textContent =
      "";

    errorBanner.style.display =
      "none";
  }

  if (infoBanner) {
    infoBanner.textContent =
      "";

    infoBanner.style.display =
      "none";
  }
}

/*
|--------------------------------------------------------------------------
| Loading State
|--------------------------------------------------------------------------
*/

function setLoadingState(
  loading,
) {
  if (fullNameInput) {
    fullNameInput.disabled =
      loading;
  }

  /*
  | Email is never editable on this page.
  */

  if (emailInput) {
    emailInput.disabled =
      true;

    emailInput.readOnly =
      true;
  }

  const submitButton =
    profileForm?.querySelector(
      "button[type='submit']",
    );

  if (submitButton) {
    submitButton.disabled =
      loading;

    submitButton.textContent =
      loading
        ? "Saving..."
        : "Save Changes";
  }
}

/*
|--------------------------------------------------------------------------
| Display Account
|--------------------------------------------------------------------------
*/

function displayAccount(
  user,
  profile,
) {
  currentUser = user;
  currentProfile = profile;

  /*
  |----------------------------------------------------------------------
  | Full Name
  |----------------------------------------------------------------------
  */

  if (fullNameInput) {
    fullNameInput.value =
      profile?.full_name || "";
  }

  /*
  |----------------------------------------------------------------------
  | Email
  |----------------------------------------------------------------------
  |
  | Email comes from Supabase Auth.
  | It is NOT taken from the editable profile form.
  |
  */

  if (emailInput) {
    emailInput.value =
      user?.email || "";

    emailInput.disabled =
      true;

    emailInput.readOnly =
      true;
  }

  /*
  |----------------------------------------------------------------------
  | Email Verification
  |----------------------------------------------------------------------
  */

  const verified =
    Boolean(
      user?.email_confirmed_at,
    );

  if (verifiedStatus) {
    verifiedStatus.textContent =
      verified
        ? "Verified"
        : "Not verified";

    verifiedStatus.dataset.status =
      verified
        ? "verified"
        : "unverified";
  }

  /*
  |----------------------------------------------------------------------
  | Role
  |----------------------------------------------------------------------
  |
  | The role is used here only for UI.
  |
  | Supabase RLS must enforce actual authorization.
  |
  */

  const role =
    profile?.role ||
    "customer";

  if (roleStatus) {
    roleStatus.textContent =
      role;
  }

  /*
  | Only show owner functionality to owners.
  */

  if (ownerLink) {
    ownerLink.hidden =
      role !== "owner";
  }
}

/*
|--------------------------------------------------------------------------
| Profile Form
|--------------------------------------------------------------------------
*/

async function handleProfileSubmit(
  event,
) {
  event.preventDefault();

  clearMessages();

  if (!currentUser) {
    showError(
      "You are not signed in.",
    );

    return;
  }

  if (!fullNameInput) {
    showError(
      "The profile form is unavailable.",
    );

    return;
  }

  const fullName =
    fullNameInput.value.trim();

  /*
  |----------------------------------------------------------------------
  | Validation
  |----------------------------------------------------------------------
  */

  if (!fullName) {
    showError(
      "Please enter your full name.",
    );

    fullNameInput.focus();

    return;
  }

  if (fullName.length < 2) {
    showError(
      "Your name must contain at least 2 characters.",
    );

    fullNameInput.focus();

    return;
  }

  if (fullName.length > 100) {
    showError(
      "Your name is too long.",
    );

    fullNameInput.focus();

    return;
  }

  setLoadingState(true);

  try {
    /*
    |----------------------------------------------------------------------
    | IMPORTANT
    |----------------------------------------------------------------------
    |
    | We DO NOT pass currentUser.id.
    |
    | auth.js gets the authenticated user directly
    | from Supabase Auth.
    |
    */

    const profile =
      await updateCustomerProfile(
        fullName,
      );

    currentProfile =
      profile;

    if (fullNameInput) {
      fullNameInput.value =
        profile?.full_name ||
        "";
    }

    showInfo(
      "Your profile has been updated successfully.",
    );
  } catch (error) {
    console.error(
      "Profile update failed:",
      error,
    );

    showError(
      error?.message ||
        "Unable to update your profile.",
    );
  } finally {
    setLoadingState(
      false,
    );
  }
}

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

async function handleLogoutClick() {
  if (
    !logoutButton ||
    logoutButton.disabled
  ) {
    return;
  }

  clearMessages();

  logoutButton.disabled =
    true;

  logoutButton.textContent =
    "Logging out...";

  try {
    await logoutUser();

    sessionStorage.removeItem(
      "esweets-verification-email",
    );

    /*
    | Redirect after successful logout.
    */

    window.location.replace(
      "login.html",
    );
  } catch (error) {
    console.error(
      "Logout failed:",
      error,
    );

    showError(
      error?.message ||
        "Unable to log out. Please try again.",
    );

    logoutButton.disabled =
      false;

    logoutButton.textContent =
      "Log Out";
  }
}

/*
|--------------------------------------------------------------------------
| Initialize Account Page
|--------------------------------------------------------------------------
*/

async function initializeAccountPage() {
  clearMessages();

  try {
    /*
    |----------------------------------------------------------------------
    | requireAuth handles:
    |
    | - authentication
    | - email verification
    | - profile loading
    | - role checking
    |----------------------------------------------------------------------
    */

    const authState =
      await requireAuth();

    if (!authState?.user) {
      window.location.replace(
        createLoginRedirect(),
      );

      return;
    }

    displayAccount(
      authState.user,
      authState.profile,
    );

    profileForm?.addEventListener(
      "submit",
      handleProfileSubmit,
    );

    logoutButton?.addEventListener(
      "click",
      handleLogoutClick,
    );
  } catch (error) {
    console.error(
      "Account initialization failed:",
      error,
    );

    if (
      error?.status === 401 ||
      error?.code ===
        "not_authenticated"
    ) {
      window.location.replace(
        createLoginRedirect(),
      );

      return;
    }

    showError(
      error?.message ||
        "Unable to load your account.",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Start
|--------------------------------------------------------------------------
*/

initializeAccountPage();
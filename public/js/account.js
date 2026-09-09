import {
  createLoginRedirect,
  logoutUser,
  requireAuth,
  updateCustomerProfile,
  uploadAvatarImage,
} from "./auth.js";

/*
|--------------------------------------------------------------------------
| DOM ELEMENTS
|--------------------------------------------------------------------------
*/

const profileForm = document.querySelector("#profileForm");

const usernameInput = document.querySelector("#username");
const fullNameInput = document.querySelector("#fullName");
const emailInput = document.querySelector("#email");
const phoneInput = document.querySelector("#phone");
const birthDateInput = document.querySelector("#birthDate");

const genderInputs = document.querySelectorAll(
  "input[name='gender']",
);

const verifiedStatus =
  document.querySelector("#verifiedStatus");

const roleStatus =
  document.querySelector("#roleStatus");

const ownerLink =
  document.querySelector("#ownerLink");

const logoutButton =
  document.querySelector("#logoutButton");

const errorBanner =
  document.querySelector("#errorBanner");

const infoBanner =
  document.querySelector("#infoBanner");

const sidebarName =
  document.querySelector("#sidebarName");

const editProfileButton =
  document.querySelector("#editProfileButton");

const selectImageButton =
  document.querySelector("#selectImageButton");

const profileImageInput =
  document.querySelector("#profileImage");

const largeAvatar =
  document.querySelector(".large-avatar");


/*
|--------------------------------------------------------------------------
| PAGE STATE
|--------------------------------------------------------------------------
*/

let currentUser = null;
let currentProfile = null;
let selectedAvatarFile = null;


/*
|--------------------------------------------------------------------------
| MESSAGES
|--------------------------------------------------------------------------
*/

function showError(message) {
  if (!errorBanner) {
    return;
  }

  errorBanner.textContent =
    message || "Something went wrong.";

  errorBanner.style.display = "block";
}


function showInfo(message) {
  if (!infoBanner) {
    return;
  }

  infoBanner.textContent =
    message || "";

  infoBanner.style.display = "block";
}


function clearMessages() {
  if (errorBanner) {
    errorBanner.textContent = "";
    errorBanner.style.display = "none";
  }

  if (infoBanner) {
    infoBanner.textContent = "";
    infoBanner.style.display = "none";
  }
}


/*
|--------------------------------------------------------------------------
| GET SELECTED GENDER
|--------------------------------------------------------------------------
*/

function getSelectedGender() {
  const selected = document.querySelector(
    "input[name='gender']:checked",
  );

  return selected?.value || "";
}


/*
|--------------------------------------------------------------------------
| SET GENDER
|--------------------------------------------------------------------------
*/

function setGender(gender) {
  genderInputs.forEach((input) => {
    input.checked =
      input.value.toLowerCase() ===
      String(gender || "").toLowerCase();
  });
}


/*
|--------------------------------------------------------------------------
| LOADING STATE
|--------------------------------------------------------------------------
*/

function setLoadingState(loading) {
  if (usernameInput) {
    usernameInput.disabled = loading;
  }

  if (fullNameInput) {
    fullNameInput.disabled = loading;
  }

  if (phoneInput) {
    phoneInput.disabled = loading;
  }

  if (birthDateInput) {
    birthDateInput.disabled = loading;
  }

  genderInputs.forEach((input) => {
    input.disabled = loading;
  });

  /*
  | Email is never editable.
  */

  if (emailInput) {
    emailInput.disabled = true;
    emailInput.readOnly = true;
  }

  const submitButton =
    profileForm?.querySelector(
      "button[type='submit']",
    );

  if (submitButton) {
    submitButton.disabled = loading;

    submitButton.textContent =
      loading
        ? "Saving..."
        : "Save";
  }
}


/*
|--------------------------------------------------------------------------
| DISPLAY PROFILE IMAGE
|--------------------------------------------------------------------------
*/

function displayProfileImage(profile) {
  if (!largeAvatar) {
    return;
  }

  const avatarUrl =
    profile?.avatar_url ||
    currentUser?.user_metadata?.avatar_url ||
    "";

  if (avatarUrl) {
    largeAvatar.innerHTML = "";

    largeAvatar.style.backgroundImage =
      `url("${avatarUrl}")`;

    largeAvatar.style.backgroundSize =
      "cover";

    largeAvatar.style.backgroundPosition =
      "center";

    largeAvatar.style.backgroundRepeat =
      "no-repeat";
  } else {
    largeAvatar.style.backgroundImage = "";

    largeAvatar.innerHTML = "♙";
  }
}


/*
|--------------------------------------------------------------------------
| DISPLAY ACCOUNT
|--------------------------------------------------------------------------
*/

function displayAccount(user, profile) {
  currentUser = user;
  currentProfile = profile;

  /*
  |--------------------------------------------------------------------------
  | FULL NAME
  |--------------------------------------------------------------------------
  */

  const fullName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    "";

  if (fullNameInput) {
    fullNameInput.value = fullName;
  }


  /*
  |--------------------------------------------------------------------------
  | SIDEBAR NAME
  |--------------------------------------------------------------------------
  */

  if (sidebarName) {
    sidebarName.textContent =
      fullName || "Customer";
  }


  /*
  |--------------------------------------------------------------------------
  | USERNAME
  |--------------------------------------------------------------------------
  */

  if (usernameInput) {
    usernameInput.value =
      profile?.username ||
      user?.user_metadata?.username ||
      "";
  }


  /*
  |--------------------------------------------------------------------------
  | EMAIL
  |--------------------------------------------------------------------------
  */

  if (emailInput) {
    emailInput.value =
      user?.email || "";

    emailInput.disabled = true;
    emailInput.readOnly = true;
  }


  /*
  |--------------------------------------------------------------------------
  | PHONE
  |--------------------------------------------------------------------------
  */

  if (phoneInput) {
    phoneInput.value =
      profile?.phone ||
      user?.user_metadata?.phone ||
      "";
  }


  /*
  |--------------------------------------------------------------------------
  | GENDER
  |--------------------------------------------------------------------------
  */

  setGender(
    profile?.gender ||
    user?.user_metadata?.gender ||
    "",
  );


  /*
  |--------------------------------------------------------------------------
  | DATE OF BIRTH
  |--------------------------------------------------------------------------
  */

  if (birthDateInput) {
    birthDateInput.value =
      profile?.birth_date ||
      user?.user_metadata?.birth_date ||
      "";
  }


  /*
  |--------------------------------------------------------------------------
  | EMAIL VERIFICATION
  |--------------------------------------------------------------------------
  */

  const verified =
    Boolean(user?.email_confirmed_at);

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
  |--------------------------------------------------------------------------
  | ACCOUNT ROLE
  |--------------------------------------------------------------------------
  */

  const role =
    profile?.role ||
    "customer";

  if (roleStatus) {
    roleStatus.textContent = role;
  }


  /*
  |--------------------------------------------------------------------------
  | OWNER DASHBOARD
  |--------------------------------------------------------------------------
  */

  if (ownerLink) {
    ownerLink.hidden =
      role !== "owner";
  }


  /*
  |--------------------------------------------------------------------------
  | PROFILE IMAGE
  |--------------------------------------------------------------------------
  */

  displayProfileImage(profile);
}


/*
|--------------------------------------------------------------------------
| VALIDATE PROFILE
|--------------------------------------------------------------------------
*/

function validateProfile() {
  const fullName =
    fullNameInput?.value.trim() || "";

  const username =
    usernameInput?.value.trim() || "";

  const phone =
    phoneInput?.value.trim() || "";

  const birthDate =
    birthDateInput?.value || "";

  /*
  | Full name
  */

  if (!fullName) {
    return "Please enter your full name.";
  }

  if (fullName.length < 2) {
    return "Your name must contain at least 2 characters.";
  }

  if (fullName.length > 100) {
    return "Your name is too long.";
  }

  if (!/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(fullName)) {
    return "Your name can only contain letters, spaces, apostrophes, and hyphens.";
  }


  /*
  | Username
  */

  if (username.length > 30) {
    return "Username must not exceed 30 characters.";
  }

  if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
    return "Username can only contain letters, numbers, and underscores.";
  }


  /*
  | Phone
  */

  if (phone) {
    const phoneDigits = phone.replace(/\D/g, "");

    if (!/^[+]?[0-9() .-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
      return "Please enter a valid phone number.";
    }
  }


  /*
  | Birthday
  */

  if (birthDate) {
    const parsedBirthDate = new Date(`${birthDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [yearText, month, day] = birthDate.split("-");
    const year = Number(yearText);

    if (!/^\d{4}$/.test(yearText || "")) {
      return "Birthday year must contain exactly 4 digits.";
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
      Number.isNaN(parsedBirthDate.getTime()) ||
      parsedBirthDate.getFullYear() !== year ||
      parsedBirthDate.getMonth() !== month - 1 ||
      parsedBirthDate.getDate() !== day
    ) {
      return "Please enter a valid birthday.";
    }

    if (parsedBirthDate > today) {
      return "Birthday cannot be in the future.";
    }
  }


  return null;
}


/*
|--------------------------------------------------------------------------
| BIRTHDAY INPUT
|--------------------------------------------------------------------------
*/

function handleBirthDateInput() {
  if (!birthDateInput) {
    return;
  }

  const yearText =
    birthDateInput.value.split("-")[0] || "";

  if (yearText.length > 4) {
    birthDateInput.value = "";

    showError(
      "Birthday year must contain exactly 4 digits.",
    );
  }
}


function setupBirthDateInput() {
  if (!birthDateInput) {
    return;
  }

  birthDateInput.max =
    new Date().toISOString().split("T")[0];

  birthDateInput.addEventListener(
    "input",
    handleBirthDateInput,
  );
}


/*
|--------------------------------------------------------------------------
| PROFILE FORM SUBMIT
|--------------------------------------------------------------------------
*/

async function handleProfileSubmit(event) {
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


  /*
  |--------------------------------------------------------------------------
  | VALIDATION
  |--------------------------------------------------------------------------
  */

  const validationError =
    validateProfile();

  if (validationError) {
    showError(validationError);

    return;
  }


  /*
  |--------------------------------------------------------------------------
  | COLLECT DATA
  |--------------------------------------------------------------------------
  */

  const profileData = {
    full_name:
      fullNameInput.value.trim(),

    username:
      usernameInput?.value.trim() || null,

    phone:
      phoneInput?.value.trim() || null,

    gender:
      getSelectedGender() || null,

    birth_date:
      birthDateInput?.value || null,

      avatar_url:
        currentProfile?.avatar_url || null,
  };


  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  setLoadingState(true);


  try {

    if (selectedAvatarFile) {
      profileData.avatar_url =
        await uploadAvatarImage(selectedAvatarFile);
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE SUPABASE PROFILE
    |--------------------------------------------------------------------------
    */

    const profile =
      await updateCustomerProfile(
        profileData,
      );

      currentProfile = profile;

    displayAccount(
      currentUser,
      profile
    );

    displayProfileImage(profile);

    selectedAvatarFile = null;

    if (profileImageInput) {
      profileImageInput.value = "";
    }

    showInfo(
      "Your profile has been updated successfully."
    );


    /*
    |--------------------------------------------------------------------------
    | UPDATE UI
    |--------------------------------------------------------------------------
    */

    if (fullNameInput) {
      fullNameInput.value =
        profile?.full_name ||
        profileData.full_name;
    }

    if (usernameInput) {
      usernameInput.value =
        profile?.username ||
        profileData.username ||
        "";
    }

    if (phoneInput) {
      phoneInput.value =
        profile?.phone ||
        profileData.phone ||
        "";
    }

    setGender(
      profile?.gender ||
      profileData.gender ||
      "",
    );

    if (birthDateInput) {
      birthDateInput.value =
        profile?.birth_date ||
        profileData.birth_date ||
        "";
    }


    /*
    |--------------------------------------------------------------------------
    | SIDEBAR
    |--------------------------------------------------------------------------
    */

    if (sidebarName) {
      sidebarName.textContent =
        profile?.full_name ||
        profileData.full_name ||
        "Customer";
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

    setLoadingState(false);
  }
}


/*
|--------------------------------------------------------------------------
| PROFILE IMAGE SELECT
|--------------------------------------------------------------------------
*/

function handleSelectImage() {
  profileImageInput?.click();
}


/*
|--------------------------------------------------------------------------
| PROFILE IMAGE PREVIEW
|--------------------------------------------------------------------------
*/

function handleImageChange(event) {
  clearMessages();

  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }


  /*
  |--------------------------------------------------------------------------
  | File size
  |--------------------------------------------------------------------------
  |
  | Maximum 1 MB
  |
  */

  const maxSize =
    1 * 1024 * 1024;

  if (file.size > maxSize) {

    showError(
      "Profile image must be smaller than 1 MB.",
    );

    event.target.value = "";

    return;
  }


  /*
  |--------------------------------------------------------------------------
  | File type
  |--------------------------------------------------------------------------
  */

  const allowedTypes = [
    "image/jpeg",
    "image/png",
  ];

  if (!allowedTypes.includes(file.type)) {

    showError(
      "Please select a JPEG or PNG image.",
    );

    event.target.value = "";

    return;
  }


  /*
  |--------------------------------------------------------------------------
  | Preview
  |--------------------------------------------------------------------------
  */

  const reader =
    new FileReader();

  reader.onload = () => {

    if (!largeAvatar) {
      return;
    }

    largeAvatar.innerHTML = "";

    largeAvatar.style.backgroundImage =
      `url("${reader.result}")`;

    largeAvatar.style.backgroundSize =
      "cover";

    largeAvatar.style.backgroundPosition =
      "center";
  };

  reader.readAsDataURL(file);

  /*
  |--------------------------------------------------------------------------
  | Stash the file — it's uploaded to Supabase Storage when the profile
  | form is submitted (see handleProfileSubmit).
  |--------------------------------------------------------------------------
  */

  selectedAvatarFile = file;

  showInfo(
    "Image selected. Save your profile to upload it.",
  );
}


/*
|--------------------------------------------------------------------------
| EDIT PROFILE BUTTON
|--------------------------------------------------------------------------
*/

function handleEditProfile() {

  fullNameInput?.focus();

  fullNameInput?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}


/*
|--------------------------------------------------------------------------
| LOGOUT
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
    |--------------------------------------------------------------------------
    | Redirect
    |--------------------------------------------------------------------------
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
      "Log out";
  }
}


/*
|--------------------------------------------------------------------------
| NAVIGATION
|--------------------------------------------------------------------------
*/

function setupNavigation() {

  const links =
    document.querySelectorAll(
      ".account-nav-link",
    );

  links.forEach((link) => {

    link.addEventListener(
      "click",
      () => {

        links.forEach((item) => {
          item.classList.remove(
            "active",
          );
        });

        link.classList.add(
          "active",
        );

      },
    );

  });
}


/*
|--------------------------------------------------------------------------
| INITIALIZE ACCOUNT PAGE
|--------------------------------------------------------------------------
*/

async function initializeAccountPage() {

  clearMessages();

  try {

    /*
    |--------------------------------------------------------------------------
    | REQUIRE AUTHENTICATION
    |--------------------------------------------------------------------------
    */

    const authState =
      await requireAuth();


    if (!authState?.user) {

      window.location.replace(
        createLoginRedirect(),
      );

      return;
    }


    /*
    |--------------------------------------------------------------------------
    | DISPLAY PROFILE
    |--------------------------------------------------------------------------
    */

    displayAccount(
      authState.user,
      authState.profile,
    );


    /*
    |--------------------------------------------------------------------------
    | EVENT LISTENERS
    |--------------------------------------------------------------------------
    */

    profileForm?.addEventListener(
      "submit",
      handleProfileSubmit,
    );

    logoutButton?.addEventListener(
      "click",
      handleLogoutClick,
    );

    editProfileButton?.addEventListener(
      "click",
      handleEditProfile,
    );

    selectImageButton?.addEventListener(
      "click",
      handleSelectImage,
    );

    profileImageInput?.addEventListener(
      "change",
      handleImageChange,
    );

    setupBirthDateInput();

    setupNavigation();


  } catch (error) {

    console.error(
      "Account initialization failed:",
      error,
    );


    /*
    |--------------------------------------------------------------------------
    | NOT AUTHENTICATED
    |--------------------------------------------------------------------------
    */

    if (
      error?.status === 401 ||
      error?.code === "not_authenticated"
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
| START
|--------------------------------------------------------------------------
*/

initializeAccountPage();
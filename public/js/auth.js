import { supabase } from "./supabase.js";

const AUTH_MESSAGES = {
  invalid_credentials: "Incorrect email or password.",
  invalid_login_credentials: "Incorrect email or password.",
  email_not_confirmed: "Verify your email before logging in.",
  user_already_exists: "That email is already registered.",
  weak_password: "Use a stronger password with at least 8 characters.",
  password_too_short: "Use a stronger password with at least 8 characters.",
  over_request_rate_limit: "Too many attempts. Please try again later.",
};

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeName(fullName) {
  return String(fullName || "").trim();
}

function createPageUrl(pageName) {
  return new URL(pageName, window.location.href).href;
}

function createFriendlyAuthError(error) {
  const message = AUTH_MESSAGES[error?.code] || error?.message;
  const friendlyError = new Error(
    message || "Something went wrong. Please try again.",
  );
  friendlyError.code = error?.code || "unknown_auth_error";
  return friendlyError;
}

// Exported so pages (e.g. account.js) can build a matching redirect
// without duplicating the "?redirect=" logic in more than one place.
export function createLoginRedirect() {
  const currentPage = window.location.pathname.split("/").pop();
  return `login.html?redirect=${encodeURIComponent(currentPage || "account.html")}`;
}

export async function registerUser(email, password, fullName) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeName(fullName);

  if (!normalizedEmail) throw new Error("Please enter your email.");
  if (!normalizedName) throw new Error("Please enter your full name.");
  if (normalizedName.length < 2) throw new Error("Your name must contain at least 2 characters.");
  if (normalizedName.length > 100) throw new Error("Your name is too long.");
  if (!password || password.length < 8) throw new Error("Use a stronger password with at least 8 characters.");

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { full_name: normalizedName },
      emailRedirectTo: createPageUrl("account.html"),
    },
  });

  if (error) {
    throw createFriendlyAuthError(error);
  }

  sessionStorage.setItem("esweets-verification-email", normalizedEmail);
  return {
    user: data.user,
    session: data.session,
    needsEmailVerification: !data.session,
  };
}

export async function loginUser(email, password) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error("Please enter your email.");
  if (!password) throw new Error("Please enter your password.");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      sessionStorage.setItem("esweets-verification-email", normalizedEmail);
    }
    throw createFriendlyAuthError(error);
  }

  return data.user;
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw createFriendlyAuthError(error);
  }
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: createPageUrl("update-password.html"),
  });

  if (error) {
    throw createFriendlyAuthError(error);
  }
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    throw createFriendlyAuthError(error);
  }
}

export async function resendVerificationEmail(email) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: createPageUrl("account.html") },
  });

  if (error) {
    throw createFriendlyAuthError(error);
  }
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return null;
  }
  return data.user;
}

export async function getCustomerProfile(userId) {

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();


  if (userError || !user) {

    const error = new Error(
      "You are not signed in.",
    );

    error.code = "not_authenticated";
    error.status = 401;

    throw error;
  }


  const profileUserId =
    userId || user.id;


  const {
    data,
    error,
  } = await supabase
    .from("profiles")
    .select(
      `
      id,
      email,
      full_name,
      username,
      phone,
      gender,
      birth_date,
      avatar_url,
      role,
      created_at,
      updated_at
      `,
    )
    .eq("id", profileUserId)
    .maybeSingle();


  if (error) {

    console.error(
      "Profile loading error:",
      error,
    );

    throw new Error(
      error.message ||
      "Your customer profile could not be loaded.",
    );
  }


  /*
  |--------------------------------------------------------------------------
  | PROFILE DOES NOT EXIST
  |--------------------------------------------------------------------------
  */

  if (!data) {

    const newProfile = {
      id: user.id,

      email:
        user.email || "",

      full_name:
        user.user_metadata?.full_name || "",

      username:
        user.user_metadata?.username || null,

      phone:
        user.user_metadata?.phone || null,

      gender:
        user.user_metadata?.gender || null,

      birth_date:
        user.user_metadata?.birth_date || null,

      avatar_url:
        user.user_metadata?.avatar_url || null,

      role: "customer",
    };


    const {
      data: createdProfile,
      error: createError,
    } =
      await supabase
        .from("profiles")
        .insert(newProfile)
        .select()
        .single();


    if (createError) {

      console.error(
        "Profile creation error:",
        createError,
      );

      throw new Error(
        "Your customer profile could not be created.",
      );
    }


    return createdProfile;
  }


  return data;
}

// Note: no longer takes a userId argument. The current Supabase session
// is resolved internally so the page can never accidentally (or
// maliciously) update a profile that isn't the signed-in user's — this
// is a defense-in-depth measure on top of the RLS policy
// (auth.uid() = id) that already enforces this at the database level.
export async function updateCustomerProfile(profileData) {
  const values =
    typeof profileData === "string"
      ? { full_name: profileData }
      : profileData || {};

  const fullName = normalizeName(values.full_name);

  if (!fullName) {
    throw new Error("Please enter your full name.");
  }

  if (fullName.length < 2) {
    throw new Error(
      "Your name must contain at least 2 characters.",
    );
  }

  if (fullName.length > 100) {
    throw new Error(
      "Your name is too long.",
    );
  }

  if (!/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(fullName)) {
    throw new Error(
      "Your name can only contain letters, spaces, apostrophes, and hyphens.",
    );
  }

  const username = values.username?.trim() || "";

  if (username.length > 30) {
    throw new Error(
      "Username must not exceed 30 characters.",
    );
  }

  if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error(
      "Username can only contain letters, numbers, and underscores.",
    );
  }

  const phone = values.phone?.trim() || "";
  const phoneDigits = phone.replace(/\D/g, "");

  if (phone && (!/^[+]?[0-9() .-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15)) {
    throw new Error(
      "Please enter a valid phone number.",
    );
  }

  const birthDate = values.birth_date || "";

  if (birthDate) {
    const parsedBirthDate = new Date(`${birthDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [yearText, month, day] = birthDate.split("-");
    const year = Number(yearText);

    if (!/^\d{4}$/.test(yearText || "")) {
      throw new Error(
        "Birthday year must contain exactly 4 digits.",
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
      Number.isNaN(parsedBirthDate.getTime()) ||
      parsedBirthDate.getFullYear() !== year ||
      parsedBirthDate.getMonth() !== month - 1 ||
      parsedBirthDate.getDate() !== day
    ) {
      throw new Error(
        "Please enter a valid birthday.",
      );
    }

    if (parsedBirthDate > today) {
      throw new Error(
        "Birthday cannot be in the future.",
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | GET CURRENT USER
  |--------------------------------------------------------------------------
  */

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const error = new Error(
      "You are not signed in.",
    );

    error.code = "not_authenticated";
    error.status = 401;

    throw error;
  }


  /*
  |--------------------------------------------------------------------------
  | DO NOT CHANGE ROLE
  |--------------------------------------------------------------------------
  */

  const { data: existingProfile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    console.error(
      "Profile lookup failed:",
      profileError,
    );

    throw new Error(
      "Unable to load your profile.",
    );
  }


  /*
  |--------------------------------------------------------------------------
  | KEEP EXISTING ROLE
  |--------------------------------------------------------------------------
  */

  const existingRole =
    existingProfile?.role || "customer";


  /*
  |--------------------------------------------------------------------------
  | PROFILE DATA
  |--------------------------------------------------------------------------
  */

  const profilePayload = {
    id: user.id,

    email:
      user.email || "",

    full_name:
      fullName,

    username:
      username || null,

    phone:
      phone || null,

    gender:
      values.gender || null,

    birth_date:
      birthDate || null,

    avatar_url:
      values.avatar_url || null,

    role:
      existingRole,

    updated_at:
      new Date().toISOString(),
  };


  /*
  |--------------------------------------------------------------------------
  | UPSERT PROFILE
  |--------------------------------------------------------------------------
  */

  const {
    data,
    error,
  } = await supabase
    .from("profiles")
    .upsert(
      profilePayload,
      {
        onConflict: "id",
      },
    )
    .select(
      `
      id,
      email,
      full_name,
      username,
      phone,
      gender,
      birth_date,
      avatar_url,
      role,
      created_at,
      updated_at
      `,
    )
    .single();


  /*
  |--------------------------------------------------------------------------
  | HANDLE DATABASE ERROR
  |--------------------------------------------------------------------------
  */

  if (error) {
    console.error(
      "Supabase profile update error:",
      error,
    );

    if (error.code === "23505") {
      throw new Error(
        "That username is already being used.",
      );
    }

    throw new Error(
      error.message ||
      "Your profile could not be updated.",
    );
  }


  /*
  |--------------------------------------------------------------------------
  | UPDATE SUPABASE AUTH METADATA
  |--------------------------------------------------------------------------
  */

  const {
    error: metadataError,
  } =
    await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        username:
          username || null,
        phone:
          phone || null,
        gender:
          values.gender || null,
        birth_date:
          birthDate || null,
        avatar_url:
          values.avatar_url || null,
      },
    });


  if (metadataError) {
    console.warn(
      "Auth metadata update failed:",
      metadataError,
    );
  }


  return data;
}

export async function uploadAvatarImage(file) {
  if (!file) {
    throw new Error("No image selected.");
  }

  const user = await getCurrentUser();

  if (!user) {
    const error = new Error("You are not signed in.");
    error.code = "not_authenticated";
    error.status = 401;
    throw error;
  }

  // ---------------------------------------------------------
  // Validate file type
  // ---------------------------------------------------------

  const allowedTypes = [
    "image/jpeg",
    "image/png",
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Only JPG and PNG images are allowed.");
  }

  // ---------------------------------------------------------
  // Validate file size
  // ---------------------------------------------------------

  const maxSize = 1 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(
      "Profile image must be smaller than 1 MB."
    );
  }

  // ---------------------------------------------------------
  // Determine extension
  // ---------------------------------------------------------

  let extension;

  if (file.type === "image/png") {
    extension = "png";
  } else {
    extension = "jpg";
  }

  // ---------------------------------------------------------
  // UNIQUE FILE NAME
  // ---------------------------------------------------------

  const fileName =
    `avatar-${Date.now()}.${extension}`;

  const filePath =
    `${user.id}/${fileName}`;

  console.log("Uploading avatar...");
  console.log("User:", user.id);
  console.log("Bucket:", "avatars");
  console.log("Path:", filePath);
  console.log("Type:", file.type);
  console.log("Size:", file.size);


  // ---------------------------------------------------------
  // UPLOAD
  // ---------------------------------------------------------

  const {
    data,
    error
  } = await supabase.storage
    .from("avatars")
    .upload(
      filePath,
      file,
      {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
      }
    );


  // ---------------------------------------------------------
  // HANDLE STORAGE ERROR
  // ---------------------------------------------------------

  if (error) {

    console.error(
      "SUPABASE STORAGE ERROR:",
      error
    );

    console.error(
      "Storage error message:",
      error.message
    );

    console.error(
      "Storage error status:",
      error.status
    );

    console.error(
      "Storage error statusCode:",
      error.statusCode
    );

    console.error(
      "Storage error name:",
      error.error
    );

    throw new Error(
      error.message ||
      "Profile image upload failed."
    );
  }


  // ---------------------------------------------------------
  // GET PUBLIC URL
  // ---------------------------------------------------------

  const {
    data: publicUrlData
  } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);


  const publicUrl =
    publicUrlData?.publicUrl;

  
  if (!publicUrl) {
    throw new Error(
      "Image uploaded, but its public URL could not be created."
    );
  }


  console.log(
    "Avatar uploaded successfully:",
    publicUrl
  );


  return publicUrl;
}

export async function listCustomerProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, username, phone, gender, birth_date, avatar_url, role, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Customer profiles could not be loaded.");
  }

  return data || [];
}

export async function requireAuth(options = {}) {
  const { allowedRoles = ["customer", "owner"], requireVerifiedEmail = true } =
    options;
  const user = await getCurrentUser();

  if (!user) {
    window.location.replace(createLoginRedirect());
    return null;
  }

  if (requireVerifiedEmail && !user.email_confirmed_at) {
    sessionStorage.setItem("esweets-verification-email", user.email || "");
    window.location.replace("verify-email.html");
    return null;
  }

  const profile = await getCustomerProfile(user.id);

  if (!allowedRoles.includes(profile.role)) {
    window.location.replace("account.html");
    return null;
  }

  return { user, profile };
}

export function watchAuthState(callback) {
  const { data } = supabase.auth.onAuthStateChange(
    function handleAuthChange(event, session) {
      callback(session?.user || null, event);
    },
  );

  return function unsubscribeFromAuthState() {
    data.subscription.unsubscribe();
  };
}
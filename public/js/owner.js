import { supabase } from "./supabase.js";

/*
|--------------------------------------------------------------------------
| Authentication Messages
|--------------------------------------------------------------------------
*/

const AUTH_MESSAGES = {
  invalid_credentials:
    "Incorrect email or password.",

  invalid_login_credentials:
    "Incorrect email or password.",

  email_not_confirmed:
    "Verify your email before logging in.",

  user_already_exists:
    "That email is already registered.",

  weak_password:
    "Use a stronger password with at least 8 characters.",

  password_too_short:
    "Use a stronger password with at least 8 characters.",

  over_request_rate_limit:
    "Too many attempts. Please try again later.",
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeName(fullName) {
  return String(fullName || "").trim();
}

function createPageUrl(pageName) {
  return new URL(
    pageName,
    window.location.href,
  ).href;
}

function createFriendlyAuthError(error) {
  const code =
    error?.code ||
    "unknown_auth_error";

  const message =
    AUTH_MESSAGES[code] ||
    error?.message ||
    "Something went wrong. Please try again.";

  const friendlyError =
    new Error(message);

  friendlyError.code = code;

  return friendlyError;
}

/*
|--------------------------------------------------------------------------
| Login Redirect
|--------------------------------------------------------------------------
*/

export function createLoginRedirect() {
  const currentPage =
    window.location.pathname
      .split("/")
      .pop() ||
    "account.html";

  return (
    `login.html?redirect=${encodeURIComponent(
      currentPage,
    )}`
  );
}

/*
|--------------------------------------------------------------------------
| Register
|--------------------------------------------------------------------------
*/

export async function registerUser(
  email,
  password,
  fullName,
) {
  const normalizedEmail =
    normalizeEmail(email);

  const normalizedName =
    normalizeName(fullName);

  if (!normalizedEmail) {
    throw new Error(
      "Please enter your email.",
    );
  }

  if (!normalizedName) {
    throw new Error(
      "Please enter your full name.",
    );
  }

  if (normalizedName.length < 2) {
    throw new Error(
      "Your name must contain at least 2 characters.",
    );
  }

  if (normalizedName.length > 100) {
    throw new Error(
      "Your name is too long.",
    );
  }

  if (
    !password ||
    password.length < 8
  ) {
    throw new Error(
      "Use a stronger password with at least 8 characters.",
    );
  }

  const { data, error } =
    await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: normalizedName,
        },

        emailRedirectTo:
          createPageUrl(
            "account.html",
          ),
      },
    });

  if (error) {
    throw createFriendlyAuthError(error);
  }

  sessionStorage.setItem(
    "esweets-verification-email",
    normalizedEmail,
  );

  return {
    user: data?.user || null,
    session: data?.session || null,
    needsEmailVerification:
      !data?.session,
  };
}

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

export async function loginUser(
  email,
  password,
) {
  const normalizedEmail =
    normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error(
      "Please enter your email.",
    );
  }

  if (!password) {
    throw new Error(
      "Please enter your password.",
    );
  }

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (error) {
    if (
      error.code ===
      "email_not_confirmed"
    ) {
      sessionStorage.setItem(
        "esweets-verification-email",
        normalizedEmail,
      );
    }

    throw createFriendlyAuthError(error);
  }

  sessionStorage.removeItem(
    "esweets-verification-email",
  );

  return data.user;
}

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

export async function logoutUser() {
  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw createFriendlyAuthError(error);
  }

  sessionStorage.removeItem(
    "esweets-verification-email",
  );
}

/*
|--------------------------------------------------------------------------
| Reset Password
|--------------------------------------------------------------------------
*/

export async function resetPassword(
  email,
) {
  const normalizedEmail =
    normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error(
      "Please enter your email.",
    );
  }

  const { error } =
    await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo:
          createPageUrl(
            "update-password.html",
          ),
      },
    );

  if (error) {
    throw createFriendlyAuthError(error);
  }
}

/*
|--------------------------------------------------------------------------
| Update Password
|--------------------------------------------------------------------------
*/

export async function updatePassword(
  newPassword,
) {
  if (
    !newPassword ||
    newPassword.length < 8
  ) {
    throw new Error(
      "Use a stronger password with at least 8 characters.",
    );
  }

  const { error } =
    await supabase.auth.updateUser({
      password: newPassword,
    });

  if (error) {
    throw createFriendlyAuthError(error);
  }
}

/*
|--------------------------------------------------------------------------
| Resend Verification
|--------------------------------------------------------------------------
*/

export async function resendVerificationEmail(
  email,
) {
  const normalizedEmail =
    normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error(
      "Please enter your email.",
    );
  }

  const { error } =
    await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,

      options: {
        emailRedirectTo:
          createPageUrl(
            "account.html",
          ),
      },
    });

  if (error) {
    throw createFriendlyAuthError(error);
  }

  sessionStorage.setItem(
    "esweets-verification-email",
    normalizedEmail,
  );
}

/*
|--------------------------------------------------------------------------
| Get Current User
|--------------------------------------------------------------------------
*/

export async function getCurrentUser() {
  const {
    data,
    error,
  } =
    await supabase.auth.getUser();

  if (error || !data?.user) {
    return null;
  }

  return data.user;
}

/*
|--------------------------------------------------------------------------
| Get Current Customer Profile
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| This function no longer accepts userId.
|
| Supabase Auth determines the current user.
|
*/

export async function getCustomerProfile() {
  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError || !user) {
    const error = new Error(
      "You are not signed in.",
    );

    error.code =
      "not_authenticated";

    error.status = 401;

    throw error;
  }

  const { data, error } =
    await supabase
      .from("profiles")
      .select(
        "id, email, full_name, role, created_at, updated_at",
      )
      .eq("id", user.id)
      .maybeSingle();

  if (error) {
    console.error(
      "Profile loading failed:",
      error,
    );

    throw new Error(
      "Your customer profile could not be loaded.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Normally the database trigger creates this row.
  |--------------------------------------------------------------------------
  */

  if (!data) {
    return {
      id: user.id,
      email: user.email || "",
      full_name:
        user.user_metadata?.full_name ||
        "",
      role: "customer",
      created_at:
        user.created_at,
      updated_at:
        user.updated_at ||
        user.created_at,
    };
  }

  return data;
}

/*
|--------------------------------------------------------------------------
| Update Customer Profile
|--------------------------------------------------------------------------
*/

export async function updateCustomerProfile(
  fullName,
) {
  const normalizedName =
    normalizeName(fullName);

  if (!normalizedName) {
    throw new Error(
      "Please enter your full name.",
    );
  }

  if (normalizedName.length < 2) {
    throw new Error(
      "Your name must contain at least 2 characters.",
    );
  }

  if (normalizedName.length > 100) {
    throw new Error(
      "Your name is too long.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Get the authenticated Supabase user.
  |--------------------------------------------------------------------------
  */

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError || !user) {
    const error = new Error(
      "You are not signed in.",
    );

    error.code =
      "not_authenticated";

    error.status = 401;

    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Update only the current user's profile.
  |--------------------------------------------------------------------------
  */

  const { data, error } =
    await supabase
      .from("profiles")
      .update({
        full_name:
          normalizedName,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", user.id)
      .select(
        "id, email, full_name, role, created_at, updated_at",
      )
      .single();

  if (error) {
    console.error(
      "Profile update failed:",
      error,
    );

    throw new Error(
      "Your profile could not be updated.",
    );
  }

  return data;
}

/*
|--------------------------------------------------------------------------
| List Customer Profiles
|--------------------------------------------------------------------------
|
| OWNER ONLY
|
*/

export async function listCustomerProfiles() {
  const user =
    await getCurrentUser();

  if (!user) {
    const error = new Error(
      "You are not signed in.",
    );

    error.code =
      "not_authenticated";

    error.status = 401;

    throw error;
  }

  const profile =
    await getCustomerProfile();

  if (
    profile.role !==
    "owner"
  ) {
    const error = new Error(
      "You are not authorized to view customer profiles.",
    );

    error.code =
      "forbidden";

    error.status = 403;

    throw error;
  }

  const { data, error } =
    await supabase
      .from("profiles")
      .select(
        "id, email, full_name, role, created_at",
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      );

  if (error) {
    console.error(
      "Customer profile query failed:",
      error,
    );

    throw new Error(
      "Customer profiles could not be loaded.",
    );
  }

  return data || [];
}

/*
|--------------------------------------------------------------------------
| Require Authentication
|--------------------------------------------------------------------------
*/

export async function requireAuth(
  options = {},
) {
  const {
    allowedRoles = [
      "customer",
      "owner",
    ],

    requireVerifiedEmail = false,
  } = options;

  const user =
    await getCurrentUser();

  /*
  |--------------------------------------------------------------------------
  | Not authenticated
  |--------------------------------------------------------------------------
  */

  if (!user) {
    window.location.replace(
      createLoginRedirect(),
    );

    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | Email verification
  |--------------------------------------------------------------------------
  */

  if (
    requireVerifiedEmail &&
    !user.email_confirmed_at
  ) {
    sessionStorage.setItem(
      "esweets-verification-email",
      user.email || "",
    );

    window.location.replace(
      "verify-email.html",
    );

    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | Get profile
  |--------------------------------------------------------------------------
  */

  const profile =
    await getCustomerProfile();

  /*
  |--------------------------------------------------------------------------
  | Role authorization
  |--------------------------------------------------------------------------
  */

  if (
    !allowedRoles.includes(
      profile.role,
    )
  ) {
    const currentPage =
      window.location.pathname
        .split("/")
        .pop();

    /*
    | Prevent redirect loops.
    */

    if (
      currentPage !==
      "account.html"
    ) {
      window.location.replace(
        "account.html",
      );
    }

    return null;
  }

  return {
    user,
    profile,
  };
}

/*
|--------------------------------------------------------------------------
| Authentication State Listener
|--------------------------------------------------------------------------
*/

export function watchAuthState(
  callback,
) {
  if (
    typeof callback !==
    "function"
  ) {
    throw new TypeError(
      "watchAuthState requires a callback function.",
    );
  }

  const { data } =
    supabase.auth.onAuthStateChange(
      (
        event,
        session,
      ) => {
        callback(
          session?.user || null,
          event,
        );
      },
    );

  return function unsubscribeFromAuthState() {
    data?.subscription?.unsubscribe();
  };
}
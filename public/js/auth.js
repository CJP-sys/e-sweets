import { supabase } from "./supabase.js";

const AUTH_MESSAGES = {
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Verify your email before logging in.",
  user_already_exists: "That email is already registered.",
  weak_password: "Use a stronger password with at least 8 characters.",
};

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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: createPageUrl("account.html"),
    },
  });

  if (error) {
    throw createFriendlyAuthError(error);
  }

  sessionStorage.setItem("esweets-verification-email", email);
  return {
    user: data.user,
    session: data.session,
    needsEmailVerification: !data.session,
  };
}

export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      sessionStorage.setItem("esweets-verification-email", email);
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
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at, updated_at")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      const user = await getCurrentUser();
      if (user?.id === userId) {
        return {
          id: user.id,
          email: user.email || "",
          full_name: user.user_metadata?.full_name || "",
          role: "customer",
          created_at: user.created_at,
          updated_at: user.updated_at || user.created_at,
        };
      }
    }
    throw new Error("Your customer profile could not be loaded.");
  }

  return data;
}

// Note: no longer takes a userId argument. The current Supabase session
// is resolved internally so the page can never accidentally (or
// maliciously) update a profile that isn't the signed-in user's — this
// is a defense-in-depth measure on top of the RLS policy
// (auth.uid() = id) that already enforces this at the database level.
export async function updateCustomerProfile(fullName) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You are not signed in.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("id, email, full_name, role, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No profile row existed yet (e.g. the auto-create trigger hasn't
      // run or was added after this account was created). Fall back to
      // storing the name on the auth user's metadata, then re-read.
      const { data: authData, error: authError } = await supabase.auth.updateUser(
        { data: { full_name: fullName } },
      );

      if (!authError && authData.user) {
        return getCustomerProfile(user.id);
      }
    }
    throw new Error("Your profile could not be updated.");
  }

  return data;
}

export async function listCustomerProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Customer profiles could not be loaded.");
  }

  return data;
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
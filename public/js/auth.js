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
    throw new Error("Your customer profile could not be loaded.");
  }

  return data;
}

export async function updateCustomerProfile(userId, fullName) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id, email, full_name, role, created_at, updated_at")
    .single();

  if (error) {
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

function createLoginRedirect() {
  const currentPage = window.location.pathname.split("/").pop();
  return `login.html?redirect=${encodeURIComponent(currentPage || "account.html")}`;
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

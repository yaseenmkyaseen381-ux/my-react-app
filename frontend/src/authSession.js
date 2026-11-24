const keys = {
  user: { token: "mobix.userToken", profile: "mobix.user" },
  admin: { token: "mobix.adminToken", profile: "mobix.admin" },
};

function migrateLegacySession() {
  const oldToken = localStorage.getItem("token");
  let oldUser = null;
  try {
    oldUser = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    /* discard malformed legacy profile */
  }
  if (oldToken && oldUser?.role && keys[oldUser.role]) {
    const target = keys[oldUser.role];
    if (!localStorage.getItem(target.token))
      localStorage.setItem(target.token, oldToken);
    if (!localStorage.getItem(target.profile))
      localStorage.setItem(target.profile, JSON.stringify(oldUser));
  }
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

migrateLegacySession();

export const getSessionToken = (role) =>
  localStorage.getItem(
    keys[
      role || (window.location.pathname.startsWith("/admin") ? "admin" : "user")
    ].token,
  );

export function getSessionUser(role) {
  try {
    return JSON.parse(localStorage.getItem(keys[role].profile) || "null");
  } catch {
    localStorage.removeItem(keys[role].profile);
    localStorage.removeItem(keys[role].token);
    return null;
  }
}

export function saveSession(role, token, user) {
  localStorage.setItem(keys[role].token, token);
  localStorage.setItem(keys[role].profile, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent(`mobix-${role}-session-updated`));
}

export function clearSession(role) {
  localStorage.removeItem(keys[role].token);
  localStorage.removeItem(keys[role].profile);
  window.dispatchEvent(new CustomEvent(`mobix-${role}-session-updated`));
}
